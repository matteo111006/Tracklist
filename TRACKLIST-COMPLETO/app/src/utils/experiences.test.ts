import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAlbums } from '../../test/fixtures';
import type { Album } from '../types';
import { appendRevision } from './albumHistory';
import { askArchive, compareEditions, dailyDuel, discoveryPicks, idealTrackPool, musicalIdentity, svgCard, wrappedStory } from './experiences';
import { validateExperienceData } from './experienceValidation';
const album = (id: string, ratings = [7, 9], artistName = id): Album => ({ ...structuredClone(initialAlbums[0]), id, artistId: artistName, artistName, artists: [{ id: artistName, name: artistName }], tracks: ratings.map((rating, i) => ({ id: `${id}-${i}`, albumId: id, trackNumber: i + 1, title: `Track ${i}`, artists: artistName, rating })) });

test('daily challenge is deterministic, distinct and ignores drafts and deletions', () => {
  const a = album('a'), b = album('b'), c = { ...album('c'), evaluationStatus: 'draft' as const };
  assert.deepEqual(dailyDuel([a, b, c], '2026-11-08').map(a => a.id).sort(), ['a', 'b']);
  assert.deepEqual(dailyDuel([a, b], '2026-11-08'), dailyDuel([b, a], '2026-11-08'));
  assert.deepEqual(dailyDuel([a, { ...b, deleted: true }], '2026-11-08'), []);
});
test('identity excludes drafts, credits collaborators and retains zero scores', () => {
  const data = musicalIdentity([album('a', [0, 10]), { ...album('draft', [10, 10]), evaluationStatus: 'draft' }]);
  assert.equal(data.average, 5); assert.equal(data.positivePercentage, 50); assert.equal(data.comparableAlbums, 1);
  assert.equal(musicalIdentity([]).average, null);
});
test('archive answers use actual track order and filter release year', () => {
  const a = album('a'), b = { ...album('b', [9, 7]), year: 2025 };
  a.tracks.reverse();
  assert.deepEqual(askArchive([a, b], 'Quali album hanno una chiusura migliore dell’apertura?').matches.map(r => r.album.id), ['a']);
  assert.deepEqual(askArchive([a, b], 'Quali sono i migliori album del 2025?').matches.map(r => r.album.id), ['b']);
  assert.equal(askArchive([a], 'raccontami il futuro').supported, false);
  assert.equal(askArchive([], 'Qual è il mio artista più discontinuo?').matches.length, 0);
});
test('artist inconsistency needs multiple albums and reports actual spread', () => {
  const result = askArchive([album('a', [5, 5], 'Same'), album('b', [9, 9], 'Same'), album('c', [10, 10])], 'artista più discontinuo');
  assert.match(result.text, /Same/); assert.match(result.text, /4,00/); assert.equal(result.matches.length, 2);
});
test('discovery picks are unique, unfinished and respect dismissed feedback', () => {
  const albums = [album('rated'), ...['a', 'b', 'c', 'd'].map(id => ({ ...album(id), evaluationStatus: 'unrated' as const, tracks: album(id).tracks.map(t => ({ ...t, rating: null })) }))];
  const picks = discoveryPicks(albums, new Set(['a']), '2026-11-08');
  assert.equal(picks.length, 3); assert.equal(new Set(picks.map(p => p.album.id)).size, 3); assert.ok(picks.every(p => !['a', 'rated'].includes(p.album.id)));
});
test('edition comparison matches duplicate titles once and never treats zero as missing', () => {
  const standard = album('s', [0, 8]), deluxe = album('d', [0, 8, 10]);
  deluxe.tracks[2].title = 'Track 0';
  const result = compareEditions(standard, deluxe);
  assert.equal(result.matched, 2); assert.equal(result.bonus.length, 1); assert.equal(result.bonusAverage, 10); assert.equal(result.baseAverage, 4);
});
test('dream track pool removes repeated songs across editions and SVG escapes content', () => {
  const a = album('a'), b = album('b', [8, 10], 'a');
  assert.equal(idealTrackPool([a, b]).length, 2);
  const svg = svgCard('<script>', 'A&B', ['"hello"'], 'red" onload="x');
  assert.ok(svg.includes('&lt;script&gt;')); assert.ok(svg.includes('A&amp;B')); assert.ok(!svg.includes('onload'));
});
test('Wrapped narrative uses release years and never invents listening duration', () => {
  assert.match(wrappedStory([], 2025), /Non hai ancora/);
  const story = wrappedStory([album('a')], 2026, true);
  assert.match(story, /1,? album|1 album/); assert.match(story, /non alle date di ascolto/); assert.ok(!story.includes('minuti'));
});
test('history preserves immutable baseline, ignores no-op saves and remains bounded', () => {
  const previous = album('a'); const next = structuredClone(previous); next.tracks[0].rating = 3;
  const changed = appendRevision(previous, next, undefined, undefined, '2026-11-08T12:00:00Z');
  assert.equal(changed.history?.length, 2); assert.equal(changed.history?.[0].state.tracks[0].rating, 7);
  next.tracks[0].rating = 1; assert.equal(changed.history?.[1].state.tracks[0].rating, 3);
  assert.equal(appendRevision(changed, changed).history?.length, 2);
  assert.equal(appendRevision(changed, changed, 'relisten').history?.length, 3);
  let current = changed; for (let i = 0; i < 110; i++) current = appendRevision(current, current, 'relisten');
  assert.equal(current.history?.length, 100);
});
test('experience imports reject malformed history, unsafe colors and invalid challenge results', () => {
  assert.throws(() => validateExperienceData({ albums: [{ history: [{ state: {} }] }] }), /Cronologia/);
  assert.throws(() => validateExperienceData({ collections: [{ dreamTracklist: { theme: 'url(x)', tracks: [] } }] }), /Tracklist/);
  assert.throws(() => validateExperienceData({ profile: { experiences: { duels: { '2026-11-08': { albumIds: ['a', 'b'], chosenId: 'x', scores: [8, 9] } } } } }), /Sfide/);
  assert.doesNotThrow(() => validateExperienceData({ albums: [album('a')], profile: {} }));
});
