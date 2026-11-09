import { useViewMemory } from '../hooks/useViewMemory';
import { useSaveAndClose } from '../hooks/useSaveAndClose';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { artistBioUrl } from '../utils/artistBioContext';
import { ArrowLeft, Pencil, Image as ImageIcon, X, Upload, Disc3, Sparkles, Users, CheckCircle2, RotateCcw, Loader2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, Artist } from '../types';
import { calculateArtistStats, formatRating, isAlbumEvaluated } from '../utils/musicMath';
import { ImageUploadInput } from './ImageUploadInput';
import { readAndCompressImage } from '../utils/imageUtils';
import { ArtistDiscographyTimeline } from './ArtistDiscographyTimeline';
import { storage } from '../services/storage';

interface ArtistaViewProps {
  artistId: string;
  artistName: string;
  allAlbums: Album[];
  artists: Artist[];
  onBack: () => void;
  onSelectAlbum: (albumId: string) => void;
  onSelectArtist: (artistId: string, artistName: string) => void;
  onUpdateArtist: (artist: Artist) => void;
}

export const ArtistaView: React.FC<ArtistaViewProps> = ({
  artistId,
  artistName,
  allAlbums,
  artists,
  onBack,
  onSelectAlbum,
  onSelectArtist,
  onUpdateArtist,
}) => {
  const currentArtist = useMemo(() => {
    return (
      artists.find(
        (a) => a.id === artistId || a.name.toLowerCase() === artistName.toLowerCase()
      ) || {
        id: artistId,
        name: artistName,
        bio: `${artistName} è presente nella collezione con le sue pubblicazioni musicali e collaborazioni.`,
        imageUrl:
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
      }
    );
  }, [artists, artistId, artistName]);

  const [activeTab, setActiveTab] = useViewMemory<'all' | 'stats' | 'collabs'>(`artist.${artistId}.tab`, 'all');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const { saveAndClose, saveError, isSaving, clearSaveError } = useSaveAndClose();
  const [draftBio, setDraftBio] = useState(currentArtist.bio);
  const [draftImg, setDraftImg] = useState(currentArtist.imageUrl);
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);
  const [bioLookupMessage, setBioLookupMessage] = useState('');

  useEffect(() => {
    if (!isEditingBio) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const dialog = document.getElementById('artist-profile-editor');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setIsEditingBio(false);
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [isEditingBio, isSaving]);

  const artistFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDirectArtistPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAndCompressImage(file);
      const updated: Artist = {
        ...currentArtist,
        imageUrl: dataUrl,
        isManualImage: true,
      };
      onUpdateArtist(updated);
      setDraftImg(dataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      if (artistFileInputRef.current) artistFileInputRef.current.value = '';
    }
  };

  const stats = useMemo(() => {
    return calculateArtistStats(currentArtist, allAlbums);
  }, [currentArtist, allAlbums]);

  const soloAlbums = useMemo(() => {
    return stats.artistAlbums.filter((item) => !item.isCollaboration);
  }, [stats.artistAlbums]);

  const collabAlbums = useMemo(() => {
    return stats.artistAlbums.filter((item) => item.isCollaboration);
  }, [stats.artistAlbums]);

  // Automatic Bio & Photo Enrichment (Requirement 1 & 16)
  useEffect(() => {
    // If artist has manual bio, skip Wikipedia lookup completely
    if (!currentArtist.isManualBio && (!currentArtist.bio || currentArtist.bio.includes('è presente nella collezione') || currentArtist.bio.length < 20)) {
      fetch(`/api/artist/bio?name=${encodeURIComponent(currentArtist.name)}`)
        .then((res) => res.json())
        .then((data) => {
          const fresh = storage.getArtists().find(a => a.id === currentArtist.id) || currentArtist;
          if (data.bio && data.bio.trim() && !fresh.isManualBio) {
            const updated: Artist = { ...fresh, bio: data.bio.trim() };
            onUpdateArtist(updated);
            setDraftBio(data.bio.trim());
          }
        })
        .catch(() => {});
    }

    // If artist has manual photo, skip Spotify lookup completely
    if (!currentArtist.isManualImage && (!currentArtist.imageUrl || currentArtist.imageUrl.includes('unsplash'))) {
      fetch(`/api/spotify/lookup-cover?artist=${encodeURIComponent(currentArtist.name)}`)
        .then((res) => res.json())
        .then((data) => {
          const fresh = storage.getArtists().find(a => a.id === currentArtist.id) || currentArtist;
          if (data.artistImageUrl && !fresh.isManualImage) {
            const updated: Artist = { ...fresh, imageUrl: data.artistImageUrl };
            onUpdateArtist(updated);
            setDraftImg(data.artistImageUrl);
          }
        })
        .catch(() => {});
    }
  }, [currentArtist.id, currentArtist.name, currentArtist.isManualBio, currentArtist.isManualImage]);

  const [timelineToast, setTimelineToast] = useState<string | null>(null);

  const handleAddAlbumFromTimeline = async (item: any) => {
    try {
      setTimelineToast(`Aggiunta in corso: ${item.title}...`);
      let tracks: any[] = [];
      let label = item.label || '';

      if (item.spotifyId && !item.spotifyId.startsWith('it-')) {
        const res = await fetch(`/api/spotify/album?id=${item.spotifyId}`);
        if (res.ok) {
          const data = await res.json();
          tracks = (data.tracks || []).map((t: any, idx: number) => ({
            id: `trk-${item.spotifyId}-${idx + 1}`,
            albumId: `alb-${item.spotifyId}`,
            trackNumber: t.trackNumber || idx + 1,
            title: t.title,
            artists: t.artists || currentArtist.name,
            rating: null,
          }));
          if (data.label) label = data.label;
        }
      }

      if (tracks.length === 0) {
        const count = item.tracksCount || 10;
        tracks = Array.from({ length: count }).map((_, idx) => ({
          id: `trk-${Date.now()}-${idx + 1}`,
          albumId: `alb-${Date.now()}`,
          trackNumber: idx + 1,
          title: `Traccia ${idx + 1}`,
          artists: currentArtist.name,
          rating: null,
        }));
      }

      const newAlb: Album = {
        id: item.spotifyId ? `alb-${item.spotifyId}` : `alb-${Date.now()}`,
        title: item.title,
        artistId: currentArtist.id,
        artistName: currentArtist.name,
        artistIds: [currentArtist.id],
        artists: [{ id: currentArtist.id, name: currentArtist.name }],
        releaseDate: item.releaseDate || `${item.year}-01-01`,
        releaseDateFormatted: new Date(item.releaseDate || `${item.year}-01-01`).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).toUpperCase(),
        year: item.year || new Date().getFullYear(),
        coverUrl: item.coverUrl,
        label: label || 'Non disponibile',
        genres: 'Rap Italiano',
        duration: '',
        editionType: 'standard',
        spotifyUrl: item.spotifyUrl,
        spotifyId: item.spotifyId,
        tracks,
        evaluationStatus: 'unrated',
      };

      storage.saveAlbum(newAlb);
      setTimelineToast(`Album "${item.title}" aggiunto a TRACKLIST!`);
      setTimeout(() => setTimelineToast(null), 4000);
      onSelectAlbum(newAlb.id);
    } catch (err: any) {
      console.warn('Error adding album from timeline:', err);
      setTimelineToast('Errore durante l\'aggiunta dell\'album');
      setTimeout(() => setTimelineToast(null), 4000);
    }
  };

  const handleFetchWikipediaBio = async () => {
    setIsFetchingWiki(true);
    setBioLookupMessage('');
    try {
      const res = await fetch(artistBioUrl(currentArtist.name, allAlbums));
      if (res.ok) {
        const data = await res.json();
        if (data.bio && data.bio.trim()) {
          setDraftBio(data.bio.trim());
          setBioLookupMessage('Biografia musicale trovata: controllala prima di salvare.');
        } else {
          setBioLookupMessage('Nessuna biografia musicale verificabile per questo artista. La descrizione attuale è rimasta invariata.');
        }
      } else setBioLookupMessage('Ricerca non disponibile. La descrizione attuale è rimasta invariata.');
    } catch (err) {
      setBioLookupMessage('Ricerca non disponibile. La descrizione attuale è rimasta invariata.');
      console.warn('Wikipedia bio lookup failed:', err);
    } finally {
      setIsFetchingWiki(false);
    }
  };

  const handleResetPhotoToSpotify = async () => {
    try {
      const res = await fetch(`/api/spotify/lookup-cover?artist=${encodeURIComponent(currentArtist.name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.artistImageUrl) {
          setDraftImg(data.artistImageUrl);
        }
      }
    } catch (err) {
      console.warn('Spotify photo lookup failed:', err);
    }
  };

  const handleSaveBio = () => {
    return saveAndClose(() => {
      const isPhotoCustomized =
        draftImg.trim() !== '' &&
        (draftImg !== currentArtist.imageUrl || currentArtist.isManualImage);

      const updated: Artist = {
        ...currentArtist,
        bio: draftBio.trim(),
        imageUrl: draftImg.trim() || currentArtist.imageUrl,
        isManualBio: true,
        isManualImage: isPhotoCustomized,
      };
      onUpdateArtist(updated);
    }, () => { setIsEditingBio(false); });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="max-w-5xl mx-auto w-full px-2 sm:px-4"
    >
      {/* Back button */}
      <motion.button
        whileHover={{ x: -3 }}
        whileTap={{ scale: 0.98 }}
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#77777f] hover:text-white uppercase mb-6 sm:mb-8 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>INDIETRO</span>
      </motion.button>

      {/* Centered Modern Hero Section (Requirement 2) */}
      <div className="flex flex-col items-center text-center mb-10 sm:mb-12">
        {/* Centered Circular Artist Image with modern glow */}
        <div className="relative group w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden shrink-0 bg-[#161619] border-2 border-[#2b2b32] shadow-[0_12px_40px_rgba(0,0,0,0.85)] ring-4 ring-[#151518]">
          <img
            src={currentArtist.imageUrl}
            alt={currentArtist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <input
            type="file"
            ref={artistFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleDirectArtistPhotoUpload}
          />
          {/* Quick upload triggers */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={() => artistFileInputRef.current?.click()}
              title="Carica foto da locale"
              className="p-2.5 rounded-full bg-black/80 hover:bg-black text-[#c7ff36] border border-white/10 shadow-lg transition-transform hover:scale-110 cursor-pointer"
            >
              <Upload size={16} />
            </motion.button>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={() => {
                setDraftBio(currentArtist.bio);
                setDraftImg(currentArtist.imageUrl);
                clearSaveError(); setIsEditingBio(true);
              }}
              title="Modifica profilo e foto"
              className="p-2.5 rounded-full bg-black/80 hover:bg-black text-white border border-white/10 shadow-lg transition-transform hover:scale-110 cursor-pointer"
            >
              <ImageIcon size={16} />
            </motion.button>
          </div>
        </div>

        {/* Centered Typography: Artist Name - Original Casing preserved without uppercase (Requirement 2) */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mt-5 mb-2 font-sans">
          {currentArtist.name}
        </h1>

        {/* Key stats row */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-mono uppercase tracking-wider text-[#8e8e93] my-3">
          <span className="px-3 py-1 rounded-full bg-[#121216] border border-[#232328]">
            {stats.albumsCount} ALBUM NEL TUO ARCHIVIO
          </span>
          {stats.artistAverage !== null && (
            <span className="px-3 py-1 rounded-full bg-[#18230f] border border-[#2d4016] text-[#c7ff36] font-semibold">
              MEDIA VOTI: {formatRating(stats.artistAverage)}
            </span>
          )}
          {stats.bestAlbum && (
            <span className="px-3 py-1 rounded-full bg-[#121216] border border-[#232328] text-neutral-300">
              TOP: <strong className="text-white">{stats.bestAlbum.title}</strong> ({formatRating(stats.bestAlbum.average, 2)})
            </span>
          )}
        </div>

        {/* Centered Bio */}
        {currentArtist.bio && (
          <p className="text-xs sm:text-sm text-[#a3a3ad] max-w-2xl font-light leading-relaxed mt-2 mb-3 px-4">
            {currentArtist.bio}
          </p>
        )}

        {/* Prominent Edit Artist Button (Confirmed UX Requirement) */}
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={() => {
            setDraftBio(currentArtist.bio);
            setDraftImg(currentArtist.imageUrl);
            clearSaveError();
            setIsEditingBio(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded-full bg-[#141419] hover:bg-[#1c1c24] border border-[#2b2b35] hover:border-[#c7ff36]/60 text-xs text-white hover:text-[#c7ff36] uppercase font-semibold tracking-wider transition-all shadow-sm hover:shadow-[0_0_15px_rgba(199,255,54,0.15)] cursor-pointer"
        >
          <Pencil size={13} className="text-[#c7ff36]" />
          <span>MODIFICA ARTISTA</span>
        </motion.button>
      </div>

      {/* Interactive Horizontal Discography Timeline (Requirement 12: Left = Newest, Right = Oldest) */}
      <ArtistDiscographyTimeline
        artistId={currentArtist.spotifyId || currentArtist.id}
        artistName={currentArtist.name}
        existingAlbums={allAlbums}
        onSelectAlbum={onSelectAlbum}
        onAddAlbum={handleAddAlbumFromTimeline}
      />

      {/* Timeline Action Toast */}
      <AnimatePresence>
        {timelineToast && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-8 right-8 z-50 bg-[#16220e]/95 border border-[#c7ff36]/40 text-[#d4ffd6] px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs"
          >
            <CheckCircle2 size={15} className="text-[#c7ff36]" />
            <span>{timelineToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 border-b border-[#1c1c22] pb-3 mb-8">
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#18181d] text-[#c7ff36] border border-[#2d2d38]'
              : 'text-[#77777f] hover:text-white'
          }`}
        >
          <Disc3 size={14} />
          <span>Album in archivio ({stats.albumsCount})</span>
        </motion.button>

        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-[#18181d] text-[#c7ff36] border border-[#2d2d38]'
              : 'text-[#77777f] hover:text-white'
          }`}
        >
          <Sparkles size={14} />
          <span>Statistiche & Top Brani</span>
        </motion.button>

        {collabAlbums.length > 0 && (
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={() => setActiveTab('collabs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'collabs'
                ? 'bg-[#18181d] text-[#c7ff36] border border-[#2d2d38]'
                : 'text-[#77777f] hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Collaborazioni in archivio ({collabAlbums.length})</span>
          </motion.button>
        )}
      </div>

      <p className="text-xs text-[#8e8e96] mb-5">L’elenco e le statistiche riguardano solo gli album che hai inserito nel tuo archivio, compresi quelli ancora da valutare. Non rappresentano l’intera discografia dell’artista.</p>
      {/* TAB 1: ALL ALBUMS */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.artistAlbums.map(({ album, isCollaboration, coArtists, averageRating }) => {
              const evaluated = isAlbumEvaluated(album);
              return (
                <motion.div
                  key={album.id}
                  whileHover={{ y: -3, borderColor: '#33333f' }}
                  onClick={() => onSelectAlbum(album.id)}
                  className="p-4 bg-[#0d0d10] border border-[#1c1c20] rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-[#121217] transition-all group shadow-lg"
                >
                  <img
                    src={album.coverUrl}
                    alt={album.title}
                    className="w-16 h-16 rounded-xl object-cover bg-[#161619] shrink-0 border border-white/5"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wide truncate group-hover:text-[#c7ff36] transition-colors">
                      {album.title}
                    </h4>

                    {/* Co-artists / Collaboration badge */}
                    {isCollaboration && coArtists.length > 0 ? (
                      <p className="text-[11px] text-[#8e8e95] truncate mt-0.5">
                        con{' '}
                        {coArtists.map((c, idx) => (
                          <span
                            key={`${c.id}-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectArtist(c.id, c.name);
                            }}
                            className="text-white hover:text-[#c7ff36] underline cursor-pointer"
                          >
                            {c.name}{idx < coArtists.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#77777f] font-mono mt-0.5">
                        {album.year} · {album.tracks.length} tracce
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
                      <span className="text-[10px] text-[#77777f] font-mono uppercase">
                        {album.editionType || 'Standard'}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#c7ff36]">
                        {evaluated ? formatRating(averageRating) : 'In attesa'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STATISTICHE & TOP BRANI (Deduplicated automatically) */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#0d0d10] border border-[#1c1c20] rounded-3xl p-6 sm:p-8 shadow-xl">
          {/* Left Column: BRANI PIÙ APPREZZATI (Deduplicated with earlier album tie-break) */}
          <div>
            <div className="text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-5 flex items-center justify-between">
              <span>BRANI PIÙ APPREZZATI</span>
              <span className="text-[10px] text-[#55555c] font-normal lowercase">voto più alto</span>
            </div>

            {stats.topTracks.length === 0 ? (
              <p className="text-xs text-[#55555c] italic">Nessun brano valutato finora.</p>
            ) : (
              <div className="space-y-4">
                {stats.topTracks.map((item, idx) => {
                  const rating = item.track.rating as number;
                  const percent = Math.min(Math.max((rating / 10) * 100, 5), 100);
                  return (
                    <div key={item.track.id} className="flex items-center gap-3 text-xs">
                      <span className="w-4 text-[#55555c] font-mono text-[11px] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-40 sm:w-48 truncate">
                        <span className="text-white uppercase font-semibold">
                          {item.track.title}
                        </span>{' '}
                        <span className="text-[10px] text-[#77777f] uppercase font-mono">
                          {item.albumTitle}
                        </span>
                      </div>
                      {/* Lime Progress Bar */}
                      <div className="flex-1 h-1.5 bg-[#1a1a20] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#c7ff36] rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs font-bold text-white">
                        {formatRating(rating, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: RIEPILOGO STATISTICHE */}
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-1">
                MEDIA COMPLESSIVA ARTISTA
              </div>
              <div className="font-extrabold text-4xl sm:text-5xl text-[#c7ff36] tracking-tight">
                {formatRating(stats.artistAverage)}
              </div>
              <div className="text-xs text-[#77777f] font-mono mt-1">
                {stats.ratedAlbumsCount} album con valutazioni registrate
              </div>
            </div>

            <div className="pt-4 border-t border-[#18181c]">
              <div className="text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-2">
                MIGLIOR ALBUM NEL TUO ARCHIVIO
              </div>
              {stats.bestAlbum ? (
                <div>
                  <div className="text-base font-bold text-white uppercase tracking-wide">
                    {stats.bestAlbum.title}
                  </div>
                  <div className="text-lg font-bold text-[#c7ff36] font-mono mt-0.5">
                    {formatRating(stats.bestAlbum.average, 2)}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#55555c]">—</p>
              )}
            </div>

            <div className="pt-4 border-t border-[#18181c]">
              <div className="text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-2">
                DISCOGRAFIA NELL'ARCHIVIO
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-[#131317] rounded-xl border border-white/5">
                  <div className="text-[#77777f] text-[10px]">PROGETTI SOLISTI</div>
                  <div className="text-white font-bold text-sm mt-0.5">{soloAlbums.length}</div>
                </div>
                <div className="p-3 bg-[#131317] rounded-xl border border-white/5">
                  <div className="text-[#77777f] text-[10px]">COLLABORAZIONI</div>
                  <div className="text-[#c7ff36] font-bold text-sm mt-0.5">{collabAlbums.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COLLABORAZIONI */}
      {activeTab === 'collabs' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collabAlbums.map(({ album, coArtists, averageRating }) => (
            <motion.div
              key={album.id}
              whileHover={{ y: -3 }}
              onClick={() => onSelectAlbum(album.id)}
              className="p-4 bg-[#0d0d10] border border-[#1c1c20] hover:border-[#33333f] rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-[#121217] transition-all"
            >
              <img
                src={album.coverUrl}
                alt={album.title}
                className="w-16 h-16 rounded-xl object-cover bg-[#161619] shrink-0 border border-white/5"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wide truncate">
                  {album.title}
                </h4>
                <div className="text-[11px] text-[#8e8e95] truncate mt-0.5">
                  con{' '}
                  {coArtists.map((c, idx) => (
                    <span
                      key={`${c.id}-${idx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectArtist(c.id, c.name);
                      }}
                      className="text-white hover:text-[#c7ff36] underline cursor-pointer"
                    >
                      {c.name}{idx < coArtists.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
                  <span className="text-[10px] text-[#77777f] font-mono">{album.year}</span>
                  <span className="font-mono text-xs font-bold text-[#c7ff36]">
                    {formatRating(averageRating)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Bio / Image Modal */}
      {createPortal(<AnimatePresence>
        {isEditingBio && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-2 sm:p-6 backdrop-blur-md">
            <motion.div
              id="artist-profile-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="artist-profile-editor-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#111116] border border-[#272733] rounded-3xl max-w-5xl w-full h-[94dvh] sm:h-[88dvh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 p-4 sm:px-7 sm:py-5 border-b border-[#1c1c24]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#c7ff36]" />
                    <span className="text-[10px] font-mono tracking-widest text-[#c7ff36] uppercase font-semibold">
                      SCHEDA ARTISTA
                    </span>
                  </div>
                  <h3 id="artist-profile-editor-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Modifica {currentArtist.name}
                  </h3>
                  <p className="text-xs text-[#8e8e96] mt-0.5 font-light">
                    Foto e biografia personalizzate rimarranno memorizzate e sincronizzate su tutti i tuoi dispositivi.
                  </p>
                </div>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setIsEditingBio(false)}
                  className="p-1.5 rounded-full bg-[#18181f] text-[#66666f] hover:text-white transition-colors cursor-pointer"
                  aria-label="Chiudi finestra"
                >
                  <X size={16} />
                </motion.button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-7 grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6 content-start">
                {/* Photo Upload & Preview */}
                <div className="space-y-1.5">
                  <ImageUploadInput
                    label="Foto Profilo Artista"
                    value={draftImg}
                    onChange={setDraftImg}
                    placeholder="https://... o carica un file locale (JPG, PNG)"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      type="button"
                      onClick={handleResetPhotoToSpotify}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#8e8e96] hover:text-[#c7ff36] transition-colors cursor-pointer"
                      title="Ripristina la foto ufficiale da Spotify"
                    >
                      <RotateCcw size={11} />
                      <span>Cerca foto ufficiale Spotify</span>
                    </motion.button>
                    {draftImg.startsWith('data:image/') && (
                      <span className="text-[10px] font-mono text-[#c7ff36]">
                        Foto personalizzata attiva
                      </span>
                    )}
                  </div>
                </div>

                {/* Biography Editor with Wikipedia search helper */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="artist-biography" className="text-[10px] font-semibold text-[#8e8e96] uppercase tracking-wider">
                      Biografia / Descrizione
                    </label>
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      type="button"
                      onClick={handleFetchWikipediaBio}
                      disabled={isFetchingWiki}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[#c7ff36] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {isFetchingWiki ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Globe size={11} />
                      )}
                      <span>{isFetchingWiki ? 'Ricerca in corso...' : 'Cerca su Wikipedia'}</span>
                    </motion.button>
                  </div>
                  <textarea
                    id="artist-biography"
                    rows={16}
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    placeholder="Inserisci la biografia dell'artista..."
                    className="w-full min-h-72 resize-y bg-[#16161c] border border-[#262632] focus:border-[#c7ff36] rounded-xl p-4 text-base text-white leading-relaxed focus:outline-none transition-colors"
                  />
                  {bioLookupMessage && <p role="status" className="text-xs text-[#c7ff36] mt-2">{bioLookupMessage}</p>}
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#666670] mt-1">
                    <span>Rimane intatta anche dopo gli aggiornamenti</span>
                    <span>{draftBio.length} caratteri</span>
                  </div>
                </div>

              </div>
                <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:px-7 border-t border-[#1c1c24] bg-[#111116]">
                  {saveError && <p role="alert" className="text-xs text-red-300 w-full">{saveError}</p>}
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    onClick={() => setIsEditingBio(false)}
                    className="px-4 py-2 text-xs text-[#8e8e96] hover:text-white uppercase font-semibold cursor-pointer transition-colors"
                  >
                    Annulla
                  </motion.button>
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    disabled={isSaving}
                    onClick={handleSaveBio}
                    className="px-6 py-2.5 rounded-xl bg-[#c7ff36] text-black font-bold text-xs tracking-wider uppercase hover:brightness-110 shadow-[0_0_20px_rgba(199,255,54,0.18)] cursor-pointer transition-all"
                  >
                    {isSaving ? 'Salvataggio…' : 'Salva Modifiche'}
                  </motion.button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>, document.body)}
    </motion.div>
  );
};
