import { useViewMemory } from '../hooks/useViewMemory';
import { StatisticsInsights, downloadInsights } from './InsightsPanels';
import { insightsCSV } from '../utils/listeningInsights';
import { AnimatedMetric } from './AnimatedMetric';
import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Disc3,
  PieChart,
  Flame,
  Crown,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, Artist } from '../types';
import { calculateAdvancedStats, formatRating } from '../utils/musicMath';
import { ArtistAvatar } from './ArtistAvatar';

interface StatisticheViewProps {
  albums: Album[];
  artists?: Artist[];
  onSelectAlbum: (albumId: string) => void;
  onSelectArtist?: (artistId: string, artistName: string) => void;
}

export const StatisticheView: React.FC<StatisticheViewProps> = ({
  albums,
  artists = [],
  onSelectAlbum,
  onSelectArtist,
}) => {
  const [tab, setTab] = useViewMemory<'overview' | 'timeline' | 'artists' | 'albums' | 'genres' | 'insights'>('stats.tab', 'overview');

  const [filterYear, setFilterYear] = useViewMemory<number | 'all'>('stats.year', 'all');
  const [filterEdition, setFilterEdition] = useViewMemory('stats.edition', 'all');
  const years = useMemo(() => [...new Set(albums.filter(a => !a.deleted).map(a => a.year))].sort((a, b) => b - a), [albums]);
  const scopedAlbums = useMemo(() => albums.filter(a => !a.deleted && (filterYear === 'all' || a.year === filterYear) && (filterEdition === 'all' || (a.editionType || 'standard') === filterEdition)), [albums, filterYear, filterEdition]);
  const stats = useMemo(() => {
    return calculateAdvancedStats(scopedAlbums, artists);
  }, [scopedAlbums, artists]);

  const maxDist = Math.max(...Object.values(stats.general.scoreDistribution), 1);

  const getArtistId = (name: string): string => {
    const found = artists.find((a) => a.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : `art-${name.toLowerCase().replace(/\s+/g, '-')}`;
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
        ANALISI E METRICHE
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-3">
        Statistiche <span className="text-[#c7ff36]">avanzate</span>
      </h1>

      <p className="text-sm md:text-[15px] text-[#a3a3a3] max-w-2xl font-light mb-8 leading-relaxed">
        Analisi multidimensionale della tua discoteca: indici statistici (media, mediana, moda), trend temporali,
        confronto edizioni e gradimento per genere.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#252c20] bg-[#10130e] p-4 mb-5">
        <label className="flex-1 min-w-[130px] text-[10px] uppercase tracking-wider text-[#8c9880]">Anno di uscita
          <select aria-label="Anno statistiche" value={filterYear} onChange={e => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="block w-full mt-2 rounded-xl border border-[#343e29] bg-[#191e14] p-2.5 text-xs text-white"><option value="all">Tutti gli anni</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </label>
        <label className="flex-1 min-w-[130px] text-[10px] uppercase tracking-wider text-[#8c9880]">Edizione
          <select aria-label="Edizione statistiche" value={filterEdition} onChange={e => setFilterEdition(e.target.value)} className="block w-full mt-2 rounded-xl border border-[#343e29] bg-[#191e14] p-2.5 text-xs text-white"><option value="all">Tutte le edizioni</option><option value="standard">Standard</option><option value="deluxe">Deluxe</option><option value="remaster">Remaster</option><option value="modified">Versione modificata</option></select>
        </label>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .97 }} onClick={() => downloadInsights('tracklist-statistiche-' + filterYear + '-' + filterEdition + '.csv', insightsCSV(scopedAlbums), 'text/csv;charset=utf-8')} className="rounded-xl border border-[#465d2a] px-4 py-2.5 text-xs font-semibold text-[#c7ff36]">Esporta statistiche CSV</motion.button>
        {(filterYear !== 'all' || filterEdition !== 'all') && <button onClick={() => { setFilterYear('all'); setFilterEdition('all'); }} className="text-xs text-[#9ca78f] underline px-2 py-2">Azzera filtri</button>}
      </div>
      <p role="status" className="text-[11px] text-[#828e76] mb-5">{scopedAlbums.length} album nel filtro · metriche dei voti basate sugli album confermati{scopedAlbums.length ? '.' : ' · Nessun album trovato.'}</p>
      {/* Tabs navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1c1c22] pb-4 mb-8">
        {[
          { id: 'overview', label: 'Panoramica', icon: BarChart3 },
          { id: 'timeline', label: 'Evoluzione Temporale', icon: TrendingUp },
          { id: 'artists', label: 'Analisi Artisti', icon: Users },
          { id: 'albums', label: 'Album & Edizioni', icon: Disc3 },
          { id: 'genres', label: 'Generi Musicali', icon: PieChart },
          { id: 'insights', label: 'Approfondimenti', icon: Flame },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#18230f] border border-[#2c4014] text-[#c7ff36] shadow-[0_0_15px_rgba(199,255,54,0.15)] font-bold'
                  : 'text-[#8e8e93] hover:text-white hover:bg-[#121216]'
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'insights' && <StatisticsInsights key="insights" albums={scopedAlbums} onSelectAlbum={onSelectAlbum} />}
        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && (
          <motion.div
            key="tab-overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Top Metric Cards: Media, Mediana, Moda, Totale */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 shadow-xl">
                <div className="text-[10px] font-mono tracking-widest text-[#77777f] uppercase mb-1">
                  MEDIA COMPLESSIVA
                </div>
                <div className="font-editorial text-4xl text-[#c7ff36]">
                  <AnimatedMetric value={stats.general.meanRating} rating decimals={3} />
                </div>
                <div className="text-[11px] text-[#66666f] font-mono mt-1">
                  su {stats.general.totalTracks} brani
                </div>
              </div>

              <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 shadow-xl">
                <div className="text-[10px] font-mono tracking-widest text-[#77777f] uppercase mb-1">
                  MEDIANA
                </div>
                <div className="font-editorial text-4xl text-white">
                  <AnimatedMetric value={stats.general.medianRating} rating decimals={2} />
                </div>
                <div className="text-[11px] text-[#66666f] font-mono mt-1">
                  valore centrale della serie
                </div>
              </div>

              <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 shadow-xl">
                <div className="text-[10px] font-mono tracking-widest text-[#77777f] uppercase mb-1">
                  MODA DEI VOTI
                </div>
                <div className="font-editorial text-4xl text-white">
                  <AnimatedMetric value={stats.general.modeRating} rating decimals={2} />
                </div>
                <div className="text-[11px] text-[#66666f] font-mono mt-1">
                  il voto assegnato più spesso
                </div>
              </div>

              <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 shadow-xl">
                <div className="text-[10px] font-mono tracking-widest text-[#77777f] uppercase mb-1">
                  ALBUM VALUTATI
                </div>
                <div className="font-editorial text-4xl text-white">
                  <AnimatedMetric value={stats.general.totalRated} />
                </div>
                <div className="text-[11px] text-[#66666f] font-mono mt-1">
                  su {stats.general.totalAlbums} album totali
                </div>
              </div>
            </div>

            {/* Distribution Bar Chart */}
            <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Layers size={14} />
                <span>DISTRIBUZIONE FREQUENZA VOTI ({stats.general.totalTracks} TRACCE)</span>
              </div>

              <div className="space-y-4">
                {Object.entries(stats.general.scoreDistribution).map(([range, count]) => {
                  const pct = (count / maxDist) * 100;
                  const ratio = ((count / (stats.general.totalTracks || 1)) * 100).toFixed(1);
                  return (
                    <div key={range} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#8e8e93] w-12">{range}</span>
                        <span className="text-white font-medium">
                          {count} tracce <span className="text-[#66666f]">({ratio}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-[#18181e] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full bg-[#c7ff36] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: TIMELINE */}
        {tab === 'timeline' && (
          <motion.div
            key="tab-timeline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl"
          >
            <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
              MEDIE VOTI PER ANNO DI PUBBLICAZIONE
            </div>

            <div className="divide-y divide-[#18181c]">
              {stats.temporal.timelineByYear.map((item) => (
                <div key={item.year} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-editorial text-white">{item.year}</div>
                    <div className="text-[11px] font-mono text-[#66666f]">
                      {item.count} album valutati
                    </div>
                  </div>
                  <div className="font-editorial text-2xl text-[#c7ff36]">
                    {formatRating(item.average, 2)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 3: ARTISTS */}
        {tab === 'artists' && (
          <motion.div
            key="tab-artists"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* ARTISTI PIÙ VALUTATI */}
            <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Flame size={14} />
                <span>ARTISTI CON IL MAGGIOR NUMERO DI TRACCE</span>
              </div>

              <div className="divide-y divide-[#17171b]">
                {stats.artistAnalysis.mostEvaluated.map((artist, idx) => (
                  <div
                    key={artist.name}
                    onClick={() =>
                      onSelectArtist && onSelectArtist(getArtistId(artist.name), artist.name)
                    }
                    className="py-3 px-2 flex items-center justify-between rounded-xl hover:bg-[#121216] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs text-[#55555c] w-5 text-center group-hover:text-[#c7ff36]">
                        {idx + 1}
                      </span>
                      <ArtistAvatar
                        imageUrl={artists.find((a) => a.name.toLowerCase() === artist.name.toLowerCase())?.imageUrl}
                        name={artist.name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                          {artist.name}
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

            {/* ARTISTI CON MEDIA PIÙ ALTA (con soglia min. 2+ album) */}
            <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                <Crown size={14} />
                <span>ARTISTI CON LA MEDIA PIÙ ALTA (MIN. 2 ALBUM)</span>
              </div>

              <div className="divide-y divide-[#17171b]">
                {stats.artistAnalysis.highestAverage.map((artist, idx) => (
                  <div
                    key={artist.name}
                    onClick={() =>
                      onSelectArtist && onSelectArtist(getArtistId(artist.name), artist.name)
                    }
                    className="py-3 px-2 flex items-center justify-between rounded-xl hover:bg-[#121216] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs text-[#55555c] w-5 text-center group-hover:text-[#c7ff36]">
                        {idx + 1}
                      </span>
                      <ArtistAvatar
                        imageUrl={artists.find((a) => a.name.toLowerCase() === artist.name.toLowerCase())?.imageUrl}
                        name={artist.name}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                          {artist.name}
                        </h4>
                        <p className="text-xs text-[#77777f] truncate">
                          {artist.albumsCount} album · {artist.tracksCount} tracce
                        </p>
                      </div>
                    </div>

                    <div className="font-editorial text-base sm:text-lg text-[#c7ff36] font-medium ml-2">
                      {formatRating(artist.average, 3)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 4: ALBUMS & EDITIONS */}
        {tab === 'albums' && (
          <motion.div
            key="tab-albums"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Confronto Edizioni (Standard vs Deluxe vs Remaster) */}
            <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                CONFRONTO TIPOLOGIE DI EDIZIONE
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-[#141418] border border-[#222228]">
                  <div className="text-xs font-semibold text-white uppercase mb-1">Standard</div>
                  <div className="font-editorial text-3xl text-[#c7ff36] my-2">
                    {formatRating(stats.editions.standardAverage, 3)}
                  </div>
                  <div className="text-xs text-[#8e8e93] font-mono">
                    {stats.editions.standardCount} album nel catalogo
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#141418] border border-[#222228]">
                  <div className="text-xs font-semibold text-white uppercase mb-1">Deluxe / Altro</div>
                  <div className="font-editorial text-3xl text-[#c7ff36] my-2">
                    {formatRating(stats.editions.otherAverage, 3)}
                  </div>
                  <div className="text-xs text-[#8e8e93] font-mono">
                    {stats.editions.otherCount} album nel catalogo
                  </div>
                </div>
              </div>
            </div>

            {/* Album con maggior divario (Best vs Worst Track) */}
            <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                ALBUM CON IL MAGGIOR DIVARIO QUALITATIVO TRA TRACCE (DISCHI PIÙ POLARIZZANTI)
              </div>

              <div className="divide-y divide-[#17171b]">
                {stats.spreadAlbums.map((item, idx) => (
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
                        <p className="text-[11px] text-[#77777f] truncate">
                          {item.album.artistName} · Min {formatRating(item.min, 2)} / Max {formatRating(item.max, 2)}
                        </p>
                      </div>
                    </div>

                    <div className="font-mono text-xs sm:text-sm font-semibold text-white ml-2">
                      Δ {formatRating(item.spread, 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: GENRES */}
        {tab === 'genres' && (
          <motion.div
            key="tab-genres"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl"
          >
            <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
              SUDDIVISIONE E GRADIMENTO PER GENERE MUSICALE
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {stats.genres.map((g) => (
                <div
                  key={g.genre}
                  className="p-5 rounded-2xl bg-[#141418] border border-[#222228] flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white">{g.genre}</h4>
                    <p className="text-xs text-[#77777f] font-mono mt-0.5">{g.count} album valutati</p>
                  </div>
                  <div className="font-editorial text-2xl text-[#c7ff36]">
                    {formatRating(g.average, 2)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
