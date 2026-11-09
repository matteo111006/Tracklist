import type { Album, Artist } from '../types/index.ts';
import { getAlbumArtistRefs } from './artistParser.ts';
import { isAlbumInRankings } from './musicMath.ts';

export const validRatings = (album: Album) => album.tracks.map(t => t.rating).filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10);
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const deviation = (values: number[]) => { const avg = mean(values); return avg === null ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length); };
const confirmed = (albums: Album[]) => albums.filter(a => isAlbumInRankings(a) && validRatings(a).length > 0);

export function calculateCollectionInsights(allAlbums: Album[]) {
  const albums = allAlbums.filter(a => !a.deleted);
  const evaluated = confirmed(albums);
  const ratings = evaluated.flatMap(validRatings);
  const albumScores = evaluated.map(album => {
    const values = validRatings(album);
    return { album, mean: mean(values)!, deviation: deviation(values)!, rated: values.length, full: values.length === album.tracks.length };
  });
  const unfinished = albums.filter(a => !isAlbumInRankings(a) || validRatings(a).length < a.tracks.length)
    .map(album => ({ album, rated: validRatings(album).length, total: album.tracks.length, progress: album.tracks.length ? validRatings(album).length / album.tracks.length : 0 }))
    .sort((a, b) => b.progress - a.progress || a.album.title.localeCompare(b.album.title, 'it'));
  return {
    totalAlbums: albums.length, confirmedAlbums: evaluated.length, totalRatings: ratings.length,
    average: mean(ratings), deviation: deviation(ratings),
    minimum: ratings.length ? Math.min(...ratings) : null, maximum: ratings.length ? Math.max(...ratings) : null,
    positiveCount: ratings.filter(n => n >= 8).length,
    positivePercentage: ratings.length ? ratings.filter(n => n >= 8).length / ratings.length * 100 : null,
    perfectCount: ratings.filter(n => n === 10).length,
    coverage: albums.length ? evaluated.length / albums.length * 100 : 0,
    reviews: evaluated.filter(a => Boolean(a.review?.text?.trim())).length,
    consistent: albumScores.filter(a => a.full && a.rated >= 5).sort((a, b) => a.deviation - b.deviation || b.mean - a.mean || a.album.title.localeCompare(b.album.title, 'it')),
    unfinished, albumScores,
  };
}

export function calculateWrappedInsights(albums: Album[], year: number) {
  const current = calculateCollectionInsights(albums.filter(a => a.year === year));
  const previous = calculateCollectionInsights(albums.filter(a => a.year === year - 1));
  const artists = new Set(confirmed(albums.filter(a => a.year === year)).flatMap(a => getAlbumArtistRefs(a).map(r => r.name.toLowerCase())));
  const score = current.positivePercentage;
  const profile = current.totalRatings < 10 ? 'Profilo in costruzione' : score! >= 75 ? 'Un anno di colpi di fulmine' : score! >= 40 ? 'Tra conferme e scoperte' : 'Orecchio critico';
  return {
    year, current, previous, uniqueArtists: artists.size, profile,
    averageDelta: current.average !== null && previous.average !== null ? current.average - previous.average : null,
    albumsDelta: previous.confirmedAlbums ? current.confirmedAlbums - previous.confirmedAlbums : null,
  };
}

export function calculateSpecialAwards(allAlbums: Album[], year: number, artists: Artist[] = []) {
  const albums = confirmed(allAlbums.filter(a => a.year === year));
  const eligible = albums.filter(a => (!a.editionType || a.editionType === 'standard') && a.tracks.length >= 5 && validRatings(a).length === a.tracks.length);
  const stats = calculateCollectionInsights(eligible);
  const category = (id: string, title: string, criterion: string, scoreFor: (album: Album) => number, lowerIsBetter = false) => {
    const candidates = eligible.map(album => ({ album, score: scoreFor(album) }))
      .sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score) || a.album.title.localeCompare(b.album.title, 'it'));
    const winningScore = candidates[0]?.score;
    return { id, title, criterion, score: winningScore ?? null, winners: candidates.filter(c => Math.abs(c.score - winningScore) < 1e-9) };
  };
  const categories = [
    category('consistency', 'Dall’inizio alla fine', 'Album più omogeneo: dispersione più bassa fra i voti delle tracce.', a => deviation(validRatings(a))!, true),
    category('opening', 'Ingresso in scena', 'Miglior voto della traccia di apertura, in ordine di tracklist.', a => [...a.tracks].sort((x, y) => x.trackNumber - y.trackNumber)[0].rating!),
    category('closing', 'Ultima parola', 'Miglior voto della traccia conclusiva, in ordine di tracklist.', a => [...a.tracks].sort((x, y) => x.trackNumber - y.trackNumber).at(-1)!.rating!),
    category('highlights', 'Picchi di qualità', 'Quota più alta di brani con voto almeno 9,00.', a => validRatings(a).filter(n => n >= 9).length / a.tracks.length * 100),
  ];
  const artistMeans = (targetYear: number) => {
    const map = new Map<string, { id: string; name: string; averages: number[] }>();
    confirmed(allAlbums.filter(a => a.year === targetYear)).forEach(a => getAlbumArtistRefs(a, artists).forEach(ref => {
      const key = ref.name.toLowerCase();
      const entry = map.get(key) || { id: ref.id, name: ref.name, averages: [] };
      entry.averages.push(mean(validRatings(a))!); map.set(key, entry);
    }));
    return map;
  };
  const now = artistMeans(year), before = artistMeans(year - 1);
  const growth = [...now].flatMap(([key, artist]) => {
    const previous = before.get(key);
    if (!previous) return [];
    const delta = mean(artist.averages)! - mean(previous.averages)!;
    return delta > 1e-9 ? [{ ...artist, delta, previous: mean(previous.averages)!, current: mean(artist.averages)! }] : [];
  }).sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name, 'it'));
  return { categories, eligibleCount: stats.confirmedAlbums, growth };
}

export function insightsCSV(albums: Album[]): string {
  const text = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const rows = calculateCollectionInsights(albums).albumScores.map(({ album, mean, deviation, rated }) => [text(album.title), text(album.artistName), album.year, text(album.editionType || 'standard'), rated, album.tracks.length, mean.toFixed(4), deviation.toFixed(4)]);
  return [['Album', 'Artista', 'Anno uscita', 'Edizione', 'Tracce valutate', 'Tracce totali', 'Media', 'Deviazione standard'].join(','), ...rows.map(row => row.join(','))].join('\n');
}
