import { useAppNavigation } from './hooks/useAppNavigation';
import { GlobalSearch } from './components/GlobalSearch';
import { MobileNavigation } from './components/MobileNavigation';
import { ResetPasswordView } from './components/ResetPasswordView';
import { ExperienceHub } from './components/ExperienceHub';
import React, { useState, useEffect, useCallback } from 'react';
import { SaveStatus } from './components/SaveStatus';
import { Menu, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, Artist, AuthUser, CustomCollection, UserProfile } from './types';
import { storage } from './services/storage';
import { Sidebar, ActiveView } from './components/Sidebar';
import { ClassificaView } from './components/ClassificaView';
import { NuoveUsciteView } from './components/NuoveUsciteView';
import { AggiungiAlbumView } from './components/AggiungiAlbumView';
import { AlbumDetailView } from './components/AlbumDetailView';
import { ArtistaView } from './components/ArtistaView';
import { ConfrontoView } from './components/ConfrontoView';
import { AwardsView } from './components/AwardsView';
import { ProfiloView } from './components/ProfiloView';
import { StatisticheView } from './components/StatisticheView';
import { RaccolteView } from './components/RaccolteView';
import { WrappedView } from './components/WrappedView';
import { ImportExportModal } from './components/ImportExportModal';
import { ShareCardModal } from './components/ShareCardModal';
import { AuthModal } from './components/AuthModal';
import { isAlbumInRankings } from './utils/musicMath';

function readResetToken() { return new URLSearchParams(window.location.hash.slice(1)).get('reset-password') || ''; }

export default function App() {
  const [appearance, setAppearance] = useState<'glass' | 'original' | 'light'>(() => {
    try { const saved = localStorage.getItem('tracklist_appearance'); return saved === 'original' || saved === 'light' ? saved : 'glass'; } catch { return 'glass'; }
  });
  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    try { localStorage.setItem('tracklist_appearance', appearance); } catch { /* Appearance remains usable without browser storage. */ }
  }, [appearance]);
  const [resetToken, setResetToken] = useState(readResetToken);
  useEffect(() => {
    const changed = () => setResetToken(readResetToken());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);


  // Core Data loaded from storage
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ id: '', name: '', email: '' });
  const [collections, setCollections] = useState<CustomCollection[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const navigation = useAppNavigation(authUser?.id);
  const activeView = navigation.route.view;
  const selectedAlbumId = navigation.route.albumId || null;
  const selectedArtist = navigation.route.artist || null;
  const confrontoInitials = { a: navigation.route.compareA, b: navigation.route.compareB };
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!authUser || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]') && !isSearchOpen) return;
      event.preventDefault(); setIsSearchOpen(open => !open);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [authUser, isSearchOpen]);
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'error'>('checking');

  // Modals & Navigation state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [shareAlbum, setShareAlbum] = useState<Album | null>(null);

  // Undo Delete Snackbar state (Requirement 15: 6-second window)
  const [undoDelete, setUndoDelete] = useState<{ albumId: string; album: Album } | null>(null);

  // Sync state with storage events
  const refreshData = useCallback(() => {
    setAlbums(storage.getAlbums());
    setArtists(storage.getArtists());
    setProfile(storage.getProfile());
    setCollections(storage.getCollections());
  }, []);

  useEffect(() => {
    const handleAlbumsUpdate = () => setAlbums(storage.getAlbums());
    const handleArtistsUpdate = () => setArtists(storage.getArtists());
    const handleProfileUpdate = () => setProfile(storage.getProfile());
    const handleCollectionsUpdate = () => setCollections(storage.getCollections());
    const handleAuthUpdate = (e: any) => {
      const user = e.detail ?? storage.getAuthUser();
      if (!user) {
        setAuthUser(null); setAlbums([]); setArtists([]); setCollections([]);
        navigation.reset(); setIsSearchOpen(false); setShareAlbum(null);
        setUndoDelete(null); setIsImportExportOpen(false); setIsMobileNavOpen(false);
        setSessionState('ready');
      } else {
        setAuthUser(null); setAlbums([]); setArtists([]); setCollections([]);
        setSessionState('checking');
        void initSessionAndSync();
      }
    };

    const handleUndoDelete = (e: any) => {
      if (e.detail?.albumId && e.detail?.album) {
        setUndoDelete({
          albumId: e.detail.albumId,
          album: e.detail.album,
        });
      }
    };

    window.addEventListener('tracklist:albums_updated', handleAlbumsUpdate);
    window.addEventListener('tracklist:artists_updated', handleArtistsUpdate);
    window.addEventListener('tracklist:profile_updated', handleProfileUpdate);
    window.addEventListener('tracklist:collections_updated', handleCollectionsUpdate);
    window.addEventListener('tracklist:auth_updated', handleAuthUpdate);
    window.addEventListener('tracklist:album_deleted_undo', handleUndoDelete);

    // Initial session verification & multi-device cloud synchronization
    let isCancelled = false;
    const initSessionAndSync = async () => {
      const token = storage.getAuthToken();
      if (!token) { storage.setAuthUser(null); setSessionState('ready'); return; }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          if (res.status === 401) {
            storage.setAuthToken(null);
            storage.setAuthUser(null);
            if (!isCancelled) setAuthUser(null);
          }
          if (!isCancelled) setSessionState(res.status === 401 ? 'ready' : 'error');
          return;
        }

        const data = await res.json();
        if (data.user) {
          if (isCancelled || token !== storage.getAuthToken()) return;
          await storage.loadLegacyCatalog();
          storage.setAuthUser(data.user);
          if (!isCancelled) { setAuthUser(data.user); refreshData(); setSessionState('ready'); }

          // Pull latest cloud state so ratings & artist customizations persist across all devices
          const pulled = await storage.pullFromCloud();
          if (pulled && !isCancelled) {
            refreshData();
          }
        } else {
          storage.setAuthToken(null);
          storage.setAuthUser(null);
          if (!isCancelled) { setAuthUser(null); setSessionState('ready'); }
        }
      } catch (err) {
        if (!isCancelled) setSessionState('error');
      }
    };

    initSessionAndSync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'tracklist_auth_user_v5' || event.key === 'tracklist_auth_token_v5') {
        setAuthUser(null); setAlbums([]); setArtists([]); setCollections([]); setSessionState('checking');
        void initSessionAndSync();
        return;
      }
      if (event.key?.startsWith('tracklist_')) refreshData();
    };
    const retry = () => { if (storage.getAuthToken()) void storage.pullFromCloud(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      isCancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('tracklist:albums_updated', handleAlbumsUpdate);
      window.removeEventListener('tracklist:artists_updated', handleArtistsUpdate);
      window.removeEventListener('tracklist:profile_updated', handleProfileUpdate);
      window.removeEventListener('tracklist:collections_updated', handleCollectionsUpdate);
      window.removeEventListener('tracklist:auth_updated', handleAuthUpdate);
      window.removeEventListener('tracklist:album_deleted_undo', handleUndoDelete);
    };
  }, [refreshData]);

  // 6-second timer for Undo snackbar
  useEffect(() => {
    if (!undoDelete) return;
    const timer = setTimeout(() => {
      setUndoDelete(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [undoDelete]);

  // Unrated count for sidebar badge and banner
  const unratedCount = albums.filter((a) => !isAlbumInRankings(a)).length;

  // Selected Album entity
  const currentAlbum = selectedAlbumId
    ? albums.find((a) => a.id === selectedAlbumId) || null
    : null;

  // Navigation handlers
  const handleSelectAlbum = (albumId: string) => navigation.navigate({ view: 'album_detail', albumId });

  const handleSelectArtist = (artistId: string, artistName: string) => {
    navigation.navigate({ view: 'artista_detail', artist: { id: artistId, name: artistName } });
  };

  const handleNavigateConfronto = (albumId: string) => {
    navigation.navigate({ view: 'confronto', compareA: albumId });
  };

  const handleUpdateTrackRating = (trackId: string, rating: number | null) => {
    if (!selectedAlbumId) return;
    storage.updateTrackRating(selectedAlbumId, trackId, rating);
  };

  const handleSaveAlbum = (newAlbum: Album) => {
    storage.saveAlbum(newAlbum);
    navigation.navigate({ view: 'album_detail', albumId: newAlbum.id });
  };

  const handleUpdateAlbum = (updated: Album) => {
    storage.saveAlbum(updated);
  };

  const handleUpdateArtist = (updated: Artist) => {
    storage.saveArtist(updated);
  };

  const handleSaveProfile = (updated: UserProfile) => {
    storage.saveProfile(updated);
  };

  const handleSaveCollection = (col: CustomCollection) => {
    storage.saveCollection(col);
  };

  const handleDeleteCollection = (id: string) => {
    storage.deleteCollection(id);
  };

  const handleLogout = async () => {
    await storage.pushToCloud();
    try {
      const token = storage.getAuthToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore network errors
    }
    storage.setAuthToken(null);
    storage.setAuthUser(null);
    setAuthUser(null);
    refreshData();
  };

  const handleResetData = () => {
    if (confirm('Vuoi davvero ripristinare il catalogo ai dati iniziali originali?')) {
      storage.resetToDefault();
      refreshData();
    }
  };

  if (resetToken) return <ResetPasswordView token={resetToken} onClose={(completed) => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setResetToken('');
    if (completed) { storage.setAuthToken(null); storage.setAuthUser(null); }
    setIsAuthModalOpen(true);
  }} />;

  if (sessionState !== 'ready') return <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-6">
    <section className="max-w-md text-center"><p className="text-[#c7ff36] tracking-[0.25em] mb-5">TRACKLIST</p>
      <p role="status">{sessionState === 'checking' ? 'Verifica dell’accesso…' : 'Non riesco a verificare la sessione. Riprova quando il server è disponibile.'}</p>
      {sessionState === 'error' && <button className="mt-5 underline text-[#c7ff36]" onClick={() => window.location.reload()}>Riprova</button>}
    </section>
  </main>;

  if (!authUser) return <main className="min-h-screen bg-[#080808] text-white">
    <AuthModal key="required-login" required isOpen onClose={() => {}} onAuthSuccess={user => {
      navigation.reset(); setIsSearchOpen(false);
      setShareAlbum(null); setUndoDelete(null);
      refreshData(); setAuthUser(user); setIsAuthModalOpen(false);
    }} />
  </main>;

  return (
    <div className="relative isolate min-h-screen bg-[#080808] text-[#f5f5f2] flex flex-col font-sans selection:bg-[#c7ff36] selection:text-black">
      {appearance === 'glass' && activeView === 'album_detail' && currentAlbum?.coverUrl && (
        <div aria-hidden="true" className="tl-album-atmosphere" key={currentAlbum.id}>
          <img src={currentAlbum.coverUrl} alt="" onError={event => { event.currentTarget.style.opacity = '0'; }} />
        </div>
      )}
      <SaveStatus />
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 lg:ml-[295px] bg-[#0d0d0f]/95 border-b border-[#1c1c20] px-4 sm:px-8 py-3 flex items-center justify-between gap-3 backdrop-blur-md">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsMobileNavOpen(true)}
          className="lg:hidden p-1.5 text-neutral-300 hover:text-white cursor-pointer"
          aria-label="Apri menu di navigazione"
        >
          <Menu size={22} />
        </motion.button>

        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border border-[#c7ff36]/60 flex items-center justify-center p-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#c7ff36]" />
          </div>
          <span className="font-medium text-xs tracking-[0.25em] text-white">TRACKLIST</span>
        </div>

        <button onClick={() => setIsSearchOpen(true)} aria-label="Apri ricerca globale" className="min-w-0 flex-1 max-w-xl flex items-center gap-3 rounded-xl border border-[#35432a] bg-[#171d12] px-3 sm:px-4 py-2 text-[#a5b695] text-sm"><Search size={16} className="text-[#c7ff36] shrink-0" /><span className="truncate">Cerca album, artista o traccia</span><kbd className="hidden sm:block ml-auto text-[10px] shrink-0 border border-[#3a472f] px-1.5 py-1 rounded">Ctrl / ⌘ K</kbd></button>
      </header>

      {/* Persistent Left Sidebar */}
      <Sidebar
        activeView={activeView}
        onNavigate={(view) => {
          navigation.navigate({ view });
        }}
        unratedCount={unratedCount}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        authUser={authUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area with fluid Animated Page Transitions */}
      <main className="flex-1 lg:pl-[295px] pb-32 lg:pb-0 transition-all">
        <div className="max-w-[1300px] mx-auto px-5 sm:px-10 lg:px-16 py-8 sm:py-12 lg:py-14">
          <AnimatePresence mode="wait">
            <motion.div
              key={navigation.entryKey}
              onAnimationComplete={() => navigation.restoreScroll(navigation.entryKey)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeView === 'esperienze' && <ExperienceHub albums={albums} profile={profile} collections={collections} onSelectAlbum={handleSelectAlbum} onNavigate={view => navigation.navigate({ view })} onSaveAlbum={handleSaveAlbum} onSaveCollection={handleSaveCollection} />}
              {activeView === 'classifica' && (
                <ClassificaView
                  albums={albums}
                  artists={artists}
                  onSelectAlbum={handleSelectAlbum}
                  onSelectArtist={handleSelectArtist}
                  onNavigateNuoveUscite={() => navigation.navigate({ view: 'nuove_uscite' })}
                />
              )}

              {activeView === 'nuove_uscite' && (
                <NuoveUsciteView
                  albums={albums}
                  onSelectAlbum={handleSelectAlbum}
                  onNavigateAggiungi={() => navigation.navigate({ view: 'aggiungi' })}
                />
              )}

              {activeView === 'aggiungi' && (
                <AggiungiAlbumView
                  onBack={navigation.back}
                  onSaveAlbum={handleSaveAlbum}
                />
              )}

              {activeView === 'album_detail' && !currentAlbum && <section className="p-8 rounded-2xl border border-[#34432a]"><h1 className="text-2xl text-white mb-3">Album non disponibile in questo account</h1><button className="text-[#c7ff36] underline" onClick={navigation.back}>Torna indietro</button></section>}
              {activeView === 'album_detail' && currentAlbum && (
                <AlbumDetailView
                  album={currentAlbum}
                  highlightTrackId={navigation.route.trackId}
                  onBack={navigation.back}
                  onSelectArtist={handleSelectArtist}
                  onUpdateTrackRating={handleUpdateTrackRating}
                  onUpdateAlbum={handleUpdateAlbum}
                  onNavigateConfronto={handleNavigateConfronto}
                  onOpenShareModal={(alb) => setShareAlbum(alb)}
                />
              )}

              {activeView === 'artista_detail' && selectedArtist && (
                <ArtistaView
                  artistId={selectedArtist.id}
                  artistName={selectedArtist.name}
                  allAlbums={albums}
                  artists={artists}
                  onBack={navigation.back}
                  onSelectAlbum={handleSelectAlbum}
                  onSelectArtist={handleSelectArtist}
                  onUpdateArtist={handleUpdateArtist}
                />
              )}

              {activeView === 'confronto' && (
                <ConfrontoView
                  albums={albums}
                  initialAlbumIdA={confrontoInitials.a}
                  initialAlbumIdB={confrontoInitials.b}
                  onSelectAlbum={handleSelectAlbum}
                  onOpenShareModal={(alb) => setShareAlbum(alb)}
                />
              )}

              {activeView === 'awards' && (
                <AwardsView
                  albums={albums}
                  artists={artists}
                  onSelectAlbum={handleSelectAlbum}
                  onSelectArtist={handleSelectArtist}
                />
              )}

              {activeView === 'profilo' && (
                <ProfiloView
                  appearance={appearance}
                  onAppearanceChange={setAppearance}
                  profile={profile}
                  albums={albums}
                  authUser={authUser}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  onLogout={handleLogout}
                  onSaveProfile={handleSaveProfile}
                  onSelectAlbum={handleSelectAlbum}
                  onSelectArtist={handleSelectArtist}
                  onResetData={handleResetData}
                />
              )}

              {/* TRACKLIST 2.0 Views */}
              {activeView === 'statistiche' && (
                <StatisticheView
                  albums={albums}
                  artists={artists}
                  onSelectAlbum={handleSelectAlbum}
                  onSelectArtist={handleSelectArtist}
                />
              )}

              {activeView === 'raccolte' && (
                <RaccolteView
                  collections={collections}
                  albums={albums}
                  onSaveCollection={handleSaveCollection}
                  onDeleteCollection={handleDeleteCollection}
                  onSelectAlbum={handleSelectAlbum}
                />
              )}

              {activeView === 'wrapped' && (
                <WrappedView
                  albums={albums}
                  artists={artists}
                  onSelectAlbum={handleSelectAlbum}
                  onOpenShareModal={(alb) => setShareAlbum(alb)}
                  onSelectArtist={handleSelectArtist}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onDataChanged={refreshData}
      />

      <MobileNavigation activeView={activeView} onNavigate={view => navigation.navigate({ view })} onSearch={() => setIsSearchOpen(true)} />
      {isSearchOpen && <GlobalSearch albums={albums} artists={artists} onNavigate={navigation.navigate} onClose={() => setIsSearchOpen(false)} />}

      {/* Share Card Modal */}
      <ShareCardModal
        album={shareAlbum}
        isOpen={!!shareAlbum}
        onClose={() => setShareAlbum(null)}
      />

      {/* Auth & Cloud Sync Modal (Requirement 13) */}
      <AuthModal
        key={authUser?.id || 'guest'}
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(u) => {
          navigation.reset(); setIsSearchOpen(false); setShareAlbum(null);
          setUndoDelete(null);
          setAuthUser(u);
          refreshData();
        }}
      />

      {/* Floating 6-second Undo Delete Snackbar (Requirement 15) */}
      <AnimatePresence>
        {undoDelete && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-[420px] z-50 bg-[#141419] border border-[#2b2b35] shadow-[0_10px_35px_rgba(0,0,0,0.6)] rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={undoDelete.album.coverUrl}
                alt=""
                className="w-11 h-11 rounded-lg object-cover bg-[#222] shrink-0 border border-[#262630]"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  "{undoDelete.album.title}" eliminato
                </p>
                <p className="text-[11px] text-[#8e8e93] font-mono mt-0.5">
                  6 secondi per annullare
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                storage.undoDeleteAlbum(undoDelete.albumId, undoDelete.album);
                setUndoDelete(null);
                refreshData();
              }}
              className="px-4 py-2 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 cursor-pointer shrink-0 transition-all shadow-md font-sans"
            >
              Annulla
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
