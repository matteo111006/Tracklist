import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const dir = fs.mkdtempSync(path.resolve('../tracklist-server-test-'));
process.env.TRACKLIST_DATA_DIR = dir;
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
delete process.env.APP_URL;
const { handleAuthAndSync } = await import('./authAndSync');
const store = await import('./db');
const server = http.createServer((req, res) => { if (!handleAuthAndSync(req, res)) { res.statusCode = 404; res.end(); } });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}`;
const call = (route: string, body?: any, token?: string) => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await store.closeDatabase(); assert.ok(path.resolve(dir).startsWith(path.resolve('..') + path.sep + 'tracklist-server-test-')); await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); });
test('sync requires session authentication and rejects stale writes', async () => {
  const registered = await call('/api/auth/register', { email: 'regression@example.test', password: 'test-password', name: 'Regression' });
  assert.equal(registered.status, 200);
  const { user, token } = await registered.json();
  assert.equal((await call('/api/sync?userId=' + user.id)).status, 401);
  assert.equal((await call('/api/sync', { userId: user.id, data: {} })).status, 401);
  const snapshot = { albums: [{ id: 'album', title: 'Album', tracks: [{ id: 'track', rating: 9.25 }] }], artists: [], collections: [], profile: { id: user.id, name: 'Test', email: user.email } };
  assert.equal((await call('/api/sync', { data: snapshot, expectedRevision: 0 }, token)).status, 200);
  const saved = await (await call('/api/sync', undefined, token)).json();
  assert.equal(saved.revision, 1);
  assert.equal(saved.data.albums[0].tracks[0].rating, 9.25);
  assert.equal((await call('/api/sync', { data: { ...snapshot, albums: [] }, expectedRevision: 0 }, token)).status, 409);
  assert.equal((await (await call('/api/sync', undefined, token)).json()).data.albums.length, 1);
  assert.equal((await call('/api/sync', { data: {}, expectedRevision: 1 }, token)).status, 400);
  const other = await (await call('/api/auth/register', { email: 'other@example.test', password: 'other-password' })).json();
  const isolated = await (await call('/api/sync?userId=' + user.id, undefined, other.token)).json();
  assert.equal(isolated.exists, false);
  assert.equal((await call('/api/auth/forgot-password', { email: user.email })).status, 503);
  assert.equal((await call('/api/auth/logout', {}, token)).status, 200);
  assert.equal((await call('/api/sync', undefined, token)).status, 401);
});

test('email recovery expires, consumes tokens once and invalidates all previous sessions', async () => {
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = 'mock-test-key';
  process.env.EMAIL_FROM = 'TRACKLIST <noreply@example.test>';
  process.env.APP_URL = 'http://127.0.0.1:3000';
  const delivered: any[] = [];
  globalThis.fetch = async (url, init) => {
    if (url === 'https://api.resend.com/emails') { delivered.push(JSON.parse(init?.body as string)); return Response.json({ id: 'email-' + delivered.length }); }
    return originalFetch(url, init);
  };
  try {
    const registration = await (await call('/api/auth/register', { email: 'recover@example.test', name: 'Recovery', password: 'old-password' })).json();
    const oldSession = registration.token;
    const unknown = await call('/api/auth/forgot-password', { email: 'unknown@example.test' });
    assert.equal(unknown.status, 200);
    assert.equal(delivered.length, 0);
    const requested = await call('/api/auth/forgot-password', { email: 'recover@example.test' });
    assert.equal(requested.status, 200);
    assert.deepEqual(await requested.json(), await unknown.json());
    assert.equal(delivered.length, 1);
    const token = delivered[0].text.match(/#reset-password=([a-f0-9]{64})/)[1];
    const stored = await store.findUserByEmail('recover@example.test');
    assert.equal(JSON.stringify(stored).includes(token), false);
    const reset = await call('/api/auth/reset-password', { token, password: 'new-password-123' });
    assert.equal(reset.status, 200);
    assert.equal((await call('/api/auth/reset-password', { token, password: 'another-password' })).status, 400);
    assert.equal((await call('/api/sync', undefined, oldSession)).status, 401);
    assert.equal((await call('/api/auth/login', { email: 'recover@example.test', password: 'old-password' })).status, 401);
    assert.equal((await call('/api/auth/login', { email: 'recover@example.test', password: 'new-password-123' })).status, 200);
    await call('/api/auth/forgot-password', { email: 'recover@example.test' });
    const expired = delivered[1].text.match(/#reset-password=([a-f0-9]{64})/)[1];
    const expiring = (await store.findUserByEmail('recover@example.test'))!;
    expiring.passwordResetTokens![0].expiresAt = 1;
    await store.saveUser(expiring);
    assert.equal((await call('/api/auth/reset-password', { token: expired, password: 'valid-password' })).status, 400);
    globalThis.fetch = async (url, init) => url === 'https://api.resend.com/emails' ? Response.json({}, { status: 503 }) : originalFetch(url, init);
    assert.equal((await call('/api/auth/forgot-password', { email: 'recover@example.test' })).status, 503);
    const finalUser = (await store.findUserByEmail('recover@example.test'))!;
    assert.equal(finalUser.passwordResetTokens!.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.APP_URL;
  }
});

test('two accounts cannot read or overwrite each other, including by forging userId', async () => {
  const a = await (await call('/api/auth/register', { email: 'private-a@example.test', password: 'private-password-a' })).json();
  const b = await (await call('/api/auth/register', { email: 'private-b@example.test', password: 'private-password-b' })).json();
  assert.equal((await (await call('/api/sync', undefined, b.token)).json()).exists, false);
  const snapshot = (id: string) => ({ albums: [{ id, title: id, tracks: [] }], artists: [], collections: [], profile: { id, name: id, email: '' } });
  assert.equal((await call('/api/sync', { data: snapshot('ONLY-A'), expectedRevision: 0 }, a.token)).status, 200);
  assert.equal((await call('/api/sync', { userId: a.user.id, data: snapshot('ONLY-B'), expectedRevision: 0 }, b.token)).status, 200);
  assert.equal((await (await call('/api/sync?userId=' + a.user.id, undefined, b.token)).json()).data.albums[0].id, 'ONLY-B');
  assert.equal((await (await call('/api/sync', undefined, a.token)).json()).data.albums[0].id, 'ONLY-A');
  assert.equal((await call('/api/sync', undefined, 'forged-token')).status, 401);
  process.env.LEGACY_CATALOG_OWNER_ID = a.user.id;
  try {
    assert.equal((await call('/api/auth/legacy-catalog')).status, 401);
    assert.equal((await call('/api/auth/legacy-catalog', undefined, b.token)).status, 403);
    assert.equal((await call('/api/auth/legacy-catalog', undefined, a.token)).status, 200);
  } finally { delete process.env.LEGACY_CATALOG_OWNER_ID; }
});

test('legacy history is removed atomically and old clients cannot reintroduce it', async () => {
  const registered = await (await call('/api/auth/register', { email: 'history-removal@example.test', password: 'test-password' })).json();
  const data = { albums: [{ id: 'a', title: 'Current album', tracks: [{ id: 't', rating: 8.75 }], history: [{ old: 'discarded' }] }], artists: [], collections: [], profile: { id: registered.user.id, name: 'Unicode è 🎵'.repeat(8000), email: '' } };
  await (await store.db()).execute({ sql: 'INSERT INTO userdata (user_id, revision, data) VALUES (?, 1, ?)', args: [registered.user.id, JSON.stringify(data)] });
  const response = await call('/api/sync', undefined, registered.token);
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  const saved = await response.json();
  assert.equal(saved.revision, 2);
  assert.equal(saved.data.albums[0].history, undefined);
  assert.equal(saved.data.albums[0].tracks[0].rating, 8.75);
  assert.equal(saved.data.profile.name, data.profile.name);
  const raw = await (await store.db()).execute({ sql: 'SELECT data FROM userdata WHERE user_id = ?', args: [registered.user.id] });
  assert.equal(JSON.parse(raw.rows[0].data as string).albums[0].history, undefined);
  assert.equal((await call('/api/sync', { data, expectedRevision: 1 }, registered.token)).status, 409);
  assert.equal((await call('/api/sync', { data, expectedRevision: 2 }, registered.token)).status, 200);
  assert.equal((await (await call('/api/sync', undefined, registered.token)).json()).data.albums[0].history, undefined);
});
