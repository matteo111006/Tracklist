import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { initialAlbums } from '../../test/fixtures';
import { searchSpotifyAlbum, syncAlbumWithSpotify } from './spotifySync';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test('Spotify search resolves an albums response and then fetches its tracklist', async () => {
  globalThis.fetch = async (url) => String(url).includes('/search?')
    ? Response.json({ albums: [{ id: 'album-id', tracks: [] }] })
    : Response.json({ id: 'album-id', tracks: [{ title: 'Track', trackNumber: 1 }] });
  assert.equal((await searchSpotifyAlbum('album artist'))?.tracks[0].title, 'Track');
});
test('Spotify reordering keeps scores attached to matching songs, never track positions', async () => {
  const album = structuredClone(initialAlbums[0]);
  album.spotifyUrl = 'https://open.spotify.com/album/1234567890123456789012';
  album.tracks = [
    { id: 'one', albumId: album.id, trackNumber: 1, title: 'First', artists: 'Test', rating: 9.5 },
    { id: 'two', albumId: album.id, trackNumber: 2, title: 'Second', artists: 'Test', rating: 7.25 },
  ];
  const payload = { id: '1234567890123456789012', title: album.title, tracks: [
    { title: 'Brand new song', trackNumber: 1 }, { title: 'Second', trackNumber: 2 }, { title: 'First', trackNumber: 3 },
  ] };
  globalThis.fetch = async () => Response.json(payload);
  const result = await syncAlbumWithSpotify(album);
  assert.equal(result.success, true);
  assert.equal(result.updatedAlbum.tracks[0].rating, null);
  assert.equal(result.updatedAlbum.tracks[1].rating, 7.25);
  assert.equal(result.updatedAlbum.tracks[2].rating, 9.5);
  assert.equal(new Set(result.updatedAlbum.tracks.map(t => t.id)).size, 3);
  album.isManualTracklist = true;
  assert.deepEqual((await syncAlbumWithSpotify(album)).updatedAlbum.tracks, album.tracks);
});
