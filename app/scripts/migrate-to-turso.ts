// Copia account e archivi dalla vecchia cartella .data (file JSON) al database Turso.
// Uso, dalla cartella app:
//   1. metti TURSO_DATABASE_URL e TURSO_AUTH_TOKEN in .env.local
//   2. npm run db:migrate
// Le sessioni non vengono copiate: dopo la migrazione basta rifare l'accesso.
// Lo script si puo' rilanciare: sovrascrive i dati con quelli dei file.
import 'dotenv/config';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
config({ path: '.env.local', quiet: true });

if (!process.env.TURSO_DATABASE_URL?.trim()) {
  console.error('Manca TURSO_DATABASE_URL: aggiungila a .env.local (vedi .env.example).');
  process.exit(1);
}
const store = await import('../server/db.ts');
const dir = store.dataDir();
const usersFile = path.join(dir, 'users.json');
if (!fs.existsSync(usersFile)) {
  console.error('Non trovo ' + usersFile + '. Lancia lo script dalla cartella app che contiene .data/.');
  process.exit(1);
}

const users: any[] = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
await store.db();
for (const user of users) {
  if (!(await store.insertUser(user))) await store.saveUser(user);
  console.log('Account: ' + user.email);
}

const userdataDir = path.join(dir, 'userdata');
let archives = 0;
if (fs.existsSync(userdataDir)) {
  for (const name of fs.readdirSync(userdataDir).filter(n => n.endsWith('.json'))) {
    const raw = fs.readFileSync(path.join(userdataDir, name), 'utf8');
    if (!raw.trim()) continue;
    const parsed = JSON.parse(raw);
    const snapshot = Number.isInteger(parsed.revision) && parsed.data ? parsed : { revision: 1, data: parsed };
    const userId = name.slice(0, -5);
    if (!users.some(u => u.id === userId)) { console.warn('  saltato ' + name + ': nessun account corrispondente'); continue; }
    await store.putSnapshot(userId, { revision: Math.max(1, snapshot.revision), data: snapshot.data });
    archives++;
    console.log('Archivio: ' + name + ' (' + (Buffer.byteLength(raw) / 1024 / 1024).toFixed(2) + ' MB)');
  }
}

try {
  const owner = JSON.parse(fs.readFileSync(path.join(dir, 'legacy-owner.json'), 'utf8')).userId;
  if (owner) { await store.setSetting('legacy-owner', owner); console.log('Proprietario catalogo storico impostato.'); }
} catch { /* nessun legacy-owner.json */ }

console.log(`\nFatto: ${users.length} account e ${archives} archivi copiati su Turso.`);
