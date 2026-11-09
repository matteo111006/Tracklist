import { Album, AlbumRatingStats, Artist, ArtistRef, Track } from '../types/index.ts';
import { albumMatchesArtist, getAlbumArtistRefs, splitArtistNames } from './artistParser.ts';

/**
 * Calculates ratings statistics for an album:
 * - Average rating: strictly arithmetic mean of valid rated tracks (null if 0 rated tracks)
 * - Distribution across 4 distinct buckets [0,4), [4,6), [6,8), [8,10]
 * - Top 5 tracks sorted by rating descending
 */
export function calculateAlbumStats(tracks: Track[]): AlbumRatingStats {
  const ratedTracks = tracks.filter((t) => t.rating !== null && !isNaN(t.rating));
  const ratedCount = ratedTracks.length;
  const totalTracks = tracks.length;

  let averageRating: number | null = null;
  if (ratedCount > 0) {
    const sum = ratedTracks.reduce((acc, t) => acc + (t.rating as number), 0);
    averageRating = sum / ratedCount;
  }

  // Distribution buckets (no overlap)
  const distribution = {
    '0-4': 0,
    '4-6': 0,
    '6-8': 0,
    '8-10': 0,
  };

  ratedTracks.forEach((t) => {
    const r = t.rating as number;
    if (r < 4) {
      distribution['0-4']++;
    } else if (r < 6) {
      distribution['4-6']++;
    } else if (r < 8) {
      distribution['6-8']++;
    } else {
      distribution['8-10']++;
    }
  });

  // Top 5 tracks
  const sortedTracks = [...ratedTracks].sort((a, b) => {
    const diff = (b.rating as number) - (a.rating as number);
    if (diff !== 0) return diff;
    return a.trackNumber - b.trackNumber;
  });

  return {
    averageRating,
    ratedCount,
    totalTracks,
    isFullyRated: totalTracks > 0 && ratedCount === totalTracks,
    topTracks: sortedTracks.slice(0, 5),
    distribution,
  };
}

/**
 * Formats a rating value into the exact Italian format with comma.
 * Matches Tracklist's natural precision observed in screenshots:
 * e.g. 9,3214 | 9,1429 | 9,125 | 8,75 | 8,05 | 10,00
 */
export function formatRating(val: number | null | undefined, forceDecimals?: number): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '—';
  }

  if (forceDecimals !== undefined) {
    return val.toFixed(forceDecimals).replace('.', ',');
  }

  // Natural high precision with maximum 4 decimals, min 2 decimals
  const rounded4 = Math.round(val * 10000) / 10000;
  const str = rounded4.toString();
  const decimalPart = str.split('.')[1] || '';

  if (decimalPart.length <= 2) {
    return rounded4.toFixed(2).replace('.', ',');
  }

  return rounded4.toString().replace('.', ',');
}

/**
 * Checks if an album is evaluated (has at least 1 rated track, and is not deleted).
 */
export function isAlbumEvaluated(album: Album): boolean {
  if (album.deleted) return false;
  if (!album.tracks || album.tracks.length === 0) return false;
  return album.tracks.some((t) => t.rating !== null);
}

/**
 * Checks if an album is eligible for official rankings (evaluated, not draft, not deleted).
 */
export function isAlbumInRankings(album: Album): boolean {
  if (album.deleted) return false;
  if (!isAlbumEvaluated(album)) return false;
  if (album.evaluationStatus === 'draft') return false;
  return true;
}

export interface CandidateSong {
  title: string;
  artist: string;
  albumTitle: string;
  coverUrl: string;
  rating: number;
  releaseDate?: string;
  albumYear?: number;
}

/**
 * Deduplicates songs in rankings according to Requirement 4:
 * - If a song appears in multiple albums, only the occurrence with the highest score is included.
 * - In case of a tie in score, the occurrence from the earlier released album is selected.
 * - Preserves legitimately distinct versions (e.g. Remix, Live, Acoustic).
 */
export function deduplicateSongsRankings<T extends CandidateSong>(songs: T[]): T[] {
  const map = new Map<string, T>();

  songs.forEach((s) => {
    const titleLower = s.title.toLowerCase().trim();
    const versionMatch = titleLower.match(/\((remix|live|acousti[ck]|acustica|instrumental|edit|speed up|slowed)[^)]*\)/);
    const versionTag = versionMatch ? `_${versionMatch[0]}` : '';
    const baseTitle = titleLower
      .replace(/\((feat|featuring|prod|con)[^)]*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const primaryArtist = (s.artist || '').split(/[,&]/)[0].toLowerCase().trim();
    const key = `${primaryArtist}:::${baseTitle}${versionTag}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      if (s.rating > existing.rating) {
        map.set(key, s);
      } else if (s.rating === existing.rating) {
        const dateNew = s.releaseDate ? new Date(s.releaseDate).getTime() : NaN;
        const dateExisting = existing.releaseDate ? new Date(existing.releaseDate).getTime() : NaN;

        if (!isNaN(dateNew) && !isNaN(dateExisting) && dateNew !== dateExisting) {
          if (dateNew < dateExisting) {
            map.set(key, s);
          }
        } else if ((s.albumYear || 9999) < (existing.albumYear || 9999)) {
          map.set(key, s);
        } else if ((s.albumTitle || '').localeCompare(existing.albumTitle || '') < 0) {
          map.set(key, s);
        }
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const diff = b.rating - a.rating;
    if (diff !== 0) return diff;
    const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : NaN;
    const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : NaN;
    if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return dateA - dateB;
    return (a.title || '').localeCompare(b.title || '');
  });
}

export interface ArtistAlbumItem {
  album: Album;
  isCollaboration: boolean;
  coArtists: ArtistRef[];
  averageRating: number | null;
}

export interface ArtistStats {
  albumsCount: number;
  ratedAlbumsCount: number;
  artistAverage: number | null;
  bestAlbum: { title: string; average: number } | null;
  topTracks: { track: Track; albumTitle: string }[];
  albums: Album[];
  artistAlbums: ArtistAlbumItem[];
}

/**
 * Calculate artist discography and stats, supporting multi-artist albums and
 * deduplicating tracks by highest score (earlier album on tie).
 */
export function calculateArtistStats(artist: Artist, allAlbums: Album[]): ArtistStats {
  // Find all albums where this artist is either primary or secondary/collaborator
  const matchedAlbums = allAlbums.filter(
    (a) => albumMatchesArtist(a, artist.id) || albumMatchesArtist(a, artist.name)
  );

  const ratedAlbums = matchedAlbums.filter((a) => isAlbumEvaluated(a));

  // Group duplicate tracks across albums:
  // "Se una canzone appare in più album, deve comparire una sola volta con il voto più alto registrato
  // e se con lo stesso voto inserire l'album uscito prima."
  interface TrackCandidate {
    track: Track;
    albumTitle: string;
    releaseDate: string;
    albumYear: number;
  }

  const uniqueTracksMap = new Map<string, TrackCandidate>();

  matchedAlbums.forEach((a) => {
    const albumReleaseDate = a.releaseDate || `${a.year}-01-01`;
    a.tracks.forEach((t) => {
      if (t.rating !== null && !isNaN(t.rating)) {
        const key = t.title.trim().toUpperCase().replace(/\s+/g, ' ');
        const candidate: TrackCandidate = {
          track: t,
          albumTitle: a.title,
          releaseDate: albumReleaseDate,
          albumYear: a.year,
        };

        const existing = uniqueTracksMap.get(key);
        if (!existing) {
          uniqueTracksMap.set(key, candidate);
        } else {
          const currentRating = existing.track.rating as number;
          const newRating = t.rating as number;

          if (newRating > currentRating) {
            uniqueTracksMap.set(key, candidate);
          } else if (newRating === currentRating) {
            const dateNew = new Date(albumReleaseDate).getTime();
            const dateExisting = new Date(existing.releaseDate).getTime();

            const isValidNew = !isNaN(dateNew);
            const isValidExisting = !isNaN(dateExisting);

            if (isValidNew && isValidExisting) {
              if (dateNew < dateExisting) {
                uniqueTracksMap.set(key, candidate);
              }
            } else if (a.year < existing.albumYear) {
              uniqueTracksMap.set(key, candidate);
            }
          }
        }
      }
    });
  });

  const deduplicatedTracks = Array.from(uniqueTracksMap.values());

  // Artist average across deduplicated tracks
  let artistAverage: number | null = null;
  if (deduplicatedTracks.length > 0) {
    const sum = deduplicatedTracks.reduce((acc, curr) => acc + (curr.track.rating as number), 0);
    artistAverage = sum / deduplicatedTracks.length;
  }

  // Best album
  let bestAlbum: { title: string; average: number } | null = null;
  ratedAlbums.forEach((a) => {
    const stats = calculateAlbumStats(a.tracks);
    if (stats.averageRating !== null) {
      if (!bestAlbum || stats.averageRating > bestAlbum.average) {
        bestAlbum = { title: a.title, average: stats.averageRating };
      }
    }
  });

  // Top rated tracks (deduplicated, sorted by rating desc, then earlier release date)
  const sortedTracks = [...deduplicatedTracks].sort((a, b) => {
    const diff = (b.track.rating as number) - (a.track.rating as number);
    if (diff !== 0) return diff;
    const dateA = new Date(a.releaseDate).getTime();
    const dateB = new Date(b.releaseDate).getTime();
    if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
      return dateA - dateB;
    }
    return a.track.trackNumber - b.track.trackNumber;
  });

  // Rich artist album items
  const artistAlbums: ArtistAlbumItem[] = matchedAlbums.map((alb) => {
    const refs = getAlbumArtistRefs(alb);
    const coArtists = refs.filter(
      (r) => r.id !== artist.id && r.name.toLowerCase() !== artist.name.toLowerCase()
    );
    const stats = calculateAlbumStats(alb.tracks);
    return {
      album: alb,
      isCollaboration: refs.length > 1,
      coArtists,
      averageRating: stats.averageRating,
    };
  });

  return {
    albumsCount: matchedAlbums.length,
    ratedAlbumsCount: ratedAlbums.length,
    artistAverage,
    bestAlbum,
    topTracks: sortedTracks.slice(0, 5),
    albums: matchedAlbums,
    artistAlbums,
  };
}

export interface SongAwardWinner {
  title: string;
  artist: string;
  albumTitle: string;
  coverUrl: string;
  rating: number;
  releaseDate?: string;
  albumYear?: number;
}

export interface RankedSong {
  rank: number;
  isTie: boolean;
  title: string;
  artist: string;
  albumTitle: string;
  coverUrl: string;
  rating: number;
}

export interface ArtistAwardWinner {
  artistName: string;
  artistId?: string;
  imageUrl?: string;
  score: number;
  detail: string;
  albumCount: number;
}

export interface CollaborativeAwardWinner {
  albumId: string;
  albumTitle: string;
  artists: string;
  coverUrl: string;
  average: number;
  year: number;
}

/**
 * Calculates Awards data for a given year:
 * - Album Awards: ONLY considers standard edition albums (Requirement 8)
 * - Artist Awards: Dedicated artist categories (Requirement 5)
 * - Song Awards: Top songs of the year
 */
export function isArtistAwardEdition(album: Album): boolean {
  return !album.editionType || album.editionType === 'standard' || album.editionType === 'deluxe';
}

export function calculateYearAwards(
  allAlbums: Album[],
  year: number,
  allArtists: Artist[] = [],
  minAlbumsThreshold: number = 1
) {
  // Evaluated albums of the target year
  const yearAlbums = allAlbums.filter((a) => a.year === year && isAlbumInRankings(a));

  const totalAlbums = yearAlbums.length;
  const uniqueArtists = new Set(yearAlbums.flatMap((a) => getAlbumArtistRefs(a).map((r) => r.name))).size;

  let totalTracksRated = 0;
  let sumAlbumAverages = 0;
  let ratedAlbumCount = 0;

  // Requirement 8: For the official Album Ranking of the Year, ONLY STANDARD EDITIONS are eligible!
  const albumRanking: {
    album: Album;
    average: number;
    ratedCount: number;
  }[] = [];

  const allSongsOfYear: SongAwardWinner[] = [];

  yearAlbums.forEach((album) => {
    const stats = calculateAlbumStats(album.tracks);
    if (stats.averageRating !== null) {
      sumAlbumAverages += stats.averageRating;
      ratedAlbumCount++;

      // Strict Standard Edition filter for Album Awards
      if (!album.editionType || album.editionType === 'standard') {
        albumRanking.push({
          album,
          average: stats.averageRating,
          ratedCount: stats.ratedCount,
        });
      }
    }

    album.tracks.forEach((t) => {
      if (t.rating !== null) {
        totalTracksRated++;
        allSongsOfYear.push({
          title: t.title,
          artist: t.artists || album.artistName,
          albumTitle: album.title,
          coverUrl: album.coverUrl,
          rating: t.rating,
          releaseDate: album.releaseDate || `${album.year}-01-01`,
          albumYear: album.year,
        });
      }
    });
  });

  // Sort standard albums by average descending
  albumRanking.sort((a, b) => b.average - a.average);

  const bestAlbum = albumRanking[0] || null;
  const top10Albums = albumRanking.slice(0, 10);
  const averageAlbumRating = ratedAlbumCount > 0 ? sumAlbumAverages / ratedAlbumCount : null;

  // Deduplicate songs of year (Requirement 4: highest score wins; if tie, earlier release date wins)
  const deduplicatedSongsOfYear = deduplicateSongsRankings(allSongsOfYear);

  let tiedWinners: SongAwardWinner[] = [];
  let winningScore: number | null = null;

  if (deduplicatedSongsOfYear.length > 0) {
    winningScore = deduplicatedSongsOfYear[0].rating;
    tiedWinners = deduplicatedSongsOfYear.filter((s) => s.rating === winningScore);
  }

  const rankedTopSongs: RankedSong[] = [];
  let currentRank = 1;
  for (let i = 0; i < deduplicatedSongsOfYear.length; i++) {
    const song = deduplicatedSongsOfYear[i];
    const prevSong = deduplicatedSongsOfYear[i - 1];
    const isTie = prevSong ? prevSong.rating === song.rating : false;

    if (!isTie) {
      currentRank = i + 1;
    }

    rankedTopSongs.push({
      rank: currentRank,
      isTie,
      title: song.title,
      artist: song.artist,
      albumTitle: song.albumTitle,
      coverUrl: song.coverUrl,
      rating: song.rating,
    });

    if (rankedTopSongs.length >= 16) break;
  }

  // ==========================================
  // ARTIST AWARDS (Requirement 5)
  // ==========================================
  interface ArtistYearStats {
    artistName: string;
    artistId?: string;
    imageUrl?: string;
    albums: Album[];
    tracksCount: number;
    sumRatings: number;
    albumAverages: number[];
  }

  const artistMap = new Map<string, ArtistYearStats>();
  const artistLookup = new Map(allArtists.map((a) => [a.name.toLowerCase(), a]));
  const artistYearAlbums = yearAlbums.filter(isArtistAwardEdition);

  artistYearAlbums.forEach((album) => {
    const refs = getAlbumArtistRefs(album, allArtists);
    const albStats = calculateAlbumStats(album.tracks);
    const avg = albStats.averageRating;

    refs.forEach((ref) => {
      const key = ref.name.toLowerCase();
      let entry = artistMap.get(key);
      if (!entry) {
        const artObj = artistLookup.get(key);
        entry = {
          artistName: ref.name,
          artistId: ref.id,
          imageUrl: artObj?.imageUrl,
          albums: [],
          tracksCount: 0,
          sumRatings: 0,
          albumAverages: [],
        };
        artistMap.set(key, entry);
      }

      entry.albums.push(album);
      if (avg !== null) {
        entry.albumAverages.push(avg);
      }

      album.tracks.forEach((t) => {
        if (t.rating !== null) {
          entry!.tracksCount++;
          entry!.sumRatings += t.rating;
        }
      });
    });
  });

  const yearArtists = Array.from(artistMap.values());

  // 1. Miglior Artista dell'Anno (average rating, respecting threshold)
  const eligibleForBest = yearArtists.filter((a) => a.albums.length >= minAlbumsThreshold);
  eligibleForBest.sort((a, b) => {
    const avgA = a.albumAverages.length > 0 ? a.albumAverages.reduce((acc, v) => acc + v, 0) / a.albumAverages.length : 0;
    const avgB = b.albumAverages.length > 0 ? b.albumAverages.reduce((acc, v) => acc + v, 0) / b.albumAverages.length : 0;
    return avgB - avgA;
  });

  const bestArtistOfYear: ArtistAwardWinner | null = eligibleForBest[0]
    ? {
        artistName: eligibleForBest[0].artistName,
        artistId: eligibleForBest[0].artistId,
        imageUrl: eligibleForBest[0].imageUrl,
        score:
          eligibleForBest[0].albumAverages.reduce((acc, v) => acc + v, 0) /
          eligibleForBest[0].albumAverages.length,
        detail: `${eligibleForBest[0].albums.length} album valutati nel ${year}`,
        albumCount: eligibleForBest[0].albums.length,
      }
    : null;

  // 2. Artista più valutato dell'anno (most rated tracks)
  const sortedByTracks = [...yearArtists].sort((a, b) => b.tracksCount - a.tracksCount);
  const mostEvaluatedArtist: ArtistAwardWinner | null = sortedByTracks[0]
    ? {
        artistName: sortedByTracks[0].artistName,
        artistId: sortedByTracks[0].artistId,
        imageUrl: sortedByTracks[0].imageUrl,
        score: sortedByTracks[0].tracksCount,
        detail: `${sortedByTracks[0].tracksCount} tracce valutate in ${sortedByTracks[0].albums.length} album`,
        albumCount: sortedByTracks[0].albums.length,
      }
    : null;

  // 3. Artista con più album valutati nell'anno
  const sortedByAlbumsCount = [...yearArtists].sort((a, b) => b.albums.length - a.albums.length);
  const mostAlbumsArtist: ArtistAwardWinner | null = sortedByAlbumsCount[0]
    ? {
        artistName: sortedByAlbumsCount[0].artistName,
        artistId: sortedByAlbumsCount[0].artistId,
        imageUrl: sortedByAlbumsCount[0].imageUrl,
        score: sortedByAlbumsCount[0].albums.length,
        detail: `${sortedByAlbumsCount[0].albums.length} album pubblicati e valutati`,
        albumCount: sortedByAlbumsCount[0].albums.length,
      }
    : null;

  // 4. Miglior Collaborazione Artistica dell'Anno
  const collaborativeAlbums = artistYearAlbums.filter((a) => {
    const refs = getAlbumArtistRefs(a);
    return refs.length > 1;
  });

  const rankedCollaborations: CollaborativeAwardWinner[] = collaborativeAlbums
    .map((alb) => {
      const stats = calculateAlbumStats(alb.tracks);
      return {
        albumId: alb.id,
        albumTitle: alb.title,
        artists: alb.artistName,
        coverUrl: alb.coverUrl,
        average: stats.averageRating || 0,
        year: alb.year,
      };
    })
    .sort((a, b) => b.average - a.average);

  const bestCollaboration = rankedCollaborations[0] || null;

  // 5. Miglior Artista Rivelazione / Emergente
  // Criterio trasparente: il suo primo album valutato in assoluto nella storia dell'archivio è uscito in questo anno
  const previousYearsAlbums = allAlbums.filter((a) => a.year < year && isAlbumInRankings(a) && isArtistAwardEdition(a));
  const previousArtistsSet = new Set(
    previousYearsAlbums.flatMap((a) => getAlbumArtistRefs(a).map((r) => r.name.toLowerCase()))
  );

  const breakoutCandidates = yearArtists.filter((a) => !previousArtistsSet.has(a.artistName.toLowerCase()));
  breakoutCandidates.sort((a, b) => {
    const avgA = a.albumAverages.length > 0 ? a.albumAverages.reduce((acc, v) => acc + v, 0) / a.albumAverages.length : 0;
    const avgB = b.albumAverages.length > 0 ? b.albumAverages.reduce((acc, v) => acc + v, 0) / b.albumAverages.length : 0;
    return avgB - avgA;
  });

  const breakoutArtist: ArtistAwardWinner | null = breakoutCandidates[0]
    ? {
        artistName: breakoutCandidates[0].artistName,
        artistId: breakoutCandidates[0].artistId,
        imageUrl: breakoutCandidates[0].imageUrl,
        score:
          breakoutCandidates[0].albumAverages.reduce((acc, v) => acc + v, 0) /
          breakoutCandidates[0].albumAverages.length,
        detail: `Debutto nell'archivio nel ${year} con ${breakoutCandidates[0].albums[0]?.title || 'un album'}`,
        albumCount: breakoutCandidates[0].albums.length,
      }
    : null;

  // Tolerate only floating-point arithmetic noise, not differences hidden by rounding.
  const sameScore = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const artistAverage = (a: ArtistYearStats) => a.albumAverages.reduce((sum, value) => sum + value, 0) / a.albumAverages.length;
  const artistWinner = (a: ArtistYearStats, score: number, detail: string): ArtistAwardWinner => ({
    artistName: a.artistName, artistId: a.artistId, imageUrl: a.imageUrl, score, detail, albumCount: a.albums.length,
  });
  const bestArtistsOfYear = eligibleForBest.filter(a => bestArtistOfYear && sameScore(artistAverage(a), bestArtistOfYear.score))
    .map(a => artistWinner(a, artistAverage(a), `${a.albums.length} album valutati nel ${year}`));
  const mostEvaluatedArtists = sortedByTracks.filter(a => mostEvaluatedArtist && a.tracksCount === mostEvaluatedArtist.score)
    .map(a => artistWinner(a, a.tracksCount, `${a.tracksCount} tracce valutate in ${a.albums.length} album`));
  const mostAlbumsArtists = sortedByAlbumsCount.filter(a => mostAlbumsArtist && a.albums.length === mostAlbumsArtist.score)
    .map(a => artistWinner(a, a.albums.length, `${a.albums.length} album pubblicati e valutati`));
  const bestCollaborations = rankedCollaborations.filter(a => bestCollaboration && sameScore(a.average, bestCollaboration.average));
  const breakoutArtists = breakoutCandidates.filter(a => breakoutArtist && sameScore(artistAverage(a), breakoutArtist.score))
    .map(a => artistWinner(a, artistAverage(a), `Debutto nell'archivio nel ${year} con ${a.albums[0]?.title || 'un album'}`));
  let artistRank = 1;
  const rankedArtists = eligibleForBest.map((a, index) => {
    if (index === 0 || !sameScore(artistAverage(a), artistAverage(eligibleForBest[index - 1]))) artistRank = index + 1;
    return { ...artistWinner(a, artistAverage(a), `${a.albums.length} album`), rank: artistRank };
  });

  return {
    year,
    artistStats: {
      totalAlbums: artistYearAlbums.length,
      uniqueArtists: yearArtists.length,
      totalTracksRated: artistYearAlbums.reduce((sum, album) => sum + calculateAlbumStats(album.tracks).ratedCount, 0),
      averageAlbumRating: artistYearAlbums.length > 0
        ? artistYearAlbums.reduce((sum, album) => sum + (calculateAlbumStats(album.tracks).averageRating ?? 0), 0) / artistYearAlbums.length
        : null,
    },
    stats: {
      totalAlbums,
      uniqueArtists,
      totalTracksRated,
      averageAlbumRating,
    },
    bestAlbum,
    top10Albums,
    songAward: {
      winningScore,
      tiedCount: tiedWinners.length,
      tiedWinners,
      topSongs: rankedTopSongs,
    },
    artistAwards: {
      bestArtistsOfYear,
      mostEvaluatedArtists,
      mostAlbumsArtists,
      bestCollaborations,
      breakoutArtists,
      bestArtistOfYear,
      mostEvaluatedArtist,
      mostAlbumsArtist,
      bestCollaboration,
      breakoutArtist,
      topArtists: rankedArtists.filter(a => a.rank <= 5),
    },
  };
}

/**
 * Calculates Advanced Statistics across the whole collection (Requirement 10)
 */
export function calculateAdvancedStats(albums: Album[], artists: Artist[]) {
  const evaluatedAlbums = albums.filter((a) => isAlbumInRankings(a));
  const unratedAlbums = albums.filter((a) => !isAlbumInRankings(a));

  const allRatings: number[] = [];
  const albumAverages: { album: Album; average: number }[] = [];

  evaluatedAlbums.forEach((alb) => {
    const stats = calculateAlbumStats(alb.tracks);
    if (stats.averageRating !== null) {
      albumAverages.push({ album: alb, average: stats.averageRating });
    }
    alb.tracks.forEach((t) => {
      if (t.rating !== null && !isNaN(t.rating)) {
        allRatings.push(t.rating);
      }
    });
  });

  // 1. General stats
  const totalAlbums = albums.length;
  const totalRated = evaluatedAlbums.length;
  const totalTracks = allRatings.length;
  const uniqueArtists = new Set(
    evaluatedAlbums.flatMap((a) => getAlbumArtistRefs(a, artists).map((r) => r.name.toLowerCase()))
  ).size;

  const meanRating = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : null;

  // Median
  let medianRating: number | null = null;
  if (allRatings.length > 0) {
    const sorted = [...allRatings].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianRating = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  // Mode (most frequent vote)
  let modeRating: number | null = null;
  if (allRatings.length > 0) {
    const counts = new Map<number, number>();
    allRatings.forEach((r) => counts.set(r, (counts.get(r) || 0) + 1));
    let maxCount = 0;
    counts.forEach((count, val) => {
      if (count > maxCount) {
        maxCount = count;
        modeRating = val;
      }
    });
  }

  // 2. Score distribution
  const scoreDistribution = {
    '0-4': 0,
    '4-6': 0,
    '6-8': 0,
    '8-10': 0,
  };
  allRatings.forEach((r) => {
    if (r < 4) scoreDistribution['0-4']++;
    else if (r < 6) scoreDistribution['4-6']++;
    else if (r < 8) scoreDistribution['6-8']++;
    else scoreDistribution['8-10']++;
  });

  // 3. Temporal analysis
  const byYear = new Map<number, { count: number; sumAvg: number }>();
  albumAverages.forEach(({ album, average }) => {
    const yr = album.year || 2026;
    const current = byYear.get(yr) || { count: 0, sumAvg: 0 };
    current.count++;
    current.sumAvg += average;
    byYear.set(yr, current);
  });

  const timelineByYear = Array.from(byYear.entries())
    .map(([year, data]) => ({
      year,
      count: data.count,
      average: data.sumAvg / data.count,
    }))
    .sort((a, b) => a.year - b.year);

  // 4. Standard vs Other editions comparison
  const standardEditions = albumAverages.filter((a) => !a.album.editionType || a.album.editionType === 'standard');
  const otherEditions = albumAverages.filter((a) => a.album.editionType && a.album.editionType !== 'standard');

  const standardAvg =
    standardEditions.length > 0
      ? standardEditions.reduce((acc, a) => acc + a.average, 0) / standardEditions.length
      : null;
  const otherAvg =
    otherEditions.length > 0
      ? otherEditions.reduce((acc, a) => acc + a.average, 0) / otherEditions.length
      : null;

  // 5. Genre analysis
  const genreMap = new Map<string, { count: number; sumAvg: number }>();
  albumAverages.forEach(({ album, average }) => {
    const gList = (album.genres || 'Musica').split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    gList.forEach((g) => {
      const cur = genreMap.get(g) || { count: 0, sumAvg: 0 };
      cur.count++;
      cur.sumAvg += average;
      genreMap.set(g, cur);
    });
  });

  const genreStats = Array.from(genreMap.entries())
    .map(([genre, data]) => ({
      genre,
      count: data.count,
      average: data.sumAvg / data.count,
    }))
    .sort((a, b) => b.count - a.count);

  // 6. Album spreads (max - min rating per album)
  const spreadAlbums = evaluatedAlbums
    .map((alb) => {
      const rated = alb.tracks.filter((t) => t.rating !== null).map((t) => t.rating as number);
      if (rated.length < 2) return null;
      const max = Math.max(...rated);
      const min = Math.min(...rated);
      return { album: alb, min, max, spread: max - min };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 6);

  // 7. Artist Analysis across the catalog
  const artistMap = new Map<string, { name: string; albumsCount: number; sumAvg: number; tracksCount: number }>();
  evaluatedAlbums.forEach((alb) => {
    const refs = getAlbumArtistRefs(alb, artists);
    const stats = calculateAlbumStats(alb.tracks);
    const avg = stats.averageRating || 0;

    refs.forEach((r) => {
      const cur = artistMap.get(r.name) || {
        name: r.name,
        albumsCount: 0,
        sumAvg: 0,
        tracksCount: 0,
      };
      cur.albumsCount++;
      cur.sumAvg += avg;
      cur.tracksCount += stats.ratedCount;
      artistMap.set(r.name, cur);
    });
  });

  const allArtistStats = Array.from(artistMap.values()).map((a) => ({
    name: a.name,
    albumsCount: a.albumsCount,
    tracksCount: a.tracksCount,
    average: a.albumsCount > 0 ? a.sumAvg / a.albumsCount : 0,
  }));

  const mostEvaluatedArtists = [...allArtistStats]
    .sort((a, b) => b.tracksCount - a.tracksCount)
    .slice(0, 8);

  const highestAverageArtists = [...allArtistStats]
    .filter((a) => a.albumsCount >= 2)
    .sort((a, b) => b.average - a.average)
    .slice(0, 8);

  return {
    general: {
      totalAlbums,
      totalRated,
      unratedCount: unratedAlbums.length,
      totalTracks,
      uniqueArtists,
      meanRating,
      medianRating,
      modeRating,
      scoreDistribution,
    },
    temporal: {
      timelineByYear,
    },
    editions: {
      standardCount: standardEditions.length,
      standardAverage: standardAvg,
      otherCount: otherEditions.length,
      otherAverage: otherAvg,
    },
    genres: genreStats,
    spreadAlbums,
    artistAnalysis: {
      mostEvaluated: mostEvaluatedArtists,
      highestAverage: highestAverageArtists,
    },
  };
}

/**
 * Calculates Wrapped data for a specific year (Requirement 9)
 */
export function calculateYearWrapped(allAlbums: Album[], year: number, artists: Artist[] = []) {
  const yearAlbums = allAlbums.filter((a) => a.year === year && isAlbumInRankings(a));
  const unratedYearAlbums = allAlbums.filter((a) => a.year === year && !isAlbumEvaluated(a));

  const allRatings: number[] = [];
  const albumRankings: { album: Album; average: number; ratedCount: number }[] = [];

  yearAlbums.forEach((alb) => {
    const stats = calculateAlbumStats(alb.tracks);
    if (stats.averageRating !== null) {
      albumRankings.push({
        album: alb,
        average: stats.averageRating,
        ratedCount: stats.ratedCount,
      });
    }
    alb.tracks.forEach((t) => {
      if (t.rating !== null && !isNaN(t.rating)) {
        allRatings.push(t.rating);
      }
    });
  });

  albumRankings.sort((a, b) => b.average - a.average);

  const totalAlbumsEvaluated = yearAlbums.length;
  const totalTracksEvaluated = allRatings.length;
  const yearlyAverage = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : null;

  const highestRatedAlbum = albumRankings[0] || null;
  const lowestRatedAlbum = albumRankings.length > 1 ? albumRankings[albumRankings.length - 1] : null;

  // Top 5 Albums
  const top5Albums = albumRankings.slice(0, 5);

  // Artists stats in wrapped
  const artistMap = new Map<string, { artistName: string; albumsCount: number; sumAvg: number; tracksCount: number }>();
  yearAlbums.forEach((alb) => {
    const refs = getAlbumArtistRefs(alb, artists);
    const stats = calculateAlbumStats(alb.tracks);
    const avg = stats.averageRating || 0;

    refs.forEach((r) => {
      const cur = artistMap.get(r.name) || {
        artistName: r.name,
        albumsCount: 0,
        sumAvg: 0,
        tracksCount: 0,
      };
      cur.albumsCount++;
      cur.sumAvg += avg;
      cur.tracksCount += stats.ratedCount;
      artistMap.set(r.name, cur);
    });
  });

  const topArtists = Array.from(artistMap.values())
    .map((a) => {
      const artObj = artists.find((ar) => ar.name.toLowerCase() === a.artistName.toLowerCase());
      return {
        artistName: a.artistName,
        artistId: artObj?.id,
        imageUrl: artObj?.imageUrl,
        albumsCount: a.albumsCount,
        tracksCount: a.tracksCount,
        average: a.sumAvg / a.albumsCount,
      };
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);

  const mostRatedArtist = Array.from(artistMap.values()).sort((a, b) => b.tracksCount - a.tracksCount)[0] || null;

  // Monthly activity
  const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  const monthCounts = new Array(12).fill(0);

  yearAlbums.forEach((alb) => {
    if (alb.releaseDate) {
      const m = new Date(alb.releaseDate).getMonth();
      if (!isNaN(m) && m >= 0 && m < 12) {
        monthCounts[m]++;
      }
    }
  });

  let peakMonthIndex = 0;
  let maxMonthCount = 0;
  monthCounts.forEach((count, idx) => {
    if (count > maxMonthCount) {
      maxMonthCount = count;
      peakMonthIndex = idx;
    }
  });

  const peakMonth = {
    name: months[peakMonthIndex],
    count: maxMonthCount,
  };

  // Genre breakdown
  const genreCount = new Map<string, number>();
  yearAlbums.forEach((alb) => {
    const gList = (alb.genres || 'Musica').split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    gList.forEach((g) => genreCount.set(g, (genreCount.get(g) || 0) + 1));
  });

  const topGenres = Array.from(genreCount.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const distribution = {
    '0–4': 0,
    '4–6': 0,
    '6–7': 0,
    '7–8': 0,
    '8–9': 0,
    '9–10': 0,
  };
  allRatings.forEach((r) => {
    if (r < 4) distribution['0–4']++;
    else if (r < 6) distribution['4–6']++;
    else if (r < 7) distribution['6–7']++;
    else if (r < 8) distribution['7–8']++;
    else if (r < 9) distribution['8–9']++;
    else distribution['9–10']++;
  });

  return {
    year,
    totalAlbumsEvaluated,
    totalTracksEvaluated,
    unratedCount: unratedYearAlbums.length,
    yearlyAverage,
    highestRatedAlbum,
    lowestRatedAlbum,
    top5Albums,
    topArtists,
    mostRatedArtist,
    peakMonth,
    topGenres,
    distribution,
    monthTimeline: months.map((m, idx) => ({ month: m, count: monthCounts[idx] })),
  };
}
