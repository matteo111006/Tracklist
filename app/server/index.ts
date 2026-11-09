import 'dotenv/config';
import { config } from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createApiMiddleware } from './api';
import { db, usingTurso } from './db';
config({ path: '.env.local', quiet: true });
const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => { res.type('text').send('ok'); });
app.use(createApiMiddleware());
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Endpoint non trovato' }); });
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => { res.sendFile(path.resolve('dist/index.html')); });

// Su Render (variabile RENDER impostata dalla piattaforma) bisogna ascoltare su 0.0.0.0.
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.PORT) || 3000;

try {
  await db();
  console.log(usingTurso() ? 'Database: Turso' : 'Database: file locale .data/tracklist.db');
} catch (err) {
  console.error('Impossibile collegarsi al database. Controlla TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.', err);
  process.exit(1);
}

app.listen(port, host, () => {
  console.log('TRACKLIST pronto su http://' + host + ':' + port);
});
