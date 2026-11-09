import { QuickRatingDialog, RatingDifference } from './QuickRatingDialog';
import { useSaveAndClose } from '../hooks/useSaveAndClose';
import { AlbumJournal } from './ExperienceHub';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Pencil,
  ExternalLink,
  Star,
  Check,
  Share2,
  Image as ImageIcon,
  X,
  MinusCircle,
  PlusCircle,
  BookOpen,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  ListMusic,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, EditionType, Track } from '../types';
import { calculateAlbumStats, formatRating } from '../utils/musicMath';
import { cleanRecordLabel } from '../utils/labelCleaner';
import { ImageUploadInput } from './ImageUploadInput';
import { readAndCompressImage } from '../utils/imageUtils';
import { syncAlbumWithSpotify } from '../services/spotifySync';
import { getAlbumArtistRefs } from '../utils/artistParser';
import { storage } from '../services/storage';
import { TracklistEditorModal } from './TracklistEditorModal';
import { mergeSnapshots } from '../services/syncMerge';

const SpotifyIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.216.353-.675.466-1.028.25-2.816-1.722-6.36-2.112-10.536-1.157-.404.093-.804-.158-.897-.562-.093-.404.158-.804.562-.897 4.571-1.045 8.492-.596 11.648 1.338.353.216.466.675.251 1.028zm1.47-3.264c-.272.443-.852.584-1.295.312-3.223-1.982-8.136-2.555-11.948-1.397-.5.152-1.031-.133-1.183-.633-.152-.5.133-1.031.633-1.183 4.356-1.322 9.775-.683 13.481 1.596.443.272.584.852.312 1.305zm.126-3.41c-3.864-2.295-10.237-2.507-13.918-1.389-.593.18-1.222-.158-1.402-.751-.18-.593.158-1.222.751-1.402 4.237-1.286 11.278-1.041 15.727 1.6c.532.316.708 1.008.392 1.54-.316.533-1.008.709-1.55.392z" />
  </svg>
);

interface AlbumDetailViewProps {
  album: Album;
  highlightTrackId?: string;
  onBack: () => void;
  onSelectArtist: (artistId: string, artistName: string) => void;
  onUpdateTrackRating: (trackId: string, rating: number | null) => void;
  onUpdateAlbum: (updated: Album) => void;
  onNavigateConfronto: (albumId: string) => void;
  onOpenShareModal: (album: Album) => void;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({
  album,
  highlightTrackId,
  onBack,
  onSelectArtist,
  onUpdateTrackRating,
  onUpdateAlbum,
  onNavigateConfronto,
  onOpenShareModal,
}) => {
  const [isRatingMode, setIsRatingMode] = useState(false);
  const [quickRatingOpen, setQuickRatingOpen] = useState(false);
  const [ratingBaseline, setRatingBaseline] = useState<Record<string, number | null>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { saveAndClose, saveError, isSaving, clearSaveError } = useSaveAndClose();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isTracklistModalOpen, setIsTracklistModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Real-time auto-save indicator state (Requirement 14)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<any>(null);

  const triggerSaveIndicator = () => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 350);
  };

  // Local draft ratings for fast slider feedback
  const [draftRatings, setDraftRatings] = useState<Record<string, number | null>>({});
  useEffect(() => {
    if (!isRatingMode) setDraftRatings({});
  }, [album.tracks, isRatingMode]);
  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);

  // Review draft state
  const [reviewText, setReviewText] = useState(album.review?.text || '');
  const [isRelisten, setIsRelisten] = useState(album.review?.isRelisten || false);

  // Edit album metadata state
  const [editTitle, setEditTitle] = useState(album.title);
  const [editArtist, setEditArtist] = useState(album.artistName);
  const [editCover, setEditCover] = useState(album.coverUrl);
  const [editLabel, setEditLabel] = useState(cleanRecordLabel(album.label));
  const [editGenres, setEditGenres] = useState(album.genres);
  const [editDuration, setEditDuration] = useState(album.duration);
  const [editDate, setEditDate] = useState(album.releaseDate);

  // Spotify Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isManualSpotifyOpen, setIsManualSpotifyOpen] = useState(false);
  const [manualSpotifyLink, setManualSpotifyLink] = useState('');

  const handleSpotifySync = async (customUrl?: string) => {
    setIsSyncing(true);
    try {
      const result = await syncAlbumWithSpotify(album, customUrl);
      if (result.success) {
        const latest = storage.getAlbums().find(a => a.id === album.id);
        if (!latest) return;
        onUpdateAlbum(mergeSnapshots(album, latest, result.updatedAlbum));
        setEditTitle(result.updatedAlbum.title);
        setEditArtist(result.updatedAlbum.artistName);
        setEditCover(result.updatedAlbum.coverUrl);
        setEditDuration(result.updatedAlbum.duration);
        setEditLabel(cleanRecordLabel(result.updatedAlbum.label));
        setSyncToast({ message: result.message, type: 'success' });
        setIsManualSpotifyOpen(false);
      } else {
        setSyncToast({ message: result.message, type: 'error' });
      }
    } catch (err: any) {
      setSyncToast({
        message: err.message || 'Errore durante la sincronizzazione con Spotify',
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  const directFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDirectCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAndCompressImage(file);
      const latest = storage.getAlbums().find(a => a.id === album.id);
      if (!latest) return;
      onUpdateAlbum({ ...latest, coverUrl: dataUrl });
      setEditCover(dataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      if (directFileInputRef.current) directFileInputRef.current.value = '';
    }
  };

  // Effective tracks with any draft ratings overlayed
  const currentTracks = useMemo(() => {
    return album.tracks.map((t) => ({
      ...t,
      rating: t.id in draftRatings ? draftRatings[t.id] : t.rating,
    }));
  }, [album.tracks, draftRatings]);

  const stats = useMemo(() => {
    return calculateAlbumStats(currentTracks);
  }, [currentTracks]);

  const handleStartRating = () => {
    setRatingBaseline(Object.fromEntries(album.tracks.map(t => [t.id, t.rating])));
    setDraftRatings({});
    setIsRatingMode(true);
  };

  const handleFinishRating = () => {
    storage.confirmAlbumCompleted(album.id, draftRatings);
    setIsRatingMode(false);
    triggerSaveIndicator();
  };

  const handleSliderChange = (trackId: string, value: number) => {
    const snapped = Math.round(value * 4) / 4;
    onUpdateTrackRating(trackId, snapped);
    setDraftRatings((prev) => ({ ...prev, [trackId]: snapped }));
    triggerSaveIndicator();
  };

  const handleStepRating = (trackId: string, delta: number) => {
    const current = draftRatings[trackId] ?? (album.tracks.find((t) => t.id === trackId)?.rating ?? 5.0);
    let next = Math.round((current + delta) * 4) / 4;
    if (next < 0) next = 0;
    if (next > 10) next = 10;
    onUpdateTrackRating(trackId, next);
    setDraftRatings((prev) => ({ ...prev, [trackId]: next }));
    triggerSaveIndicator();
  };

  const handleClearRating = (trackId: string) => {
    onUpdateTrackRating(trackId, null);
    setDraftRatings((prev) => ({ ...prev, [trackId]: null }));
    triggerSaveIndicator();
  };

  const handleSaveTracklist = (newTracks: Track[]) => {
    storage.updateAlbumTracklist(album.id, newTracks);
    triggerSaveIndicator();
  };

  const handleDeleteAlbum = () => {
    const { success, deletedAlbum } = storage.deleteAlbum(album.id);
    if (success && deletedAlbum) {
      setIsDeleteModalOpen(false);
      window.dispatchEvent(
        new CustomEvent('tracklist:album_deleted_undo', {
          detail: { albumId: album.id, album: deletedAlbum },
        })
      );
      onBack();
    }
  };

  const handleEditionChange = (edition: EditionType) => {
    const latest = storage.getAlbums().find(a => a.id === album.id);
    if (!latest) return;
    const updated: Album = { ...latest, editionType: edition };
    onUpdateAlbum(updated);
  };

  const openEditModal = () => {
    setEditTitle(album.title);
    setEditArtist(album.artistName);
    setEditCover(album.coverUrl);
    setEditLabel(cleanRecordLabel(album.label));
    setEditGenres(album.genres);
    setEditDuration(album.duration);
    setEditDate(album.releaseDate);
    clearSaveError();
    setIsEditModalOpen(true);
  };

  const handleSaveMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    return saveAndClose(() => {
      let formattedDate = album.releaseDateFormatted;
      let finalYear = album.year;
      if (editDate) {
        try {
          const d = new Date(editDate);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).toUpperCase();
            finalYear = d.getFullYear();
          }
        } catch {
          // keep fallback formatted date
        }
      }

      const updated: Album = {
        ...(storage.getAlbums().find(a => a.id === album.id) || album),
        title: editTitle.trim().toUpperCase() || album.title,
        artistName: editArtist.trim() || album.artistName,
        coverUrl: editCover.trim() || album.coverUrl,
        label: cleanRecordLabel(editLabel.trim()),
        genres: editGenres.trim(),
        duration: editDuration.trim(),
        releaseDate: editDate || album.releaseDate,
        releaseDateFormatted: formattedDate,
        year: finalYear,
      };
      onUpdateAlbum(updated);
    }, () => { setIsEditModalOpen(false); });
  };

  const handleSaveReview = () => {
    return saveAndClose(() => {
      const updated: Album = {
        ...(storage.getAlbums().find(a => a.id === album.id) || album),
        review: {
          id: album.review?.id || `rev-${Date.now()}`,
          albumId: album.id,
          text: reviewText.trim(),
          date: new Date().toISOString().split('T')[0],
          isRelisten,
        },
      };
      onUpdateAlbum(updated);
    }, () => { setIsReviewOpen(false); });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-6xl w-full"
    >
      {/* Top Back Link */}
      <motion.button
        whileHover={{ x: -3 }}
        whileTap={{ scale: 0.98 }}
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#77777f] hover:text-white uppercase mb-8 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>INDIETRO</span>
      </motion.button>

      {/* Main Album Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Cover Art with subtle edit trigger */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="relative group w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shrink-0 bg-[#161619] border border-[#232328] shadow-2xl"
          >
            <img
              src={album.coverUrl}
              alt={album.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Quick local upload & modal trigger */}
            <input
              type="file"
              ref={directFileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleDirectCoverUpload}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={() => directFileInputRef.current?.click()}
                title="Carica nuova foto copertina da locale"
                className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-[#c7ff36] cursor-pointer border border-white/10 shadow-md transition-transform hover:scale-110"
              >
                <Upload size={13} />
              </motion.button>
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={openEditModal}
                title="Modifica metadati album"
                className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-white cursor-pointer border border-white/10 shadow-md transition-transform hover:scale-110"
              >
                <ImageIcon size={13} />
              </motion.button>
            </div>
          </motion.div>

          {/* Titles & Info */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-editorial font-normal text-white uppercase tracking-tight">
                {album.title}
              </h1>
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={openEditModal}
                title="Modifica metadati album"
                className="text-[#66666e] hover:text-[#c7ff36] transition-colors cursor-pointer p-1"
              >
                <Pencil size={15} />
              </motion.button>
            </div>

            {/* Clickable Artist Names (supports collaborative albums individually) */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-base sm:text-lg text-[#8e8e93] font-medium">
              {(() => {
                const artistRefs = getAlbumArtistRefs(album);
                return artistRefs.map((ref, idx) => (
                  <React.Fragment key={`${ref.id}-${idx}`}>
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      onClick={() => onSelectArtist(ref.id, ref.name)}
                      className="hover:text-[#c7ff36] transition-colors cursor-pointer"
                    >
                      {ref.name}
                    </motion.button>
                    {idx < artistRefs.length - 1 && <span className="text-[#55555c]">,</span>}
                  </React.Fragment>
                ));
              })()}
            </div>

            {/* Date and Track stats */}
            <div className="text-xs text-[#77777f] font-mono tracking-wider uppercase mt-2">
              {album.releaseDateFormatted || album.releaseDate} · {stats.totalTracks} TRACCE · {stats.ratedCount} VALUTATE
            </div>
          </div>
        </div>

        {/* Right side: Overall Score + Confronta button */}
        <div className="flex md:flex-col items-center md:items-end justify-between gap-4">
          <motion.div
            key={String(stats.averageRating)}
            initial={{ scale: 0.9, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="font-editorial text-4xl sm:text-5xl text-[#c7ff36] tracking-tight drop-shadow-[0_0_15px_rgba(199,255,54,0.15)]"
          >
            {formatRating(stats.averageRating)}
          </motion.div>

          <div className="flex items-center gap-2 relative">
            <motion.button
              whileHover={{ scale: 1.04, backgroundColor: '#1a1a22' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onNavigateConfronto(album.id)}
              className="px-4 py-2 rounded-full border border-[#26262b] bg-[#111114] text-xs font-semibold tracking-wider text-white uppercase transition-colors cursor-pointer"
            >
              CONFRONTA
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => onOpenShareModal(album)}
              title="Condividi scheda album"
              className="p-2 rounded-full border border-[#26262b] bg-[#111114] hover:bg-[#1a1a20] text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
            >
              <Share2 size={14} />
            </motion.button>

            {/* 3-Dots Action Menu (Requirement 8 & 15) */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="Altre azioni album"
                className="p-2 rounded-full border border-[#26262b] bg-[#111114] hover:bg-[#1a1a20] text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
              >
                <MoreVertical size={14} />
              </motion.button>

              <AnimatePresence>
                {isMoreMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsMoreMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-[#121216] border border-[#26262d] rounded-2xl p-1.5 shadow-2xl z-40 space-y-0.5"
                    >
                      <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsTracklistModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-[#1b1b22] transition-colors cursor-pointer"
                      >
                        <ListMusic size={14} className="text-[#c7ff36]" />
                        <span>Modifica tracklist</span>
                      </motion.button>

                      <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          openEditModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-[#1b1b22] transition-colors cursor-pointer"
                      >
                        <Pencil size={14} className="text-neutral-400" />
                        <span>Modifica metadati</span>
                      </motion.button>

                      <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleSpotifySync();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-[#1b1b22] transition-colors cursor-pointer"
                      >
                        <RefreshCw size={14} className="text-[#1ED760]" />
                        <span>Sincronizza Spotify</span>
                      </motion.button>

                      <div className="h-[1px] bg-[#22222a] my-1" />

                      <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>Elimina album</span>
                      </motion.button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Edition Selector Bar */}
      <div className="flex flex-wrap items-center gap-4 py-3.5 border-t border-[#18181c] mb-6">
        <span className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase">
          EDIZIONE
        </span>

        <div className="flex flex-wrap items-center gap-4">
          {(
            [
              { id: 'standard', label: 'Standard' },
              { id: 'deluxe', label: 'Deluxe' },
              { id: 'remaster', label: 'Remaster' },
              { id: 'modified', label: 'Versione modificata' },
            ] as const
          ).map((ed) => {
            const isSelected = album.editionType === ed.id;
            return (
              <motion.label
                key={ed.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleEditionChange(ed.id)}
                className="flex items-center gap-2 text-xs text-[#a3a3a3] hover:text-white cursor-pointer select-none"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected ? 'border-[#c7ff36]' : 'border-[#44444a]'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="editionPill"
                      className="w-1.5 h-1.5 rounded-full bg-[#c7ff36]"
                    />
                  )}
                </div>
                <span>{ed.label}</span>
              </motion.label>
            );
          })}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-3.5 border-t border-[#18181c] mb-8 text-xs">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <div className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1">
              ETICHETTA
            </div>
            <div className="text-white font-medium">{cleanRecordLabel(album.label) || '—'}</div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1">
              GENERI
            </div>
            <div className="text-white font-medium">{album.genres || 'Rap/Hip Hop'}</div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1">
              DURATA
            </div>
            <div className="text-white font-medium">{album.duration || '—'}</div>
          </div>
        </div>

        {/* Listen on Spotify link */}
        <motion.a
          whileHover={{ x: 2 }}
          href={album.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(album.title + ' ' + album.artistName)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a3a3a3] hover:text-[#c7ff36] uppercase tracking-wider transition-colors"
        >
          <span>{album.spotifyUrl?.includes('deezer.com') ? 'ASCOLTA SU DEEZER' : 'ASCOLTA SU SPOTIFY'}</span>
          <ExternalLink size={13} />
        </motion.a>
      </div>

      <AlbumJournal key={album.id} album={album} disabled={isRatingMode || isEditModalOpen || isTracklistModalOpen} />
      {/* STATISTICHE VOTI (Two Columns side by side with animated progress bars) */}
      <div className="mb-10">
        <div className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-4">
          STATISTICHE VOTI
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#0d0d10] border border-[#1c1c20] rounded-2xl p-6 shadow-xl">
          {/* BRANI MIGLIORI */}
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-[#77777f] uppercase mb-4">
              BRANI MIGLIORI
            </div>

            {stats.topTracks.length === 0 ? (
              <p className="text-xs text-[#55555c] italic">Nessuna traccia valutata finora.</p>
            ) : (
              <div className="space-y-3">
                {stats.topTracks.map((t, idx) => {
                  const rating = t.rating as number;
                  const percent = Math.min(Math.max((rating / 10) * 100, 5), 100);
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.25 }}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="w-4 text-[#55555c] font-mono text-[11px]">{idx + 1}</span>
                      <span className="w-32 truncate text-white uppercase font-medium">
                        {t.title}
                      </span>
                      {/* Animated Horizontal Lime Bar */}
                      <div className="flex-1 h-1.5 bg-[#1a1a20] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full bg-[#c7ff36] rounded-full"
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs text-[#e0e0dc]">
                        {formatRating(rating, 2)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DISTRIBUZIONE */}
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-[#77777f] uppercase mb-4">
              DISTRIBUZIONE · {stats.ratedCount} TRACCE VALUTATE
            </div>

            <div className="space-y-3">
              {(['0-4', '4-6', '6-8', '8-10'] as const).map((bucket, bIdx) => {
                const count = stats.distribution[bucket];
                const total = stats.ratedCount || 1;
                const percent = stats.ratedCount > 0 ? (count / total) * 100 : 0;
                return (
                  <motion.div
                    key={bucket}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: bIdx * 0.05, duration: 0.25 }}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="w-10 text-[#77777f] font-mono text-[11px]">{bucket}</span>
                    <div className="flex-1 h-1.5 bg-[#1a1a20] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full bg-[#c7ff36] rounded-full"
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-xs text-[#e0e0dc]">{count}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4"><button className="rounded-xl border border-[#4c6338] bg-[#203014] text-[#c7ff36] px-4 py-3 text-sm disabled:opacity-40" disabled={isRatingMode} onClick={() => setQuickRatingOpen(true)}>Valuta da tastiera</button><span className="text-xs text-[#8e9f80] self-center">Voto → Invio → brano successivo</span></div>
      {quickRatingOpen && <QuickRatingDialog album={album} onClose={() => setQuickRatingOpen(false)} />}
      {/* TRACKLIST CARD */}
      <div className="bg-[#0f0f12] border border-[#1e1e23] rounded-2xl p-6 sm:p-8 mb-8 shadow-xl">
        <div className="flex items-center justify-between pb-6 mb-4 border-b border-[#18181c]">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold text-[#8e8e93] tracking-widest uppercase">
              TRACCE
            </h2>
            {album.evaluationStatus === 'draft' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300">
                Bozza in corso
              </span>
            )}
            {album.evaluationStatus === 'completed' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#18230f] border border-[#2b3d14] text-[#c7ff36]">
                Valutazione completata
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Discrete Auto-Save Status (Requirement 14) */}
            <AnimatePresence>
              {saveStatus === 'saving' && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400"
                >
                  <RefreshCw size={11} className="animate-spin text-[#c7ff36]" />
                  <span>Salvataggio...</span>
                </motion.span>
              )}
              {saveStatus === 'saved' && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-[11px] font-mono text-[#c7ff36]"
                >
                  <Check size={12} strokeWidth={2.5} />
                  <span>Salvato nel browser ✓</span>
                </motion.span>
              )}
            </AnimatePresence>

            {/* Quick Tracklist Edit trigger */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsTracklistModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#26262b] bg-[#141418] hover:bg-[#1a1a22] text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <ListMusic size={13} className="text-[#c7ff36]" />
              <span>Modifica tracce</span>
            </motion.button>

            {isRatingMode ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFinishRating}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer shadow-[0_0_15px_rgba(199,255,54,0.3)]"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>FATTO</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05, borderColor: '#c7ff36' }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStartRating}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#26262b] bg-[#141418] hover:bg-[#1a1a22] text-xs font-semibold tracking-wider text-white hover:text-[#c7ff36] transition-colors cursor-pointer"
              >
                <Star size={13} className="text-[#c7ff36]" />
                <span>VALUTA ALBUM</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Tracks Rows */}
        <div className="divide-y divide-[#161619]">
          {album.tracks.map((track, tIdx) => {
            const currentRating = isRatingMode
              ? (track.id in draftRatings ? draftRatings[track.id] : track.rating)
              : track.rating;

            return (
              <motion.div
                key={track.id}
                id={`track-${track.id}`}
                tabIndex={-1}
                style={highlightTrackId === track.id ? { background: '#233616', outline: '1px solid #83b34c' } : undefined}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(tIdx * 0.02, 0.3), duration: 0.2 }}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-[#131317]/50 px-2 rounded-lg transition-colors"
              >
                {/* Track Number + Title + Artists */}
                <div className="flex items-center gap-4 min-w-0 sm:w-1/3">
                  <span className="font-mono text-xs text-[#55555c] w-6 shrink-0 group-hover:text-[#c7ff36] transition-colors">
                    {String(track.trackNumber).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white uppercase tracking-wide truncate">
                      {track.title}
                    </div>
                    {track.artists && (
                      <div className="text-xs text-[#77777f] truncate mt-0.5">
                        {track.artists}
                      </div>
                    )}
                    {isRatingMode && <RatingDifference before={ratingBaseline[track.id]} after={currentRating} />}
                  </div>
                </div>

                {/* Rating Control or Badge */}
                {isRatingMode ? (
                  /* Slider Mode matching screenshot 05 */
                  <div className="flex items-center gap-3 sm:w-2/3 justify-end">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.25"
                      value={currentRating ?? 5.0}
                      onChange={(e) => handleSliderChange(track.id, parseFloat(e.target.value))}
                      className="w-full max-w-xs accent-[#c7ff36] cursor-pointer h-1.5 bg-[#202026] rounded-full"
                    />

                    {/* Stepper buttons */}
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleStepRating(track.id, -0.25)}
                        title="Riduci (-0.25)"
                        className="p-1 rounded text-[#77777f] hover:text-white transition-colors cursor-pointer"
                      >
                        <MinusCircle size={15} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleStepRating(track.id, 0.25)}
                        title="Aumenta (+0.25)"
                        className="p-1 rounded text-[#77777f] hover:text-white transition-colors cursor-pointer"
                      >
                        <PlusCircle size={15} />
                      </motion.button>
                    </div>

                    {/* Clear button */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleClearRating(track.id)}
                      title="Rimuovi valutazione traccia"
                      className="p-1 rounded text-[#55555c] hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </motion.button>

                    {/* Value readout with animate on change */}
                    <motion.span
                      key={currentRating !== null ? String(currentRating) : 'none'}
                      initial={{ scale: 1.15 }}
                      animate={{ scale: 1 }}
                      className="w-12 text-right font-mono text-xs font-semibold text-white"
                    >
                      {currentRating !== null ? formatRating(currentRating, 2) : '—'}
                    </motion.span>
                  </div>
                ) : (
                  /* Read-only rating display */
                  <div className="flex items-center gap-2 justify-end">
                    {currentRating !== null ? (
                      <span className="font-mono text-xs text-[#c7ff36] font-semibold bg-[#16210b] border border-[#2b3d14] px-2.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(199,255,54,0.1)]">
                        {formatRating(currentRating, 2)}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-[#44444a]">—</span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Personal Review Section (Requirement 10) */}
      <div className="mb-12">
        <div className="bg-[#0d0d10] border border-[#1e1e23] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-[#8e8e93] tracking-widest uppercase flex items-center gap-2">
              <BookOpen size={14} className="text-[#c7ff36]" />
              <span>RECENSIONE PERSONALE</span>
            </h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { clearSaveError(); setIsReviewOpen(!isReviewOpen); }}
              className="text-[11px] font-semibold text-[#c7ff36] hover:underline cursor-pointer uppercase"
            >
              {album.review?.text ? 'MODIFICA' : 'SCRIVI'}
            </motion.button>
          </div>

          <AnimatePresence>
            {isReviewOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
                <textarea
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Scrivi qui le tue impressioni sull'album, tracce preferite, atmosfera, liriche..."
                  className="w-full bg-[#141418] border border-[#24242a] rounded-xl p-3 text-xs text-white placeholder-[#55555c] focus:outline-none focus:border-[#c7ff36] transition-colors"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRelisten}
                      onChange={(e) => setIsRelisten(e.target.checked)}
                      className="accent-[#c7ff36]"
                    />
                    <span>Riascolto successivo</span>
                  </label>
                  <div className="flex gap-2">
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      onClick={() => setIsReviewOpen(false)}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                    >
                      Annulla
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      disabled={isSaving}
                      onClick={handleSaveReview}
                      className="px-4 py-1.5 rounded-lg bg-[#c7ff36] text-black font-semibold text-xs uppercase"
                    >
                      {isSaving ? 'Salvataggio…' : 'Salva'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div>
                {album.review?.text ? (
                  <div>
                    <p className="text-xs text-neutral-300 leading-relaxed font-light">
                      "{album.review.text}"
                    </p>
                    <div className="mt-2 text-[10px] text-neutral-500 font-mono">
                      Registrata il {album.review.date} {album.review.isRelisten && '· Riascolto'}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#55555c] font-light">
                    Nessuna recensione personale registrata per questo album.
                  </p>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Metadata Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-[#111114] border border-[#26262c] rounded-2xl p-6 max-w-lg w-full max-h-[90dvh] overflow-y-auto space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c20]">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-white">
                  MODIFICA METADATI ALBUM
                </h3>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-[#66666f] hover:text-white"
                >
                  <X size={16} />
                </motion.button>
              </div>

              <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} aria-label="Modifica album" onSubmit={handleSaveMetadata} className="space-y-4">
                {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
                <div>
                  <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                    Titolo
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c7ff36]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                    Artista
                  </label>
                  <input
                    type="text"
                    value={editArtist}
                    onChange={(e) => setEditArtist(e.target.value)}
                    className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c7ff36]"
                  />
                </div>

                <ImageUploadInput
                  label="Copertina Album"
                  value={editCover}
                  onChange={setEditCover}
                  placeholder="https://... o carica un file locale"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                      Etichetta
                    </label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c7ff36]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                      Generi
                    </label>
                    <input
                      type="text"
                      value={editGenres}
                      onChange={(e) => setEditGenres(e.target.value)}
                      className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c7ff36]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                      Data di uscita
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c7ff36]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                      Durata
                    </label>
                    <input
                      type="text"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c7ff36]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-xs text-[#77777f] hover:text-white uppercase font-semibold"
                  >
                    Annulla
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 cursor-pointer"
                  >
                    {isSaving ? 'Salvataggio…' : 'Salva Modifiche'}
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Floating Action Button: Sync with Spotify */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex flex-col items-end gap-2">
        {/* Optional modal for direct Spotify link */}
        <AnimatePresence>
          {isManualSpotifyOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="mb-2 p-4 bg-[#111115] border border-[#26262d] rounded-2xl shadow-2xl w-80 text-xs text-white"
            >
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1c1c22]">
                <span className="font-semibold uppercase tracking-wider text-[#1ED760] flex items-center gap-1.5">
                  <SpotifyIcon size={14} />
                  <span>LINK SPOTIFY DIRETTO</span>
                </span>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setIsManualSpotifyOpen(false)}
                  className="text-[#77777f] hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </motion.button>
              </div>
              <p className="text-[11px] text-[#8e8e93] mb-2 leading-relaxed">
                Incolla l'URL o l'URI dell'album per sincronizzare esattamente questa edizione:
              </p>
              <input
                type="text"
                placeholder="https://open.spotify.com/album/..."
                value={manualSpotifyLink}
                onChange={(e) => setManualSpotifyLink(e.target.value)}
                className="w-full bg-[#18181d] border border-[#282830] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#1ED760] mb-3"
              />
              <div className="flex justify-end gap-2">
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setIsManualSpotifyOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#77777f] hover:text-white uppercase font-semibold cursor-pointer"
                >
                  Annulla
                </motion.button>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => handleSpotifySync(manualSpotifyLink)}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1ED760] hover:bg-[#1db954] text-black font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer"
                >
                  Sincronizza
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The FAB button itself */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsManualSpotifyOpen((prev) => !prev)}
            title="Inserisci URL Spotify personalizzato"
            className="h-11 w-11 rounded-full bg-[#111115] border border-[#2b2b32] text-[#8e8e93] hover:text-[#1ED760] flex items-center justify-center shadow-lg hover:border-[#1ED760] transition-colors cursor-pointer"
          >
            <LinkIcon size={16} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 25px rgba(30, 215, 96, 0.45)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSpotifySync()}
            disabled={isSyncing}
            title="Sincronizza tracce e metadati con Spotify"
            className="group flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-[#1ED760] to-[#17b952] text-black font-bold text-xs uppercase tracking-wider shadow-[0_6px_20px_rgba(30,215,96,0.35)] cursor-pointer hover:brightness-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <RefreshCw size={17} className="animate-spin text-black" />
            ) : (
              <SpotifyIcon size={18} className="text-black group-hover:scale-110 transition-transform" />
            )}
            <span>{isSyncing ? 'Sincronizzazione...' : 'Sync with Spotify'}</span>
          </motion.button>
        </div>
      </div>

      {/* Sync Toast Feedback */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`fixed bottom-24 right-6 sm:right-8 z-50 max-w-sm px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 text-xs ${
              syncToast.type === 'success'
                ? 'bg-[#121e10]/95 border-[#1ED760]/40 text-[#d4ffd6]'
                : 'bg-[#211214]/95 border-red-500/40 text-red-200'
            }`}
          >
            {syncToast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-[#1ED760] shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span className="flex-1 font-medium">{syncToast.message}</span>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={() => setSyncToast(null)}
              className="text-white/60 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tracklist Editor Modal (Requirement 8) */}
      <TracklistEditorModal
        isOpen={isTracklistModalOpen}
        onClose={() => setIsTracklistModalOpen(false)}
        albumTitle={album.title}
        initialTracks={album.tracks}
        onSaveTracklist={handleSaveTracklist}
      />

      {/* Delete Album Confirmation Modal (Requirement 15) */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-md bg-[#121216] border border-red-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl z-10"
            >
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={album.coverUrl}
                  alt={album.title}
                  className="w-16 h-16 rounded-2xl object-cover border border-[#2b2b35] shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Trash2 size={12} />
                    <span>Elimina dalla raccolta</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">{album.title}</h3>
                  <p className="text-xs text-[#8e8e93] truncate">{album.artistName}</p>
                </div>
              </div>

              <p className="text-xs text-neutral-300 mb-6 leading-relaxed bg-[#191920] border border-[#262630] p-3.5 rounded-2xl">
                Sei sicuro di voler eliminare questo album? Verranno rimosse le valutazioni delle tracce e la recensione personale. L'album rimarrà consultabile nel catalogo generale e potrai aggiungerlo nuovamente.
              </p>

              <div className="flex items-center justify-end gap-3">
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Annulla
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDeleteAlbum}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer"
                >
                  Elimina album
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
