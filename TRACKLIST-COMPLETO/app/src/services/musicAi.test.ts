import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from './storage';
import { getMusicAiStatus, requestMusicAi } from './musicAi';
const original = { fetch: globalThis.fetch, token: storage.getAuthToken, status: storage.getSyncStatus, sync: storage.pushToCloud };
afterEach(() => { globalThis.fetch = original.fetch; storage.getAuthToken = original.token; storage.getSyncStatus = original.status; storage.pushToCloud = original.sync; });

test('AI client sends only task parameters, authenticates and syncs pending edits first', async () => {
  storage.getAuthToken = () => 'test-session';
  storage.getSyncStatus = () => 'pending';
  let synced = false;
  storage.pushToCloud = async () => { synced = true; return true; };
  globalThis.fetch = async (url, init) => {
    assert.equal(synced, true);
    assert.equal(url, '/api/ai/generate');
    assert.equal((init?.headers as any).Authorization, 'Bearer test-session');
    assert.deepEqual(JSON.parse(String(init?.body)), { feature: 'archive', question: 'Una domanda libera' });
    return Response.json({ text: 'Risposta', albumIds: [], recommendations: [], model: 'Gemini', includedAlbums: 1, totalAlbums: 1 });
  };
  assert.equal((await requestMusicAi({ feature: 'archive', question: 'Una domanda libera' })).text, 'Risposta');
});
test('AI client never sends stale unsynced data or crosses an account switch', async () => {
  storage.getAuthToken = () => 'test-session'; storage.getSyncStatus = () => 'pending'; storage.pushToCloud = async () => false;
  globalThis.fetch = async () => { assert.fail('No provider request expected'); };
  await assert.rejects(requestMusicAi({ feature: 'identity' }), /sincronizzare/);
  storage.getSyncStatus = () => 'synced';
  let reads = 0; storage.getAuthToken = () => ++reads === 1 ? 'first-session' : 'second-session';
  await assert.rejects(requestMusicAi({ feature: 'identity' }), /annullata/);
});
test('AI availability handles missing session and returns only the configured flag', async () => {
  storage.getAuthToken = () => null;
  assert.equal(await getMusicAiStatus(), false);
  storage.getAuthToken = () => 'test-session';
  globalThis.fetch = async () => Response.json({ configured: true, provider: 'Gemini' });
  assert.equal(await getMusicAiStatus(), true);
});
