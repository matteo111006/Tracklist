import { catalogMatchesArchive, parseDiscographyAnchors } from './discographyIdentity.ts';
import { findArtistBiography } from './artistBiography.ts';
import { fetchWithTimeout } from './network.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { cleanRecordLabel } from '../src/utils/labelCleaner.ts';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WIKI_USER_AGENT = 'TracklistMusicPlatform/1.0 (contact@tracklist.it)';

let cachedSpotifyToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedSpotifyToken && cachedSpotifyToken.expiresAt > Date.now() + 60000) {
    return cachedSpotifyToken.token;
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      console.warn('Spotify auth token request failed:', res.status);
      return null;
    }

    const data = (await res.json()) as any;
    if (data.access_token) {
      cachedSpotifyToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      };
      return data.access_token;
    }
  } catch (err) {
    console.warn('Spotify token fetch error:', err);
  }
  return null;
}

export function handleBioAndEnrichment(req: IncomingMessage, res: ServerResponse): boolean {
  if (!req.url?.startsWith('/api/artist/bio') &&
      !req.url?.startsWith('/api/spotify/artist-discography') &&
      !req.url?.startsWith('/api/spotify/lookup-cover')) {
    return false;
  }

  const urlObj = new URL(req.url, 'http://localhost:3000');
  const pathname = urlObj.pathname;
  res.setHeader('Content-Type', 'application/json');

  (async () => {
    try {
      // 1. ARTIST BIO VIA WIKIPEDIA IT (Max 1500 chars, Italian, verified)
      if (pathname === '/api/artist/bio') {
        const name = (urlObj.searchParams.get('name') || '').trim();
        if (!name) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Nome artista richiesto' }));
          return;
        }

        try {
          const albums = urlObj.searchParams.getAll('album').slice(0, 5).map(title => title.slice(0, 200));
          res.statusCode = 200;
          res.end(JSON.stringify(await findArtistBiography(name.slice(0, 160), albums)));
          return;
        } catch (err: any) {
          console.warn('Bio fetch error for', name, err);
          res.statusCode = 200;
          res.end(JSON.stringify({ bio: '', source: 'none' }));
          return;
        }
      }

      // 2. ARTIST DISCOGRAPHY (Strictly Albums and EPs, Newest on Left, Oldest on Right)
      if (pathname === '/api/spotify/artist-discography') {
        const id = urlObj.searchParams.get('id') || '';
        const name = (urlObj.searchParams.get('name') || '').trim();
        const normName = name.toLowerCase().trim();

        if (!name && !id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Nome o ID artista richiesto' }));
          return;
        }

        const anchors = parseDiscographyAnchors(urlObj.searchParams.get('anchors'));
        const seenKeys = new Set<string>();
        const discography: any[] = [];

        // Helper to normalize album titles for clean deduplication (avoid duplicates of Deluxe/Special editions)
        const normalizeTitleKey = (t: string): string => {
          return t
            .toLowerCase()
            .replace(/\s*[-–:]\s*ep\b/gi, '')
            .replace(/\s*\(deluxe.*?\)/gi, '')
            .replace(/\s*\[deluxe.*?\]/gi, '')
            .replace(/\s*\(special.*?\)/gi, '')
            .replace(/\s*\[special.*?\]/gi, '')
            .replace(/\s*\(reloaded.*?\)/gi, '')
            .replace(/\s*\(anniversary.*?\)/gi, '')
            .replace(/\s*\(remastered.*?\)/gi, '')
            .replace(/\s*\(original soundtrack.*?\)/gi, '')
            .replace(/\s*\(the ultimate.*?\)/gi, '')
            .replace(/[,:\-]\s*aspettando.*?$/gi, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
        };

        // Filter: ONLY Albums, Mixtapes, and EPs (Exclude singles and automated compilation playlists)
        const isValidAlbumOrEp = (title: string, trackCount: number, recordType?: string): boolean => {
          const lower = title.toLowerCase();
          // Exclude loose singles
          if (lower.endsWith(' - single') || lower.endsWith('- single') || lower.endsWith(' (single)') || lower.endsWith(' [single]')) {
            return false;
          }
          // Exclude auto-generated playlist compilations
          if (lower.includes('top tracks') || lower.includes('greatest hits') || lower.includes('best of')) {
            return false;
          }
          // If explicitly marked as single with fewer than 4 tracks, reject
          if (recordType === 'single' && trackCount < 4 && !lower.includes('ep') && !lower.includes('mixtape')) {
            return false;
          }
          // If fewer than 4 tracks and doesn't mention EP or mixtape, reject
          if (trackCount > 0 && trackCount < 4 && !lower.includes('ep') && !lower.includes('mixtape')) {
            return false;
          }
          return true;
        };

        // A) Official Spotify Web API if configured
        const token = await getSpotifyAccessToken();
        let spotifyArtistId = /^[a-zA-Z0-9]{22}$/.test(id) ? id : '';

        if (token) {
          try {
            if (!spotifyArtistId && name) {
              const searchRes = await fetchWithTimeout(
                `https://api.spotify.com/v1/search?q=artist:${encodeURIComponent(name)}&type=artist&limit=5`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (searchRes.ok) {
                const sData = (await searchRes.json()) as any;
                const matched = (sData.artists?.items || []).find(
                  (a: any) => a.name.toLowerCase().trim() === normName
                );
                if (matched) spotifyArtistId = matched.id;
              }
            }

            if (spotifyArtistId) {
              const discoRes = await fetchWithTimeout(
                `https://api.spotify.com/v1/artists/${spotifyArtistId}/albums?include_groups=album,single&limit=50`,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (discoRes.ok) {
                const dData = (await discoRes.json()) as any;
                const candidates = dData.items || [];
                const verified = catalogMatchesArchive(candidates.map((a: any) => ({ title: a.name || '', year: Number(a.release_date?.slice(0, 4)), spotifyId: a.id })), anchors);
                const items = verified ? candidates : [];

                for (const item of items) {
                  // Verify artist attribution
                  const artistMatch = (item.artists || []).some(
                    (a: any) =>
                      a.id === spotifyArtistId
                  );
                  if (!artistMatch) continue;

                  const trackCount = item.total_tracks || 0;
                  if (!isValidAlbumOrEp(item.name, trackCount, item.album_type)) continue;

                  const key = normalizeTitleKey(item.name);
                  if (key && seenKeys.has(key)) continue;
                  if (key) seenKeys.add(key);

                  const relDate = item.release_date || '';
                  const year = relDate ? parseInt(relDate.split('-')[0], 10) : new Date().getFullYear();
                  const isEp =
                    item.album_type === 'single' ||
                    item.name.toLowerCase().includes('ep') ||
                    (trackCount >= 4 && trackCount <= 6);

                  discography.push({
                    id: item.id,
                    spotifyId: item.id,
                    title: item.name,
                    artistName: (item.artists || []).map((a: any) => a.name).join(', ') || name,
                    releaseDate: relDate,
                    year,
                    coverUrl: item.images?.[0]?.url || '',
                    type: isEp ? 'ep' : 'album',
                    spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/album/${item.id}`,
                    tracksCount: trackCount,
                  });
                }
              }
            }
          } catch (err) {
            console.warn('Spotify artist discography error:', err);
          }
        }

        // B) Apple Music / iTunes Exact Artist Lookup (Direct Artist Catalog by ID)
        if (name) {
          try {
            const itArtistRes = await fetchWithTimeout(
              `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=8`
            );
            if (itArtistRes.ok) {
              const itArtistData = (await itArtistRes.json()) as any;
              const matches = (itArtistData.results || []).filter(
                (a: any) => (a.artistName || '').toLowerCase().trim() === normName
              );

              const matchedArtist = matches[0];

              if (matchedArtist && matchedArtist.artistId) {
                const itAlbRes = await fetchWithTimeout(
                  `https://itunes.apple.com/lookup?id=${matchedArtist.artistId}&entity=album&limit=100`
                );
                if (itAlbRes.ok) {
                  const itAlbData = (await itAlbRes.json()) as any;
                  // Skip index 0 which represents the artist entity itself
                  const candidates = (itAlbData.results || []).filter((a: any) => a.wrapperType === 'collection' && String(a.artistId) === String(matchedArtist.artistId));
                  const verified = catalogMatchesArchive(candidates.map((a: any) => ({ title: a.collectionName || '', year: Number(a.releaseDate?.slice(0, 4)) })), anchors);
                  for (const item of verified ? candidates : []) {
                    const title = (item.collectionName || '').trim();
                    const trackCount = item.trackCount || 0;

                    // Strictly Albums and EPs: Exclude singles and unrelated noise
                    if (!isValidAlbumOrEp(title, trackCount)) continue;

                    // Verify artist attribution on the album item
                    const itemArtist = (item.artistName || '').toLowerCase().trim();
                    if (itemArtist !== normName) continue;

                    const key = normalizeTitleKey(title);
                    if (key && seenKeys.has(key)) continue;
                    if (key) seenKeys.add(key);

                    const relDate = item.releaseDate ? item.releaseDate.split('T')[0] : '';
                    const year = relDate ? parseInt(relDate.split('-')[0], 10) : new Date().getFullYear();
                    const bigCover = item.artworkUrl100
                      ? item.artworkUrl100.replace('100x100bb', '600x600bb')
                      : '';
                    const isEp =
                      title.toLowerCase().includes('ep') ||
                      (trackCount >= 4 && trackCount <= 6);

                    discography.push({
                      id: `it-${item.collectionId}`,
                      title,
                      artistName: item.artistName || name,
                      releaseDate: relDate,
                      year,
                      coverUrl: bigCover,
                      type: isEp ? 'ep' : 'album',
                      tracksCount: trackCount,
                      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + (item.artistName || name))}`,
                      label: cleanRecordLabel(item.copyright || ''),
                      source: 'itunes_artist_catalog',
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.warn('iTunes artist discography error:', err);
          }
        }

        // C) Deezer Official Artist Discography (Complementary Catalog)
        if (name) {
          try {
            const dzSearchRes = await fetchWithTimeout(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`);
            if (dzSearchRes.ok) {
              const dzSearchData = (await dzSearchRes.json()) as any;
              const matchedArtist = (dzSearchData.data || []).find(
                (a: any) => a.name.toLowerCase().trim() === normName
              );

              if (matchedArtist && matchedArtist.id) {
                const dzAlbRes = await fetchWithTimeout(`https://api.deezer.com/artist/${matchedArtist.id}/albums?limit=100`);
                if (dzAlbRes.ok) {
                  const dzAlbData = (await dzAlbRes.json()) as any;
                  const candidates = dzAlbData.data || [];
                  const verified = catalogMatchesArchive(candidates.map((a: any) => ({ title: a.title || '', year: Number(a.release_date?.slice(0, 4)) })), anchors);
                  for (const item of verified ? candidates : []) {
                    if (item.artist?.id && String(item.artist.id) !== String(matchedArtist.id)) continue;
                    const isAlbumOrEp =
                      item.record_type === 'album' ||
                      item.record_type === 'ep' ||
                      item.record_type === 'compile';
                    if (!isAlbumOrEp) continue;

                    const title = (item.title || '').trim();
                    const lowerTitle = title.toLowerCase();



                    const trackCount = item.nb_tracks || (item.record_type === 'ep' ? 5 : 12);
                    if (!isValidAlbumOrEp(title, trackCount, item.record_type)) continue;

                    const key = normalizeTitleKey(title);
                    if (key && seenKeys.has(key)) continue;
                    if (key) seenKeys.add(key);

                    const relDate = item.release_date || '';
                    const year = relDate ? parseInt(relDate.split('-')[0], 10) : new Date().getFullYear();
                    const isEp =
                      item.record_type === 'ep' ||
                      lowerTitle.includes('ep') ||
                      (trackCount >= 4 && trackCount <= 6);

                    discography.push({
                      id: `dz-${item.id}`,
                      title,
                      artistName: matchedArtist.name || name,
                      releaseDate: relDate,
                      year,
                      coverUrl: item.cover_xl || item.cover_big || item.cover_medium || '',
                      type: isEp ? 'ep' : 'album',
                      tracksCount: trackCount,
                      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + (matchedArtist.name || name))}`,
                      source: 'deezer_catalog',
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.warn('Deezer artist discography error:', err);
          }
        }

        // Mandatory Sort: Newest on Left (index 0) to Oldest on Right (Requirement 12)
        discography.sort((a: any, b: any) => {
          const dateA = new Date(a.releaseDate).getTime();
          const dateB = new Date(b.releaseDate).getTime();
          if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
          return b.year - a.year;
        });

        res.statusCode = 200;
        res.end(JSON.stringify({ albums: discography, count: discography.length, artist: name }));
        return;
      }

      // 3. LOOKUP COVER & ARTIST PHOTO AUTOMATICALLY (Requirement 16)
      if (pathname === '/api/spotify/lookup-cover') {
        const title = (urlObj.searchParams.get('title') || '').trim();
        const artist = (urlObj.searchParams.get('artist') || '').trim();

        if (!title && !artist) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Titolo o artista richiesto' }));
          return;
        }

        let coverUrl = '';
        let artistImageUrl = '';
        let releaseDate = '';
        let year = new Date().getFullYear();
        let label = '';
        let found = false;

        const token = await getSpotifyAccessToken();
        if (token) {
          try {
            const query = [title ? `album:${title}` : '', artist ? `artist:${artist}` : ''].filter(Boolean).join(' ');
            const sRes = await fetchWithTimeout(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(query || title + ' ' + artist)}&type=album,artist&limit=3`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (sRes.ok) {
              const sData = (await sRes.json()) as any;
              const matchedAlbum = sData.albums?.items?.[0];
              const matchedArtist = sData.artists?.items?.[0];

              if (matchedAlbum) {
                coverUrl = matchedAlbum.images?.[0]?.url || '';
                releaseDate = matchedAlbum.release_date || '';
                year = releaseDate ? parseInt(releaseDate.split('-')[0], 10) : year;
                found = true;

                // Fetch album details for label
                try {
                  const detailRes = await fetchWithTimeout(`https://api.spotify.com/v1/albums/${matchedAlbum.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (detailRes.ok) {
                    const detail = (await detailRes.json()) as any;
                    label = cleanRecordLabel(detail.label || detail.copyrights?.[0]?.text || '');
                  }
                } catch {
                  // Ignore
                }
              }

              if (matchedArtist) {
                artistImageUrl = matchedArtist.images?.[0]?.url || '';
              }
            }
          } catch (err) {
            console.warn('Spotify lookup cover error:', err);
          }
        }

        // Public Fallback if not found via Spotify
        if (!coverUrl && title) {
          try {
            const itRes = await fetchWithTimeout(
              `https://itunes.apple.com/search?term=${encodeURIComponent(title + ' ' + artist)}&entity=album&limit=3`
            );
            if (itRes.ok) {
              const itData = (await itRes.json()) as any;
              const item = itData.results?.[0];
              if (item) {
                coverUrl = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
                releaseDate = item.releaseDate ? item.releaseDate.split('T')[0] : '';
                year = releaseDate ? parseInt(releaseDate.split('-')[0], 10) : year;
                label = cleanRecordLabel(item.copyright || '');
                found = true;
              }
            }
          } catch (err) {
            console.warn('iTunes fallback error:', err);
          }
        }

        if (!artistImageUrl && artist) {
          try {
            const dzRes = await fetchWithTimeout(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`);
            if (dzRes.ok) {
              const dzData = (await dzRes.json()) as any;
              const dzArt = dzData.data?.[0];
              if (dzArt && dzArt.picture_xl) {
                artistImageUrl = dzArt.picture_xl || dzArt.picture_big;
              }
            }
          } catch (err) {
            console.warn('Deezer artist lookup error:', err);
          }
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            found,
            coverUrl,
            artistImageUrl,
            releaseDate,
            year,
            label: cleanRecordLabel(label),
          })
        );
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint non trovato' }));
    } catch (err: any) {
      console.error('Server error:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Errore interno' }));
    }
  })();

  return true;
}
