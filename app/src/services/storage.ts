import { uniqueId } from '../utils/uniqueId';
import { artistBioUrl } from '../utils/artistBioContext';
import { appendRevision } from '../utils/albumHistory';
import { validateExperienceData } from '../utils/experienceValidation';
import { musicFingerprint } from '../utils/usability';
import type { AiRequest, AiResult, AiConversation, AiTurn } from '../types/ai';
import { Album, Artist, CustomCollection, UserProfile, AuthUser, Track, ArtistTimelineOverrides, DiscographyItem } from '../types';
import { initialAlbums, initialArtists, initialUserProfile, setLegacyCatalog } from '../data/seedData';
import { resolveAlbumArtists } from '../utils/artistParser';
import { cleanRecordLabel } from '../utils/labelCleaner';
import { persistence, packSnapshot, unpackSnapshot } from './persistence';
import { mergeSnapshots } from './syncMerge';

const ALBUMS_KEY = 'tracklist_albums_v5';
const ARTISTS_KEY = 'tracklist_artists_v5';
const PREV_ALBUMS_KEY = 'tracklist_albums_v4';
const PREV_ARTISTS_KEY = 'tracklist_artists_v4';
const PROFILE_KEY = 'tracklist_profile_v5';
const PREV_PROFILE_KEY = 'tracklist_profile_v4';
const COLLECTIONS_KEY = 'tracklist_collections_v5';
const PREV_COLLECTIONS_KEY = 'tracklist_collections_v4';
const DELETED_ALBUMS_KEY = 'tracklist_deleted_album_ids_v5';
const AUTH_TOKEN_KEY = 'tracklist_auth_token_v5';
const AUTH_USER_KEY = 'tracklist_auth_user_v5';
const TIMELINE_OVERRIDES_KEY = 'tracklist_timeline_overrides_v1';

let syncDebounceTimer: any = null;
const deletedMemberships = new Map<string, { id: string; index: number }[]>();

/**
 * Normalizes all albums and artists to ensure full multi-artist support (many-to-many relationship)
 * without losing any ratings, reviews, or metadata.
 */
function normalizeCatalog(
  rawAlbums: Album[],
  rawArtists: Artist[]
): { albums: Album[]; artists: Artist[] } {
  const artistMap = new Map<string, Artist>();
  rawArtists.forEach((a) => {
    artistMap.set(a.id, a);
    artistMap.set(a.name.toLowerCase(), a);
  });

  const normalizedAlbums = rawAlbums.map((alb) => {
    const cleanedLabel = cleanRecordLabel(alb.label);
    if (alb.artistIds && alb.artistIds.length > 0 && alb.artists && alb.artists.length > 0) {
      return { ...alb, label: cleanedLabel };
    }

    const { artistIds, artists, newArtists } = resolveAlbumArtists(alb, Array.from(artistMap.values()));
    newArtists.forEach((na) => {
      artistMap.set(na.id, na);
      artistMap.set(na.name.toLowerCase(), na);
    });

    return {
      ...alb,
      label: cleanedLabel,
      artistIds: artistIds.length > 0 ? artistIds : [alb.artistId],
      artists: artists.length > 0 ? artists : [{ id: alb.artistId, name: alb.artistName }],
    };
  });

  const uniqueArtists = Array.from(
    new Map(Array.from(artistMap.values()).map((a) => [a.id, a])).values()
  );

  return { albums: normalizedAlbums, artists: uniqueArtists };
}


export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'error';
let syncStatus: SyncStatus = 'local';
let syncInFlight: Promise<boolean> | null = null;
const snapshotKeys: Record<string, string> = {
  albums: ALBUMS_KEY, artists: ARTISTS_KEY, profile: PROFILE_KEY,
  collections: COLLECTIONS_KEY, deletedAlbumIds: DELETED_ALBUMS_KEY,
  timelineOverrides: TIMELINE_OVERRIDES_KEY,
};
function setSyncStatus(status: SyncStatus) {
  syncStatus = status;
  window.dispatchEvent(new CustomEvent('tracklist:sync_status', { detail: status }));
}
function publishDataEvents() {
  for (const kind of ['albums', 'artists', 'profile', 'collections', 'timeline'])
    window.dispatchEvent(new CustomEvent('tracklist:' + kind + '_updated'));
}
function defaultSnapshot() {
  const { albums, artists } = normalizeCatalog(structuredClone(initialAlbums), structuredClone(initialArtists));
  return { version: '6.0', albums, artists, profile: initialUserProfile, collections: [], deletedAlbumIds: [], timelineOverrides: {} };
}
function validateRating(rating: number | null) {
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10 || Math.round(rating * 4) !== rating * 4))
    throw new Error('Il voto deve essere tra 0 e 10, con incrementi di 0,25.');
}

function persistAlbumsWithHistory(list: Album[], kind?: import('../types').AlbumRevision['kind'], label?: string, targetId?: string) {
  const previous = new Map(storage.getAlbums(true).map(a => [a.id, a]));
  const updated = list.map(album => appendRevision(previous.get(album.id), album, !targetId || album.id === targetId ? kind : undefined, !targetId || album.id === targetId ? label : undefined));
  persistence.setItem(ALBUMS_KEY, JSON.stringify(updated));
}

export const storage = {
  // ==========================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // ==========================================
  getAuthToken(): string | null {
    try {
      return persistence.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setAuthToken(token: string | null): void {
    if (token) {
      persistence.setItem(AUTH_TOKEN_KEY, token);
    } else {
      persistence.removeItem(AUTH_TOKEN_KEY);
    }
  },

  getAuthUser(): AuthUser | null {
    try {
      const data = persistence.getItem(AUTH_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setAuthUser(user: AuthUser | null, migrateGuest = false): void {
    const previousId = this.getAuthUser()?.id;
    persistence.migrateCurrent();
    const nextAccount = user?.id || 'guest';
    if (persistence.account !== nextAccount) {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      persistence.switchAccount(nextAccount, migrateGuest);
      publishDataEvents();
    }
    if (user) {
      persistence.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      persistence.removeItem(AUTH_USER_KEY);
    }
    if (previousId !== user?.id) window.dispatchEvent(new CustomEvent('tracklist:auth_updated', { detail: user }));
    setSyncStatus(user ? 'pending' : 'local');
  },

  // ==========================================
  // CLOUD SYNC (Multi-device synchronization)
  // ==========================================
  async loadLegacyCatalog(): Promise<void> {
    const token = this.getAuthToken();
    if (!token) return;
    const res = await fetch('/api/auth/legacy-catalog', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) });
    if (res.status === 403 || res.status === 404) { setLegacyCatalog({}); return; }
    if (!res.ok) throw new Error('Impossibile caricare i dati storici del tuo account. Riprova.');
    setLegacyCatalog(await res.json());
  },

  getSyncStatus(): SyncStatus { return syncStatus; },

  getSnapshot(): any {
    return {
      version: '6.0', albums: this.getAlbums(true), artists: this.getArtists(),
      profile: this.getProfile(), collections: this.getCollections(),
      deletedAlbumIds: this.getDeletedAlbumIds(),
      timelineOverrides: JSON.parse(persistence.getItem(TIMELINE_OVERRIDES_KEY) || '{}'),
    };
  },

  applySnapshot(data: any): void {
    for (const [field, key] of Object.entries(snapshotKeys)) {
      if (data[field] !== undefined) persistence.setItem(key, JSON.stringify(data[field]));
    }
    publishDataEvents();
  },

  scheduleCloudSync(): void {
    persistence.setItem('tracklist_sync_dirty', 'true');
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    setSyncStatus(this.getAuthUser() ? 'pending' : 'local');
    if (this.getAuthUser()) syncDebounceTimer = setTimeout(() => { void this.pushToCloud(); }, 800);
  },

  async pushToCloud(): Promise<boolean> {
    if (syncInFlight) {
      await syncInFlight;
      return this.pushToCloud();
    }
    const token = this.getAuthToken();
    const user = this.getAuthUser();
    if (!token || !user) { setSyncStatus('local'); return false; }
    const owner = persistence.account;
    const run = async (): Promise<boolean> => {
      setSyncStatus('syncing');
      try {
        // Always read before writing. CAS revision prevents concurrent devices
        // from silently replacing each other's catalog.
        for (let attempt = 0; attempt < 4; attempt++) {
          const before = await fetch('/api/sync', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) });
          if (before.status === 401) { this.setAuthToken(null); this.setAuthUser(null); return false; }
          if (!before.ok) throw new Error('Sincronizzazione non disponibile');
          const remote = await before.json();
          if (owner !== persistence.account || token !== this.getAuthToken()) return false;
          const local = this.getSnapshot();
          const baselineRaw = persistence.getItem('tracklist_sync_baseline');
          const baseline = baselineRaw ? unpackSnapshot(JSON.parse(baselineRaw)) : undefined;
          const base = baseline || defaultSnapshot();
          const dirty = persistence.getItem('tracklist_sync_dirty') === 'true' || JSON.stringify(local) !== JSON.stringify(base);
          const merged = remote.exists ? (dirty ? mergeSnapshots(base, local, remote.data) : remote.data) : local;
          const sent = JSON.stringify(local);
          const response = await fetch('/api/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ data: merged, expectedRevision: remote.revision || 0 }),
            signal: AbortSignal.timeout(15000), keepalive: false,
          });
          if (response.status === 409) continue;
          if (response.status === 401) { this.setAuthToken(null); this.setAuthUser(null); return false; }
          if (!response.ok) throw new Error('Salvataggio sul server non riuscito');
          if (owner !== persistence.account || token !== this.getAuthToken()) return false;
          // Edits made while the POST was in flight also survive its response.
          const current = this.getSnapshot();
          const changed = JSON.stringify(current) !== sent;
          this.applySnapshot(changed ? mergeSnapshots(local, current, merged) : merged);
          persistence.setItem('tracklist_sync_baseline', JSON.stringify(packSnapshot(merged)));
          persistence.setItem('tracklist_sync_dirty', changed ? 'true' : 'false');
          setSyncStatus(changed ? 'pending' : 'synced');
          if (changed) this.scheduleRetry();
          return true;
        }
        throw new Error('Conflitto di sincronizzazione: nuovo tentativo in attesa');
      } catch (err) {
        if (owner === persistence.account) {
          setSyncStatus('error');
          this.scheduleRetry();
        }
        return false;
      }
    };
    syncInFlight = run();
    try { return await syncInFlight; } finally { syncInFlight = null; }
  },

  scheduleRetry(): void {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => { void this.pushToCloud(); }, 10000);
  },

  async pullFromCloud(): Promise<boolean> {
    // The same serialized reconcile path is used on startup, login and retry.
    // A pull must never discard unsent browser changes.
    return this.pushToCloud();
  },

  // ==========================================
  // DELETED ALBUMS TRACKING (Requirement 15)
  // ==========================================
  getDeletedAlbumIds(): string[] {
    try {
      const data = persistence.getItem(DELETED_ALBUMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setDeletedAlbumIds(ids: string[]): void {
    persistence.setItem(DELETED_ALBUMS_KEY, JSON.stringify(ids));
  },

  // ==========================================
  // USER PROFILE
  // ==========================================
  getProfile(): UserProfile {
    try {
      const data =
        persistence.getItem(PROFILE_KEY) ||
        persistence.getItem(PREV_PROFILE_KEY);
      return data ? JSON.parse(data) : initialUserProfile;
    } catch {
      return initialUserProfile;
    }
  },

  saveProfile(profile: UserProfile): void {
    persistence.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('tracklist:profile_updated', { detail: profile }));
    this.scheduleCloudSync();
  },

  saveAiTurn(request: AiRequest, result: AiResult): AiConversation {
    const current = this.getProfile(), conversations = current.aiConversations || [];
    const existing = request.conversationId ? conversations.find(c => c.id === request.conversationId && c.feature === request.feature) : undefined;
    if (request.conversationId && !existing) throw new Error('Conversazione non disponibile in questo account.');
    const now = result.generatedAt || new Date().toISOString();
    const titles = { identity: 'Il mio ritratto musicale', archive: 'Domande al mio archivio', discovery: 'Nuovi album da scoprire', wrapped: `Il mio Wrapped ${request.year || ''}` };
    const question = request.question?.trim() || titles[request.feature];
    const turn: AiTurn = { ...result, id: uniqueId(), question, generatedAt: now, catalogFingerprint: result.catalogFingerprint || musicFingerprint(this.getAlbums()) };
    const conversation: AiConversation = { id: existing?.id || uniqueId(), feature: request.feature, year: request.year, tone: request.tone,
      title: existing?.title || question.slice(0, 80), createdAt: existing?.createdAt || now, updatedAt: new Date().toISOString(), messages: [...(existing?.messages || []), turn].slice(-12) };
    this.saveProfile({ ...current, aiConversations: [conversation, ...conversations.filter(c => c.id !== conversation.id)].slice(0, 20) });
    return conversation;
  },

  // ==========================================
  // ARTISTS
  // ==========================================
  getArtists(): Artist[] {
    try {
      const data = persistence.getItem(ARTISTS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }

      const prevData = persistence.getItem(PREV_ARTISTS_KEY);
      const baseArtists = prevData ? JSON.parse(prevData) : initialArtists;
      const storedAlbums = persistence.getItem(ALBUMS_KEY) || persistence.getItem(PREV_ALBUMS_KEY);
      const baseAlbums = storedAlbums ? JSON.parse(storedAlbums) : initialAlbums;

      const { artists } = normalizeCatalog(baseAlbums, baseArtists);
      try {
        persistence.setItem(ARTISTS_KEY, JSON.stringify(artists));
      } catch (e) {
        throw e;
      }
      return artists;
    } catch {
      return initialArtists;
    }
  },

  saveArtist(artist: Artist): void {
    const list = this.getArtists();
    const idx = list.findIndex(
      (a) => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
    );
    const existing = idx >= 0 ? list[idx] : null;
    const mergedArtist: Artist = {
      ...existing,
      ...artist,
      bio: existing?.isManualBio && !artist.isManualBio ? existing.bio : artist.bio,
      imageUrl: existing?.isManualImage && !artist.isManualImage ? existing.imageUrl : artist.imageUrl,
      isManualBio: existing?.isManualBio || artist.isManualBio || false,
      isManualImage: existing?.isManualImage || artist.isManualImage || false,
    };

    if (idx >= 0) {
      list[idx] = mergedArtist;
    } else {
      list.push(mergedArtist);
    }

    try {
      persistence.setItem(ARTISTS_KEY, JSON.stringify(list));
    } catch (e) {
      throw e;
    }
    window.dispatchEvent(new CustomEvent('tracklist:artists_updated'));
    this.scheduleCloudSync();
  },

  // ==========================================
  // ALBUMS & CATALOG
  // ==========================================
  getAlbums(includeDeleted: boolean = false): Album[] {
    try {
      const deletedIds = new Set(this.getDeletedAlbumIds());
      const data = persistence.getItem(ALBUMS_KEY);
      let list: Album[] = [];

      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          list = parsed.map((a: Album) => ({ ...a, label: cleanRecordLabel(a.label) }));
        }
      }

      if (!data) {
        const prevData = persistence.getItem(PREV_ALBUMS_KEY);
        const baseAlbums: Album[] = prevData ? JSON.parse(prevData) : initialAlbums;
        const currentArtists: Artist[] = this.getArtists();
        const { albums } = normalizeCatalog(baseAlbums, currentArtists);
        try {
          persistence.setItem(ALBUMS_KEY, JSON.stringify(albums));
        } catch (e) {
          throw e;
        }
        list = albums;
      }

      if (includeDeleted) return list;
      return list.filter((a) => !deletedIds.has(a.id) && !a.deleted);
    } catch {
      return structuredClone(initialAlbums).filter(a => includeDeleted || (!a.deleted && !this.getDeletedAlbumIds().includes(a.id)));
    }
  },

  saveAlbum(album: Album): void {
    const list = this.getAlbums(true);
    const currentArtists = this.getArtists();

    const { artistIds, artists, newArtists } = resolveAlbumArtists(album, currentArtists);
    const enrichedAlbum: Album = {
      ...album,
      label: cleanRecordLabel(album.label),
      artistIds: artistIds.length > 0 ? artistIds : (album.artistIds || [album.artistId]),
      artists: artists.length > 0 ? artists : (album.artists || [{ id: album.artistId, name: album.artistName }]),
      deleted: false,
    };

    // Remove from deleted list if re-added
    const deletedIds = this.getDeletedAlbumIds().filter((id) => id !== album.id);
    this.setDeletedAlbumIds(deletedIds);

    if (newArtists.length > 0) {
      const mergedArtists = [...currentArtists, ...newArtists];
      try {
        persistence.setItem(ARTISTS_KEY, JSON.stringify(mergedArtists));
      } catch (e) {
        throw e;
      }
      window.dispatchEvent(new CustomEvent('tracklist:artists_updated'));
    }

    const idx = list.findIndex((a) => a.id === album.id);
    if (idx >= 0) {
      list[idx] = enrichedAlbum;
    } else {
      list.unshift(enrichedAlbum);
    }
    try {
      persistAlbumsWithHistory(list);
    } catch (e) {
      throw e;
    }
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();

    // Trigger background auto-enrichment for artists lacking bio or photo
    enrichedAlbum.artists?.forEach((a) => {
      this.enrichArtistBackground(a.name);
    });
  },

  // Delete album with full confirmation and undo capability (Requirement 15)
  deleteAlbum(albumId: string): { success: boolean; deletedAlbum: Album | null } {
    const list = this.getAlbums(true);
    const albumIndex = list.findIndex((a) => a.id === albumId);
    if (albumIndex < 0) return { success: false, deletedAlbum: null };

    const targetAlbum = list[albumIndex];

    // Mark as deleted and clear user ratings
    list[albumIndex] = {
      ...targetAlbum,
      deleted: true,
      review: undefined,
      tracks: targetAlbum.tracks.map((t) => ({ ...t, rating: null })),
    };

    const deletedIds = Array.from(new Set([...this.getDeletedAlbumIds(), albumId]));
    this.setDeletedAlbumIds(deletedIds);

    deletedMemberships.set(albumId, this.getCollections().filter(c => c.albumIds.includes(albumId)).map(c => ({ id: c.id, index: c.albumIds.indexOf(albumId) })));
    // Remove from custom collections
    const collections = this.getCollections().map((c) => ({
      ...c,
      albumIds: c.albumIds.filter((id) => id !== albumId),
    }));
    persistence.setItem(COLLECTIONS_KEY, JSON.stringify(collections));

    persistAlbumsWithHistory(list);
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:collections_updated'));
    this.scheduleCloudSync();

    return { success: true, deletedAlbum: targetAlbum };
  },

  undoDeleteAlbum(albumId: string, originalAlbum?: Album): void {
    const deletedIds = this.getDeletedAlbumIds().filter((id) => id !== albumId);
    this.setDeletedAlbumIds(deletedIds);

    const list = this.getAlbums(true);
    const idx = list.findIndex((a) => a.id === albumId);
    if (idx >= 0) {
      list[idx] = originalAlbum ? { ...originalAlbum, deleted: false } : { ...list[idx], deleted: false };
    } else if (originalAlbum) {
      list.unshift({ ...originalAlbum, deleted: false });
    }

    const memberships = deletedMemberships.get(albumId) || [];
    const collections = this.getCollections().map(c => {
      const membership = memberships.find(m => m.id === c.id);
      if (!membership || c.albumIds.includes(albumId)) return c;
      const albumIds = [...c.albumIds];
      albumIds.splice(membership.index, 0, albumId);
      return { ...c, albumIds };
    });
    persistence.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    deletedMemberships.delete(albumId);
    window.dispatchEvent(new CustomEvent('tracklist:collections_updated'));
    persistAlbumsWithHistory(list);
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  // ==========================================
  // REAL-TIME AUTO-SAVE & DRAFT STATUS (Requirement 14)
  // ==========================================
  updateTrackRating(albumId: string, trackId: string, rating: number | null): void {
    const list = this.getAlbums(true);
    const album = list.find((a) => a.id === albumId);
    if (!album) return;

    const track = album.tracks.find((t) => t.id === trackId);
    if (!track) return;

    validateRating(rating);
    track.rating = rating;

    // Set evaluation status to 'draft' if not already completed
    if (album.evaluationStatus !== 'completed') {
      album.evaluationStatus = 'draft';
    }

    try {
      persistAlbumsWithHistory(list);
    } catch (e) {
      throw e;
    }
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  confirmAlbumCompleted(albumId: string, ratings: Record<string, number | null> = {}): void {
    const list = this.getAlbums(true);
    const album = list.find((a) => a.id === albumId);
    if (!album) return;

    album.tracks = album.tracks.map(t => {
      const rating = t.id in ratings ? ratings[t.id] : t.rating;
      validateRating(rating);
      return { ...t, rating };
    });
    album.evaluationStatus = 'completed';
    try {
      persistAlbumsWithHistory(list);
    } catch (e) {
      throw e;
    }
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  saveRelisten(albumId: string, ratings: Record<string, number | null>, note: string): void {
    const list = this.getAlbums(true);
    const album = list.find(a => a.id === albumId && !a.deleted);
    if (!album) throw new Error('Album non disponibile.');
    if (album.tracks.some(t => !(t.id in ratings))) throw new Error('La tracklist è cambiata. Riapri il riascolto.');
    album.tracks = album.tracks.map(t => { validateRating(ratings[t.id]); return { ...t, rating: ratings[t.id] }; });
    if (!album.tracks.some(t => t.rating !== null)) throw new Error('Assegna almeno un voto.');
    album.evaluationStatus = 'completed';
    persistAlbumsWithHistory(list, 'relisten', note.trim().slice(0, 500) || 'Riascolto confermato', albumId);
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  restoreAlbumRevision(albumId: string, revisionId: string): void {
    const list = this.getAlbums(true);
    const album = list.find(a => a.id === albumId && !a.deleted);
    const revision = album?.history?.find(r => r.id === revisionId);
    if (!album || !revision) throw new Error('Versione non disponibile.');
    Object.assign(album, structuredClone(revision.state));
    persistAlbumsWithHistory(list, 'restore', 'Ripristino: ' + revision.label);
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  updateAllTrackRatings(albumId: string, ratingsMap: Record<string, number | null>): void {
    const list = this.getAlbums(true);
    const album = list.find((a) => a.id === albumId);
    if (!album) return;

    album.tracks.forEach((t) => {
      if (t.id in ratingsMap) {
        validateRating(ratingsMap[t.id]);
        t.rating = ratingsMap[t.id];
      }
    });

    if (album.evaluationStatus !== 'completed') {
      album.evaluationStatus = 'draft';
    }

    try {
      persistAlbumsWithHistory(list);
    } catch (e) {
      throw e;
    }
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  // ==========================================
  // TRACKLIST EDITING & REORDERING (Requirement 8)
  // ==========================================
  updateAlbumTracklist(albumId: string, updatedTracks: Track[]): void {
    const list = this.getAlbums(true);
    const album = list.find((a) => a.id === albumId);
    if (!album) return;

    // Renumber tracks sequentially
    const currentRatings = new Map(album.tracks.map(t => [t.id, t.rating]));
    const renumbered = updatedTracks.map((t, idx) => ({
      ...t,
      rating: currentRatings.has(t.id) ? currentRatings.get(t.id)! : t.rating,
      trackNumber: idx + 1,
    }));

    album.tracks = renumbered;
    album.isManualTracklist = true;

    try {
      persistAlbumsWithHistory(list);
    } catch (e) {
      throw e;
    }
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    this.scheduleCloudSync();
  },

  // ==========================================
  // BACKGROUND ARTIST ENRICHMENT (Requirement 1 & 16)
  // ==========================================
  async enrichArtistBackground(artistName: string): Promise<void> {
    const requestingAccount = persistence.account;
    if (!artistName || !artistName.trim()) return;
    const cleanName = artistName.trim();
    const artists = this.getArtists();
    const existing = artists.find((a) => a.name.toLowerCase() === cleanName.toLowerCase());

    // Do not overwrite user-customized bio or image
    const needsBio = !existing || (!existing.isManualBio && (!existing.bio || existing.bio.length < 20));
    const needsImage = !existing || (!existing.isManualImage && !existing.imageUrl);

    if (!needsBio && !needsImage) return;

    try {
      let bio = existing?.bio || '';
      let imageUrl = existing?.imageUrl || '';

      if (needsBio) {
        const bioRes = await fetch(artistBioUrl(cleanName, this.getAlbums()));
        if (bioRes.ok) {
          const bioJson = await bioRes.json();
          if (bioJson.bio) bio = bioJson.bio;
        }
      }

      if (needsImage) {
        const coverRes = await fetch(`/api/spotify/lookup-cover?artist=${encodeURIComponent(cleanName)}`);
        if (coverRes.ok) {
          const coverJson = await coverRes.json();
          if (coverJson.artistImageUrl) imageUrl = coverJson.artistImageUrl;
        }
      }

      if (persistence.account !== requestingAccount) return;
      const freshList = this.getArtists();
      const fresh = freshList.find((a) => a.name.toLowerCase() === cleanName.toLowerCase()) || existing;

      if (fresh) {
        // Never overwrite if user set manual bio or manual photo
        if (bio && !fresh.isManualBio) fresh.bio = bio;
        if (imageUrl && !fresh.isManualImage) fresh.imageUrl = imageUrl;
        this.saveArtist(fresh);
      } else {
        const newArt: Artist = {
          id: `art-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: cleanName,
          bio,
          imageUrl,
          isManualBio: false,
          isManualImage: false,
        };
        this.saveArtist(newArt);
      }
    } catch (err) {
      console.warn('Background artist enrichment failed for', cleanName, err);
    }
  },

  // ==========================================
  // BACKGROUND LABEL BACKFILL (Requirement 7)
  // ==========================================
  async autoBackfillMissingLabels(): Promise<void> {
    const albums = this.getAlbums();
    const unlabelled = albums.filter((a) => !a.label || a.label.trim() === '');
    if (unlabelled.length === 0) return;

    // Process a small batch in background
    for (const alb of unlabelled.slice(0, 5)) {
      try {
        const res = await fetch(
          `/api/spotify/lookup-cover?title=${encodeURIComponent(alb.title)}&artist=${encodeURIComponent(alb.artistName)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.label) {
            alb.label = cleanRecordLabel(data.label);
            this.saveAlbum(alb);
          }
        }
      } catch {
        // Continue silently
      }
    }
  },

  // ==========================================
  // COLLECTIONS
  // ==========================================
  getCollections(): CustomCollection[] {
    try {
      const data =
        persistence.getItem(COLLECTIONS_KEY) ||
        persistence.getItem(PREV_COLLECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCollection(col: CustomCollection): void {
    const list = this.getCollections();
    const idx = list.findIndex((c) => c.id === col.id);
    if (idx >= 0) {
      list[idx] = col;
    } else {
      list.unshift(col);
    }
    persistence.setItem(COLLECTIONS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('tracklist:collections_updated'));
    this.scheduleCloudSync();
  },

  deleteCollection(id: string): void {
    const list = this.getCollections().filter((c) => c.id !== id);
    persistence.setItem(COLLECTIONS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('tracklist:collections_updated'));
    this.scheduleCloudSync();
  },

  // Export full catalog to JSON
  exportDataJSON(): string {
    const fullBackup = {
      version: '5.0',
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      artists: this.getArtists(),
      albums: this.getAlbums(),
      collections: this.getCollections(),
      deletedAlbumIds: this.getDeletedAlbumIds(),
      timelineOverrides: JSON.parse(persistence.getItem(TIMELINE_OVERRIDES_KEY) || '{}'),
    };
    return JSON.stringify(fullBackup, null, 2);
  },

  // Export albums and track ratings to CSV
  exportDataCSV(): string {
    const albums = this.getAlbums();
    const headers = [
      'AlbumID',
      'Titolo',
      'Artista',
      'ArtistiPrincipali',
      'Anno',
      'DataUscita',
      'Edizione',
      'Etichetta',
      'TracciaNumero',
      'TracciaTitolo',
      'Voto',
    ];
    const rows: string[] = [headers.join(',')];

    albums.forEach((alb) => {
      const artistList = alb.artists ? alb.artists.map((a) => a.name).join('; ') : alb.artistName;
      alb.tracks.forEach((t) => {
        const row = [
          `"${alb.id}"`,
          `"${alb.title.replace(/"/g, '""')}"`,
          `"${alb.artistName.replace(/"/g, '""')}"`,
          `"${artistList.replace(/"/g, '""')}"`,
          alb.year,
          `"${alb.releaseDate}"`,
          `"${alb.editionType}"`,
          `"${(alb.label || '').replace(/"/g, '""')}"`,
          t.trackNumber,
          `"${t.title.replace(/"/g, '""')}"`,
          t.rating !== null ? t.rating : '',
        ];
        rows.push(row.join(','));
      });
    });

    return rows.join('\n');
  },

  // Import data with duplicate resolution and automatic normalization
  importDataJSON(jsonStr: string): { importedAlbums: number; importedArtists: number } {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.albums || !Array.isArray(parsed.albums)) {
      throw new Error('Il file JSON non contiene un archivio valido di album.');
    }

    if (parsed.albums.some((a: any) => !a || typeof a.id !== 'string' || typeof a.title !== 'string' || !Array.isArray(a.tracks) || a.tracks.some((t: any) => !t || typeof t.id !== 'string' || typeof t.title !== 'string' || (t.rating !== null && (!Number.isFinite(t.rating) || t.rating < 0 || t.rating > 10))))) {
      throw new Error('Il file contiene album, tracce o voti non validi. Nessun dato importato.');
    }
    validateExperienceData(parsed);
    const currentAlbums = this.getAlbums(true);
    const currentAlbumMap = new Map(currentAlbums.map((a) => [a.id, a]));

    let newCount = 0;
    parsed.albums.forEach((incoming: Album) => {
      if (incoming.id && incoming.title) {
        currentAlbumMap.set(incoming.id, incoming);
        newCount++;
      }
    });

    const incomingArtists: Artist[] = Array.isArray(parsed.artists) ? parsed.artists : [];
    const mergedArtists = [...this.getArtists(), ...incomingArtists];

    const { albums, artists } = normalizeCatalog(Array.from(currentAlbumMap.values()), mergedArtists);

    persistence.setItem(ALBUMS_KEY, JSON.stringify(albums));
    persistence.setItem(ARTISTS_KEY, JSON.stringify(artists));

    if (Array.isArray(parsed.collections)) persistence.setItem(COLLECTIONS_KEY, JSON.stringify(parsed.collections));
    if (parsed.timelineOverrides && typeof parsed.timelineOverrides === 'object') persistence.setItem(TIMELINE_OVERRIDES_KEY, JSON.stringify(parsed.timelineOverrides));
    const restoredIds = new Set(parsed.albums.filter((a: Album) => !a.deleted).map((a: Album) => a.id));
    this.setDeletedAlbumIds([...new Set([...this.getDeletedAlbumIds(), ...(parsed.deletedAlbumIds || [])])].filter((id: string) => !restoredIds.has(id)));
    if (parsed.profile) {
      persistence.setItem(PROFILE_KEY, JSON.stringify(parsed.profile));
    }

    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:artists_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:profile_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:collections_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:timeline_updated'));
    this.scheduleCloudSync();

    return { importedAlbums: newCount, importedArtists: artists.length };
  },

  resetToDefault(): void {
    const { albums, artists } = normalizeCatalog(initialAlbums, initialArtists);
    persistence.setItem(ALBUMS_KEY, JSON.stringify(albums));
    persistence.setItem(ARTISTS_KEY, JSON.stringify(artists));
    persistence.setItem(PROFILE_KEY, JSON.stringify(initialUserProfile));
    this.setDeletedAlbumIds([]);
    persistence.setItem(COLLECTIONS_KEY, '[]');
    persistence.setItem(TIMELINE_OVERRIDES_KEY, '{}');
    publishDataEvents();
    window.dispatchEvent(new CustomEvent('tracklist:albums_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:artists_updated'));
    window.dispatchEvent(new CustomEvent('tracklist:profile_updated'));
    this.scheduleCloudSync();
  },

  // ==========================================
  // ARTIST TIMELINE MANUAL CUSTOMIZATION
  // ==========================================
  getArtistTimelineOverrides(artistKey: string): ArtistTimelineOverrides {
    try {
      const allStr = persistence.getItem(TIMELINE_OVERRIDES_KEY);
      if (!allStr) return { hiddenIds: [], customAlbums: [], editedAlbums: {} };
      const all = JSON.parse(allStr);
      const cleanKey = artistKey.toLowerCase().trim();
      return all[cleanKey] || { hiddenIds: [], customAlbums: [], editedAlbums: {} };
    } catch {
      return { hiddenIds: [], customAlbums: [], editedAlbums: {} };
    }
  },

  saveArtistTimelineOverrides(artistKey: string, overrides: ArtistTimelineOverrides): void {
    try {
      const allStr = persistence.getItem(TIMELINE_OVERRIDES_KEY);
      const all = allStr ? JSON.parse(allStr) : {};
      const cleanKey = artistKey.toLowerCase().trim();
      all[cleanKey] = overrides;
      persistence.setItem(TIMELINE_OVERRIDES_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('tracklist:timeline_updated', { detail: { artistKey: cleanKey } }));
      this.scheduleCloudSync();
    } catch (err) {
      throw err;
    }
  },

  resetArtistTimelineOverrides(artistKey: string): void {
    try {
      const allStr = persistence.getItem(TIMELINE_OVERRIDES_KEY);
      if (!allStr) return;
      const all = JSON.parse(allStr);
      const cleanKey = artistKey.toLowerCase().trim();
      delete all[cleanKey];
      persistence.setItem(TIMELINE_OVERRIDES_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('tracklist:timeline_updated', { detail: { artistKey: cleanKey } }));
      this.scheduleCloudSync();
    } catch (err) {
      throw err;
    }
  },
};

