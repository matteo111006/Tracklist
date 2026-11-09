import type { Album } from '../types/index.ts';
import { calculateAlbumStats, isAlbumInRankings, formatRating } from './musicMath.ts';
import { validRatings } from './listeningInsights.ts';

export const mean = (values: number[]) => values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
export const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const confirmed = (albums: Album[]) => albums.filter(a => isAlbumInRankings(a) && validRatings(a).length);
export const scored = (albums: Album[]) => confirmed(albums).map(album => ({ album, average: mean(validRatings(album))! })).sort((a, b) => b.average - a.average);
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function dailyDuel(albums: Album[], day: string): Album[] {
  const pool = confirmed(albums).sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length < 2) return [];
  let seed = 0; for (const char of day) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const first = pool[seed % pool.length];
  const others = pool.filter(a => a.id !== first.id && a.artistName !== first.artistName);
  const candidates = others.length ? others : pool.filter(a => a.id !== first.id);
  return [first, candidates[Math.floor(seed / pool.length) % candidates.length]];
}

export function musicalIdentity(albums: Album[]) {
  const ranked = scored(albums), ratings = ranked.flatMap(a => validRatings(a.album));
  const average = mean(ratings), positive = ratings.filter(n => n >= 8).length;
  const openings = ranked.flatMap(({ album }) => {
    const tracks = [...album.tracks].sort((a, b) => a.trackNumber - b.trackNumber);
    const first = tracks[0]?.rating, last = tracks.at(-1)?.rating;
    return first != null && last != null && tracks.length > 1 ? [{ first, last }] : [];
  });
  const artistScores = new Map<string, { name: string; values: number[]; ids: string[] }>();
  for (const { album, average: score } of ranked) {
    for (const ref of album.artists?.length ? album.artists : [{ id: album.artistId, name: album.artistName }]) {
      const entry = artistScores.get(ref.id) || { name: ref.name, values: [], ids: [] };
      entry.values.push(score); entry.ids.push(album.id); artistScores.set(ref.id, entry);
    }
  }
  const favorites = [...artistScores.values()].map(a => ({ ...a, average: mean(a.values)! })).sort((a, b) => b.average - a.average);
  const genreCounts = new Map<string, number>();
  ranked.forEach(({ album }) => album.genres.split(/[,;|]/).map(g => g.trim()).filter(Boolean).forEach(g => genreCounts.set(g, (genreCounts.get(g) || 0) + 1)));
  return {
    title: ratings.length < 10 ? 'Un gusto da scoprire' : average! >= 8 ? 'Il cercatore di colpi di fulmine' : average! >= 6.5 ? 'L’esploratore selettivo' : 'Il critico senza sconti',
    average, totalRatings: ratings.length, albumCount: ranked.length, positive,
    positivePercentage: ratings.length ? positive / ratings.length * 100 : null,
    opening: mean(openings.map(x => x.first)), closing: mean(openings.map(x => x.last)), comparableAlbums: openings.length,
    favorites, topAlbums: ranked.slice(0, 3), genres: [...genreCounts].sort((a, b) => b[1] - a[1]),
  };
}

export interface ArchiveAnswer { text: string; matches: { album: Album; detail: string }[]; supported: boolean; }
export function askArchive(albums: Album[], question: string): ArchiveAnswer {
  const q = normalized(question), year = q.match(/\b(19\d{2}|20\d{2})\b/)?.[0];
  const pool = confirmed(albums).filter(a => !year || a.year === Number(year));
  let rows: { album: Album; value: number; detail: string }[] = [];
  let text = '';
  if (/chiusur|final[ei]|apertur|intro/.test(q)) {
    rows = pool.flatMap(album => {
      const tracks = [...album.tracks].sort((a, b) => a.trackNumber - b.trackNumber);
      const first = tracks[0]?.rating, last = tracks.at(-1)?.rating;
      if (tracks.length < 2 || first == null || last == null) return [];
      const value = last - first;
      return /miglior|super|piu/.test(q) && value <= 0 ? [] : [{ album, value, detail: `Apertura ${formatRating(first, 2)} · Chiusura ${formatRating(last, 2)} · Δ ${formatRating(value, 2)}` }];
    }).sort((a, b) => b.value - a.value);
    text = 'Confronto i voti della prima e dell’ultima traccia, nell’ordine della tracklist.';
  } else if (/discontinu|omogene|costan|dispersion/.test(q)) {
    const byArtist = new Map<string, { albums: Album[]; values: number[] }>();
    pool.forEach(a => { const key = a.artistName; const x = byArtist.get(key) || { albums: [], values: [] }; x.albums.push(a); x.values.push(mean(validRatings(a))!); byArtist.set(key, x); });
    if (/artist/.test(q)) {
      const artists = [...byArtist.entries()].filter(([, x]) => x.values.length >= 2).map(([name, x]) => ({ name, ...x, spread: Math.max(...x.values) - Math.min(...x.values) })).sort((a, b) => b.spread - a.spread);
      const winner = artists[0];
      if (winner) { rows = winner.albums.map(album => ({ album, value: mean(validRatings(album))!, detail: `Media ${formatRating(mean(validRatings(album)), 2)}` })); text = `${winner.name}: escursione di ${formatRating(winner.spread, 2)} punti tra le medie di ${winner.values.length} album. Servono almeno due album per artista; i progetti condivisi sono considerati separatamente.`; }
      else text = 'Servono almeno due album confermati dello stesso artista per misurare la discontinuità.';
    } else {
      rows = pool.flatMap(album => { const r = validRatings(album); if (r.length < 2) return []; const avg = mean(r)!; const deviation = Math.sqrt(r.reduce((s, n) => s + (n - avg) ** 2, 0) / r.length); return [{ album, value: deviation, detail: `Dispersione σ ${formatRating(deviation, 3)}` }]; }).sort((a, b) => /omogene|costan/.test(q) ? a.value - b.value : b.value - a.value);
      text = 'Misuro la dispersione dei voti delle tracce; un album omogeneo può avere anche una media bassa.';
    }
  } else if (/miglior|preferit|peggior|media|voto|voti|album di|dischi di/.test(q)) {
    let filtered = pool;
    const artistMention = [...new Set(pool.map(a => a.artistName))].filter(name => q.includes(normalized(name))).sort((a, b) => b.length - a.length)[0];
    if (artistMention) filtered = pool.filter(a => a.artistName === artistMention);
    rows = scored(filtered).map(({ album, average }) => ({ album, value: average, detail: `Media ${formatRating(average, 4)} · ${validRatings(album).length} tracce votate` }));
    if (/peggior|bass/.test(q)) rows.reverse();
    text = `Ordino gli album per media dei voti confermati${artistMention ? ' di ' + artistMention : ''}${year ? ' con uscita nel ' + year : ''}.`;
  } else {
    const search = pool.filter(a => normalized(`${a.title} ${a.artistName}`).includes(q));
    return { supported: search.length > 0, text: search.length ? 'Album trovati nel tuo archivio.' : 'In modalità locale riconosco confronti apertura/chiusura, medie, migliori e peggiori album, omogeneità e artisti discontinui. Puoi aggiungere un anno o cercare un titolo/artista. Prova uno degli esempi qui sotto.', matches: search.slice(0, 20).map(album => ({ album, detail: `Media ${formatRating(mean(validRatings(album)), 2)}` })) };
  }
  return { supported: true, text: rows.length ? text : text + ' Nessun risultato con dati sufficienti.', matches: rows.slice(0, 20).map(({ album, detail }) => ({ album, detail })) };
}

export function wrappedStory(albums: Album[], year: number, ironic = false) {
  const identity = musicalIdentity(albums.filter(a => a.year === year));
  if (!identity.albumCount) return `Non hai ancora album confermati usciti nel ${year}. Il racconto arriverà dopo le prime valutazioni.`;
  const top = identity.topAlbums[0];
  return `${ironic ? 'La giuria sei tu, e i numeri hanno emesso il verdetto.' : 'Un anno di musica, visto attraverso i tuoi voti.'} Hai valutato ${identity.albumCount} album ${identity.albumCount === 1 ? 'uscito' : 'usciti'} nel ${year}, assegnando ${identity.totalRatings} voti con media ${formatRating(identity.average, 2)}. ${top.album.title} di ${top.album.artistName} guida la tua classifica con ${formatRating(top.average, 2)}. ${identity.positive} ${identity.positive === 1 ? 'traccia ha raggiunto' : 'tracce hanno raggiunto'} almeno 8. ${identity.genres[0] ? `Il genere più presente è ${identity.genres[0][0]}. ` : ''}${ironic ? 'Il tuo voto conta più di qualsiasi hype.' : 'Ogni valutazione aggiunge una sfumatura al tuo archivio.'} I periodi si riferiscono all’uscita dei dischi, non alle date di ascolto.`;
}

export function discoveryPicks(albums: Album[], ignored: Set<string>, day: string) {
  const identity = musicalIdentity(albums), favoriteNames = identity.favorites.slice(0, 5).map(a => normalized(a.name));
  const genres = identity.genres.slice(0, 3).map(([g]) => normalized(g));
  const pool = albums.filter(a => !a.deleted && !isAlbumInRankings(a) && !ignored.has(a.id));
  const affinity = (a: Album) => (a.artists?.length ? a.artists : [{ name: a.artistName }]).some(ref => favoriteNames.includes(normalized(ref.name))) ? 3 : genres.some(g => normalized(a.genres).includes(g)) ? 1 : 0;
  const used = new Set<string>();
  return ['Vicino ai tuoi gusti', 'Fuori dalla comfort zone', 'La sorpresa'].flatMap((label, index) => {
    let candidates = pool.filter(a => !used.has(a.id)).sort((a, b) => index === 1 ? affinity(a) - affinity(b) : affinity(b) - affinity(a));
    if (index === 2 && candidates.length) { const offset = [...day].reduce((s, c) => s + c.charCodeAt(0), 0) % candidates.length; candidates = [...candidates.slice(offset), ...candidates.slice(0, offset)]; }
    const album = candidates[0]; if (!album) return [];
    used.add(album.id);
    return [{ album, label, reason: index === 1 && affinity(album) > 0 ? 'Tra gli album disponibili questa è la proposta meno vicina ai tuoi preferiti, ma condivide ancora artisti o generi abituali.' : index === 2 ? 'Una scelta a rotazione tra gli album ancora da valutare.' : affinity(album) >= 3 ? 'Un artista presente tra le tue medie più alte.' : affinity(album) > 0 ? 'Un genere presente tra quelli che hai valutato più spesso.' : 'Un artista o un genere meno rappresentato nei tuoi album preferiti.' }];
  });
}

export function compareEditions(standard: Album, deluxe: Album) {
  const counts = new Map<string, number>();
  standard.tracks.forEach(t => { const key = normalized(t.title); counts.set(key, (counts.get(key) || 0) + 1); });
  const bonus = deluxe.tracks.filter(t => { const key = normalized(t.title); const count = counts.get(key) || 0; if (count) { counts.set(key, count - 1); return false; } return true; });
  const baseAverage = calculateAlbumStats(standard.tracks).averageRating, deluxeAverage = calculateAlbumStats(deluxe.tracks).averageRating;
  return { baseAverage, deluxeAverage, delta: baseAverage != null && deluxeAverage != null ? deluxeAverage - baseAverage : null, bonus, bonusAverage: mean(bonus.flatMap(t => t.rating == null ? [] : [t.rating])), matched: deluxe.tracks.length - bonus.length };
}
export function idealTrackPool(albums: Album[]) {
  const seen = new Set<string>();
  return confirmed(albums).flatMap(album => album.tracks.filter(t => t.rating != null).map(track => ({ album, track }))).sort((a, b) => b.track.rating! - a.track.rating!).filter(({ track }) => { const key = normalized(`${track.title} ${track.artists}`); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function svgCard(title: string, subtitle: string, lines: string[], theme = '#c7ff36') {
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
  const color = /^#[a-f0-9]{6}$/i.test(theme) ? theme : '#c7ff36';
  const height = 390 + lines.length * 58;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}"><defs><radialGradient id="glow"><stop stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="#0d100a"/></radialGradient></defs><rect width="1080" height="${height}" fill="#0d100a"/><circle cx="880" cy="100" r="440" fill="url(#glow)"/><text x="70" y="82" fill="${color}" font-size="20" font-family="sans-serif" letter-spacing="8">TRACKLIST</text><text x="70" y="190" fill="white" font-size="44" font-family="sans-serif">${escape(title.slice(0, 39))}</text><text x="70" y="240" fill="#a8b29d" font-size="24" font-family="sans-serif">${escape(subtitle.slice(0, 68))}</text>${lines.map((line, i) => `<text x="70" y="${330 + i * 58}" fill="${i === 0 ? color : '#edf0e8'}" font-family="sans-serif" font-size="25">${escape(line.slice(0, 70))}</text>`).join('')}</svg>`;
}
