import { Album, Track } from '../types';
import { preferredSearchGenre, rankMusicResults } from '../utils/searchRelevance';
import { cleanRecordLabel } from '../utils/labelCleaner';

export interface SearchResultAlbum {
  id: string;
  title: string;
  artistName: string;
  releaseDate: string;
  year: number;
  coverUrl: string;
  label: string;
  genres: string;
  tracks: Track[];
  spotifyUrl?: string;
  source?: 'spotify' | 'itunes' | 'deezer';
}

export async function searchMusicOnline(query: string, archive: Album[] = []): Promise<SearchResultAlbum[]> {
  if (!query || query.trim().length < 2) return [];

  const results: SearchResultAlbum[] = [];

  // 1. Try Spotify search first ("vorrei che prendessi tutte le informazioni da spotify")
  try {
    const responses = await Promise.allSettled(['', '&catalog=deezer'].map(suffix =>
      fetch(`/api/spotify/search?q=${encodeURIComponent(query)}${suffix}`, { signal: AbortSignal.timeout(12000) })
    ));
    for (const response of responses) {
    if (response.status !== 'fulfilled') continue;
    const spRes = response.value;
    if (spRes.ok) {
      const spData = await spRes.json();
      const rawAlbums: any[] = Array.isArray(spData.albums)
        ? spData.albums
        : spData.id
        ? [spData]
        : [];

      for (const item of rawAlbums) {
        const releaseDate = item.releaseDate || '2026-01-01';
        const year = item.year || (releaseDate ? new Date(releaseDate).getFullYear() : 2026);
        const spTracks: Track[] = Array.isArray(item.tracks) && item.tracks.length > 0
          ? item.tracks.map((t: any, idx: number) => ({
              id: `tr-sp-${item.id}-${idx + 1}`,
              albumId: `sp-${item.id}`,
              trackNumber: t.trackNumber || idx + 1,
              title: (t.title || `Traccia ${idx + 1}`).toUpperCase(),
              artists: t.artists || item.artistName || '',
              rating: null,
            }))
          : [];

        results.push({
          id: item.id.startsWith('sp-') || item.id.startsWith('dz-') ? item.id : `sp-${item.id}`,
          title: (item.title || '').toUpperCase(),
          artistName: item.artistName || 'Artista Sconosciuto',
          releaseDate,
          year,
          coverUrl: item.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
          label: cleanRecordLabel(item.label || 'Indipendente'),
            genres: item.genres || 'Musica',
          tracks: spTracks,
          spotifyUrl: item.spotifyUrl,
          source: item.id.startsWith('dz-') ? 'deezer' : 'spotify',
        });
      }
    }
    }
  } catch (err) {
    console.warn('Spotify search notice:', err);
  }

  // 2. Fetch iTunes catalog as complementary / fallback
  try {
    const genre = preferredSearchGenre(archive);
    const queries = [query, ...(genre ? [`${query} ${genre}`] : [])];
    const responses = await Promise.allSettled(queries.map(async term => {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=album&country=IT&limit=100`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((item: any) => {
          // Avoid duplicate titles if already found via Spotify
          const title = (item.collectionName || '').toUpperCase();
          if (results.some((r) => r.title === title && r.artistName.toLowerCase() === (item.artistName || '').toLowerCase())) return;

          const releaseDate = item.releaseDate ? item.releaseDate.split('T')[0] : '2026-01-01';
          const year = new Date(releaseDate).getFullYear() || 2026;
          const coverUrl = item.artworkUrl100
            ? item.artworkUrl100.replace('100x100bb', '600x600bb')
            : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop';

          results.push({
            id: `itunes-${item.collectionId}`,
            title,
            artistName: item.artistName || 'Artista Sconosciuto',
            releaseDate,
            year,
            coverUrl,
            label: cleanRecordLabel(item.copyright || 'Indipendente'),
            genres: item.primaryGenreName || 'Musica',
            tracks: [],
            source: 'itunes',
          });
        });
      }
    }
    }));
    for (const response of responses) if (response.status === 'rejected') console.warn('Catalog search unavailable');
  } catch (err) {
    console.warn('iTunes search notice:', err);
  }

  // Public catalog fallbacks can return unrelated recommendations. Keep only
  // results whose title/artist actually contains every word in the request.
  return rankMusicResults(query, results, archive);
}

export async function fetchAlbumTracks(collectionId: string): Promise<{ tracks: Track[]; label?: string; releaseDate?: string; genres?: string }> {
  try {
    // 1. Check if Spotify ID (either with sp- or plain)
    if (collectionId.startsWith('sp-') || collectionId.startsWith('dz-') || !collectionId.startsWith('itunes-')) {
      const cleanId = collectionId.replace('sp-', '');
      const res = await fetch(`/api/spotify/album?id=${cleanId}`, { signal: AbortSignal.timeout(12000) });
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && Array.isArray(data.tracks) && data.tracks.length > 0) {
          const mappedTracks = data.tracks.map((t: any, idx: number) => ({
            id: `tr-${cleanId}-${idx + 1}`,
            albumId: collectionId,
            trackNumber: t.trackNumber || idx + 1,
            title: (t.title || `Traccia ${idx + 1}`).toUpperCase(),
            artists: t.artists || data.artistName || '',
            rating: null,
          }));
          return { tracks: mappedTracks, label: cleanRecordLabel(data.label), releaseDate: data.releaseDate, genres: data.genres };
        }
      }
    }

    // 2. iTunes lookup
    const cleanItunesId = collectionId.replace('itunes-', '');
    const url = `https://itunes.apple.com/lookup?id=${cleanItunesId}&entity=song&country=IT`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 1) {
        const collectionInfo = data.results[0];
        const songs = data.results.slice(1);
        const mappedTracks = songs.map((s: any, idx: number) => ({
          id: `tr-${cleanItunesId}-${idx + 1}`,
          albumId: collectionId,
          trackNumber: s.trackNumber || idx + 1,
          title: (s.trackName || `Traccia ${idx + 1}`).toUpperCase(),
          artists: s.artistName || '',
          rating: null,
        }));
        return { tracks: mappedTracks, label: cleanRecordLabel(collectionInfo?.copyright) };
      }
    }
  } catch (err) {
    console.warn('Error fetching tracklist:', err);
  }
  return { tracks: [] };
}
