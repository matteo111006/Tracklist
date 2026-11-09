// Three-way merge: retain remote changes to untouched fields and local edits to
// changed fields. Arrays of entities are merged by ID, including individual tracks.
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function mergeSnapshots(base: any, local: any, remote: any): any {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    if ([...local, ...remote].every(x => x && typeof x === 'object' && typeof x.id === 'string')) {
      const b = new Map((Array.isArray(base) ? base : []).map((x: any) => [x.id, x]));
      const l = new Map(local.map(x => [x.id, x]));
      const r = new Map(remote.map(x => [x.id, x]));
      return [...new Set([...l.keys(), ...r.keys()])]
        .map(id => mergeSnapshots(b.get(id), l.get(id), r.get(id)))
        .filter(x => x !== undefined);
    }
    return local;
  }
  if (local && remote && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local) && !Array.isArray(remote)) {
    return Object.fromEntries([...new Set([...Object.keys(local), ...Object.keys(remote)])]
      .map(key => [key, mergeSnapshots(base?.[key], local[key], remote[key])])
      .filter(([, value]) => value !== undefined));
  }
  return local;
}
