import test from 'node:test';
import assert from 'node:assert/strict';
import { withoutHistory, snapshotWithoutHistory } from './withoutHistory';
import type { Album } from '../types';
test('history removal preserves every current album field and does not mutate the source', () => {
  const album = { id: 'album', tracks: [{ id: 'track', rating: 8.25 }], review: 'Current review', history: [{ id: 'old' }] } as unknown as Album;
  const current = withoutHistory(album);
  assert.equal('history' in current, false);
  assert.deepEqual(current, { id: 'album', tracks: [{ id: 'track', rating: 8.25 }], review: 'Current review' });
  assert.equal(album.history?.length, 1);
});
test('incoming stale history cannot return through a server snapshot', () => {
  const data = { albums: [{ id: 'album', tracks: [], history: [{ id: 'old' }] }], profile: { name: 'Unchanged' }, collections: [] };
  const clean = snapshotWithoutHistory(data);
  assert.equal('history' in clean.albums[0], false);
  assert.deepEqual(clean.profile, data.profile);
  assert.deepEqual(clean.collections, data.collections);
});
