import type { Album } from '../types/index.ts';
export function withoutHistory(album: Album): Album {
  const { history: _history, ...current } = album;
  return current;
}
export function snapshotWithoutHistory<T>(snapshot: T): T {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray((snapshot as any).albums)) return snapshot;
  return { ...snapshot, albums: (snapshot as any).albums.map(withoutHistory) };
}
