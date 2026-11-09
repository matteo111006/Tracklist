import { legacyAlbums as initialAlbums, legacyArtists as initialArtists, setLegacyCatalog } from '../data/seedData';
import LZString from 'lz-string';
import { strToU8, strFromU8, zlibSync, unzlibSync } from 'fflate';

const compressedPrefix = '~tracklist-lz1:';
const fastPrefix = '~tracklist-z1:';
const compactPrefix = '~tracklist-z15:';
// 15-bit characters avoid surrogates and store compressed bytes without the
// UTF-16 space penalty of base64 in localStorage.
function packBytes(bytes: Uint8Array): string {
  const chars: string[] = [];
  let bits = 0, buffer = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte; bits += 8;
    if (bits >= 15) { bits -= 15; chars.push(String.fromCharCode(((buffer >>> bits) & 32767) + 32)); }
  }
  if (bits) chars.push(String.fromCharCode(((buffer << (15 - bits)) & 32767) + 32));
  return bytes.length + ':' + chars.join('');
}
function unpackBytes(value: string): Uint8Array {
  const separator = value.indexOf(':');
  const length = Number(value.slice(0, separator));
  if (separator < 1 || !Number.isSafeInteger(length) || length < 0 || length > (value.length - separator - 1) * 2) throw new Error('Archivio locale non leggibile.');
  const bytes = new Uint8Array(length);
  let bits = 0, buffer = 0, offset = 0;
  for (let i = separator + 1; i < value.length && offset < length; i++) {
    const code = value.charCodeAt(i) - 32;
    if (code < 0 || code > 32767) throw new Error('Archivio locale non leggibile.');
    buffer = (buffer << 15) | code; bits += 15;
    while (bits >= 8 && offset < length) { bits -= 8; bytes[offset++] = (buffer >>> bits) & 255; }
  }
  if (offset !== length) throw new Error('Archivio locale incompleto.');
  return bytes;
}
const readCache = new Map<string, { raw: string; value: string }>();
export function encodeLocalValue(value: string): string {
  if (value.length < 4096) return value;
  const bytes = zlibSync(strToU8(value), { level: 1 });
  const packed = compactPrefix + packBytes(bytes);
  return packed.length < value.length ? packed : value;
}
export function decodeLocalValue(value: string | null): string | null {
  if (value?.startsWith(compactPrefix)) return strFromU8(unzlibSync(unpackBytes(value.slice(compactPrefix.length))));
  if (value?.startsWith(fastPrefix)) {
    const binary = atob(value.slice(fastPrefix.length));
    return strFromU8(unzlibSync(Uint8Array.from(binary, char => char.charCodeAt(0))));
  }
  if (!value?.startsWith(compressedPrefix)) return value;
  const decoded = LZString.decompressFromUTF16(value.slice(compressedPrefix.length));
  if (decoded === null) throw new Error('Archivio locale compresso non leggibile.');
  return decoded;
}

const authKey = 'tracklist_auth_user_v5';
const dataKeys = ['tracklist_albums_v5', 'tracklist_artists_v5', 'tracklist_profile_v5', 'tracklist_collections_v5', 'tracklist_deleted_album_ids_v5', 'tracklist_timeline_overrides_v1'];
let account = (() => { try { return JSON.parse(localStorage.getItem(authKey) || 'null')?.id || 'guest'; } catch { return 'guest'; } })();
const keyFor = (key: string) => `${key}:account:${account}`;
const seeds: Record<string, any[]> = { tracklist_albums_v5: initialAlbums, tracklist_artists_v5: initialArtists };

function recoverBrowserSpace(): void {
  if (typeof localStorage.key !== 'function') return;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
  for (const key of keys) {
    if (!key || !/^tracklist_(?:albums|artists|profile|collections|deleted_album_ids|timeline_overrides|sync_)/.test(key)) continue;
    try {
      const previous = localStorage.getItem(key);
      if (!previous || previous.startsWith(compactPrefix)) continue;
      const decoded = decodeLocalValue(previous);
      if (decoded === null) continue;
      const compact = encodeLocalValue(decoded);
      if (compact.length < previous.length) localStorage.setItem(key, compact);
    } catch { /* Keep the original value untouched when migration cannot finish. */ }
  }
}

// Store references to unchanged bundled records, avoiding multiple megabytes of
// identical seed data in localStorage and leaving room for uploaded images.
export function packSnapshot(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const copy = { ...data };
  for (const field of ['albums', 'artists']) {
    if (!Array.isArray(copy[field])) continue;
    const seed = new Map((field === 'albums' ? initialAlbums : initialArtists).map(x => [x.id, x as any]));
    copy[field] = copy[field].map((item: any) => {
      const original = seed.get(item.id);
      if (!original) return item;
      const patch = Object.fromEntries(Object.entries(item).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key])));
      const remove = Object.keys(original).filter(key => !(key in item));
      return { $seed: item.id, ...(Object.keys(patch).length ? { $patch: patch } : {}), ...(remove.length ? { $remove: remove } : {}) };
    });
  }
  return copy;
}
export function unpackSnapshot(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const copy = { ...data };
  for (const field of ['albums', 'artists']) {
    if (!Array.isArray(copy[field])) continue;
    const seed = new Map((field === 'albums' ? initialAlbums : initialArtists).map(x => [x.id, x]));
    copy[field] = copy[field].map((item: any) => {
      if (!item.$seed) return item;
      const original = seed.get(item.$seed);
      if (!original) throw new Error('Il catalogo storico deve essere caricato prima di leggere questo archivio.');
      const value = { ...structuredClone(original), ...item.$patch };
      for (const key of item.$remove || []) delete value[key];
      return value;
    }).filter(Boolean);
  }
  return copy;
}
export const persistence = {
  get account() { return account; },
  getItem(key: string): string | null {
    if (key.endsWith('_v4') && localStorage.getItem('tracklist_storage_migrated_v6')) return null;
    const scoped = dataKeys.includes(key) || key.startsWith('tracklist_sync_');
    const actualKey = scoped ? keyFor(key) : key;
    const stored = localStorage.getItem(actualKey);
    const cached = readCache.get(actualKey);
    if (stored !== null && cached?.raw === stored) return cached.value;
    let raw = decodeLocalValue(stored);
    // One-time migration preserves existing browser data for its current owner.
    if (raw === null && dataKeys.includes(key) && !localStorage.getItem('tracklist_storage_migrated_v6')) {
      raw = decodeLocalValue(localStorage.getItem(key));
      if (raw === null && key.endsWith('_v5')) raw = decodeLocalValue(localStorage.getItem(key.replace(/_v5$/, '_v4')));
    }
    if (raw !== null && seeds[key]) {
      const parsed = JSON.parse(raw);
      if (parsed?.format === 'seed-refs-v1') {
        const field = key.includes('albums') ? 'albums' : 'artists';
        const expanded = JSON.stringify(unpackSnapshot({ [field]: parsed.items })[field]);
        if (stored !== null) readCache.set(actualKey, { raw: stored, value: expanded });
        return expanded;
      }
    }
    if (stored !== null && raw !== null) readCache.set(actualKey, { raw: stored, value: raw });
    return raw;
  },
  setItem(key: string, value: string): void {
    try {
      const original = value;
      const scoped = dataKeys.includes(key) || key.startsWith('tracklist_sync_');
      if (seeds[key]) {
        const field = key.includes('albums') ? 'albums' : 'artists';
        value = JSON.stringify({ format: 'seed-refs-v1', items: packSnapshot({ [field]: JSON.parse(value) })[field] });
      }
      const actualKey = scoped ? keyFor(key) : key;
      const encoded = scoped ? encodeLocalValue(value) : value;
      try { localStorage.setItem(actualKey, encoded); }
      catch (cause) {
        if (!(cause instanceof DOMException) || !['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(cause.name)) throw cause;
        recoverBrowserSpace();
        localStorage.setItem(actualKey, encoded);
        window.dispatchEvent(new CustomEvent('tracklist:storage_recovered'));
      }
      readCache.set(actualKey, { raw: encoded, value: original });
    } catch (cause) {
      const error = new Error('Salvataggio non riuscito: lo spazio del browser è esaurito o non disponibile. Esporta una copia dei dati prima di continuare.', { cause });
      window.dispatchEvent(new CustomEvent('tracklist:storage_error', { detail: error.message }));
      throw error;
    }
  },
  removeItem(key: string): void { localStorage.removeItem(dataKeys.includes(key) || key.startsWith('tracklist_sync_') ? keyFor(key) : key); },
  switchAccount(id: string, migrateGuest = false): void {
    readCache.clear();
    // Finish migration before any account change; never expose one account's
    // data to the next person logging in on the same browser.
    const snapshot = migrateGuest || !localStorage.getItem('tracklist_storage_migrated_v6')
      ? dataKeys.map(key => [key, this.getItem(key)] as const) : [];
    for (const [key, value] of snapshot) if (value !== null) this.setItem(key, value);
    localStorage.setItem('tracklist_storage_migrated_v6', 'true');
    for (const key of dataKeys) localStorage.removeItem(key);
    if (account !== id) setLegacyCatalog({});
    account = id;
    if (migrateGuest) for (const [key, value] of snapshot) if (value !== null) this.setItem(key, value);
  },
  migrateCurrent(): void {
    if (!localStorage.getItem('tracklist_storage_migrated_v6')) this.switchAccount(account);
  },
};
