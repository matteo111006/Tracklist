import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAlbums, initialArtists } from '../../test/fixtures';
import { inLibraryView, mergeRatingDraft, musicFingerprint, parseQuickRating, readAppRoute, routeUrl, searchOwnArchive } from './usability';
import { validateExperienceData } from './experienceValidation';

test('routes survive direct links with Unicode and track selection and reject invalid views', () => {
  const artist = { view: 'artista_detail' as const, artist: { id: 'artist/&', name: 'È un artista & amici' } };
  assert.deepEqual(readAppRoute(routeUrl(artist)), artist);
  const track = { view: 'album_detail' as const, albumId: 'a/#', trackId: 'tr?/' };
  assert.deepEqual(readAppRoute(routeUrl(track)), track);
  assert.deepEqual(readAppRoute('?view=unknown'), { view: 'esperienze' });
  assert.deepEqual(readAppRoute('?view=album_detail'), { view: 'classifica' });
});
test('global search finds albums, artists and exact tracks without showing deleted albums', () => {
  const album = structuredClone(initialAlbums[0]); album.title = 'È un disco'; album.tracks[0].title = 'È la traccia';
  const hidden = { ...structuredClone(album), id: 'hidden', title: 'Hidden', deleted: true };
  assert.ok(searchOwnArchive([album, hidden], initialArtists, 'e un disco', 'album').some(r => r.route.albumId === album.id));
  const hit = searchOwnArchive([album], initialArtists, 'e la traccia', 'track')[0];
  assert.equal(hit.route.trackId, album.tracks[0].id);
  assert.equal(searchOwnArchive([album, hidden], initialArtists, 'Hidden').length, 0);
  assert.equal(searchOwnArchive([album], initialArtists, 'Test Artist', 'artist')[0].route.view, 'artista_detail');
  assert.equal(searchOwnArchive([album], initialArtists, '').length, 0);
});
test('keyboard ratings accept comma and zero and reject invalid or out-of-range votes', () => {
  assert.equal(parseQuickRating('0'), 0); assert.equal(parseQuickRating('8,25'), 8.25); assert.equal(parseQuickRating('10.00'), 10); assert.equal(parseQuickRating(''), null);
  for (const value of ['-1', '11', '8.1', '8,123', 'Infinity', '8abc', '1e1']) assert.throws(() => parseQuickRating(value));
});
test('rapid rating saves retain untouched remote votes and reject same-track conflicts', () => {
  assert.deepEqual(mergeRatingDraft({ a: 7, b: 8 }, { a: 9, b: 8 }, { a: 7, b: 10 }), { a: 9, b: 10 });
  assert.throws(() => mergeRatingDraft({ a: 7 }, { a: 9 }, { a: 8 }), /altro dispositivo/);
  assert.deepEqual(mergeRatingDraft({ a: 7 }, { a: 0 }, { a: 7 }), { a: 0 });
  assert.throws(() => mergeRatingDraft({ a: 7 }, { a: 9 }, {}), /tracklist/);
});
test('saved view scopes distinguish incomplete, favorite and deleted albums without inventing votes', () => {
  const album = structuredClone(initialAlbums[0]);
  assert.equal(inLibraryView(album, 'favorites'), true);
  const draft = { ...album, evaluationStatus: 'draft' as const };
  assert.equal(inLibraryView(draft, 'incomplete'), true); assert.equal(inLibraryView(draft, 'confirmed'), false);
  assert.equal(inLibraryView({ ...album, deleted: true }, 'all'), false);
  const empty = { ...album, tracks: album.tracks.map(t => ({ ...t, rating: null })) };
  assert.equal(inLibraryView(empty, 'all'), true); assert.equal(inLibraryView(empty, 'favorites'), false);
});
test('AI timestamps can detect music changes without reacting to private notes or covers', () => {
  const album = structuredClone(initialAlbums[0]); const original = musicFingerprint([album]);
  assert.equal(musicFingerprint([{ ...album, coverUrl: 'different', history: [] }]), original);
  album.tracks[0].rating = 0; assert.notEqual(musicFingerprint([album]), original);
});
test('import validation protects saved filters and stored AI conversations', () => {
  assert.throws(() => validateExperienceData({ profile: { savedViews: [{ id: 'x', name: 'x', filters: { status: 'broken' } }] } }), /Viste/);
  assert.throws(() => validateExperienceData({ profile: { aiConversations: [{ id: 'x', feature: 'archive', messages: null }] } }), /Conversazioni/);
});
