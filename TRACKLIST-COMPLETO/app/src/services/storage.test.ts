import test, { beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { initialAlbums, initialArtists } from '../../test/fixtures';

class MemoryStorage {
  data = new Map<string, string>();
  fail = false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('quota'); this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); this.fail = false; }
}
const disk = new MemoryStorage();
Object.assign(globalThis, { localStorage: disk, window: new EventTarget() });
mock.timers.enable({ apis: ['setTimeout'] });
const { storage } = await import('./storage');
const { persistence, packSnapshot, unpackSnapshot } = await import('./persistence');
const { encodeLocalValue, decodeLocalValue } = await import('./persistence');
const originalFetch = globalThis.fetch;
beforeEach(() => {
  storage.setAuthUser(null); disk.clear();
  storage.applySnapshot({ albums: structuredClone(initialAlbums), artists: structuredClone(initialArtists), collections: [], profile: { id: 'fixture', name: 'Fixture', email: '' }, deletedAlbumIds: [], timelineOverrides: {} });
});
afterEach(() => { disk.fail = false; globalThis.fetch = originalFetch; storage.setAuthUser(null); });
const login = () => { storage.setAuthUser({ id: 'test-user', name: 'Test', email: 'test@example.test' }, true); storage.setAuthToken('test-token'); };

test('saved library views and AI follow-ups persist in private backups and retain timestamps', () => {
  const view = { id: 'saved-view', name: 'Standards', createdAt: '2026-11-08T12:00:00Z', filters: { search: '', artist: 'all', edition: 'standard', sort: 'voto' as const, year: 'all' as const, status: 'confirmed' as const } };
  storage.saveProfile({ ...storage.getProfile(), savedViews: [view] });
  const result = { text: 'My first answer', albumIds: [], recommendations: [], model: 'test', includedAlbums: 1, totalAlbums: 1, generatedAt: '2026-11-08T12:00:00Z' };
  const first = storage.saveAiTurn({ feature: 'archive', question: 'My first question' }, result);
  const second = storage.saveAiTurn({ feature: 'archive', question: 'Follow-up', conversationId: first.id }, { ...result, text: 'Updated answer' });
  assert.equal(second.id, first.id); assert.equal(second.messages.length, 2);
  assert.equal(second.messages[0].generatedAt, result.generatedAt);
  assert.ok(second.messages[0].catalogFingerprint);
  const backup = storage.exportDataJSON();
  storage.saveProfile({ ...storage.getProfile(), savedViews: [], aiConversations: [] });
  storage.importDataJSON(backup);
  assert.deepEqual(storage.getProfile().savedViews, [view]);
  assert.equal(storage.getProfile().aiConversations?.[0].messages[1].text, 'Updated answer');
  storage.setAuthUser({ id: 'another-account', name: 'Other', email: 'other@example.test' });
  assert.equal(storage.getProfile().aiConversations, undefined);
  assert.throws(() => storage.saveAiTurn({ feature: 'archive', question: 'Cross-account?', conversationId: first.id }, result), /non disponibile/);
});
test('AI conversation history bounds new threads and the number of retained replies', () => {
  const result = { text: 'Answer', albumIds: [], recommendations: [], model: 'test', includedAlbums: 1, totalAlbums: 1 };
  let last: any;
  for (let i = 0; i < 25; i++) last = storage.saveAiTurn({ feature: 'archive', question: `Question ${i}` }, result);
  assert.equal(storage.getProfile().aiConversations?.length, 20);
  for (let i = 0; i < 15; i++) last = storage.saveAiTurn({ feature: 'archive', question: `Follow-up ${i}`, conversationId: last.id }, result);
  assert.equal(last.messages.length, 12); assert.equal(last.messages.at(-1).question, 'Follow-up 14');
});

test('large local snapshots compress losslessly with Unicode and old uncompressed values remain readable', () => {
  const text = JSON.stringify({ data: 'È la musica 🎵 — 0,25'.repeat(3000) });
  const encoded = encodeLocalValue(text);
  assert.ok(encoded.length < text.length / 3);
  assert.equal(decodeLocalValue(encoded), text);
  assert.equal(decodeLocalValue(text), text);
  assert.equal(decodeLocalValue(null), null);
  persistence.setItem('tracklist_sync_baseline', text);
  assert.equal(persistence.getItem('tracklist_sync_baseline'), text);
});

test('relistening preserves previous scores, does not journal other albums, and restore survives reload', () => {
  const first = storage.getAlbums()[0];
  storage.saveAlbum({ ...structuredClone(first), id: 'other-album' });
  storage.saveRelisten(first.id, Object.fromEntries(first.tracks.map(t => [t.id, 0])), 'A fresh perspective');
  let album = storage.getAlbums().find(a => a.id === first.id)!;
  assert.equal(album.history?.length, 2);
  assert.equal(album.history?.[0].state.tracks[0].rating, first.tracks[0].rating);
  assert.equal(album.history?.[1].kind, 'relisten');
  assert.equal(storage.getAlbums().find(a => a.id === 'other-album')?.history, undefined);
  storage.restoreAlbumRevision(first.id, album.history![0].id);
  album = storage.getAlbums().find(a => a.id === first.id)!;
  assert.equal(album.tracks[0].rating, first.tracks[0].rating);
  assert.equal(album.history?.at(-1)?.kind, 'restore');
  assert.equal(album.history?.length, 3);
});
test('unchanged relistening still creates an entry, failed writes preserve the whole prior history', () => {
  const first = storage.getAlbums()[0];
  const ratings = Object.fromEntries(first.tracks.map(t => [t.id, t.rating]));
  storage.saveRelisten(first.id, ratings, 'Same judgment');
  storage.saveRelisten(first.id, ratings, 'Another listen');
  const before = storage.getAlbums()[0];
  assert.equal(before.history?.length, 3);
  disk.fail = true;
  assert.throws(() => storage.saveRelisten(first.id, ratings, 'Must fail'));
  disk.fail = false;
  assert.deepEqual(storage.getAlbums()[0], before);
});
test('history, discovery feedback and ordered dream tracklists round-trip in private backups', () => {
  const album = storage.getAlbums()[0];
  storage.updateTrackRating(album.id, album.tracks[0].id, 5);
  storage.saveProfile({ ...storage.getProfile(), experiences: { discovery: { [album.id]: 'interested' } } });
  const col = { id: 'dream', name: 'Dream', description: '', albumIds: [album.id], isPublic: false, createdAt: '2026-11-08', dreamTracklist: { theme: '#c7ff36', tracks: album.tracks.map(t => ({ albumId: album.id, trackId: t.id })).reverse() } };
  storage.saveCollection(col);
  const backup = storage.exportDataJSON();
  storage.importDataJSON(backup);
  assert.equal(storage.getAlbums()[0].history?.length, 2);
  assert.deepEqual(storage.getCollections()[0], col);
  assert.equal(storage.getProfile().experiences?.discovery?.[album.id], 'interested');
  storage.setAuthUser({ id: 'other-user', name: 'Other', email: 'other@example.test' });
  assert.equal(storage.getProfile().experiences, undefined);
  assert.equal(storage.getAlbums().length, 0);
});

test('first initialization is nonrecursive and starts with an empty private catalog', () => {
  disk.clear();
  assert.equal(storage.getAlbums().length, 0);
  assert.equal(storage.getArtists().length, 0);
  assert.ok((disk.getItem('tracklist_albums_v5:account:guest') || '').length < 400000);
});
test('ratings, review, metadata and completion survive a fresh read', () => {
  const album = storage.getAlbums()[0];
  const track = album.tracks[0];
  storage.updateTrackRating(album.id, track.id, 7.25);
  storage.confirmAlbumCompleted(album.id, { [track.id]: 9.75 });
  let reloaded = storage.getAlbums().find(a => a.id === album.id)!;
  assert.equal(reloaded.tracks[0].rating, 9.75);
  assert.equal(reloaded.evaluationStatus, 'completed');
  storage.saveAlbum({ ...reloaded, title: 'TITOLO MODIFICATO', review: { id: 'r', albumId: album.id, text: 'Recensione persistente', date: '2026-11-08' } });
  reloaded = storage.getAlbums().find(a => a.id === album.id)!;
  assert.equal(reloaded.title, 'TITOLO MODIFICATO');
  assert.equal(reloaded.review?.text, 'Recensione persistente');
  assert.equal(reloaded.tracks[0].rating, 9.75);
});
test('empty catalogs do not unexpectedly reappear', () => {
  persistence.setItem('tracklist_albums_v5', '[]');
  persistence.setItem('tracklist_artists_v5', '[]');
  assert.deepEqual(storage.getAlbums(), []);
  assert.deepEqual(storage.getArtists(), []);
});
test('failed browser writes throw and announce failure instead of reporting saved', () => {
  storage.getAlbums();
  let failure = '';
  const onError = (e: Event) => { failure = (e as CustomEvent).detail; };
  window.addEventListener('tracklist:storage_error', onError);
  const album = storage.getAlbums()[0];
  disk.fail = true;
  assert.throws(() => storage.updateTrackRating(album.id, album.tracks[0].id, 8), /Salvataggio non riuscito/);
  assert.match(failure, /spazio del browser/);
  disk.fail = false;
  assert.notEqual(storage.getAlbums()[0].tracks[0].rating, 8);
  window.removeEventListener('tracklist:storage_error', onError);
});
test('different accounts and guest retain separate local data', () => {
  storage.saveProfile({ id: 'guest', name: 'Guest', email: '' });
  login();
  storage.saveProfile({ id: 'test-user', name: 'Alice', email: 'a@example.test' });
  storage.setAuthUser(null);
  assert.equal(storage.getProfile().name, 'Guest');
  storage.setAuthUser({ id: 'other', name: 'Bob', email: 'b@example.test' });
  assert.notEqual(storage.getProfile().name, 'Alice');
  assert.deepEqual(storage.getAlbums(), []);
  assert.deepEqual(storage.getArtists(), []);
  assert.deepEqual(storage.getCollections(), []);
  storage.setAuthUser({ id: 'test-user', name: 'Alice', email: 'a@example.test' });
  assert.equal(storage.getProfile().name, 'Alice');
});
test('offline edits merge with remote edits, including different tracks in one album', async () => {
  login();
  const baseline = storage.getSnapshot();
  persistence.setItem('tracklist_sync_baseline', JSON.stringify(packSnapshot(baseline)));
  const album = baseline.albums.find((a: any) => a.tracks.length > 1);
  const localTrack = album.tracks[0];
  const remoteTrack = album.tracks[1];
  storage.updateTrackRating(album.id, localTrack.id, 7.25);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await storage.pushToCloud(), false);
  assert.equal(persistence.getItem('tracklist_sync_dirty'), 'true');
  const remote = structuredClone(baseline);
  remote.albums.find((a: any) => a.id === album.id).tracks[1].rating = 8.75;
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') { sent = JSON.parse(init.body as string); return Response.json({ success: true }); }
    return Response.json({ exists: true, data: remote, revision: 5 });
  };
  assert.equal(await storage.pullFromCloud(), true);
  const saved = storage.getAlbums().find(a => a.id === album.id)!;
  assert.equal(saved.tracks.find(t => t.id === localTrack.id)?.rating, 7.25);
  assert.equal(saved.tracks.find(t => t.id === remoteTrack.id)?.rating, 8.75);
  assert.equal(sent.expectedRevision, 5);
  assert.equal(persistence.getItem('tracklist_sync_dirty'), 'false');
});
test('edits made during a network save remain pending and persist', async () => {
  login();
  const baseline = storage.getSnapshot();
  persistence.setItem('tracklist_sync_baseline', JSON.stringify(packSnapshot(baseline)));
  const album = baseline.albums[0];
  storage.updateTrackRating(album.id, album.tracks[0].id, 6.5);
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') {
      storage.updateTrackRating(album.id, album.tracks[0].id, 9.25);
      return Response.json({ success: true });
    }
    return Response.json({ exists: true, data: baseline, revision: 1 });
  };
  assert.equal(await storage.pushToCloud(), true);
  assert.equal(storage.getAlbums()[0].tracks[0].rating, 9.25);
  assert.equal(persistence.getItem('tracklist_sync_dirty'), 'true');
});
test('revision conflicts trigger a reread and merge instead of replacing remote data', async () => {
  login();
  const snapshot = storage.getSnapshot();
  let posts = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') return ++posts === 1 ? Response.json({}, { status: 409 }) : Response.json({ success: true });
    return Response.json({ exists: true, data: snapshot, revision: posts + 1 });
  };
  assert.equal(await storage.pushToCloud(), true);
  assert.equal(posts, 2);
});
test('backups round-trip collections, timeline and deleted-album state', () => {
  storage.saveCollection({ id: 'c', name: 'Collection', description: '', albumIds: [], isPublic: false, createdAt: '2026-11-08' });
  storage.saveArtistTimelineOverrides('Artist', { hiddenIds: ['hidden'], customAlbums: [], editedAlbums: {} });
  const json = storage.exportDataJSON();
  storage.resetToDefault();
  storage.importDataJSON(json);
  assert.equal(storage.getCollections()[0].name, 'Collection');
  assert.deepEqual(storage.getArtistTimelineOverrides('Artist').hiddenIds, ['hidden']);
});
test('seed compression round-trips modified and removed fields', () => {
  const original = structuredClone(initialAlbums[0]);
  delete original.review;
  original.title = 'Modified';
  const value = { albums: [original] };
  assert.deepEqual(unpackSnapshot(packSnapshot(value)), value);
});
test('late automatic artist updates cannot remove manual customizations', () => {
  const artist = storage.getArtists()[0];
  storage.saveArtist({ ...artist, bio: 'My biography', imageUrl: 'my-photo', isManualBio: true, isManualImage: true });
  storage.saveArtist({ ...artist, bio: 'Late biography', imageUrl: 'automatic-photo', isManualBio: false, isManualImage: false });
  const saved = storage.getArtists().find(a => a.id === artist.id)!;
  assert.equal(saved.bio, 'My biography');
  assert.equal(saved.imageUrl, 'my-photo');
  assert.equal(saved.isManualBio, true);
  assert.equal(saved.isManualImage, true);
});
test('undo restores both votes and collection memberships', () => {
  const album = storage.getAlbums()[0];
  storage.saveCollection({ id: 'undo-test', name: 'Undo', description: '', albumIds: [album.id], isPublic: false, createdAt: '2026-11-08' });
  const { deletedAlbum } = storage.deleteAlbum(album.id);
  assert.equal(storage.getAlbums().some(a => a.id === album.id), false);
  assert.deepEqual(storage.getCollections().find(c => c.id === 'undo-test')?.albumIds, []);
  storage.undoDeleteAlbum(album.id, deletedAlbum!);
  assert.deepEqual(storage.getCollections().find(c => c.id === 'undo-test')?.albumIds, [album.id]);
  assert.deepEqual(storage.getAlbums().find(a => a.id === album.id)?.tracks, album.tracks);
});
test('v4 browser profile is retained when migrating to account-isolated storage', () => {
  disk.clear();
  disk.setItem('tracklist_profile_v4', JSON.stringify({ id: 'old', name: 'Legacy profile', email: 'legacy@example.test' }));
  storage.setAuthUser(null);
  assert.equal(storage.getProfile().name, 'Legacy profile');
});
test('unsent writes are recovered even if the browser closed before setting the dirty flag', async () => {
  login();
  const baseline = storage.getSnapshot();
  persistence.setItem('tracklist_sync_baseline', JSON.stringify(packSnapshot(baseline)));
  const edited = structuredClone(baseline);
  edited.albums[0].tracks[0].rating = 8.25;
  persistence.setItem('tracklist_albums_v5', JSON.stringify(edited.albums));
  persistence.setItem('tracklist_sync_dirty', 'false');
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') { sent = JSON.parse(init.body as string); return Response.json({ success: true }); }
    return Response.json({ exists: true, data: baseline, revision: 1 });
  };
  assert.equal(await storage.pullFromCloud(), true);
  assert.equal(sent.data.albums[0].tracks[0].rating, 8.25);
});
