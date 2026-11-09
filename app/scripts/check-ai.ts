import fs from 'node:fs';
import { parse } from 'dotenv';
import { generateMusicAi } from '../server/gemini.ts';
import { initialAlbums } from '../test/fixtures.ts';
// Diagnostic uses synthetic fixtures; no personal archive is sent.
const local = fs.existsSync('.env.local') ? parse(fs.readFileSync('.env.local')) : {};
if (!process.env.GEMINI_API_KEY && local.GEMINI_API_KEY) process.env.GEMINI_API_KEY = local.GEMINI_API_KEY;
if (!process.env.GEMINI_MODEL && local.GEMINI_MODEL) process.env.GEMINI_MODEL = local.GEMINI_MODEL;
try {
  const result = await generateMusicAi(initialAlbums, { feature: 'identity', tone: 'narrative' });
  console.log(JSON.stringify({ configured: true, provider: 'Gemini', model: result.model, generated: true, characters: result.text.length, validAlbumReferences: result.albumIds.every(id => initialAlbums.some(a => a.id === id)) }));
} catch (error: any) {
  console.log(JSON.stringify({ configured: !!process.env.GEMINI_API_KEY, generated: false, error: error.message || 'Prova IA non riuscita.' }));
  process.exitCode = 1;
}
