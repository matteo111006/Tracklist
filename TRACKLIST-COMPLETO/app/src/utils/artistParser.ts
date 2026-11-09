import { Album, Artist, ArtistRef } from '../types/index.ts';

/**
 * Known official musical groups, bands, and collectives that must NEVER be split.
 */
export const PROTECTED_COLLECTIVES = new Set([
  'club dogo',
  '333 mob',
  'dark polo gang',
  'fsk satellite',
  'truceklan',
  'dogo gang',
  'slime',
  'the kolors',
  'pinguini tattici nucleari',
  'coma_cose',
  'colapesce dimartino',
  'måneskin',
  'subsonica',
  'negramaro',
  'baustelle',
  'afterhours',
  'marlene kuntz',
  'cccp',
  'csi',
  'linea 77',
  'pooh',
  'beatles',
  'pink floyd',
  'led zeppelin',
  'rolling stones',
  'n.w.a',
  'wu-tang clan',
  'a tribe called quest',
  'outkast',
  'daft punk',
  'swedish house mafia',
  'major lazer',
  'twenty one pilots',
  'brockhampton',
  'gorillaz',
  'linkin park',
  'coldplay',
  'radiohead',
  'oasis',
  'blur',
  'green day',
  'blink-182',
  'red hot chili peppers',
  'rage against the machine',
  'arctic monkeys',
  'the strokes',
  'black eyed peas',
  'the fugees',
  'fugees',
  'massive attack',
  'portishead',
  'cypress hill',
  'beastie boys',
  'run-d.m.c.',
  'run dmc',
  'public enemy',
  'de la soul',
]);

/**
 * Deterministic slug generator for artist IDs.
 */
export function slugifyArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Splits an artist string into distinct artist names, respecting recognized groups.
 */
export function splitArtistNames(raw: string): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (PROTECTED_COLLECTIVES.has(trimmed.toLowerCase())) {
    return [trimmed];
  }

  // Split on commas, ampersands, or ' x ' / ' X '
  const parts = trimmed.split(/\s*,\s*|\s+&\s+|\s+[xX]\s+/);
  const result: string[] = [];

  for (const p of parts) {
    const clean = p.trim();
    if (!clean) continue;

    // Check if subpart is a protected collective
    if (PROTECTED_COLLECTIVES.has(clean.toLowerCase())) {
      result.push(clean);
      continue;
    }

    result.push(clean);
  }

  return result.length > 0 ? result : [trimmed];
}

/**
 * Resolves artist references for an album given existing artists in the database.
 */
export function resolveAlbumArtists(
  album: Partial<Album>,
  existingArtists: Artist[]
): { artistIds: string[]; artists: ArtistRef[]; newArtists: Artist[] } {
  const existingMapByName = new Map<string, Artist>();
  const existingMapById = new Map<string, Artist>();

  existingArtists.forEach((a) => {
    existingMapByName.set(a.name.toLowerCase(), a);
    existingMapById.set(a.id, a);
  });

  const names = album.artists && album.artists.length > 0
    ? album.artists.map((a) => a.name)
    : splitArtistNames(album.artistName || '');

  const artistIds: string[] = [];
  const artists: ArtistRef[] = [];
  const newArtists: Artist[] = [];

  names.forEach((name) => {
    const lower = name.toLowerCase();
    let found = existingMapByName.get(lower);

    if (!found) {
      // Check if primary artistId matches
      if (album.artistId && existingMapById.has(album.artistId)) {
        const byId = existingMapById.get(album.artistId)!;
        if (byId.name.toLowerCase() === lower) {
          found = byId;
        }
      }
    }

    if (found) {
      if (!artistIds.includes(found.id)) {
        artistIds.push(found.id);
        artists.push({ id: found.id, name: found.name, spotifyId: found.spotifyId });
      }
    } else {
      // Generate a new artist entry
      const newId = `art-${slugifyArtistName(name)}`;
      const created: Artist = {
        id: newId,
        name,
        bio: `${name} è presente nella collezione con le sue pubblicazioni e collaborazioni.`,
        imageUrl:
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
      };
      existingMapByName.set(lower, created);
      existingMapById.set(newId, created);
      newArtists.push(created);

      artistIds.push(newId);
      artists.push({ id: newId, name: created.name });
    }
  });

  return { artistIds, artists, newArtists };
}

/**
 * Checks if an album belongs to an artist (supports single and multi-artist albums).
 */
export function albumMatchesArtist(album: Album, artistIdOrName: string): boolean {
  if (!artistIdOrName) return false;
  const target = artistIdOrName.toLowerCase().trim();

  // 1. Direct ID match
  if (album.artistId && album.artistId.toLowerCase() === target) return true;
  if (album.artistIds && album.artistIds.some((id) => id.toLowerCase() === target)) return true;

  // 2. Structured artist objects match
  if (album.artists && album.artists.some((a) => a.id.toLowerCase() === target || a.name.toLowerCase() === target)) {
    return true;
  }

  // 3. Formatted artistName string match or split matching
  if (album.artistName) {
    const lowerName = album.artistName.toLowerCase();
    if (lowerName === target) return true;
    const split = splitArtistNames(album.artistName).map((n) => n.toLowerCase());
    if (split.includes(target)) return true;
  }

  return false;
}

/**
 * Safely extracts all artist references from an album.
 */
export function getAlbumArtistRefs(album: Album, fallbackArtists: Artist[] = []): ArtistRef[] {
  const artistMapByName = new Map<string, Artist>();
  const artistMapById = new Map<string, Artist>();
  fallbackArtists.forEach((a) => {
    artistMapByName.set(a.name.toLowerCase().trim(), a);
    artistMapById.set(a.id, a);
  });

  // If album already has structured artists, sanitize to guarantee distinct IDs
  if (album.artists && album.artists.length > 0) {
    const seenIds = new Set<string>();
    const sanitized: ArtistRef[] = [];
    album.artists.forEach((art, idx) => {
      let id = art.id;
      // If id is missing, or already seen among sibling artists, or matches a joint composite ID
      if (!id || seenIds.has(id)) {
        const found = artistMapByName.get(art.name.toLowerCase().trim());
        id = found ? found.id : `art-${slugifyArtistName(art.name || `artist-${idx + 1}`)}`;
        if (seenIds.has(id)) {
          id = `${id}-${idx + 1}`;
        }
      }
      seenIds.add(id);
      sanitized.push({ ...art, id });
    });
    return sanitized;
  }

  if (album.artistIds && album.artistIds.length > 0) {
    const refs: ArtistRef[] = [];
    const seenIds = new Set<string>();
    album.artistIds.forEach((id) => {
      const art = artistMapById.get(id);
      if (art && !seenIds.has(art.id)) {
        seenIds.add(art.id);
        refs.push({ id: art.id, name: art.name, spotifyId: art.spotifyId });
      }
    });
    if (refs.length > 0) return refs;
  }

  // Fallback to parsed artistName
  const names = splitArtistNames(album.artistName || '');
  if (names.length <= 1) {
    const singleName = names[0] || album.artistName || 'Artista sconosciuto';
    const found = artistMapByName.get(singleName.toLowerCase().trim());
    return [
      {
        id: found?.id || album.artistId || `art-${slugifyArtistName(singleName)}`,
        name: singleName,
        spotifyId: found?.spotifyId,
      },
    ];
  }

  // Multiple artists: ensure each individual artist has their own unique ID
  const seenIds = new Set<string>();
  return names.map((name, idx) => {
    const cleanName = name.trim();
    const found = artistMapByName.get(cleanName.toLowerCase());
    let id = found ? found.id : `art-${slugifyArtistName(cleanName)}`;
    if (seenIds.has(id)) {
      id = `${id}-${idx + 1}`;
    }
    seenIds.add(id);
    return {
      id,
      name: cleanName,
      spotifyId: found?.spotifyId,
    };
  });
}
