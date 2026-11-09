import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiMiddleware } from './api';
const middleware = createApiMiddleware();
const server = http.createServer((req, res) => { void middleware(req, res, () => { res.statusCode = 204; res.end(); }); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address() as { port: number };
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
test('development middleware blocks private source, accounts, secrets and historical catalogs', async () => {
  for (const path of ['/server/private/catalogData.json', '/src/data/catalogData.json', '/.data/users.json', '/.data/sessions.json', '/.env.local', '/@fs/C:/private', '/server%2Fprivate%2FcatalogData.json']) {
    assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status, 404, path);
  }
});
