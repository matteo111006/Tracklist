import { useSaveAndClose } from '../hooks/useSaveAndClose';
import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, AlertCircle, X, Check, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Track } from '../types';

interface TracklistEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumTitle: string;
  initialTracks: Track[];
  onSaveTracklist: (tracks: Track[]) => void;
}

export const TracklistEditorModal: React.FC<TracklistEditorModalProps> = ({
  isOpen,
  onClose,
  albumTitle,
  initialTracks,
  onSaveTracklist,
}) => {
  const [tracks, setTracks] = useState<Track[]>(() =>
    initialTracks.map((t, idx) => ({ ...t, trackNumber: idx + 1 }))
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { saveAndClose, saveError, isSaving, clearSaveError } = useSaveAndClose();

  useEffect(() => {
    if (isOpen) {
      setTracks(initialTracks.map((t, idx) => ({ ...t, trackNumber: idx + 1 })));
      setConfirmDeleteId(null);
      clearSaveError();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...tracks];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setTracks(next.map((t, idx) => ({ ...t, trackNumber: idx + 1 })));
  };

  const handleMoveDown = (index: number) => {
    if (index === tracks.length - 1) return;
    const next = [...tracks];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setTracks(next.map((t, idx) => ({ ...t, trackNumber: idx + 1 })));
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const next = [...tracks];
    next[index] = { ...next[index], title: newTitle };
    setTracks(next);
  };

  const handleArtistsChange = (index: number, newArtists: string) => {
    const next = [...tracks];
    next[index] = { ...next[index], artists: newArtists };
    setTracks(next);
  };

  const handleAddTrack = () => {
    const newTrack: Track = {
      id: `custom-track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      albumId: initialTracks[0]?.albumId || 'album',
      trackNumber: tracks.length + 1,
      title: 'Nuova traccia',
      artists: initialTracks[0]?.artists || '',
      rating: null,
    };
    setTracks([...tracks, newTrack]);
  };

  const handleDeleteClick = (track: Track) => {
    if (track.rating !== null && !isNaN(track.rating)) {
      setConfirmDeleteId(track.id);
    } else {
      executeDelete(track.id);
    }
  };

  const executeDelete = (trackId: string) => {
    const next = tracks
      .filter((t) => t.id !== trackId)
      .map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
    setTracks(next);
    setConfirmDeleteId(null);
  };

  const handleSave = () => {
    return saveAndClose(() => onSaveTracklist(tracks), onClose);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-3xl max-h-[85vh] bg-[#0e0e11] border border-[#24242b] rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#1c1c21] flex items-center justify-between shrink-0">
            <div>
              <div className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-widest flex items-center gap-1.5 mb-0.5">
                <Music size={12} className="text-[#c7ff36]" />
                <span>Modifica Tracklist</span>
              </div>
              <h2 className="text-lg sm:text-xl font-editorial text-white">{albumTitle}</h2>
            </div>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
            >
              <X size={18} />
            </motion.button>
          </div>

          {/* Tracklist Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                className="flex items-center gap-2 sm:gap-3 p-3 rounded-2xl bg-[#141418] border border-[#222228] hover:border-[#33333e] transition-colors"
              >
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    disabled={idx === 0}
                    onClick={() => handleMoveUp(idx)}
                    title="Sposta in alto"
                    className="p-1 rounded text-neutral-400 hover:text-[#c7ff36] disabled:opacity-20 disabled:hover:text-neutral-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronUp size={14} />
                  </motion.button>
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    disabled={idx === tracks.length - 1}
                    onClick={() => handleMoveDown(idx)}
                    title="Sposta in basso"
                    className="p-1 rounded text-neutral-400 hover:text-[#c7ff36] disabled:opacity-20 disabled:hover:text-neutral-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronDown size={14} />
                  </motion.button>
                </div>

                {/* Track Number */}
                <span className="w-6 text-center font-mono text-xs text-[#8e8e93] font-bold shrink-0">
                  {idx + 1}
                </span>

                {/* Track Title and Artist Inputs */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) => handleTitleChange(idx, e.target.value)}
                    placeholder="Titolo canzone"
                    className="w-full bg-[#1b1b22] border border-[#2a2a34] rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#c7ff36] transition-colors"
                  />
                  <input
                    type="text"
                    value={track.artists}
                    onChange={(e) => handleArtistsChange(idx, e.target.value)}
                    placeholder="Artisti (es. Shiva, Kid Yugi)"
                    className="w-full bg-[#1b1b22] border border-[#2a2a34] rounded-xl px-3 py-1.5 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-[#c7ff36] transition-colors"
                  />
                </div>

                {/* Rating Badge (retains user rating) */}
                <div className="shrink-0 text-right min-w-[50px]">
                  {track.rating !== null ? (
                    <span className="font-mono text-xs text-[#c7ff36] font-bold bg-[#18230f] border border-[#2b3d14] px-2 py-0.5 rounded-full">
                      {track.rating.toFixed(2).replace('.', ',')}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-neutral-600">—</span>
                  )}
                </div>

                {/* Delete button */}
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => handleDeleteClick(track)}
                  title="Elimina traccia"
                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 size={15} />
                </motion.button>
              </div>
            ))}

            {/* Add Track Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleAddTrack}
              className="w-full py-3 border border-dashed border-[#2a2a35] hover:border-[#c7ff36]/60 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-[#8e8e93] hover:text-[#c7ff36] transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Aggiungi nuova traccia</span>
            </motion.button>
          </div>

          {saveError && <p role="alert" className="px-6 py-3 text-sm text-red-300">{saveError}</p>}
          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-[#1c1c21] flex items-center justify-between bg-[#0b0b0e] shrink-0">
            <span className="text-xs text-[#66666f] font-mono">
              {tracks.length} tracce totali
            </span>
            <div className="flex items-center gap-3">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Annulla
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                disabled={isSaving}
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(199,255,54,0.2)] cursor-pointer"
              >
                <Check size={14} />
                <span>Salva Tracklist</span>
              </motion.button>
            </div>
          </div>

          {/* Delete confirmation popup */}
          <AnimatePresence>
            {confirmDeleteId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 flex items-center justify-center p-6 z-20 backdrop-blur-sm"
              >
                <div className="max-w-md bg-[#141418] border border-red-500/30 rounded-2xl p-6 text-center shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center mb-3">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Eliminare traccia valutata?</h3>
                  <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                    Questa canzone ha già un voto registrato. Se la elimini, la valutazione verrà rimossa
                    dall'album e dalle statistiche.
                  </p>
                  <div className="flex justify-center gap-3">
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-4 py-2 rounded-xl bg-neutral-800 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
                    >
                      Annulla
                    </motion.button>
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      onClick={() => executeDelete(confirmDeleteId)}
                      className="px-4 py-2 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                    >
                      Elimina comunque
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
