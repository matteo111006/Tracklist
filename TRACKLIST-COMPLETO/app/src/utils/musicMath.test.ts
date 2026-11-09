import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAlbumStats, formatRating, calculateYearAwards, calculateArtistStats, deduplicateSongsRankings, isAlbumInRankings, calculateYearWrapped } from './musicMath';
import { initialAlbums } from '../../test/fixtures';
import { Album, Artist, Track } from '../types';

test('artist awards include every tied winner and extend the ranking at fifth place', () => {
  const albums: Album[] = [9, 9, 8, 7, 6, 6, 6, 5].map((rating, index) => ({
    ...structuredClone(initialAlbums[0]), id: `tie-${index}`, artistName: `Artist ${index}`, artistId: `artist-${index}`,
    tracks: [{ id: `track-${index}`, albumId: `tie-${index}`, trackNumber: 1, title: `Track ${index}`, artists: `Artist ${index}`, rating }],
  }));
  const result = calculateYearAwards(albums, 2026).artistAwards;
  assert.deepEqual(result.bestArtistsOfYear.map(a => a.artistName), ['Artist 0', 'Artist 1']);
  assert.deepEqual(result.breakoutArtists.map(a => a.artistName), ['Artist 0', 'Artist 1']);
  assert.equal(result.mostEvaluatedArtists.length, 8);
  assert.equal(result.mostAlbumsArtists.length, 8);
  assert.deepEqual(result.topArtists.map(a => a.rank), [1, 1, 3, 4, 5, 5, 5]);
  const collaborations = albums.slice(0, 3).map(a => ({ ...a, artistName: `${a.artistName}, Guest`, artistIds: [a.artistId, 'guest'] }));
  assert.equal(calculateYearAwards(collaborations, 2026).artistAwards.bestCollaborations.length, 2);
  assert.equal(calculateYearAwards([], 2026).artistAwards.bestArtistsOfYear.length, 0);
  const closeButDifferent = { ...albums[1], tracks: albums[1].tracks.map(t => ({ ...t, rating: 8.99999 })) };
  assert.equal(calculateYearAwards([albums[0], closeButDifferent], 2026).artistAwards.bestArtistsOfYear.length, 1);
});

test('artist awards use only standard and deluxe across winners, collaborations, counts and history', () => {
  const makeAlbum = (id: string, editionType: Album['editionType'], rating: number, artistName = 'Allowed', year = 2026): Album => ({
    ...structuredClone(initialAlbums[0]), id, editionType, artistName, artistId: artistName, year,
    tracks: [{ id: `${id}-track`, albumId: id, trackNumber: 1, title: id, artists: artistName, rating }],
  });
  const allowed = [makeAlbum('standard', 'standard', 7), makeAlbum('deluxe', 'deluxe', 9)];
  const excluded = [
    makeAlbum('modified', 'modified', 10, 'Excluded & Guest'),
    makeAlbum('remaster', 'remaster', 10, 'Excluded & Guest'),
    makeAlbum('old-remaster', 'remaster', 10, 'Allowed', 2025),
    { ...makeAlbum('draft', 'standard', 10), evaluationStatus: 'draft' as const },
  ];
  const result = calculateYearAwards([...allowed, ...excluded], 2026);
  assert.deepEqual(result.artistAwards, calculateYearAwards(allowed, 2026).artistAwards);
  assert.deepEqual(result.artistStats, { totalAlbums: 2, uniqueArtists: 1, totalTracksRated: 2, averageAlbumRating: 8 });
  assert.equal(result.artistAwards.bestArtistOfYear?.score, 8);
  assert.equal(result.artistAwards.breakoutArtist?.artistName, 'Allowed');
  assert.equal(result.artistAwards.bestCollaboration, null);
  // The edition restriction is specific to artist awards; song awards retain their rules.
  assert.equal(result.songAward.winningScore, 10);
  const empty = calculateYearAwards(excluded, 2026);
  assert.equal(empty.artistAwards.bestArtistOfYear, null);
  assert.equal(empty.artistStats.averageAlbumRating, null);
  const collab = makeAlbum('deluxe-collab', 'deluxe', 9, 'Allowed & Guest');
  assert.equal(calculateYearAwards([collab, ...excluded], 2026).artistAwards.bestCollaboration?.albumId, collab.id);
  const standardHistory = makeAlbum('old-standard', 'standard', 5, 'Allowed', 2025);
  assert.equal(calculateYearAwards([...allowed, standardHistory], 2026).artistAwards.breakoutArtist, null);
});

test('draft evaluations stay out of official awards and Wrapped', () => {
  const album = { ...structuredClone(initialAlbums[0]), evaluationStatus: 'draft' as const };
  assert.equal(isAlbumInRankings(album), false);
  assert.equal(calculateYearAwards([album], album.year).stats.totalAlbums, 0);
  assert.equal(calculateYearWrapped([album], album.year).totalAlbumsEvaluated, 0);
});

test('calculateAlbumStats calculates correct average and distribution', () => {
  const tracks: Track[] = [
    { id: '1', albumId: 'a1', trackNumber: 1, title: 'Intro', artists: 'Kid Yugi', rating: 9.5 },
    { id: '2', albumId: 'a1', trackNumber: 2, title: 'Track 2', artists: 'Kid Yugi', rating: 7.75 },
    { id: '3', albumId: 'a1', trackNumber: 3, title: 'Track 3', artists: 'Kid Yugi', rating: 5.25 },
    { id: '4', albumId: 'a1', trackNumber: 4, title: 'Track 4', artists: 'Kid Yugi', rating: 3.5 },
    { id: '5', albumId: 'a1', trackNumber: 5, title: 'Track 5', artists: 'Kid Yugi', rating: null }, // unrated
  ];

  const stats = calculateAlbumStats(tracks);
  assert.equal(stats.totalTracks, 5);
  assert.equal(stats.ratedCount, 4);
  assert.equal(stats.isFullyRated, false);

  // sum = 9.5 + 7.75 + 5.25 + 3.5 = 26; average = 26 / 4 = 6.5
  assert.equal(stats.averageRating, 6.5);

  // Distribution
  assert.equal(stats.distribution['0-4'], 1); // 3.5
  assert.equal(stats.distribution['4-6'], 1); // 5.25
  assert.equal(stats.distribution['6-8'], 1); // 7.75
  assert.equal(stats.distribution['8-10'], 1); // 9.5
});

test('formatRating handles Italian decimal comma formatting', () => {
  assert.equal(formatRating(9.3214), '9,3214');
  assert.equal(formatRating(9.125), '9,125');
  assert.equal(formatRating(8.75), '8,75');
  assert.equal(formatRating(8.0), '8,00');
  assert.equal(formatRating(10), '10,00');
  assert.equal(formatRating(null), '—');
});

test('calculateArtistStats deduplicates tracks by highest score, or earlier album on tie', () => {
  const artist: Artist = {
    id: 'art-kid',
    name: 'Kid Yugi',
    bio: 'Test bio',
    imageUrl: '',
  };

  const albumStandard: Album = {
    id: 'alb-standard',
    title: 'ANCHE GLI EROI MUOIONO',
    artistId: 'art-kid',
    artistName: 'Kid Yugi',
    releaseDate: '2026-01-30',
    releaseDateFormatted: '30 GEN 2026',
    year: 2026,
    coverUrl: '',
    label: '',
    genres: '',
    duration: '',
    editionType: 'standard',
    tracks: [
      { id: 't1', albumId: 'alb-standard', trackNumber: 1, title: 'DAVIDE E GOLIA', artists: 'Kid Yugi', rating: 10.0 },
      { id: 't2', albumId: 'alb-standard', trackNumber: 2, title: 'BERSERKER', artists: 'Kid Yugi', rating: 9.0 },
    ],
  };

  const albumDeluxe: Album = {
    id: 'alb-deluxe',
    title: 'POST MORTEM',
    artistId: 'art-kid',
    artistName: 'Kid Yugi',
    releaseDate: '2026-10-30', // Later release date
    releaseDateFormatted: '30 OTT 2026',
    year: 2026,
    coverUrl: '',
    label: '',
    genres: '',
    duration: '',
    editionType: 'deluxe',
    tracks: [
      // Same song DAVIDE E GOLIA with identical rating 10.0 -> must keep earlier album ANCHE GLI EROI MUOIONO
      { id: 't3', albumId: 'alb-deluxe', trackNumber: 1, title: 'davide e golia', artists: 'Kid Yugi', rating: 10.0 },
      // Same song BERSERKER with higher rating 9.75 -> must keep POST MORTEM because of higher rating
      { id: 't4', albumId: 'alb-deluxe', trackNumber: 2, title: 'BERSERKER', artists: 'Kid Yugi', rating: 9.75 },
    ],
  };

  const stats = calculateArtistStats(artist, [albumStandard, albumDeluxe]);

  // Total unique tracks should be 2, not 4
  assert.equal(stats.topTracks.length, 2);

  // #1 track: DAVIDE E GOLIA (rating 10.0) from the earlier album ANCHE GLI EROI MUOIONO
  assert.equal(stats.topTracks[0].track.title.toUpperCase(), 'DAVIDE E GOLIA');
  assert.equal(stats.topTracks[0].track.rating, 10.0);
  assert.equal(stats.topTracks[0].albumTitle, 'ANCHE GLI EROI MUOIONO');

  // #2 track: BERSERKER (rating 9.75) from POST MORTEM because higher score beats earlier album
  assert.equal(stats.topTracks[1].track.title.toUpperCase(), 'BERSERKER');
  assert.equal(stats.topTracks[1].track.rating, 9.75);
  assert.equal(stats.topTracks[1].albumTitle, 'POST MORTEM');
});

test('calculateYearAwards correctly groups tied #1 songs and top albums', () => {
  const dummyAlbum: Album = {
    id: 'alb-1',
    title: 'ANCHE GLI EROI MUOIONO',
    artistId: 'art-1',
    artistName: 'Kid Yugi',
    releaseDate: '2026-03-01',
    releaseDateFormatted: '01 MAR 2026',
    year: 2026,
    coverUrl: '/covers/eroi.jpg',
    label: 'Universal Music Italia',
    genres: 'Rap',
    duration: '45 min',
    editionType: 'standard',
    tracks: [
      { id: 't1', albumId: 'alb-1', trackNumber: 1, title: 'DAVIDE E GOLIA', artists: 'Kid Yugi', rating: 10.0 },
      { id: 't2', albumId: 'alb-1', trackNumber: 2, title: 'BERSERKER', artists: 'Kid Yugi', rating: 9.75 },
    ],
  };

  const dummyAlbum2: Album = {
    id: 'alb-2',
    title: 'WAR',
    artistId: 'art-2',
    artistName: 'Artie 5ive',
    releaseDate: '2026-05-01',
    releaseDateFormatted: '01 MAG 2026',
    year: 2026,
    coverUrl: '/covers/war.jpg',
    label: 'Milano Ovest',
    genres: 'Rap',
    duration: '40 min',
    editionType: 'standard',
    tracks: [
      { id: 't3', albumId: 'alb-2', trackNumber: 1, title: 'ANCELOTTI', artists: 'Artie 5ive', rating: 10.0 },
      { id: 't4', albumId: 'alb-2', trackNumber: 2, title: 'TRACK B', artists: 'Artie 5ive', rating: 8.5 },
    ],
  };

  const awards = calculateYearAwards([dummyAlbum, dummyAlbum2], 2026);
  assert.equal(awards.bestAlbum?.album.title, 'ANCHE GLI EROI MUOIONO');
  assert.equal(awards.songAward.winningScore, 10.0);
  assert.equal(awards.songAward.tiedCount, 2); // DAVIDE E GOLIA and ANCELOTTI
});

test('calculateYearAwards considers ONLY standard edition albums for Album Awards', () => {
  const standardAlb: Album = {
    id: 'alb-std',
    title: 'CVLT',
    artistId: 'art-salmo',
    artistName: 'Salmo, Noyz Narcos',
    artistIds: ['art-salmo', 'art-noyz'],
    releaseDate: '2024-11-03',
    releaseDateFormatted: '03 NOV 2024',
    year: 2024,
    coverUrl: '',
    label: 'Sony',
    genres: 'Hip Hop',
    duration: '45 min',
    editionType: 'standard',
    tracks: [
      { id: 't1', albumId: 'alb-std', trackNumber: 1, title: 'RESPIRA', artists: 'Salmo, Noyz Narcos', rating: 9.0 },
    ],
  };

  const deluxeAlb: Album = {
    id: 'alb-dlx',
    title: 'CVLT - HELLRAISERS',
    artistId: 'art-salmo',
    artistName: 'Salmo, Noyz Narcos',
    artistIds: ['art-salmo', 'art-noyz'],
    releaseDate: '2024-11-10',
    releaseDateFormatted: '10 NOV 2024',
    year: 2024,
    coverUrl: '',
    label: 'Sony',
    genres: 'Hip Hop',
    duration: '60 min',
    editionType: 'deluxe',
    tracks: [
      { id: 't2', albumId: 'alb-dlx', trackNumber: 1, title: 'BONUS', artists: 'Salmo, Noyz Narcos', rating: 10.0 },
    ],
  };

  const awards = calculateYearAwards([standardAlb, deluxeAlb], 2024);
  // Deluxe album has higher rating (10.0) but MUST be excluded from standard Album Awards
  assert.equal(awards.bestAlbum?.album.title, 'CVLT');
  assert.equal(awards.bestAlbum?.album.editionType, 'standard');
  assert.equal(awards.bestAlbum?.average, 9.0);
  // Best collaboration award should identify Salmo & Noyz Narcos
  assert.equal(awards.artistAwards.bestCollaboration?.albumTitle, 'CVLT - HELLRAISERS');
});

test('calculateArtistStats correctly includes collaborative albums for each participating artist', () => {
  const salmo: Artist = { id: 'art-salmo', name: 'Salmo', bio: '', imageUrl: '' };
  const noyz: Artist = { id: 'art-noyz', name: 'Noyz Narcos', bio: '', imageUrl: '' };

  const collabAlbum: Album = {
    id: 'alb-cvlt',
    title: 'CVLT',
    artistId: 'art-salmo',
    artistName: 'Salmo, Noyz Narcos',
    artistIds: ['art-salmo', 'art-noyz'],
    releaseDate: '2023-11-03',
    releaseDateFormatted: '03 NOV 2023',
    year: 2023,
    coverUrl: '',
    label: 'Sony Music',
    genres: 'Rap',
    duration: '45 min',
    editionType: 'standard',
    tracks: [
      { id: 't1', albumId: 'alb-cvlt', trackNumber: 1, title: 'RESPIRA', artists: 'Salmo, Noyz Narcos', rating: 9.0 },
      { id: 't2', albumId: 'alb-cvlt', trackNumber: 2, title: 'ANTIDOTO', artists: 'Salmo, Noyz Narcos', rating: 8.5 },
    ],
  };

  const salmoStats = calculateArtistStats(salmo, [collabAlbum]);
  const noyzStats = calculateArtistStats(noyz, [collabAlbum]);

  // Both artists must have the album in their discography
  assert.equal(salmoStats.albumsCount, 1);
  assert.equal(noyzStats.albumsCount, 1);
  assert.equal(salmoStats.albums[0].title, 'CVLT');
  assert.equal(noyzStats.albums[0].title, 'CVLT');

  // Both artists get calculated averages
  assert.equal(salmoStats.artistAverage, 8.75);
  assert.equal(noyzStats.artistAverage, 8.75);
});

test('deduplicateSongsRankings keeps highest rating, or earlier album on tie', () => {
  const songs = [
    {
      title: 'Davide',
      artist: 'Gemitaiz',
      albumTitle: 'Davide',
      coverUrl: '',
      rating: 9.0,
      releaseDate: '2018-04-20',
      albumYear: 2018,
    },
    {
      title: 'Davide',
      artist: 'Gemitaiz',
      albumTitle: 'QVC9',
      coverUrl: '',
      rating: 9.5, // Higher rating wins
      releaseDate: '2020-11-06',
      albumYear: 2020,
    },
    {
      title: 'Thoiry',
      artist: 'Quentin40',
      albumTitle: 'Album A',
      coverUrl: '',
      rating: 8.5,
      releaseDate: '2018-01-15', // Earlier release date wins on tie
      albumYear: 2018,
    },
    {
      title: 'Thoiry',
      artist: 'Quentin40',
      albumTitle: 'Album B',
      coverUrl: '',
      rating: 8.5,
      releaseDate: '2019-06-20',
      albumYear: 2019,
    },
    {
      title: 'Thoiry (Remix)', // Legitimate different version must be preserved
      artist: 'Quentin40',
      albumTitle: 'Album C',
      coverUrl: '',
      rating: 8.75,
      releaseDate: '2018-03-01',
      albumYear: 2018,
    },
  ];

  const result = deduplicateSongsRankings(songs);
  assert.equal(result.length, 3); // Davide, Thoiry, Thoiry (Remix)

  const davide = result.find((s) => s.title.toLowerCase() === 'davide');
  assert.equal(davide?.rating, 9.5);
  assert.equal(davide?.albumTitle, 'QVC9');

  const thoiry = result.find((s) => s.title.toLowerCase() === 'thoiry');
  assert.equal(thoiry?.rating, 8.5);
  assert.equal(thoiry?.albumTitle, 'Album A');

  const thoiryRemix = result.find((s) => s.title.toLowerCase().includes('remix'));
  assert.equal(thoiryRemix?.rating, 8.75);
});


