import { useViewMemory } from '../hooks/useViewMemory';
import { WrappedInsights } from './InsightsPanels';
import { WrappedNarrative } from './ExperienceHub';
import { AnimatedMetric } from './AnimatedMetric';
import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Trophy,
  Share2,
  Calendar,
  Flame,
  Crown,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, Artist } from '../types';
import { calculateYearWrapped, formatRating } from '../utils/musicMath';
import { ArtistAvatar } from './ArtistAvatar';

interface WrappedViewProps {
  albums: Album[];
  artists?: Artist[];
  onSelectAlbum: (albumId: string) => void;
  onOpenShareModal: (album: Album) => void;
  onSelectArtist?: (artistId: string, artistName: string) => void;
}

export const WrappedView: React.FC<WrappedViewProps> = ({
  albums,
  artists = [],
  onSelectAlbum,
  onOpenShareModal,
  onSelectArtist,
}) => {
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    albums.forEach((a) => set.add(a.year));
    if (!set.has(2026)) set.add(2026);
    if (!set.has(2025)) set.add(2025);
    if (!set.has(2024)) set.add(2024);
    if (!set.has(2023)) set.add(2023);
    return Array.from(set).sort((a, b) => b - a);
  }, [albums]);

  const [selectedYear, setSelectedYear] = useViewMemory<number>('wrapped.year', 2026);

  const wrap = useMemo(() => {
    return calculateYearWrapped(albums, selectedYear, artists);
  }, [albums, selectedYear, artists]);

  const getArtistId = (name: string): string => {
    const found = artists.find((a) => a.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : `art-${name.toLowerCase().replace(/\s+/g, '-')}`;
  };

  const maxDistCount = Math.max(...Object.values(wrap.distribution), 1);
  const maxMonthCount = Math.max(...wrap.monthTimeline.map((m) => m.count), 1);

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
        RIEPILOGO ANNUALE
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-2">
            TRACKLIST <span className="text-[#c7ff36]">Wrapped</span>
          </h1>
          <p className="text-sm md:text-[15px] text-[#a3a3a3] max-w-xl font-light leading-relaxed">
            Il riassunto completo e statistico del tuo anno musicale: voti, dischi dominanti e generi, raggruppati per anno di uscita.
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex flex-wrap gap-2 self-start sm:self-auto bg-[#121215] border border-[#222227] p-1.5 rounded-2xl">
          {availableYears.map((yr) => (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-4 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                yr === selectedYear
                  ? 'bg-[#c7ff36] text-black shadow-[0_0_12px_rgba(199,255,54,0.3)] font-bold'
                  : 'text-[#8e8e93] hover:text-white hover:bg-[#1a1a20]'
              }`}
            >
              {yr}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`wrapped-${selectedYear}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="space-y-10"
        >
          <WrappedInsights albums={albums} year={selectedYear} onSelectAlbum={onSelectAlbum} />
          <WrappedNarrative albums={albums} year={selectedYear} />
          {/* Big Hero Card: The Year in Numbers */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#121d0a] via-[#0b0f06] to-[#0a0a0c] border border-[#273812] rounded-3xl p-8 sm:p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#c7ff36] uppercase">
                <Sparkles size={15} />
                <span>IL TUO {selectedYear} IN CIFRE</span>
              </div>
              {wrap.peakMonth.count > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c290e] border border-[#334c16] text-[11px] font-mono text-[#c7ff36]">
                  <Calendar size={12} />
                  <span>Più uscite a: {wrap.peakMonth.name} ({wrap.peakMonth.count} album)</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#77777f] mb-1">
                  ALBUM VALUTATI
                </div>
                <div className="font-editorial text-4xl sm:text-5xl text-white">
                  <AnimatedMetric value={wrap.totalAlbumsEvaluated} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#77777f] mb-1">
                  TRACCE VOTATE
                </div>
                <div className="font-editorial text-4xl sm:text-5xl text-white">
                  <AnimatedMetric value={wrap.totalTracksEvaluated} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#77777f] mb-1">
                  MEDIA ANNUALE
                </div>
                <div className="font-editorial text-4xl sm:text-5xl text-[#c7ff36]">
                  <AnimatedMetric value={wrap.yearlyAverage} rating decimals={2} />
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#77777f] mb-1">
                  TOP ARTISTA
                </div>
                <div className="font-editorial text-2xl sm:text-3xl text-white truncate">
                  {wrap.topArtists[0]?.artistName || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* BEST ALBUM & WORST ALBUM SIDE-BY-SIDE (Requirement 9) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* MIGLIOR ALBUM */}
            {wrap.highestRatedAlbum && (
              <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase">
                      <Trophy size={14} />
                      <span>ALBUM CON VOTO PIÙ ALTO</span>
                    </div>
                    <span className="text-xs font-mono text-[#c7ff36] flex items-center gap-1">
                      <TrendingUp size={13} />
                      <span>Vetta</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-5 mb-4">
                    <img
                      src={wrap.highestRatedAlbum.album.coverUrl}
                      alt={wrap.highestRatedAlbum.album.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-[#161619] shrink-0 border border-[#25252c]"
                    />
                    <div className="min-w-0">
                      <h3
                        onClick={() => onSelectAlbum(wrap.highestRatedAlbum!.album.id)}
                        className="font-editorial text-2xl sm:text-3xl font-normal text-white uppercase tracking-tight hover:text-[#c7ff36] transition-colors cursor-pointer truncate"
                      >
                        {wrap.highestRatedAlbum.album.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#8e8e93] truncate mt-0.5">
                        {wrap.highestRatedAlbum.album.artistName}
                      </p>
                      <div className="font-editorial text-3xl text-[#c7ff36] mt-2">
                        {formatRating(wrap.highestRatedAlbum.average)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#18181c] flex justify-between items-center text-xs">
                  <span className="text-[#66666f] font-mono uppercase">
                    {wrap.highestRatedAlbum.album.tracks.length} tracce · {wrap.highestRatedAlbum.album.label || 'Indipendente'}
                  </span>
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    onClick={() => onOpenShareModal(wrap.highestRatedAlbum!.album)}
                    className="font-semibold uppercase tracking-wider text-[#8e8e93] hover:text-[#c7ff36] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Share2 size={13} />
                    <span>Condividi</span>
                  </motion.button>
                </div>
              </div>
            )}

            {/* ALBUM CON VOTO PIÙ BASSO */}
            {wrap.lowestRatedAlbum && (
              <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#e05252] uppercase">
                      <TrendingDown size={14} />
                      <span>ALBUM CON VOTO PIÙ BASSO</span>
                    </div>
                    <span className="text-xs font-mono text-[#e05252]">Fanalino di coda</span>
                  </div>

                  <div className="flex items-center gap-5 mb-4">
                    <img
                      src={wrap.lowestRatedAlbum.album.coverUrl}
                      alt={wrap.lowestRatedAlbum.album.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-[#161619] shrink-0 border border-[#25252c]"
                    />
                    <div className="min-w-0">
                      <h3
                        onClick={() => onSelectAlbum(wrap.lowestRatedAlbum!.album.id)}
                        className="font-editorial text-2xl sm:text-3xl font-normal text-white uppercase tracking-tight hover:text-white/80 transition-colors cursor-pointer truncate"
                      >
                        {wrap.lowestRatedAlbum.album.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#8e8e93] truncate mt-0.5">
                        {wrap.lowestRatedAlbum.album.artistName}
                      </p>
                      <div className="font-editorial text-3xl text-[#e05252] mt-2">
                        {formatRating(wrap.lowestRatedAlbum.average)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#18181c] flex justify-between items-center text-xs">
                  <span className="text-[#66666f] font-mono uppercase">
                    {wrap.lowestRatedAlbum.album.tracks.length} tracce · {wrap.lowestRatedAlbum.album.label || 'Indipendente'}
                  </span>
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    onClick={() => onSelectAlbum(wrap.lowestRatedAlbum!.album.id)}
                    className="font-semibold uppercase tracking-wider text-[#8e8e93] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Vedi scheda</span>
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {/* TOP 5 ALBUMS & TOP 5 ARTISTS SIDE-BY-SIDE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* TOP 5 ALBUM */}
            <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Crown size={14} />
                <span>TOP 5 ALBUM DELL'ANNO</span>
              </div>

              <div className="divide-y divide-[#17171b]">
                {wrap.top5Albums.map((item, idx) => (
                  <div
                    key={item.album.id}
                    onClick={() => onSelectAlbum(item.album.id)}
                    className="py-3 px-2 flex items-center justify-between rounded-xl hover:bg-[#121216] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs text-[#55555c] w-5 text-center group-hover:text-[#c7ff36]">
                        {idx + 1}
                      </span>
                      <img
                        src={item.album.coverUrl}
                        alt={item.album.title}
                        className="w-10 h-10 rounded-lg object-cover bg-[#161619] shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                          {item.album.title}
                        </h4>
                        <p className="text-xs text-[#77777f] truncate">{item.album.artistName}</p>
                      </div>
                    </div>

                    <div className="font-editorial text-sm sm:text-base text-[#c7ff36] font-medium ml-2">
                      {formatRating(item.average, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP 5 ARTISTI */}
            <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Flame size={14} />
                <span>TOP 5 ARTISTI PER MEDIA VOTO</span>
              </div>

              <div className="divide-y divide-[#17171b]">
                {wrap.topArtists.map((artist, idx) => (
                  <div
                    key={artist.artistName}
                    onClick={() =>
                      onSelectArtist && onSelectArtist(getArtistId(artist.artistName), artist.artistName)
                    }
                    className="py-3 px-2 flex items-center justify-between rounded-xl hover:bg-[#121216] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs text-[#55555c] w-5 text-center group-hover:text-[#c7ff36]">
                        {idx + 1}
                      </span>
                      <ArtistAvatar
                        name={artist.artistName}
                        imageUrl={artist.imageUrl}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                          {artist.artistName}
                        </h4>
                        <p className="text-xs text-[#77777f] truncate">
                          {artist.tracksCount} tracce · {artist.albumsCount} album
                        </p>
                      </div>
                    </div>

                    <div className="font-editorial text-sm sm:text-base text-white font-medium ml-2">
                      {formatRating(artist.average, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DISTRIBUTION & MONTHLY TIMELINE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* RATING DISTRIBUTION */}
            <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Layers size={14} />
                <span>DISTRIBUZIONE VOTI ({selectedYear})</span>
              </div>

              <div className="space-y-3.5">
                {Object.entries(wrap.distribution).map(([range, count]) => {
                  const pct = (count / maxDistCount) * 100;
                  return (
                    <div key={range} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#8e8e93]">{range}</span>
                        <span className="text-white font-medium">{count} tracce</span>
                      </div>
                      <div className="h-2 bg-[#18181e] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-[#c7ff36] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MONTHLY ACTIVITY */}
            <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Calendar size={14} />
                <span>USCITE DEGLI ALBUM VALUTATI PER MESE · {selectedYear}</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {wrap.monthTimeline.map((m) => {
                  const heightPct = Math.max((m.count / maxMonthCount) * 100, 10);
                  const isPeak = m.month === wrap.peakMonth.name && m.count > 0;
                  return (
                    <div
                      key={m.month}
                      className={`p-2.5 rounded-2xl flex flex-col items-center justify-between min-h-[90px] border transition-all ${
                        isPeak
                          ? 'bg-[#18230f] border-[#2c4014] text-[#c7ff36]'
                          : 'bg-[#121216] border-[#1d1d23] text-[#8e8e93]'
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase tracking-wider">{m.month}</div>
                      <div className="w-full flex items-end justify-center h-8 my-1">
                        <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} style={{ transformOrigin: 'bottom', height: `${m.count > 0 ? heightPct : 6}%` }}
                          className={`w-3 rounded-full ${
                            isPeak ? 'bg-[#c7ff36]' : m.count > 0 ? 'bg-[#55555c]' : 'bg-[#1f1f26]'
                          }`}
                        />
                      </div>
                      <div className="text-[11px] font-mono font-semibold text-white">
                        {m.count > 0 ? `${m.count}` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* GENRE EXPLORATION CHIPS */}
          {wrap.topGenres.length > 0 && (
            <div data-motion-panel className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-4">
                GENERI PIÙ PRESENTI NEGLI ALBUM VALUTATI DEL {selectedYear}
              </div>

              <div className="flex flex-wrap gap-2.5">
                {wrap.topGenres.map((g) => (
                  <div
                    key={g.genre}
                    className="px-4 py-2 rounded-xl bg-[#141418] border border-[#222228] text-xs font-mono text-white flex items-center gap-2"
                  >
                    <span>{g.genre}</span>
                    <span className="text-[10px] text-[#c7ff36] bg-[#1a2510] px-2 py-0.5 rounded-full">
                      {g.count} album
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
