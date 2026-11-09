import type { Album, Artist } from '../src/types';
export const initialArtists: Artist[] = [{ id: 'fixture-artist', name: 'Test Artist', bio: 'Synthetic biography used only by automated tests', imageUrl: 'https://example.test/artist.jpg' }];
export const initialAlbums: Album[] = [{
  id: 'fixture-album', title: 'TEST ALBUM', artistId: 'fixture-artist', artistName: 'Test Artist',
  releaseDate: '2026-01-01', releaseDateFormatted: '01 GEN 2026', year: 2026,
  coverUrl: '', label: 'Indipendente', genres: 'Musica', duration: '6 min', editionType: 'standard',
  tracks: [
    { id: 'fixture-track-1', albumId: 'fixture-album', trackNumber: 1, title: 'FIRST', artists: 'Test Artist', rating: 9 },
    { id: 'fixture-track-2', albumId: 'fixture-album', trackNumber: 2, title: 'SECOND', artists: 'Test Artist', rating: 7.5 },
  ],
}];
