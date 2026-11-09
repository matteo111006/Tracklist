import { useViewMemory } from '../hooks/useViewMemory';
import React, { useState, useMemo, useEffect } from 'react';
import { EditionComparison } from './ExperienceHub';
import { ChevronDown, ArrowRight, Trophy, Plus, X, Search, RefreshCw, Disc3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album } from '../types';
import { calculateAlbumStats, formatRating, isAlbumInRankings } from '../utils/musicMath';

interface ConfrontoViewProps {
  albums: Album[];
  initialAlbumIdA?: string;
  initialAlbumIdB?: string;
  onSelectAlbum: (albumId: string) => void;
  onOpenShareModal: (album: Album) => void;
  onSelectArtist?: (artistId: string, artistName: string) => void;
}

export const ConfrontoView: React.FC<ConfrontoViewProps> = ({
  albums,
  initialAlbumIdA,
  initialAlbumIdB,
  onSelectAlbum,
}) => {
  const evaluatedAlbums = useMemo(() => {
    return albums.filter((a) => isAlbumInRankings(a));
  }, [albums]);

  // Requirement 6: NO automatic pre-selection on load!
  // Both slots start empty (null) unless explicitly passed via navigation
  const [selectedIdA, setSelectedIdA] = useViewMemory<string | null>('confronto.a', initialAlbumIdA || null);
  const [selectedIdB, setSelectedIdB] = useViewMemory<string | null>('confronto.b', initialAlbumIdB || null);

  useEffect(() => { if (initialAlbumIdA) { setSelectedIdA(initialAlbumIdA); if (initialAlbumIdA === selectedIdB) setSelectedIdB(null); } if (initialAlbumIdB) setSelectedIdB(initialAlbumIdB); }, [initialAlbumIdA, initialAlbumIdB]);
  // Search & Picker Modal State
  const [pickingSlot, setPickingSlot] = useState<'A' | 'B' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const albumA = useMemo(
    () => (selectedIdA ? albums.find((a) => a.id === selectedIdA) || null : null),
    [albums, selectedIdA]
  );
  const albumB = useMemo(
    () => (selectedIdB ? albums.find((a) => a.id === selectedIdB) || null : null),
    [albums, selectedIdB]
  );

  const statsA = useMemo(() => (albumA ? calculateAlbumStats(albumA.tracks) : null), [albumA]);
  const statsB = useMemo(() => (albumB ? calculateAlbumStats(albumB.tracks) : null), [albumB]);

  const diff = useMemo(() => {
    if (statsA?.averageRating == null || statsB?.averageRating == null || !albumA || !albumB) return null;
    const delta = Math.abs(statsA.averageRating - statsB.averageRating);
    const winnerId =
      statsA.averageRating > statsB.averageRating
        ? albumA.id
        : statsB.averageRating > statsA.averageRating
        ? albumB.id
        : null;
    const winnerTitle =
      statsA.averageRating > statsB.averageRating
        ? albumA.title
        : statsB.averageRating > statsA.averageRating
        ? albumB.title
        : 'Parità';
    return { delta, winnerId, winnerTitle };
  }, [statsA, statsB, albumA, albumB]);

  // Filtered albums for modal picker sorted alphabetically A-Z (Requirement 5)
  const filteredForPicker = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const otherSelectedId = pickingSlot === 'A' ? selectedIdB : selectedIdA;

    const list = evaluatedAlbums.filter((alb) => {
      if (alb.id === otherSelectedId) return false; // avoid picking the same album in both slots
      if (!q) return true;
      return (
        alb.title.toLowerCase().includes(q) ||
        alb.artistName.toLowerCase().includes(q) ||
        String(alb.year).includes(q)
      );
    });

    // Natural case-insensitive alphabetical sort (A–Z) by album title
    return list.sort((a, b) =>
      a.title.localeCompare(b.title, 'it', { sensitivity: 'base', numeric: true })
    );
  }, [evaluatedAlbums, pickerSearch, pickingSlot, selectedIdA, selectedIdB]);

  const handleSelectSlotAlbum = (albumId: string) => {
    if (pickingSlot === 'A') {
      setSelectedIdA(albumId);
    } else if (pickingSlot === 'B') {
      setSelectedIdB(albumId);
    }
    setPickingSlot(null);
    setPickerSearch('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl w-full"
    >
      {/* Category label */}
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8e8e93] mb-3">
        DUELLO MUSICALE
      </div>

      {/* Main Title */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-3">
        Confronto <span className="text-[#c7ff36]">testa a testa</span>
      </h1>

      <p className="text-sm md:text-[15px] text-[#a3a3a3] max-w-2xl font-light mb-8 leading-relaxed">
        Scegli manualmente due album dal catalogo per confrontare medie generali, differenziali e
        le rispettive tracce migliori.
      </p>

      <div className="mb-8"><EditionComparison albums={albums} /></div>
      {/* Delta Difference Banner (when both albums are chosen) */}
      <AnimatePresence>
        {diff && diff.winnerTitle !== 'Parità' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="mb-8 flex justify-center"
          >
            <div className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-[#18230f] border border-[#2c4014] text-xs sm:text-sm font-mono text-[#c7ff36] shadow-[0_0_20px_rgba(199,255,54,0.18)]">
              <Trophy size={16} className="text-[#c7ff36]" />
              <span>
                Vantaggio: +{formatRating(diff.delta, 4)} per <strong className="font-semibold text-white">{diff.winnerTitle}</strong>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 mb-12">
        {/* SLOT A */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-semibold tracking-widest text-[#77777f] uppercase">
              PRIMO ALBUM
            </span>
            {albumA && (
              <div className="flex items-center gap-3">
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => {
                    setPickingSlot('A');
                    setPickerSearch('');
                  }}
                  className="text-[11px] font-semibold text-[#8e8e93] hover:text-[#c7ff36] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Sostituisci</span>
                </motion.button>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setSelectedIdA(null)}
                  className="text-[11px] font-semibold text-[#77777f] hover:text-red-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                  title="Rimuovi primo album"
                >
                  <X size={13} />
                  <span>Rimuovi</span>
                </motion.button>
              </div>
            )}
          </div>

          {albumA && statsA ? (
            <motion.div
              key={albumA.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-[#0d0d10] border rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-2xl transition-all ${
                diff?.winnerId === albumA.id
                  ? 'border-[#c7ff36]/60 shadow-[0_0_25px_rgba(199,255,54,0.12)]'
                  : 'border-[#1d1d22]'
              }`}
            >
              <div>
                {/* Header card with cover art */}
                <div className="flex items-start gap-5 mb-8">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#161619] shrink-0 border border-[#25252c] shadow-lg">
                    <img
                      src={albumA.coverUrl}
                      alt={albumA.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-editorial text-2xl sm:text-3xl font-normal text-white uppercase tracking-tight truncate">
                      {albumA.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8e8e93] font-medium truncate mt-0.5">
                      {albumA.artistName}
                    </p>
                    <div className="text-[11px] font-mono tracking-wider text-[#66666f] uppercase mt-2">
                      {albumA.year} · {statsA.ratedCount} TRACCE VALUTATE
                    </div>
                    <div className="font-editorial text-3xl sm:text-4xl text-[#c7ff36] mt-3 drop-shadow-[0_0_12px_rgba(199,255,54,0.2)]">
                      {formatRating(statsA.averageRating)}
                    </div>
                  </div>
                </div>

                {/* BRANI MIGLIORI A */}
                <div className="pt-4 border-t border-[#18181c]">
                  <div className="text-[10px] font-semibold tracking-widest text-[#66666f] uppercase mb-4">
                    BRANI MIGLIORI
                  </div>
                  <div className="space-y-3.5">
                    {statsA.topTracks.map((t, idx) => {
                      const rating = t.rating as number;
                      const percent = Math.min(Math.max((rating / 10) * 100, 5), 100);
                      return (
                        <div key={t.id} className="flex items-center gap-3 text-xs">
                          <span className="w-4 text-[#55555c] font-mono text-[11px]">{idx + 1}</span>
                          <span className="w-32 truncate uppercase text-white font-medium">
                            {t.title}
                          </span>
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom link to view full album */}
              <div className="mt-8 pt-4 border-t border-[#18181c] flex items-center justify-between">
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => onSelectAlbum(albumA.id)}
                  className="text-xs font-semibold text-[#8e8e93] hover:text-[#c7ff36] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Vedi scheda completa</span>
                  <ArrowRight size={13} />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            /* Empty Slot A */
            <motion.div
              whileHover={{ scale: 1.01, borderColor: '#33333d' }}
              onClick={() => {
                setPickingSlot('A');
                setPickerSearch('');
              }}
              className="bg-[#0c0c0e]/80 border-2 border-dashed border-[#202026] hover:border-[#c7ff36]/60 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[380px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#141418] border border-[#26262e] group-hover:border-[#c7ff36]/60 flex items-center justify-center text-[#77777f] group-hover:text-[#c7ff36] transition-colors mb-4 shadow-lg">
                <Plus size={28} />
              </div>
              <h3 className="text-base font-semibold text-white uppercase tracking-wider mb-1.5 group-hover:text-[#c7ff36] transition-colors">
                Seleziona primo album
              </h3>
              <p className="text-xs text-[#77777f] max-w-xs font-light">
                Clicca per aprire il catalogo degli album valutati e scegliere il primo contendente.
              </p>
            </motion.div>
          )}
        </div>

        {/* SLOT B */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-semibold tracking-widest text-[#77777f] uppercase">
              SECONDO ALBUM
            </span>
            {albumB && (
              <div className="flex items-center gap-3">
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => {
                    setPickingSlot('B');
                    setPickerSearch('');
                  }}
                  className="text-[11px] font-semibold text-[#8e8e93] hover:text-[#c7ff36] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Sostituisci</span>
                </motion.button>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setSelectedIdB(null)}
                  className="text-[11px] font-semibold text-[#77777f] hover:text-red-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                  title="Rimuovi secondo album"
                >
                  <X size={13} />
                  <span>Rimuovi</span>
                </motion.button>
              </div>
            )}
          </div>

          {albumB && statsB ? (
            <motion.div
              key={albumB.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-[#0d0d10] border rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-2xl transition-all ${
                diff?.winnerId === albumB.id
                  ? 'border-[#c7ff36]/60 shadow-[0_0_25px_rgba(199,255,54,0.12)]'
                  : 'border-[#1d1d22]'
              }`}
            >
              <div>
                {/* Header card with cover art */}
                <div className="flex items-start gap-5 mb-8">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#161619] shrink-0 border border-[#25252c] shadow-lg">
                    <img
                      src={albumB.coverUrl}
                      alt={albumB.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-editorial text-2xl sm:text-3xl font-normal text-white uppercase tracking-tight truncate">
                      {albumB.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8e8e93] font-medium truncate mt-0.5">
                      {albumB.artistName}
                    </p>
                    <div className="text-[11px] font-mono tracking-wider text-[#66666f] uppercase mt-2">
                      {albumB.year} · {statsB.ratedCount} TRACCE VALUTATE
                    </div>
                    <div className="font-editorial text-3xl sm:text-4xl text-[#c7ff36] mt-3 drop-shadow-[0_0_12px_rgba(199,255,54,0.2)]">
                      {formatRating(statsB.averageRating)}
                    </div>
                  </div>
                </div>

                {/* BRANI MIGLIORI B */}
                <div className="pt-4 border-t border-[#18181c]">
                  <div className="text-[10px] font-semibold tracking-widest text-[#66666f] uppercase mb-4">
                    BRANI MIGLIORI
                  </div>
                  <div className="space-y-3.5">
                    {statsB.topTracks.map((t, idx) => {
                      const rating = t.rating as number;
                      const percent = Math.min(Math.max((rating / 10) * 100, 5), 100);
                      return (
                        <div key={t.id} className="flex items-center gap-3 text-xs">
                          <span className="w-4 text-[#55555c] font-mono text-[11px]">{idx + 1}</span>
                          <span className="w-32 truncate uppercase text-white font-medium">
                            {t.title}
                          </span>
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom link to view full album */}
              <div className="mt-8 pt-4 border-t border-[#18181c] flex items-center justify-between">
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => onSelectAlbum(albumB.id)}
                  className="text-xs font-semibold text-[#8e8e93] hover:text-[#c7ff36] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Vedi scheda completa</span>
                  <ArrowRight size={13} />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            /* Empty Slot B */
            <motion.div
              whileHover={{ scale: 1.01, borderColor: '#33333d' }}
              onClick={() => {
                setPickingSlot('B');
                setPickerSearch('');
              }}
              className="bg-[#0c0c0e]/80 border-2 border-dashed border-[#202026] hover:border-[#c7ff36]/60 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[380px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#141418] border border-[#26262e] group-hover:border-[#c7ff36]/60 flex items-center justify-center text-[#77777f] group-hover:text-[#c7ff36] transition-colors mb-4 shadow-lg">
                <Plus size={28} />
              </div>
              <h3 className="text-base font-semibold text-white uppercase tracking-wider mb-1.5 group-hover:text-[#c7ff36] transition-colors">
                Seleziona secondo album
              </h3>
              <p className="text-xs text-[#77777f] max-w-xs font-light">
                {albumA
                  ? `Scegli l'avversario per sfidare "${albumA.title}".`
                  : 'Scegli il secondo album da mettere a confronto.'}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Album Selection Modal */}
      <AnimatePresence>
        {pickingSlot && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-[#111115] border border-[#24242c] rounded-3xl p-6 sm:p-7 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1c1c22]">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold uppercase tracking-wider text-white">
                    {pickingSlot === 'A' ? 'SELEZIONA PRIMO ALBUM' : 'SELEZIONA SECONDO ALBUM'}
                  </h3>
                  <p className="text-xs text-[#8e8e93] font-light mt-0.5">
                    Scegli tra gli {evaluatedAlbums.length} album valutati nel tuo catalogo
                  </p>
                </div>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => setPickingSlot(null)}
                  className="p-1.5 text-[#77777f] hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </motion.button>
              </div>

              {/* Search input inside modal */}
              <div className="pt-4 pb-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#66666f]"
                  />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Cerca per titolo, artista o anno..."
                    autoFocus
                    className="w-full bg-[#16161b] border border-[#282832] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-[#55555c] focus:outline-none focus:border-[#c7ff36] transition-colors"
                  />
                </div>
              </div>

              {/* List of Albums */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 divide-y divide-[#18181f]">
                {filteredForPicker.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#66666f]">
                    Nessun album trovato corrispondente alla ricerca.
                  </div>
                ) : (
                  filteredForPicker.map((alb) => {
                    const st = calculateAlbumStats(alb.tracks);
                    return (
                      <motion.div
                        key={alb.id}
                        whileHover={{ backgroundColor: '#18181f' }}
                        onClick={() => handleSelectSlotAlbum(alb.id)}
                        className="py-3 px-3 flex items-center justify-between rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={alb.coverUrl}
                            alt={alb.title}
                            className="w-11 h-11 rounded-lg object-cover bg-[#161619] shrink-0 border border-[#25252c]"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wide truncate group-hover:text-[#c7ff36] transition-colors">
                              {alb.title}
                            </h4>
                            <p className="text-xs text-[#8e8e93] truncate">
                              {alb.artistName} · {alb.year}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 ml-3">
                          <div className="text-right">
                            <div className="font-editorial text-base sm:text-lg text-[#c7ff36]">
                              {formatRating(st.averageRating)}
                            </div>
                            <div className="text-[10px] text-[#66666f] font-mono">
                              {st.ratedCount} tracce
                            </div>
                          </div>
                          <span className="text-xs uppercase tracking-wider text-[#8e8e93] group-hover:text-[#c7ff36] font-semibold hidden sm:inline">
                            Scegli →
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
