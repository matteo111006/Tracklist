import { legacyAlbums as initialAlbums, legacyArtists as initialArtists, setLegacyCatalog } from '../data/seedData';
import LZString from 'lz-string';

const compressedPrefix = '~tracklist-lz1:';
export function encodeLocalValue(value: string): string {
  if (value.length < 4096) return value;
  const packed = compressedPrefix + LZString.compressToUTF16(value);
  return packed.length < value.length ? packed : value;
}
export function decodeLocalValue(value: string | null): string | null {
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
    let raw = decodeLocalValue(localStorage.getItem(scoped ? keyFor(key) : key));
    // One-time migration preserves existing browser data for its current owner.
    if (raw === null && dataKeys.includes(key) && !localStorage.getItem('tracklist_storage_migrated_v6')) {
      raw = decodeLocalValue(localStorage.getItem(key));
      if (raw === null && key.endsWith('_v5')) raw = decodeLocalValue(localStorage.getItem(key.replace(/_v5$/, '_v4')));
    }
    if (raw !== null && seeds[key]) {
      const parsed = JSON.parse(raw);
      if (parsed?.format === 'seed-refs-v1') {
        const field = key.includes('albums') ? 'albums' : 'artists';
        return JSON.stringify(unpackSnapshot({ [field]: parsed.items })[field]);
      }
    }
    return raw;
  },
  setItem(key: string, value: string): void {
    try {
      const scoped = dataKeys.includes(key) || key.startsWith('tracklist_sync_');
      if (seeds[key]) {
        const field = key.includes('albums') ? 'albums' : 'artists';
        value = JSON.stringify({ format: 'seed-refs-v1', items: packSnapshot({ [field]: JSON.parse(value) })[field] });
      }
      localStorage.setItem(scoped ? keyFor(key) : key, scoped ? encodeLocalValue(value) : value);
    } catch (cause) {
      const error = new Error('Salvataggio non riuscito: lo spazio del browser è esaurito o non disponibile. Esporta una copia dei dati prima di continuare.', { cause });
      window.dispatchEvent(new CustomEvent('tracklist:storage_error', { detail: error.message }));
      throw error;
    }
  },
  removeItem(key: string): void { localStorage.removeItem(dataKeys.includes(key) || key.startsWith('tracklist_sync_') ? keyFor(key) : key); },
  switchAccount(id: string, migrateGuest = false): void {
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
