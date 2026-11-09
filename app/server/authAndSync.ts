import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
const gzipAsync = promisify(gzip);
import { snapshotWithoutHistory } from '../src/utils/withoutHistory.ts';
import legacyCatalog from './private/catalogData.json' with { type: 'json' };
import { validateExperienceData } from '../src/utils/experienceValidation.ts';
import { assertEmailConfigured, EmailError, sendPasswordResetEmail } from './email.ts';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createSession, dataDir, deleteSession, deleteUserSessions, findUserByEmail, findUserById,
  findUserByResetHash, getSession, getSetting, insertUser, readSnapshot, saveUser, writeSnapshot,
  type UserRecord,
} from './db.ts';

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        // 50MB max
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function getUserIdFromRequest(req: IncomingMessage): Promise<string | null> {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) return null;

  const session = await getSession(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await deleteSession(token);
    return null;
  }
  const user = await findUserById(session.userId);
  if (!user || (user.passwordVersion || '') !== (session.passwordVersion || '')) return null;
  return session.userId;
}

async function newSession(user: UserRecord): Promise<string> {
  const token = 'tok_' + crypto.randomBytes(32).toString('hex');
  await createSession(token, {
    userId: user.id,
    passwordVersion: user.passwordVersion || '',
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  return token;
}

async function legacyOwnerId(): Promise<string> {
  if (process.env.LEGACY_CATALOG_OWNER_ID) return process.env.LEGACY_CATALOG_OWNER_ID;
  const stored = await getSetting('legacy-owner');
  if (stored) return stored;
  try { return JSON.parse(fs.readFileSync(path.resolve(dataDir(), 'legacy-owner.json'), 'utf8')).userId || ''; } catch { return ''; }
}

function validateSnapshot(data: any): void {
  if (!data || !Array.isArray(data.albums) || !Array.isArray(data.artists) || !Array.isArray(data.collections) || !data.profile)
    throw new Error('Dati non validi: archivio incompleto');
  if (data.albums.some((a: any) => !a || typeof a.id !== 'string' || typeof a.title !== 'string' || !Array.isArray(a.tracks) || a.tracks.some((t: any) => !t || typeof t.id !== 'string' || (t.rating !== null && (!Number.isFinite(t.rating) || t.rating < 0 || t.rating > 10)))))
    throw new Error('Dati non validi: album, tracce o voti');
  if (data.artists.some((a: any) => !a || typeof a.id !== 'string' || typeof a.name !== 'string') || data.collections.some((c: any) => !c || typeof c.id !== 'string' || !Array.isArray(c.albumIds)))
    throw new Error('Dati non validi: artisti o raccolte');
  validateExperienceData(data);
}

const loginAttempts = new Map<string, { count: number; until: number }>();

export function handleAuthAndSync(req: IncomingMessage, res: ServerResponse): boolean {
  if (!req.url?.startsWith('/api/auth') && !req.url?.startsWith('/api/sync')) {
    return false;
  }

  const urlObj = new URL(req.url, 'http://localhost:3000');
  const pathname = urlObj.pathname;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  (async () => {
    try {
      if (req.method === 'POST' && ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password'].includes(pathname)) {
        // Dietro il proxy di Render l'indirizzo reale arriva in X-Forwarded-For.
        const forwarded = process.env.RENDER ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
        const ip = forwarded || req.socket.remoteAddress || 'local';
        let attempts = loginAttempts.get(ip);
        if (!attempts || attempts.until < Date.now()) {
          attempts = { count: 0, until: Date.now() + 15 * 60 * 1000 };
          loginAttempts.set(ip, attempts);
        }
        if (++attempts.count > 30) {
          res.statusCode = 429;
          res.end(JSON.stringify({ error: 'Troppi tentativi. Riprova tra 15 minuti.' }));
          return;
        }
      }
      // 1. REGISTER
      if (pathname === '/api/auth/register' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const name = (typeof body.name === 'string' ? body.name : email.split('@')[0] || 'Utente').trim().slice(0, 100);

        if (!email || !email.includes('@')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Inserisci un indirizzo email valido.' }));
          return;
        }

        if (password.length < 6) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'La password deve contenere almeno 6 caratteri.' }));
          return;
        }

        if (body.initialData) { body.initialData = snapshotWithoutHistory(body.initialData); validateSnapshot(body.initialData); }
        if (await findUserByEmail(email)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Un account con questa email esiste già.' }));
          return;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const newUser: UserRecord = {
          id: 'user_' + crypto.randomUUID().replace(/-/g, ''),
          email,
          name,
          avatarUrl: body.avatarUrl || '',
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
        };

        if (!(await insertUser(newUser))) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Un account con questa email esiste già.' }));
          return;
        }

        const token = await newSession(newUser);

        // If client sent initial migrated data, write it to their cloud store
        if (body.initialData) {
          await writeSnapshot(newUser.id, 0, body.initialData);
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            user: {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              avatarUrl: newUser.avatarUrl,
            },
            token,
          })
        );
        return;
      }

      // 2. LOGIN
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        const user = await findUserByEmail(email);

        if (!user) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Credenziali non valide. Verifica email e password.' }));
          return;
        }

        const computedHash = hashPassword(password, user.salt);
        if (!crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(user.passwordHash, 'hex'))) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Password non corretta.' }));
          return;
        }

        const token = await newSession(user);

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
            },
            token,
          })
        );
        return;
      }

      // 3. ME (SESSION CHECK)
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
          res.statusCode = 200;
          res.end(JSON.stringify({ user: null }));
          return;
        }

        const user = await findUserById(userId);
        if (!user) {
          res.statusCode = 200;
          res.end(JSON.stringify({ user: null }));
          return;
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
            },
          })
        );
        return;
      }

      if (pathname === '/api/auth/legacy-catalog' && req.method === 'GET') {
        const userId = await getUserIdFromRequest(req);
        const ownerId = await legacyOwnerId();
        if (!userId || !ownerId || userId !== ownerId) {
          res.statusCode = userId ? 403 : 401;
          res.end(JSON.stringify({ error: 'Accesso non consentito al catalogo storico.' }));
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify(legacyCatalog));
        return;
      }

      // 4. LOGOUT
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          await deleteSession(authHeader.slice(7).trim());
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 5. FORGOT PASSWORD
      if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Inserisci un indirizzo email valido.' }));
          return;
        }
        assertEmailConfigured();
        const user = await findUserByEmail(email);
        const message = 'Se questo indirizzo è registrato, riceverai un link per reimpostare la password. Controlla anche la cartella spam.';
        if (user) {
          const now = Date.now();
          const active = (user.passwordResetTokens || []).filter(t => t.expiresAt > now);
          // Do not reveal whether an address exists or has reached its mail limit.
          if (active.length < 3) {
            const token = crypto.randomBytes(32).toString('hex');
            const hash = crypto.createHash('sha256').update(token).digest('hex');
            user.passwordResetTokens = [...active, { hash, expiresAt: now + 30 * 60 * 1000 }];
            await saveUser(user);
            try { await sendPasswordResetEmail(user.email, token); }
            catch (err) {
              const latest = await findUserById(user.id);
              if (latest) { latest.passwordResetTokens = (latest.passwordResetTokens || []).filter(t => t.hash !== hash); await saveUser(latest); }
              throw err;
            }
          }
        }
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message }));
        return;
      }

      if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
        const body = await parseJsonBody(req);
        const token = typeof body.token === 'string' ? body.token : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length < 8 || password.length > 128) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'La nuova password deve contenere da 8 a 128 caratteri.' }));
          return;
        }
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const user = /^[a-f0-9]{64}$/.test(token) ? await findUserByResetHash(hash) : null;
        if (!user) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Link non valido, già utilizzato o scaduto. Richiedi una nuova email di recupero.' }));
          return;
        }
        user.salt = crypto.randomBytes(16).toString('hex');
        user.passwordHash = hashPassword(password, user.salt);
        user.passwordVersion = crypto.randomUUID();
        user.passwordResetTokens = [];
        // Version is persisted with the new password. Old sessions are invalid
        // even if the subsequent sessions cleanup is interrupted.
        await saveUser(user);
        await deleteUserSessions(user.id);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 6. SYNC GET
      if (pathname === '/api/sync' && req.method === 'GET') {
        const userId = await getUserIdFromRequest(req);

        if (!userId) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Utente non autenticato per la sincronizzazione.' }));
          return;
        }

        const snapshot = await readSnapshot(userId);
        if (!snapshot) {
          res.statusCode = 200;
          res.end(JSON.stringify({ exists: false, data: null, revision: 0 }));
          return;
        }

        res.statusCode = 200;
        const payload = JSON.stringify({ exists: !!snapshot.data, ...snapshot });
        res.setHeader('Vary', 'Accept-Encoding');
        if (payload.length > 65536 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
          const compressed = await gzipAsync(payload, { level: 1 });
          res.setHeader('Content-Encoding', 'gzip');
          res.end(compressed);
        } else res.end(payload);
        return;
      }

      // 7. SYNC POST
      if (pathname === '/api/sync' && req.method === 'POST') {
        const userId = await getUserIdFromRequest(req);
        const body = await parseJsonBody(req);

        if (!userId) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Utente non autenticato per il salvataggio.' }));
          return;
        }

        const dataToSave = snapshotWithoutHistory(body.data || body);
        validateSnapshot(dataToSave);
        const saved = Number.isInteger(body.expectedRevision) && await writeSnapshot(userId, body.expectedRevision, dataToSave);
        if (!saved) {
          const current = await readSnapshot(userId);
          res.statusCode = 409;
          res.end(JSON.stringify({ error: 'Il catalogo è stato modificato da un altro dispositivo. Ricarica e unisci le modifiche.', revision: current?.revision ?? 0 }));
          return;
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            syncedAt: new Date().toISOString(),
          })
        );
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint non trovato' }));
    } catch (err: any) {
      if (err instanceof EmailError) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.statusCode = err instanceof SyntaxError || err.message?.startsWith('Dati non validi') ? 400 : 500;
      if (res.statusCode === 500) console.error('Auth/Sync Error:', err);
      res.end(JSON.stringify({ error: err.message || 'Errore interno del server' }));
    }
  })();

  return true;
}
