import legacyCatalog from './private/catalogData.json' with { type: 'json' };
import { validateExperienceData } from '../src/utils/experienceValidation.ts';
import { assertEmailConfigured, EmailError, sendPasswordResetEmail } from './email.ts';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  passwordVersion?: string;
  passwordResetTokens?: { hash: string; expiresAt: number }[];
}

interface SessionRecord {
  userId: string;
  expiresAt: number;
  passwordVersion?: string;
}

const DATA_DIR = path.resolve(process.env.TRACKLIST_DATA_DIR || process.cwd(), '.data');
const USERDATA_DIR = path.resolve(DATA_DIR, 'userdata');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERDATA_DIR)) {
    fs.mkdirSync(USERDATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]), 'utf8');
  }
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}), 'utf8');
  }
}

function readUsers(): UserRecord[] {
  ensureDirectories();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeUsers(users: UserRecord[]): void {
  ensureDirectories();
  atomicWrite(USERS_FILE, users);
}

function readSessions(): Record<string, SessionRecord> {
  ensureDirectories();
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSessions(sessions: Record<string, SessionRecord>): void {
  ensureDirectories();
  atomicWrite(SESSIONS_FILE, sessions);
}

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

export function getUserIdFromRequest(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) return null;

  const sessions = readSessions();
  const session = sessions[token];
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    delete sessions[token];
    writeSessions(sessions);
    return null;
  }
  const user = readUsers().find(u => u.id === session.userId);
  if (!user || (user.passwordVersion || '') !== (session.passwordVersion || '')) return null;
  return session.userId;
}

export function getUserDataPath(userId: string): string {
  ensureDirectories();
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.resolve(USERDATA_DIR, `${safeId}.json`);
}

function atomicWrite(file: string, data: unknown): void {
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(data), 'utf8');
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function readSnapshot(file: string): { revision: number; data: any } {
  if (!fs.existsSync(file) || !fs.statSync(file).size) return { revision: 0, data: null };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Number.isInteger(parsed.revision) && parsed.data ? parsed : { revision: 0, data: parsed };
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
        const ip = req.socket.remoteAddress || 'local';
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

        if (body.initialData) validateSnapshot(body.initialData);
        const users = readUsers();
        if (users.some((u) => u.email === email)) {
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

        users.push(newUser);
        writeUsers(users);

        // Create session
        const token = 'tok_' + crypto.randomBytes(32).toString('hex');
        const sessions = readSessions();
        sessions[token] = {
          userId: newUser.id,
          passwordVersion: newUser.passwordVersion || '',
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        };
        writeSessions(sessions);

        // If client sent initial migrated data, write it to their cloud store
        if (body.initialData) {
          atomicWrite(getUserDataPath(newUser.id), { revision: 1, data: body.initialData });
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

        const users = readUsers();
        const user = users.find((u) => u.email === email);

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

        const token = 'tok_' + crypto.randomBytes(32).toString('hex');
        const sessions = readSessions();
        sessions[token] = {
          userId: user.id,
          passwordVersion: user.passwordVersion || '',
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        };
        writeSessions(sessions);

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
        const userId = getUserIdFromRequest(req);
        if (!userId) {
          res.statusCode = 200;
          res.end(JSON.stringify({ user: null }));
          return;
        }

        const users = readUsers();
        const user = users.find((u) => u.id === userId);
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
        const userId = getUserIdFromRequest(req);
        let ownerId = process.env.LEGACY_CATALOG_OWNER_ID || '';
        try { ownerId ||= JSON.parse(fs.readFileSync(path.resolve(DATA_DIR, 'legacy-owner.json'), 'utf8')).userId; } catch { /* no migration owner configured */ }
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
          const token = authHeader.slice(7).trim();
          const sessions = readSessions();
          delete sessions[token];
          writeSessions(sessions);
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
        const users = readUsers();
        const user = users.find(u => u.email === email);
        const message = 'Se questo indirizzo è registrato, riceverai un link per reimpostare la password. Controlla anche la cartella spam.';
        if (user) {
          const now = Date.now();
          const active = (user.passwordResetTokens || []).filter(t => t.expiresAt > now);
          // Do not reveal whether an address exists or has reached its mail limit.
          if (active.length < 3) {
            const token = crypto.randomBytes(32).toString('hex');
            const hash = crypto.createHash('sha256').update(token).digest('hex');
            user.passwordResetTokens = [...active, { hash, expiresAt: now + 30 * 60 * 1000 }];
            writeUsers(users);
            try { await sendPasswordResetEmail(user.email, token); }
            catch (err) {
              const latestUsers = readUsers();
              const latest = latestUsers.find(u => u.id === user.id);
              if (latest) { latest.passwordResetTokens = (latest.passwordResetTokens || []).filter(t => t.hash !== hash); writeUsers(latestUsers); }
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
        const users = readUsers();
        const user = /^[a-f0-9]{64}$/.test(token) ? users.find(u => (u.passwordResetTokens || []).some(t => t.expiresAt > Date.now() && t.hash === hash)) : undefined;
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
        // even if the subsequent sessions-file cleanup is interrupted.
        writeUsers(users);
        const sessions = readSessions();
        for (const [key, session] of Object.entries(sessions)) if (session.userId === user.id) delete sessions[key];
        writeSessions(sessions);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 6. SYNC GET
      if (pathname === '/api/sync' && req.method === 'GET') {
        const userId = getUserIdFromRequest(req);

        if (!userId) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Utente non autenticato per la sincronizzazione.' }));
          return;
        }

        const filePath = getUserDataPath(userId);
        if (!fs.existsSync(filePath)) {
          res.statusCode = 200;
          res.end(JSON.stringify({ exists: false, data: null, revision: 0 }));
          return;
        }

        const snapshot = readSnapshot(filePath);
        res.statusCode = 200;
        res.end(JSON.stringify({ exists: !!snapshot.data, ...snapshot }));
        return;
      }

      // 7. SYNC POST
      if (pathname === '/api/sync' && req.method === 'POST') {
        const userId = getUserIdFromRequest(req);
        const body = await parseJsonBody(req);

        if (!userId) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Utente non autenticato per il salvataggio.' }));
          return;
        }

        const dataToSave = body.data || body;
        const filePath = getUserDataPath(userId);
        validateSnapshot(dataToSave);
        const current = readSnapshot(filePath);
        if (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== current.revision) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: 'Il catalogo è stato modificato da un altro dispositivo. Ricarica e unisci le modifiche.', revision: current.revision }));
          return;
        }
        atomicWrite(filePath, { revision: current.revision + 1, data: dataToSave });

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
