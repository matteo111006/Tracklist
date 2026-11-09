import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { assertEmailConfigured, sendPasswordResetEmail, EmailError } from './email';
const originalFetch = globalThis.fetch;
const originalEnv = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, url: process.env.APP_URL };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({ RESEND_API_KEY: originalEnv.key, EMAIL_FROM: originalEnv.from, APP_URL: originalEnv.url })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const configure = () => { process.env.RESEND_API_KEY = 'test-key-not-real'; process.env.EMAIL_FROM = 'TRACKLIST <noreply@example.test>'; process.env.APP_URL = 'http://127.0.0.1:3000'; };
test('email requires credentials, sender and a trusted HTTPS or loopback app URL', () => {
  configure();
  delete process.env.RESEND_API_KEY;
  assert.throws(assertEmailConfigured, EmailError);
  configure(); process.env.APP_URL = 'http://public.example.test';
  assert.throws(assertEmailConfigured, EmailError);
  process.env.APP_URL = 'https://tracklist.example.test';
  assert.doesNotThrow(assertEmailConfigured);
});
test('reset mail sends only through the fixed Resend endpoint with a fragment token', async () => {
  configure();
  let body: any;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.match((init?.headers as Record<string, string>).Authorization, /^Bearer /);
    body = JSON.parse(init?.body as string);
    return Response.json({ id: 'test-email-id' });
  };
  await sendPasswordResetEmail('recipient@example.test', 'a'.repeat(64));
  assert.deepEqual(body.to, ['recipient@example.test']);
  assert.match(body.text, /#reset-password=a{64}/);
  assert.match(body.html, /30 minuti/);
});
test('provider failures never leak its response or credentials', async () => {
  configure();
  globalThis.fetch = async () => Response.json({ secret: 'never-show-this' }, { status: 403 });
  await assert.rejects(sendPasswordResetEmail('recipient@example.test', 'a'.repeat(64)), (err: Error) => !err.message.includes('never-show-this') && err instanceof EmailError);
});
