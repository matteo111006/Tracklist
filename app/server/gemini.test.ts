import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { initialAlbums } from '../test/fixtures';
const dir = fs.mkdtempSync(path.resolve('../tracklist-ai-test-'));
process.env.TRACKLIST_DATA_DIR = dir;
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const { buildAiContext, generateMusicAi, validateAiRequest, handleGemini } = await import('./gemini');
const { handleAuthAndSync } = await import('./authAndSync');
const store = await import('./db');
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; });
after(async () => { await store.closeDatabase(); assert.ok(path.resolve(dir).startsWith(path.resolve('..') + path.sep + 'tracklist-ai-test-')); await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); });

test('Gemini receives computed music facts, never reviews, history notes or covers', () => {
  const album = { ...structuredClone(initialAlbums[0]), review: { id: 'private', albumId: 'private', text: 'PRIVATE_REVIEW', date: '2026-11-08' }, coverUrl: 'PRIVATE_COVER', history: [{ label: 'PRIVATE_NOTE' }] } as any;
  const context = buildAiContext([album], { feature: 'archive', question: 'Quali sono i miei preferiti?' });
  const text = JSON.stringify(context.data);
  assert.ok(!text.includes('PRIVATE_'));
  assert.equal(context.data.statistics.average, 8.25);
  assert.equal(context.refs.get('a1'), album.id);
  assert.equal(context.data.statistics.albumRanking[0].average, 8.25);
});

test('Gemini requests validate feature, question size, release year and tone', () => {
  assert.throws(() => validateAiRequest({ feature: 'delete' }));
  assert.throws(() => validateAiRequest({ feature: 'archive', question: '' }));
  assert.throws(() => validateAiRequest({ feature: 'archive', question: 'a'.repeat(1001) }));
  assert.throws(() => validateAiRequest({ feature: 'wrapped', year: '2026' }));
  assert.throws(() => validateAiRequest({ feature: 'identity', tone: 'hostile' }));
  assert.equal(validateAiRequest({ feature: 'wrapped', year: 2026 }).tone, 'narrative');
});

test('AI ranking is computed numerically with matching references rather than catalog order', () => {
  const albums = [7.5, 9, 8].map((score, index) => ({ ...structuredClone(initialAlbums[0]), id: `rank-${index}`, tracks: initialAlbums[0].tracks.map(t => ({ ...t, rating: score })) }));
  const context = buildAiContext(albums, { feature: 'archive', question: 'I tre album migliori' });
  assert.deepEqual(context.data.statistics.albumRanking.map(a => a.average), [9, 8, 7.5]);
  assert.equal(context.data.statistics.albumRanking[0].ref, 'a2');
  assert.equal(albums[0].tracks[0].rating, 7.5);
});

test('Gemini uses a fixed provider URL, server-only header and only valid archive references', async () => {
  process.env.GEMINI_API_KEY = 'secret-unit-test';
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent');
    assert.equal((init?.headers as any)['x-goog-api-key'], 'secret-unit-test');
    assert.ok(!String(init?.body).includes('secret-unit-test'));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'Un ritratto fondato sui voti.', albumIds: ['a1', 'other-user-id', 'a1'], recommendations: [] }) }] } }] });
  };
  const result = await generateMusicAi(initialAlbums, { feature: 'identity' });
  assert.deepEqual(result.albumIds, [initialAlbums[0].id]);
  assert.ok(!JSON.stringify(result).includes('secret-unit-test'));
});

test('provider failures do not expose raw errors, secrets or request bodies', async () => {
  process.env.GEMINI_API_KEY = 'secret-error-test';
  globalThis.fetch = async () => new Response('secret-error-test PRIVATE_DATA', { status: 403 });
  await assert.rejects(generateMusicAi(initialAlbums, { feature: 'identity' }), (error: any) => error.status === 503 && !error.message.includes('secret-error-test') && !error.message.includes('PRIVATE_DATA'));
  globalThis.fetch = async () => new Response('quota details', { status: 429 });
  await assert.rejects(generateMusicAi(initialAlbums, { feature: 'identity' }), (error: any) => error.status === 429);
  globalThis.fetch = async () => { throw new Error('private network detail'); };
  await assert.rejects(generateMusicAi(initialAlbums, { feature: 'identity' }), (error: any) => error.status === 504 && !error.message.includes('private'));
});

test('missing configuration, empty catalog and malformed model replies are explicit', async () => {
  await assert.rejects(generateMusicAi(initialAlbums, { feature: 'identity' }), (error: any) => error.status === 503);
  process.env.GEMINI_API_KEY = 'test-key';
  await assert.rejects(generateMusicAi([], { feature: 'identity' }), (error: any) => error.status === 422);
  globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] });
  await assert.rejects(generateMusicAi(initialAlbums, { feature: 'identity' }), (error: any) => error.status === 502);
});

test('large archive context reports truncation instead of silently implying full coverage', () => {
  const albums = Array.from({ length: 500 }, (_, index) => ({ ...structuredClone(initialAlbums[0]), id: `many-${index}`, title: 'Title'.repeat(60), tracks: Array.from({ length: 70 }, (_, i) => ({ id: `track-${i}`, title: 'A long track title'.repeat(10), rating: 8, trackNumber: i + 1, artists: 'Test', albumId: `many-${index}` })) }));
  const context = buildAiContext(albums, { feature: 'archive', question: 'Una domanda' });
  assert.equal(context.data.totalAlbums, 500);
  assert.ok(context.data.includedAlbums < 500);
  assert.equal(context.data.trackDetailLimit, 60);
});

test('AI endpoints authenticate, isolate accounts, reject forged catalog data and cache per account', async () => {
  process.env.GEMINI_API_KEY = 'endpoint-test-key';
  const server = http.createServer((req, res) => { if (!handleAuthAndSync(req, res) && !handleGemini(req, res)) { res.statusCode = 404; res.end(); } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (route: string, body?: any, token?: string) => originalFetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await call('/api/ai/status')).status, 401);
    const first = await (await call('/api/auth/register', { email: 'ai-one@example.test', password: 'test-password' })).json();
    const second = await (await call('/api/auth/register', { email: 'ai-two@example.test', password: 'test-password' })).json();
    const firstAlbum = { ...structuredClone(initialAlbums[0]), title: 'FIRST_ACCOUNT_ONLY' };
    const secondAlbum = { ...structuredClone(initialAlbums[0]), id: 'second-album', title: 'SECOND_ACCOUNT_ONLY' };
    await store.putSnapshot(first.user.id, { revision: 1, data: { albums: [firstAlbum] } });
    await store.putSnapshot(second.user.id, { revision: 1, data: { albums: [secondAlbum] } });
    assert.equal((await call('/api/ai/status', undefined, first.token)).status, 200);
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      const prompt = String(init?.body);
      assert.ok(prompt.includes(calls === 1 ? 'FIRST_ACCOUNT_ONLY' : 'SECOND_ACCOUNT_ONLY'));
      assert.ok(!prompt.includes('FORGED_DATA'));
      assert.ok(!prompt.includes(calls === 1 ? 'SECOND_ACCOUNT_ONLY' : 'FIRST_ACCOUNT_ONLY'));
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'Risposta verificata', albumIds: ['a1'], recommendations: [] }) }] } }] });
    };
    const body = { feature: 'identity', userId: second.user.id, albums: [{ title: 'FORGED_DATA' }] };
    assert.equal((await call('/api/ai/generate', body, first.token)).status, 200);
    const cached = await (await call('/api/ai/generate', body, first.token)).json();
    assert.equal(cached.cached, true); assert.equal(calls, 1);
    const other = await (await call('/api/ai/generate', body, second.token)).json();
    assert.deepEqual(other.albumIds, ['second-album']); assert.equal(calls, 2);
    const own = (await store.readSnapshot(first.user.id))!;
    own.data.profile = { aiConversations: [{ id: 'private-thread', feature: 'archive', messages: [{ question: 'PRIVATE_FIRST_QUESTION', text: 'PRIVATE_FIRST_ANSWER', generatedAt: '2026-11-08T12:00:00Z' }] }] };
    await store.putSnapshot(first.user.id, own);
    const followup = { feature: 'archive', question: 'Continue my conversation', conversationId: 'private-thread' };
    assert.equal((await call('/api/ai/generate', followup, second.token)).status, 404);
    globalThis.fetch = async (_url, init) => {
      assert.ok(String(init?.body).includes('PRIVATE_FIRST_QUESTION'));
      assert.ok(String(init?.body).includes('PRIVATE_FIRST_ANSWER'));
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'A follow-up', albumIds: [], recommendations: [] }) }] } }] });
    };
    const continued = await (await call('/api/ai/generate', followup, first.token)).json();
    assert.equal(continued.text, 'A follow-up'); assert.ok(continued.generatedAt); assert.ok(continued.catalogFingerprint);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
