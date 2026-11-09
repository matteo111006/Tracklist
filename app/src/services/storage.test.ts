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
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
}
const disk = new MemoryStorage();
Object.assign(globalThis, { localStorage: disk, window: new EventTarget() });
mock.timers.enable({ apis: ['setTimeout'] });
const { storage } = await import('./storage');
const { persistence, packSnapshot, unpackSnapshot } = await import('./persistence');
const { encodeLocalValue, decodeLocalValue } = await import('./persistence');
const originalFetch = globalThis.fetch;
test('quota recovery compacts previous encodings without deleting account data', async () => {
  const { zlibSync, strToU8 } = await import('fflate');
  const text = JSON.stringify({ value: 'Album e voti 🎵'.repeat(10000) });
  const legacy = '~tracklist-z1:' + Buffer.from(zlibSync(strToU8(text), { level: 1 })).toString('base64');
  const legacyKey = 'tracklist_sync_baseline:account:other-account';
  disk.setItem(legacyKey, legacy);
  const previousSize = [...disk.data.values()].reduce((sum, value) => sum + value.length, 0);
  const write = disk.setItem.bind(disk);
  disk.setItem = (key, value) => {
    const total = [...disk.data].reduce((sum, [k, v]) => sum + (k === key ? 0 : v.length), 0) + value.length;
    if (total > previousSize + 5) throw new DOMException('quota', 'QuotaExceededError');
    write(key, value);
  };
  try {
    persistence.setItem('tracklist_profile_v5', JSON.stringify({ name: 'Saved after compaction', description: 'New rating'.repeat(10) }));
    assert.equal(decodeLocalValue(disk.getItem(legacyKey)), text);
    assert.ok(disk.getItem(legacyKey)!.length < legacy.length);
    assert.equal(JSON.parse(persistence.getItem('tracklist_profile_v5')!).name, 'Saved after compaction');
  } finally { disk.setItem = write; }
});

test('compact format uses less space than fast base64 and preserves nonrepetitive Unicode', async () => {
  const { zlibSync, strToU8 } = await import('fflate');
  const text = JSON.stringify(Array.from({ length: 10000 }, (_, i) => `${i} · ${String.fromCharCode(32 + (i * 631) % 40000)} 🎵`));
  const old = '~tracklist-z1:' + Buffer.from(zlibSync(strToU8(text), { level: 1 })).toString('base64');
  const compact = encodeLocalValue(text);
  assert.equal(decodeLocalValue(old), text);
  assert.equal(decodeLocalValue(compact), text);
  assert.ok(compact.length < old.length * .5);
});
test('fast compression preserves Unicode and reads the previous browser format', async () => {
  const { default: legacy } = await import('lz-string');
  const text = JSON.stringify({ description: 'Città, musica 🎵, 日本語'.repeat(2000) });
  assert.equal(decodeLocalValue(encodeLocalValue(text)), text);
  assert.equal(decodeLocalValue('~tracklist-lz1:' + legacy.compressToUTF16(text)), text);
});

test('cached reads detect another tab changing or removing the stored value', () => {
  persistence.setItem('tracklist_profile_v5', '{"name":"First"}');
  assert.equal(persistence.getItem('tracklist_profile_v5'), '{"name":"First"}');
  const key = `tracklist_profile_v5:account:${persistence.account}`;
  disk.setItem(key, '{"name":"Second"}');
  assert.equal(persistence.getItem('tracklist_profile_v5'), '{"name":"Second"}');
  disk.removeItem(key);
  assert.notEqual(persistence.getItem('tracklist_profile_v5'), '{"name":"Second"}');
});

test('applying the same snapshot does not rewrite browser storage or publish updates', () => {
  const snapshot = storage.getSnapshot();
  let updates = 0;
  const listener = () => updates++;
  window.addEventListener('tracklist:albums_updated', listener);
  disk.fail = true;
  try { assert.doesNotThrow(() => storage.applySnapshot(snapshot)); assert.equal(updates, 0); }
  finally { disk.fail = false; window.removeEventListener('tracklist:albums_updated', listener); }
});
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

test('rating updates keep current votes without creating album history', () => {
  const first = storage.getAlbums()[0];
  storage.saveRelisten(first.id, Object.fromEntries(first.tracks.map(t => [t.id, 0])), 'A fresh perspective');
  const saved = storage.getAlbums().find(a => a.id === first.id)!;
  assert.ok(saved.tracks.every(t => t.rating === 0));
  assert.equal(saved.history, undefined);
  const before = structuredClone(saved);
  disk.fail = true;
  assert.throws(() => storage.updateTrackRating(first.id, first.tracks[0].id, 8));
  disk.fail = false;
  assert.deepEqual(storage.getAlbums().find(a => a.id === first.id), before);
});

test('current ratings, discovery feedback and ordered dream tracklists round-trip in private backups', () => {
  const album = storage.getAlbums()[0];
  storage.updateTrackRating(album.id, album.tracks[0].id, 5);
  storage.saveProfile({ ...storage.getProfile(), experiences: { discovery: { [album.id]: 'interested' } } });
  const col = { id: 'dream', name: 'Dream', description: '', albumIds: [album.id], isPublic: false, createdAt: '2026-11-08', dreamTracklist: { theme: '#c7ff36', tracks: album.tracks.map(t => ({ albumId: album.id, trackId: t.id })).reverse() } };
  storage.saveCollection(col);
  const backup = storage.exportDataJSON();
  storage.importDataJSON(backup);
  assert.equal(storage.getAlbums()[0].history, undefined);
  assert.equal(storage.getAlbums()[0].tracks[0].rating, 5);
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
