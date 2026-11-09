import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { searchMusicOnline } from './musicSearch';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test('discovery catalog search rejects unrelated fallback results and does not force a genre in the request', async () => {
  const requested: string[] = [];
  globalThis.fetch = async url => {
    requested.push(String(url));
    return String(url).startsWith('/api/') ? Response.json({ albums: [
      { id: 'correct', title: 'An album', artistName: 'Kid Yugi', releaseDate: '2026-01-01' },
      { id: 'unrelated', title: 'Live Audio', artistName: 'Unrelated Artist' },
    ] }) : Response.json({ results: [] });
  };
  const results = await searchMusicOnline('Kid Yugi');
  assert.deepEqual(results.map(r => r.artistName), ['Kid Yugi']);
  assert.equal(results[0].genres, 'Musica');
  assert.ok(!requested.some(url => decodeURIComponent(url).includes('rap italiano')));
});
