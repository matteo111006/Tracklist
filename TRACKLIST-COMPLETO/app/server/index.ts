import 'dotenv/config';
import { config } from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createApiMiddleware } from './api';
config({ path: '.env.local', quiet: true });
const app = express();
app.disable('x-powered-by');
app.use(createApiMiddleware());
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Endpoint non trovato' }); });
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => { res.sendFile(path.resolve('dist/index.html')); });
app.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => {
  console.log('TRACKLIST pronto su http://' + (process.env.HOST || '127.0.0.1') + ':' + (process.env.PORT || 3000));
});
