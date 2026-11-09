import test from 'node:test';
import assert from 'node:assert/strict';
import { Artist, Album } from '../types';

test('Artist merging logic preserves manual bio and manual image overrides', () => {
  const existing: Artist = {
    id: 'art-lazza',
    name: 'Lazza',
    bio: 'Biografia manuale personalizzata scritta dall utente',
    imageUrl: 'data:image/jpeg;base64,customPhotoData',
    isManualBio: true,
    isManualImage: true,
  };

  const incomingUpdate: Partial<Artist> = {
    id: 'art-lazza',
    name: 'Lazza',
    bio: 'Biografia da Wikipedia che non deve sovrascrivere',
    imageUrl: 'https://spotify.com/default.jpg',
  };

  // Logic used in storage.ts
  const merged: Artist = {
    ...existing,
    ...incomingUpdate,
    bio: existing.isManualBio ? existing.bio : (incomingUpdate.bio || existing.bio),
    imageUrl: existing.isManualImage ? existing.imageUrl : (incomingUpdate.imageUrl || existing.imageUrl),
    isManualBio: incomingUpdate.isManualBio ?? existing.isManualBio ?? false,
    isManualImage: incomingUpdate.isManualImage ?? existing.isManualImage ?? false,
  };

  assert.equal(merged.bio, 'Biografia manuale personalizzata scritta dall utente');
  assert.equal(merged.imageUrl, 'data:image/jpeg;base64,customPhotoData');
  assert.equal(merged.isManualBio, true);
  assert.equal(merged.isManualImage, true);
});

test('Album evaluation retains custom track scores across reload simulation', () => {
  const album: Album = {
    id: 'alb-locura',
    title: 'LOCURA',
    artistId: 'art-lazza',
    artistName: 'Lazza',
    year: 2024,
    releaseDate: '2024-09-20',
    releaseDateFormatted: '20 SET 2024',
    label: 'Sony Music',
    genres: 'Rap/Hip Hop',
    duration: '42 min',
    coverUrl: 'https://images.unsplash.com/photo-1',
    editionType: 'standard',
    evaluationStatus: 'draft',
    tracks: [
      { id: 'trk-1', albumId: 'alb-locura', trackNumber: 1, title: 'INTRO', artists: 'Lazza', rating: 9 },
      { id: 'trk-2', albumId: 'alb-locura', trackNumber: 2, title: 'ESTREMO RELATIVO', artists: 'Lazza', rating: 8.5 },
      { id: 'trk-3', albumId: 'alb-locura', trackNumber: 3, title: 'CANZONE 3', artists: 'Lazza', rating: null },
    ],
  };

  // Simulate serializing to JSON and parsing back as localStorage does
  const serialized = JSON.stringify([album]);
  const parsed: Album[] = JSON.parse(serialized);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tracks[0].rating, 9);
  assert.equal(parsed[0].tracks[1].rating, 8.5);
  assert.equal(parsed[0].tracks[2].rating, null);
  assert.equal(parsed[0].evaluationStatus, 'draft');
});
