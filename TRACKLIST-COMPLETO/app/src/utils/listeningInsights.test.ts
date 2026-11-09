import test from 'node:test';
import assert from 'node:assert/strict';
import type { Album } from '../types';
import { calculateCollectionInsights, calculateSpecialAwards, calculateWrappedInsights, insightsCSV } from './listeningInsights';

const album = (id: string, year: number, ratings: (number | null)[], extra: Partial<Album> = {}): Album => ({
  id, title: id, artistId: 'artist', artistName: 'Artist', year, releaseDate: year + '-01-01', releaseDateFormatted: '',
  coverUrl: '', label: '', genres: '', duration: '', editionType: 'standard', evaluationStatus: 'completed',
  tracks: ratings.map((rating, i) => ({ id: id + i, albumId: id, title: 'Track ' + i, trackNumber: i + 1, artists: 'Artist', rating })), ...extra,
});
test('insights handle empty data without invented averages or percentages', () => {
  const data = calculateCollectionInsights([]);
  assert.equal(data.average, null); assert.equal(data.deviation, null);
  assert.equal(data.positivePercentage, null); assert.equal(data.coverage, 0);
  assert.deepEqual(data.unfinished, []);
});
test('only confirmed valid ratings contribute, including zero; deleted albums are excluded', () => {
  const data = calculateCollectionInsights([
    album('valid', 2026, [0, 8, 10]), album('draft', 2026, [10], { evaluationStatus: 'draft' }),
    album('deleted', 2026, [10], { deleted: true }), album('invalid', 2026, [NaN, Infinity, -1, 11]),
  ]);
  assert.equal(data.totalAlbums, 3); assert.equal(data.confirmedAlbums, 1);
  assert.equal(data.totalRatings, 3); assert.equal(data.average, 6);
  assert.equal(data.minimum, 0); assert.equal(data.perfectCount, 1);
  assert.ok(Math.abs(data.deviation! - Math.sqrt(56 / 3)) < 1e-9);
  assert.equal(data.positivePercentage, 2 / 3 * 100);
});
test('Wrapped compares release-year cohorts and reports missing comparisons explicitly', () => {
  const data = calculateWrappedInsights([album('old', 2025, [6, 8]), album('new', 2026, [8, 10])], 2026);
  assert.equal(data.current.average, 9); assert.equal(data.previous.average, 7); assert.equal(data.averageDelta, 2);
  assert.equal(data.uniqueArtists, 1);
  assert.equal(calculateWrappedInsights([album('new', 2026, [8])], 2026).averageDelta, null);
});
test('special awards preserve tied winners and exclude short, incomplete, draft and deluxe albums', () => {
  const data = calculateSpecialAwards([
    album('a', 2026, [8, 8, 8, 8, 8]), album('b', 2026, [8, 8, 8, 8, 8]),
    album('deluxe', 2026, [10, 10, 10, 10, 10], { editionType: 'deluxe' }),
    album('short', 2026, [10, 10]), album('partial', 2026, [10, 10, 10, 10, null]),
    album('draft', 2026, [10, 10, 10, 10, 10], { evaluationStatus: 'draft' }),
  ], 2026);
  assert.equal(data.eligibleCount, 2);
  assert.equal(data.categories[0].score, 0);
  assert.deepEqual(data.categories[0].winners.map(w => w.album.id), ['a', 'b']);
  assert.equal(data.categories[1].score, 8);
});
test('opening and closing awards follow track numbers, not array position', () => {
  const entry = album('unordered', 2026, [10, 6, 8, 7, 9]);
  entry.tracks.forEach((t, i) => { t.trackNumber = [5, 1, 4, 2, 3][i]; });
  const data = calculateSpecialAwards([entry], 2026);
  assert.equal(data.categories[1].score, 6); assert.equal(data.categories[2].score, 10);
});
test('artist growth requires a positive increase across both years, including collaborations', () => {
  const refs = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];
  const data = calculateSpecialAwards([album('before', 2025, [6, 6, 6, 6, 6], { artists: refs }), album('after', 2026, [8, 8, 8, 8, 8], { artists: refs }), album('debut', 2026, [10], { artistName: 'New', artistId: 'new' })], 2026);
  assert.equal(data.growth.length, 2); assert.equal(data.growth[0].delta, 2);
  assert.equal(calculateSpecialAwards([album('a', 2025, [8]), album('b', 2026, [7])], 2026).growth.length, 0);
});
test('unfinished list prioritizes ready-to-confirm drafts, then partial and unstarted albums', () => {
  const data = calculateCollectionInsights([album('unstarted', 2026, [null, null]), album('partial', 2026, [8, null], { evaluationStatus: 'draft' }), album('ready', 2026, [8, 9], { evaluationStatus: 'draft' }), album('done', 2026, [8, 9])]);
  assert.deepEqual(data.unfinished.map(x => x.album.id), ['ready', 'partial', 'unstarted']);
});
test('CSV exports confirmed data and neutralizes formulas in text cells', () => {
  const csv = insightsCSV([album('=SUM(2,3)', 2026, [0, 10], { artistName: 'A "quoted" artist' }), album('draft', 2026, [10], { evaluationStatus: 'draft' })]);
  assert.ok(csv.includes('"\'=SUM(2,3)"'));
  assert.ok(csv.includes('"A ""quoted"" artist"'));
  assert.equal(csv.split('\n').length, 2);
  assert.ok(csv.includes('5.0000,5.0000'));
});
