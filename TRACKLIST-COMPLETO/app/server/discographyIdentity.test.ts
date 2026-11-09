import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogMatchesArchive, parseDiscographyAnchors } from './discographyIdentity.ts';

test('namesake catalogs require archive evidence rather than the same artist name', () => {
  const anchors = [{ title: 'CRASH OUT', year: 2026 }];
  assert.equal(catalogMatchesArchive([{ title: 'Unrelated release', year: 2026 }], anchors), false);
  assert.equal(catalogMatchesArchive([{ title: 'Crash Out', year: 2020 }], anchors), false);
  assert.equal(catalogMatchesArchive([{ title: 'Crash Out', year: 2026 }], anchors), true);
  assert.equal(catalogMatchesArchive([{ title: 'Crash Out', year: 2026 }], []), false);
});
test('Spotify album identity corroborates editions while title fragments do not', () => {
  const anchors = [{ title: 'Album', year: 2026, spotifyId: 'known-album' }];
  assert.equal(catalogMatchesArchive([{ title: 'Album deluxe', year: 2026, spotifyId: 'known-album' }], anchors), true);
  assert.equal(catalogMatchesArchive([{ title: 'Album deluxe', year: 2026, spotifyId: 'other' }], anchors), false);
});
test('malformed or oversized anchor lists cannot bypass identity checks', () => {
  assert.deepEqual(parseDiscographyAnchors('broken'), []);
  assert.deepEqual(parseDiscographyAnchors('{"title":"Album"}'), []);
  assert.deepEqual(parseDiscographyAnchors('[{"title":"Album","year":"2026"}]'), []);
  assert.equal(parseDiscographyAnchors(JSON.stringify(Array.from({ length: 80 }, () => ({ title: 'Album', year: 2026 })))).length, 40);
});
