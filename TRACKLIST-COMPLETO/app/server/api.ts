import { fetchWithTimeout } from './network.ts';
import { handleGemini } from './gemini.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAuthAndSync } from './authAndSync.ts';
import { handleBioAndEnrichment } from './spotifyAndBio.ts';
import { cleanRecordLabel } from '../src/utils/labelCleaner.ts';
export function createApiMiddleware() {
  let cachedToken: { token: string; expiresAt: number } | null = null;

  async function getSpotifyAccessToken(): Promise<string | null> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      return cachedToken.token;
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

      const data = await res.json();
      if (data.access_token) {
        cachedToken = {
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

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    let requestedPath = '';
    try { requestedPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname).replaceAll('\\', '/'); } catch { res.statusCode = 400; res.end(); return; }
    if (/^\/(?:server|test|scripts|@fs|\.data|\.env)(?:\/|$|\.)/.test(requestedPath) || requestedPath.startsWith('/src/data/catalogData.json') || requestedPath.startsWith('/assets/aistudio/')) {
      res.statusCode = 404; res.end(); return;
    }

        if (handleAuthAndSync(req, res)) return;
        if (handleGemini(req, res)) return;
        if (handleBioAndEnrichment(req, res)) return;

        if (!req.url?.startsWith('/api/spotify')) {
          return next();
        }

        const urlObj = new URL(req.url, 'http://localhost:3000');
        const pathname = urlObj.pathname;

        res.setHeader('Content-Type', 'application/json');

        const USER_AGENT =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        // 0. Status check: provides info on whether Spotify Web API credentials are set
        if (pathname === '/api/spotify/status') {
          const clientId = process.env.SPOTIFY_CLIENT_ID;
          const isConfigured = !!(clientId && process.env.SPOTIFY_CLIENT_SECRET);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              configured: isConfigured,
              hasClientId: !!clientId,
              mode: isConfigured ? 'official_api' : 'public_embed_fallback',
              message: isConfigured
                ? 'Spotify Web API configurata con successo tramite credenziali server.'
                : 'Credenziali Spotify Web API (SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET) non configurate. È attiva la modalità web pubblica e fallback.',
            })
          );
          return;
        }

        // 1. Fetch album details by Spotify ID or direct URL
        if (pathname === '/api/spotify/album') {
          const idOrUrl = urlObj.searchParams.get('id') || urlObj.searchParams.get('url') || '';
          if (/^dz-\d+$/.test(idOrUrl)) {
            const response = await fetchWithTimeout(`https://api.deezer.com/album/${idOrUrl.slice(3)}`);
            if (!response.ok) { res.statusCode = 502; res.end(JSON.stringify({ error: 'Catalogo non disponibile' })); return; }
            const data = await response.json();
            if (data.error || !Array.isArray(data.tracks?.data)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Album non trovato' })); return; }
            res.end(JSON.stringify({ releaseDate: data.release_date, label: data.label, genres: data.genres?.data?.map((g: any) => g.name).join(', '), tracks: data.tracks.data.map((t: any, i: number) => ({ title: t.title, trackNumber: i + 1, artists: t.artist?.name || data.artist?.name || '' })) }));
            return;
          }
          const match = idOrUrl.match(/album[/:]([a-zA-Z0-9]+)/) || [null, idOrUrl];
          const albumId = match[1]?.trim();

          if (!albumId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Album ID non fornito' }));
            return;
          }

          // A) Try official Spotify Web API first if token is available
          const token = await getSpotifyAccessToken();
          if (token) {
            try {
              const apiRes = await fetchWithTimeout(`https://api.spotify.com/v1/albums/${albumId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              if (apiRes.ok) {
                const alb = await apiRes.json();
                let totalDurationMs = 0;
                const tracks = (alb.tracks?.items || []).map((t: any, idx: number) => {
                  totalDurationMs += t.duration_ms || 0;
                  return {
                    trackNumber: t.track_number || idx + 1,
                    title: t.name || `Traccia ${idx + 1}`,
                    artists: (t.artists || []).map((a: any) => a.name).join(', ') || alb.artists?.[0]?.name || '',
                    durationMs: t.duration_ms || 0,
                    spotifyUri: t.uri || '',
                    previewUrl: t.preview_url || null,
                  };
                });

                const mins = Math.round(totalDurationMs / 60000);
                const result = {
                  id: alb.id,
                  title: alb.name,
                  artistName: (alb.artists || []).map((a: any) => a.name).join(', '),
                  artistIds: (alb.artists || []).map((a: any) => a.id),
                  artists: (alb.artists || []).map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    spotifyId: a.id,
                  })),
                  coverUrl: alb.images?.[0]?.url || '',
                  spotifyUrl: alb.external_urls?.spotify || `https://open.spotify.com/album/${alb.id}`,
                  duration: mins > 0 ? `${mins} min` : '',
                  releaseDate: alb.release_date || '',
                  label: cleanRecordLabel(alb.label || (alb.copyrights?.[0]?.text || '')),
                  genres: (alb.genres || []).join(', ') || 'Musica',
                  tracks,
                  source: 'official_api',
                };

                res.statusCode = 200;
                res.end(JSON.stringify(result));
                return;
              }
            } catch (err) {
              console.warn('Official Spotify album fetch error, using fallback:', err);
            }
          }

          // B) Fallback: Spotify Embed scraping
          try {
            const embedUrl = `https://open.spotify.com/embed/album/${albumId}`;
            const fetchRes = await fetchWithTimeout(embedUrl, {
              headers: { 'User-Agent': USER_AGENT },
            });

            if (!fetchRes.ok) {
              res.statusCode = fetchRes.status;
              res.end(JSON.stringify({ error: `Spotify embed error: ${fetchRes.status}` }));
              return;
            }

            const html = await fetchRes.text();
            const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);

            if (!dataMatch) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Dati Spotify non trovati' }));
              return;
            }

            const parsed = JSON.parse(dataMatch[1]);
            const entity = parsed.props?.pageProps?.state?.data?.entity;

            if (!entity) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Metadati album non trovati su Spotify' }));
              return;
            }

            let totalDurationMs = 0;
            const tracks = (entity.trackList || []).map((t: any, idx: number) => {
              totalDurationMs += t.duration || 0;
              return {
                trackNumber: idx + 1,
                title: t.title || `Traccia ${idx + 1}`,
                artists: t.subtitle || '',
                durationMs: t.duration || 0,
                spotifyUri: t.uri || '',
                previewUrl: t.audioPreview?.url || null,
              };
            });

            const mins = Math.round(totalDurationMs / 60000);

            const result = {
              id: albumId,
              title: entity.title || '',
              artistName: entity.subtitle || '',
              coverUrl: entity.visualIdentity?.image?.[0]?.url || '',
              spotifyUrl: `https://open.spotify.com/album/${albumId}`,
              duration: mins > 0 ? `${mins} min` : '',
              releaseDate: entity.releaseDate || '',
              label: '',
              genres: 'Musica',
              tracks,
              source: 'embed_fallback',
            };

            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message || 'Errore nel recupero da Spotify' }));
          }
          return;
        }

        // 2. Search Spotify by query
        if (pathname === '/api/spotify/search') {
          const query = urlObj.searchParams.get('q') || '';
          if (!query.trim()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Query di ricerca non valida' }));
            return;
          }

          // A) Try official Spotify Web API first if token is available
          const forceCatalog = urlObj.searchParams.get('catalog') === 'deezer';
          const token = forceCatalog ? null : await getSpotifyAccessToken();
          if (token) {
            try {
              const apiRes = await fetchWithTimeout(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album,artist&market=IT&limit=30`,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (apiRes.ok) {
                const searchData = await apiRes.json();
                const albums = (searchData.albums?.items || []).map((item: any) => ({
                  id: item.id,
                  title: item.name,
                  artistName: (item.artists || []).map((a: any) => a.name).join(', '),
                  artistIds: (item.artists || []).map((a: any) => a.id),
                  artists: (item.artists || []).map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    spotifyId: a.id,
                  })),
                  releaseDate: item.release_date || '',
                  year: item.release_date ? parseInt(item.release_date.split('-')[0], 10) : new Date().getFullYear(),
                  coverUrl: item.images?.[0]?.url || '',
                  spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/album/${item.id}`,
                  tracksCount: item.total_tracks || 0,
                  tracks: [],
                }));

                const artists = (searchData.artists?.items || []).map((item: any) => ({
                  id: item.id,
                  name: item.name,
                  spotifyId: item.id,
                  genres: item.genres || [],
                  imageUrl: item.images?.[0]?.url || '',
                  followers: item.followers?.total || 0,
                }));

                res.statusCode = 200;
                res.end(JSON.stringify({ albums, artists, source: 'official_api' }));
                return;
              }
            } catch (err) {
              console.warn('Official Spotify search error, falling back:', err);
            }
          }

          // B) Fallback search via DuckDuckGo + Spotify embed + Deezer
          try {
            const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:open.spotify.com/album ' + query)}`;
            const ddgRes = forceCatalog ? new Response('', { status: 200 }) : await fetchWithTimeout(ddgUrl, {
              headers: { 'User-Agent': USER_AGENT },
            });

            let albumId: string | null = null;
            if (ddgRes.ok) {
              const html = await ddgRes.text();
              const matches = [...html.matchAll(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/g)];
              if (matches.length > 0) {
                albumId = matches[0][1];
              }
            }

            if (albumId) {
              const embedUrl = `https://open.spotify.com/embed/album/${albumId}`;
              const fetchRes = await fetchWithTimeout(embedUrl, {
                headers: { 'User-Agent': USER_AGENT },
              });

              if (fetchRes.ok) {
                const html = await fetchRes.text();
                const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
                if (dataMatch) {
                  const parsed = JSON.parse(dataMatch[1]);
                  const entity = parsed.props?.pageProps?.state?.data?.entity;
                  if (entity) {
                    let totalDurationMs = 0;
                    const tracks = (entity.trackList || []).map((t: any, idx: number) => {
                      totalDurationMs += t.duration || 0;
                      return {
                        trackNumber: idx + 1,
                        title: t.title || `Traccia ${idx + 1}`,
                        artists: t.subtitle || '',
                        durationMs: t.duration || 0,
                        spotifyUri: t.uri || '',
                      };
                    });

                    const mins = Math.round(totalDurationMs / 60000);
                    const singleResult = {
                      id: albumId,
                      title: entity.title || '',
                      artistName: entity.subtitle || '',
                      coverUrl: entity.visualIdentity?.image?.[0]?.url || '',
                      spotifyUrl: `https://open.spotify.com/album/${albumId}`,
                      duration: mins > 0 ? `${mins} min` : '',
                      releaseDate: entity.releaseDate || '',
                      tracks,
                      source: 'embed_fallback',
                    };

                    res.statusCode = 200;
                    res.end(JSON.stringify({ albums: [singleResult], artists: [], source: 'embed_fallback' }));
                    return;
                  }
                }
              }
            }

            // Fallback: search via Deezer
            const deezerUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=100`;
            const dzRes = await fetchWithTimeout(deezerUrl);
            if (dzRes.ok) {
              const dzData = await dzRes.json();
              if (dzData.data && dzData.data.length > 0) {
                const albums = dzData.data.slice(0, 100).map((item: any) => ({
                  id: `dz-${item.id}`,
                  title: item.title,
                  artistName: item.artist?.name || '',
                  coverUrl: item.cover_xl || item.cover_big,
                  spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(item.title + ' ' + (item.artist?.name || ''))}`,
                  tracksCount: item.nb_tracks || 0,
                  tracks: [],
                  source: 'deezer_fallback',
                }));

                res.statusCode = 200;
                res.end(JSON.stringify({ albums, artists: [], source: 'deezer_fallback' }));
                return;
              }
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ albums: [], artists: [], source: 'none' }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message || 'Errore nella ricerca' }));
          }
          return;
        }

        // 3. Search or lookup artist
        if (pathname === '/api/spotify/artist') {
          const id = urlObj.searchParams.get('id') || '';
          const token = await getSpotifyAccessToken();
          if (token && id) {
            try {
              const artRes = await fetchWithTimeout(`https://api.spotify.com/v1/artists/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (artRes.ok) {
                const art = await artRes.json();
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    id: art.id,
                    name: art.name,
                    spotifyId: art.id,
                    imageUrl: art.images?.[0]?.url || '',
                    genres: art.genres || [],
                    followers: art.followers?.total || 0,
                  })
                );
                return;
              }
            } catch (err) {
              console.warn('Spotify artist fetch error:', err);
            }
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Artista non trovato' }));
          return;
        }

        next();
  };
}

