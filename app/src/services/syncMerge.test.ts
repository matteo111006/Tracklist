import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshots } from './syncMerge';

test('concurrent relistening histories and per-day challenges retain both device changes', () => {
  const base = { albums: [{ id: 'album', history: [{ id: 'baseline', date: '2026-11-08' }] }], profile: { experiences: { duels: {} } } };
  const local = structuredClone(base) as any, remote = structuredClone(base) as any;
  local.albums[0].history.push({ id: 'local-listen', date: '2026-11-09' });
  remote.albums[0].history.push({ id: 'remote-listen', date: '2026-11-10' });
  local.profile.experiences.duels['2026-11-09'] = { chosenId: 'a' };
  remote.profile.experiences.duels['2026-11-10'] = { chosenId: 'b' };
  const merged = mergeSnapshots(base, local, remote);
  assert.deepEqual(merged.albums[0].history.map((h: any) => h.id), ['baseline', 'local-listen', 'remote-listen']);
  assert.equal(Object.keys(merged.profile.experiences.duels).length, 2);
});
test('three-way merge keeps remote additions and local deletions', () => {
  const base = [{ id: 'a', rating: 5 }, { id: 'b', rating: 7 }];
  const local = [{ id: 'a', rating: 9 }];
  const remote = [...base, { id: 'c', rating: 6 }];
  assert.deepEqual(mergeSnapshots(base, local, remote), [{ id: 'a', rating: 9 }, { id: 'c', rating: 6 }]);
});
test('one edited field cannot undo a remote edit in another field', () => {
  const base = { title: 'Old', review: 'Old review' };
  assert.deepEqual(mergeSnapshots(base, { ...base, title: 'New' }, { ...base, review: 'New review' }), { title: 'New', review: 'New review' });
});
