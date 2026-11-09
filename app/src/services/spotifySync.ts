import { Album, Track } from '../types';
import { cleanRecordLabel } from '../utils/labelCleaner';

export interface SpotifyTrackData {
  trackNumber: number;
  title: string;
  artists?: string;
  durationMs?: number;
  spotifyUri?: string;
  previewUrl?: string | null;
}

export interface SpotifyAlbumData {
  id: string;
  title: string;
  artistName: string;
  coverUrl: string;
  spotifyUrl: string;
  duration?: string;
  releaseDate?: string;
  label?: string;
  tracks: SpotifyTrackData[];
}

export interface SyncResult {
  success: boolean;
  updatedAlbum: Album;
  updatedCount: number;
  message: string;
  source: 'spotify' | 'fallback';
}

/**
 * Extracts a Spotify album ID from various link / URI formats.
 */
export function extractSpotifyAlbumId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern: https://open.spotify.com/album/4eLPsYPBmXABThSJ821sqY...
  const urlMatch = trimmed.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]{15,30})/);
  if (urlMatch) return urlMatch[1];

  // Pattern: spotify:album:4eLPsYPBmXABThSJ821sqY
  const uriMatch = trimmed.match(/spotify:album:([a-zA-Z0-9]{15,30})/);
  if (uriMatch) return uriMatch[1];

  // Raw ID check (typically 22 chars alphanumeric)
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Fetches album metadata and tracklist directly from Spotify (or proxy).
 */
export async function fetchSpotifyAlbumById(albumId: string): Promise<SpotifyAlbumData | null> {
  try {
    const res = await fetch(`/api/spotify/album?id=${encodeURIComponent(albumId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !Array.isArray(data.tracks) || !data.tracks.length) return null;
    return data as SpotifyAlbumData;
  } catch (err) {
    console.warn('Error fetching Spotify album by ID:', err);
    return null;
  }
}

/**
 * Searches for an album on Spotify by title and artist name.
 */
export async function searchSpotifyAlbum(query: string): Promise<SpotifyAlbumData | null> {
  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const albums = Array.isArray(data.albums) ? data.albums : [data];
    const candidate = albums.find((item: any) => item?.id && !item.id.startsWith('dz-'));
    if (!candidate) return null;
    return candidate.tracks?.length ? candidate as SpotifyAlbumData : await fetchSpotifyAlbumById(candidate.id.replace(/^sp-/, ''));
  } catch (err) {
    console.warn('Error searching Spotify album:', err);
    return null;
  }
}

/**
 * Normalizes title string for relaxed matching.
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/\((?:feat\.?|featuring|prod\.?|con)\s[^)]*\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Synchronizes an album with Spotify metadata and tracklist:
 * - Updates track titles, featured artists, and track order from Spotify
 * - Updates album cover artwork to official high-res Spotify cover
 * - Updates album duration and Spotify link
 * - CRITICAL: Preserves all user ratings assigned to tracks!
 */
export async function syncAlbumWithSpotify(
  currentAlbum: Album,
  manualInput?: string
): Promise<SyncResult> {
  // 1. Try to find Spotify album data
  let spotifyData: SpotifyAlbumData | null = null;
  let explicitId = extractSpotifyAlbumId(manualInput);

  if (!explicitId && currentAlbum.spotifyUrl) {
    explicitId = extractSpotifyAlbumId(currentAlbum.spotifyUrl);
  }

  if (explicitId) {
    spotifyData = await fetchSpotifyAlbumById(explicitId);
  }

  // 2. If no direct ID found, search Spotify by Album + Artist
  if (!spotifyData) {
    const query = manualInput?.trim() || `${currentAlbum.title} ${currentAlbum.artistName}`;
    spotifyData = await searchSpotifyAlbum(query);
  }

  // If still not found, return a polite error result
  if (!spotifyData || !spotifyData.tracks || spotifyData.tracks.length === 0) {
    return {
      success: false,
      updatedAlbum: currentAlbum,
      updatedCount: 0,
      message:
        'Nessun album corrispondente trovato su Spotify. Inserisci il link diretto Spotify per sincronizzare.',
      source: 'spotify',
    };
  }

  // 3. Align and merge tracks: PRESERVING ALL RATINGS
  const existingTracks = currentAlbum.tracks || [];
  let updatedCount = 0;

  // Build lookup maps for existing tracks: by trackNumber and by normalized title
  const byTitleKey = new Map<string, Track>();
  const byUri = new Map<string, Track>();
  const usedIds = new Set<string>();

  existingTracks.forEach((t) => {
    if (t.spotifyUri) byUri.set(t.spotifyUri, t);
    const key = normalizeKey(t.title);
    if (key) byTitleKey.set(key, t);
  });

  const mergedTracks: Track[] = spotifyData.tracks.map((spTrack, idx) => {
    const spNumber = spTrack.trackNumber || idx + 1;
    const spKey = normalizeKey(spTrack.title);

    // Look for matching existing track: first by title, then by track number
    const candidate = (spTrack.spotifyUri && byUri.get(spTrack.spotifyUri)) || (spKey && byTitleKey.get(spKey));
    const matchedTrack = candidate && !usedIds.has(candidate.id) ? candidate : undefined;
    if (matchedTrack) usedIds.add(matchedTrack.id);

    const userRating = matchedTrack ? matchedTrack.rating : null;
    const existingId = matchedTrack ? matchedTrack.id : `tr-${currentAlbum.id}-spotify-${spNumber}-${idx}`;

    if (matchedTrack && (matchedTrack.title !== spTrack.title || matchedTrack.artists !== spTrack.artists)) {
      updatedCount++;
    } else if (!matchedTrack) {
      updatedCount++;
    }

    return {
      id: existingId,
      albumId: currentAlbum.id,
      trackNumber: spNumber,
      title: spTrack.title.toUpperCase(),
      artists: spTrack.artists || currentAlbum.artistName,
      durationMs: spTrack.durationMs,
      spotifyUri: spTrack.spotifyUri,
      previewUrl: spTrack.previewUrl,
      rating: userRating, // Preserved!
    };
  });

  // If original album had more tracks than Spotify found and they were rated, preserve them at the end
  {
    const mergedIds = new Set(mergedTracks.map((t) => t.id));
    existingTracks.forEach((oldT) => {
      if (!mergedIds.has(oldT.id) && oldT.rating !== null) {
        mergedTracks.push(oldT);
      }
    });
  }

  // Build the updated album object
  const updatedAlbum: Album = {
    ...currentAlbum,
    title: spotifyData.title ? spotifyData.title.toUpperCase() : currentAlbum.title,
    artistName: spotifyData.artistName || currentAlbum.artistName,
    coverUrl: spotifyData.coverUrl || currentAlbum.coverUrl,
    spotifyUrl: spotifyData.spotifyUrl || currentAlbum.spotifyUrl,
    duration: spotifyData.duration || currentAlbum.duration,
    label: cleanRecordLabel(spotifyData.label || currentAlbum.label),
    spotifyId: spotifyData.id,
    tracks: currentAlbum.isManualTracklist ? existingTracks : mergedTracks,
  };

  if (spotifyData.releaseDate && (!currentAlbum.releaseDate || currentAlbum.releaseDate === '2026-01-01')) {
    updatedAlbum.releaseDate = spotifyData.releaseDate;
    try {
      updatedAlbum.releaseDateFormatted = new Date(spotifyData.releaseDate).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).toUpperCase();
      updatedAlbum.year = new Date(spotifyData.releaseDate).getFullYear() || currentAlbum.year;
    } catch {
      // keep existing
    }
  }

  return {
    success: true,
    updatedAlbum,
    updatedCount,
    message: `Sincronizzato con Spotify con successo: ${mergedTracks.length} tracce e metadati aggiornati`,
    source: 'spotify',
  };
}
