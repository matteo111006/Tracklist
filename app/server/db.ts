// Persistenza di account, sessioni e archivi.
// In produzione (Render) usa Turso tramite TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.
// Senza queste variabili usa un file SQLite locale in .data/tracklist.db,
// cosi' l'avvio sul PC continua a funzionare senza configurazioni.
import { createClient, type Client } from '@libsql/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface UserRecord {
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

export interface SessionRecord {
  userId: string;
  expiresAt: number;
  passwordVersion?: string;
}

export interface Snapshot { revision: number; data: any }

export function dataDir(): string {
  return path.resolve(process.env.TRACKLIST_DATA_DIR || process.cwd(), '.data');
}

let clientPromise: Promise<Client> | null = null;

export function usingTurso(): boolean {
  return !!process.env.TURSO_DATABASE_URL?.trim();
}

async function init(): Promise<Client> {
  let client: Client;
  if (usingTurso()) {
    client = createClient({ url: process.env.TURSO_DATABASE_URL!.trim(), authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
  } else {
    fs.mkdirSync(dataDir(), { recursive: true });
    client = createClient({ url: 'file:' + path.join(dataDir(), 'tracklist.db') });
  }
  await client.batch([
    'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, record TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, password_version TEXT NOT NULL DEFAULT \'\')',
    'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
    'CREATE TABLE IF NOT EXISTS userdata (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  ], 'write');
  return client;
}

export function db(): Promise<Client> {
  if (!clientPromise) clientPromise = init().catch(err => { clientPromise = null; throw err; });
  return clientPromise;
}

// I token di sessione non vengono salvati in chiaro: nel database c'e' solo l'hash.
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// ---------- Utenti ----------

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const r = await (await db()).execute({ sql: 'SELECT record FROM users WHERE email = ?', args: [email] });
  return r.rows.length ? JSON.parse(r.rows[0].record as string) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const r = await (await db()).execute({ sql: 'SELECT record FROM users WHERE id = ?', args: [id] });
  return r.rows.length ? JSON.parse(r.rows[0].record as string) : null;
}

/** Restituisce false se l'email e' gia' registrata. */
export async function insertUser(user: UserRecord): Promise<boolean> {
  const r = await (await db()).execute({ sql: 'INSERT INTO users (id, email, record) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', args: [user.id, user.email, JSON.stringify(user)] });
  return r.rowsAffected === 1;
}

export async function saveUser(user: UserRecord): Promise<void> {
  await (await db()).execute({ sql: 'UPDATE users SET email = ?, record = ? WHERE id = ?', args: [user.email, JSON.stringify(user), user.id] });
}

/** Trova l'utente che possiede un token di recupero password ancora valido. */
export async function findUserByResetHash(hash: string): Promise<UserRecord | null> {
  const r = await (await db()).execute({ sql: 'SELECT record FROM users WHERE record LIKE ?', args: ['%' + hash + '%'] });
  for (const row of r.rows) {
    const user: UserRecord = JSON.parse(row.record as string);
    if ((user.passwordResetTokens || []).some(t => t.hash === hash && t.expiresAt > Date.now())) return user;
  }
  return null;
}

// ---------- Sessioni ----------

export async function createSession(token: string, session: SessionRecord): Promise<void> {
  const client = await db();
  await client.execute({ sql: 'INSERT INTO sessions (token_hash, user_id, expires_at, password_version) VALUES (?, ?, ?, ?)', args: [tokenHash(token), session.userId, session.expiresAt, session.passwordVersion || ''] });
  // Pulizia occasionale delle sessioni scadute.
  if (Math.random() < 0.05) await client.execute({ sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [Date.now()] });
}

export async function getSession(token: string): Promise<SessionRecord | null> {
  const r = await (await db()).execute({ sql: 'SELECT user_id, expires_at, password_version FROM sessions WHERE token_hash = ?', args: [tokenHash(token)] });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { userId: row.user_id as string, expiresAt: Number(row.expires_at), passwordVersion: row.password_version as string };
}

export async function deleteSession(token: string): Promise<void> {
  await (await db()).execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [tokenHash(token)] });
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await (await db()).execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
}

// ---------- Archivi utente ----------

export async function readSnapshot(userId: string): Promise<Snapshot | null> {
  const r = await (await db()).execute({ sql: 'SELECT revision, data FROM userdata WHERE user_id = ?', args: [userId] });
  if (!r.rows.length) return null;
  return { revision: Number(r.rows[0].revision), data: JSON.parse(r.rows[0].data as string) };
}

/**
 * Salva l'archivio solo se la revisione sul server e' ancora expectedRevision
 * (controllo dei conflitti tra dispositivi). Restituisce false in caso di conflitto.
 */
export async function writeSnapshot(userId: string, expectedRevision: number, data: unknown): Promise<boolean> {
  const client = await db();
  const json = JSON.stringify(data);
  const r = expectedRevision === 0
    ? await client.execute({ sql: 'INSERT INTO userdata (user_id, revision, data) VALUES (?, 1, ?) ON CONFLICT DO NOTHING', args: [userId, json] })
    : await client.execute({ sql: 'UPDATE userdata SET revision = revision + 1, data = ? WHERE user_id = ? AND revision = ?', args: [json, userId, expectedRevision] });
  return r.rowsAffected === 1;
}

/** Scrittura diretta, usata solo dallo script di migrazione. */
export async function putSnapshot(userId: string, snapshot: Snapshot): Promise<void> {
  await (await db()).execute({ sql: 'INSERT INTO userdata (user_id, revision, data) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, data = excluded.data', args: [userId, snapshot.revision, JSON.stringify(snapshot.data)] });
}

// ---------- Impostazioni ----------

export async function getSetting(key: string): Promise<string | null> {
  const r = await (await db()).execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return r.rows.length ? (r.rows[0].value as string) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await (await db()).execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [key, value] });
}
