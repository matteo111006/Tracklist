import type { Album } from '../types';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
type Candidate = { title: string; artistName: string; genres: string };
const artistNames = (value: string) => value.split(/[,;&]/).map(normalize).filter(Boolean);
export function preferredSearchGenre(albums: Album[]): string {
  const counts = new Map<string, number>();
  for (const album of albums) {
    const genre = normalize(album.genres || '');
    const family = /\b(rap|hip hop|trap|drill)\b/.test(genre) ? 'rap' : /\brock\b/.test(genre) ? 'rock' : /\bpop\b/.test(genre) ? 'pop' : '';
    if (family) counts.set(family, (counts.get(family) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
export function rankMusicResults<T extends Candidate>(query: string, results: T[], archive: Album[] = []): T[] {
  const words = normalize(query).split(' ').filter(Boolean);
  const known = new Set(archive.flatMap(album => album.artists?.map(a => normalize(a.name)) || artistNames(album.artistName)));
  const genre = preferredSearchGenre(archive);
  const score = (item: T) => {
    const title = normalize(item.title), artist = normalize(item.artistName);
    const titleScore = title === normalize(query) ? 100 : words.every(w => title.split(' ').includes(w)) ? 65 : 35;
    const familiar = artistNames(item.artistName).some(name => known.has(name));
    const relatedGenre = genre === 'rap' ? /\b(rap|hip hop|trap|drill)\b/.test(normalize(item.genres)) : genre && normalize(item.genres).includes(genre);
    return titleScore + (familiar ? 45 : 0) + (relatedGenre ? 15 : 0) + (artist === normalize(query) ? 70 : 0);
  };
  const seen = new Set<string>();
  return results.filter(item => {
    const text = normalize(`${item.title} ${item.artistName}`).split(' ');
    if (!words.every(word => text.includes(word))) return false;
    const key = `${normalize(item.title)}|${artistNames(item.artistName).sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => score(b) - score(a));
}
