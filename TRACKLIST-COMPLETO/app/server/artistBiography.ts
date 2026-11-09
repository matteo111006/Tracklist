import { fetchWithTimeout } from './network.ts';

const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function matchesMusicalArtist(name: string, summary: any, albums: string[] = []): boolean {
  const text = typeof summary?.extract === 'string' ? summary.extract.trim() : '';
  if (!text || summary.type === 'disambiguation' || /può riferirsi|puo riferirsi/i.test(text)) return false;
  // A place mentioning a music festival is still a place: require a musical
  // occupation in the opening sentence, rather than a keyword anywhere.
  const lead = normalize(`${summary.description || ''} ${text.split(/[.!?]\s/)[0]}`);
  if (/\b(citta|comune|villaggio|provincia|prefettura|fiume|isola|divinita|dea|dio|personaggio mitologico)\b/.test(lead)) return false;
  if (!/\b(rapper|trapper|cantante|cantautore|cantautrice|musicista|produttore discografico|produttrice discografica|disc jockey|dj|gruppo musicale|gruppo hip hop|gruppo rap|duo musicale|collettivo musicale|collettivo hip hop|band)\b/.test(lead)) return false;
  const title = normalize((summary.title || '').replace(/\([^)]*\)/g, ''));
  const target = normalize(name);
  if (title !== target && !normalize(text.slice(0, 500)).includes(target)) return false;
  // Discography supplied by TRACKLIST disambiguates musicians with the same
  // stage name. If it cannot be corroborated, return no biography.
  const anchors = albums.map(normalize).filter(value => value.length >= 4);
  return !anchors.length || anchors.some(album => (` ${normalize(text)} `).includes(` ${album} `));
}

export async function findArtistBiography(name: string, albums: string[] = [], fetcher = fetchWithTimeout) {
  const headers = { 'User-Agent': 'TracklistMusicPlatform/1.0 (contact@tracklist.it)' };
  const queries = [`${name} rapper ${albums[0] || ''}`, `${name} musicista`, name];
  const titles = new Set<string>();
  for (const query of queries) {
    const url = new URL('https://it.wikipedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'opensearch', search: query, limit: '3', namespace: '0', format: 'json' }).toString();
    const response = await fetcher(url, { headers });
    if (!response.ok) continue;
    const data = await response.json();
    if (Array.isArray(data[1])) for (const title of data[1]) if (typeof title === 'string') titles.add(title);
  }
  for (const title of [...titles].slice(0, 6)) {
    const response = await fetcher(`https://it.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers });
    if (!response.ok) continue;
    const summary = await response.json();
    if (!matchesMusicalArtist(name, summary, albums)) continue;
    let bio = summary.extract.replace(/\[\d+\]/g, '').trim();
    if (bio.length > 1500) {
      const short = bio.slice(0, 1490), end = Math.max(short.lastIndexOf('.'), short.lastIndexOf('!'));
      bio = end > 1000 ? short.slice(0, end + 1) : `${short.trim()}…`;
    }
    return { name, title: summary.title, bio, source: 'wikipedia_it', pageUrl: summary.content_urls?.desktop?.page || null };
  }
  return { bio: '', source: 'none', reason: 'Artista musicale non identificato con sufficiente certezza.' };
}
