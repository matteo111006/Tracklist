import type { Album, Artist, LibraryFilters } from '../types/index.ts';
import type { ActiveView } from '../components/Sidebar.tsx';
import { normalized } from './experiences.ts';
import { calculateAlbumStats, isAlbumInRankings } from './musicMath.ts';

export interface AppRoute { view: ActiveView; albumId?: string; trackId?: string; artist?: { id: string; name: string }; compareA?: string; compareB?: string; }
const views: ActiveView[] = ['esperienze', 'classifica', 'nuove_uscite', 'aggiungi', 'confronto', 'wrapped', 'awards', 'raccolte', 'statistiche', 'profilo', 'album_detail', 'artista_detail'];
export function readAppRoute(search: string): AppRoute {
  const params = new URLSearchParams(search);
  const view = params.get('view') as ActiveView;
  if (!views.includes(view)) return { view: 'esperienze' };
  if (view === 'album_detail') return params.get('album') ? { view, albumId: params.get('album')!, trackId: params.get('track') || undefined } : { view: 'classifica' };
  if (view === 'artista_detail') return params.get('artist') && params.get('name') ? { view, artist: { id: params.get('artist')!, name: params.get('name')! } } : { view: 'classifica' };
  return { view, ...(view === 'confronto' ? { compareA: params.get('a') || undefined, compareB: params.get('b') || undefined } : {}) };
}
export function routeUrl(route: AppRoute): string {
  const params = new URLSearchParams({ view: route.view });
  if (route.albumId) params.set('album', route.albumId);
  if (route.trackId) params.set('track', route.trackId);
  if (route.artist) { params.set('artist', route.artist.id); params.set('name', route.artist.name); }
  if (route.compareA) params.set('a', route.compareA);
  if (route.compareB) params.set('b', route.compareB);
  return '?' + params.toString();
}
export interface SearchHit { key: string; kind: 'album' | 'artist' | 'track'; title: string; detail: string; route: AppRoute; }
export function inLibraryView(album: Album, status: LibraryFilters['status']): boolean {
  if (album.deleted) return false;
  if (status === 'all') return true;
  const stats = calculateAlbumStats(album.tracks);
  if (status === 'incomplete') return !isAlbumInRankings(album) || stats.ratedCount < album.tracks.length;
  return isAlbumInRankings(album) && (status !== 'favorites' || (stats.averageRating ?? -1) >= 8);
}
export function searchOwnArchive(albums: Album[], artists: Artist[], query: string, kind = 'all'): SearchHit[] {
  const words = normalized(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const matches = (text: string) => words.every(word => normalized(text).includes(word));
  const hits: SearchHit[] = [];
  const active = albums.filter(a => !a.deleted);
  if (kind === 'all' || kind === 'album') for (const a of active) if (matches(`${a.title} ${a.artistName} ${a.year}`)) hits.push({ key: `album-${a.id}`, kind: 'album', title: a.title, detail: `${a.artistName} · ${a.year} · ${a.editionType || 'standard'}`, route: { view: 'album_detail', albumId: a.id } });
  if (kind === 'all' || kind === 'artist') {
    const refs = new Map(artists.map(a => [a.id, { id: a.id, name: a.name }]));
    active.forEach(a => (a.artists?.length ? a.artists : [{ id: a.artistId, name: a.artistName }]).forEach(r => refs.set(r.id, r)));
    for (const a of refs.values()) if (matches(a.name)) hits.push({ key: `artist-${a.id}`, kind: 'artist', title: a.name, detail: 'Artista · apri discografia e valutazioni', route: { view: 'artista_detail', artist: a } });
  }
  if (kind === 'all' || kind === 'track') for (const a of active) for (const t of a.tracks) if (matches(`${t.title} ${t.artists} ${a.title}`)) hits.push({ key: `track-${a.id}-${t.id}`, kind: 'track', title: t.title, detail: `${t.artists || a.artistName} · ${a.title}`, route: { view: 'album_detail', albumId: a.id, trackId: t.id } });
  return hits.sort((a, b) => Number(normalized(b.title) === normalized(query)) - Number(normalized(a.title) === normalized(query)) || a.title.localeCompare(b.title, 'it')).slice(0, 30);
}
export function parseQuickRating(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(text)) throw new Error('Scrivi un voto da 0 a 10, per esempio 8,25.');
  const rating = Number(text);
  if (rating > 10 || Math.round(rating * 4) !== rating * 4) throw new Error('Usa voti da 0 a 10 con passi di 0,25.');
  return rating;
}
export function mergeRatingDraft(baseline: Record<string, number | null>, draft: Record<string, number | null>, latest: Record<string, number | null>) {
  const merged = { ...latest };
  for (const [id, value] of Object.entries(draft)) {
    if (!(id in latest)) throw new Error('La tracklist è cambiata. Riapri la valutazione.');
    if (value === baseline[id]) continue;
    if (latest[id] !== baseline[id] && latest[id] !== value) throw new Error('Un voto è stato modificato anche su un altro dispositivo. Riapri il modulo per confrontare i valori aggiornati.');
    merged[id] = value;
  }
  return merged;
}
export function musicFingerprint(albums: Album[]): string {
  const text = JSON.stringify(albums.filter(a => !a.deleted).map(a => [a.id, a.title, a.artistName, a.year, a.editionType, a.genres, a.evaluationStatus, a.tracks.map(t => [t.id, t.title, t.rating, t.trackNumber])]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  let hash = 2166136261; for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
