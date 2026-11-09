import { inLibraryView } from '../utils/usability';
import { useViewMemory } from '../hooks/useViewMemory';
import { SavedLibraryViews } from './SavedLibraryViews';
import type { LibraryFilters } from '../types';
import { AnimatedMetric } from './AnimatedMetric';
import React, { useState, useMemo } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, Artist } from '../types';
import { calculateAlbumStats, formatRating, isAlbumInRankings } from '../utils/musicMath';
import { getAlbumArtistRefs } from '../utils/artistParser';
import { CustomDropdown } from './CustomDropdown';

interface ClassificaViewProps {
  albums: Album[];
  artists?: Artist[];
  onSelectAlbum: (albumId: string) => void;
  onNavigateNuoveUscite: () => void;
  onSelectArtist?: (artistId: string, artistName: string) => void;
}

export const ClassificaView: React.FC<ClassificaViewProps> = ({
  albums,
  artists = [],
  onSelectAlbum,
  onNavigateNuoveUscite,
  onSelectArtist,
}) => {
  const [showFilters, setShowFilters] = useViewMemory('classifica.showFilters', false);
  const [searchQuery, setSearchQuery] = useViewMemory('classifica.search', '');
  const [selectedArtist, setSelectedArtist] = useViewMemory<string>('classifica.artist', 'all');
  const [selectedEdition, setSelectedEdition] = useViewMemory<string>('classifica.edition', 'all');
  const [selectedSort, setSelectedSort] = useViewMemory<'voto' | 'anno' | 'titolo' | 'artista'>('classifica.sort', 'voto');
  const [selectedYear, setSelectedYear] = useViewMemory<number | 'all'>('classifica.year', 'all');

  const [libraryStatus, setLibraryStatus] = useViewMemory<LibraryFilters['status']>('classifica.status', 'confirmed');
  const applyFilters = (f: LibraryFilters) => { setSearchQuery(f.search); setSelectedArtist(f.artist); setSelectedEdition(f.edition); setSelectedSort(f.sort); setSelectedYear(f.year); setLibraryStatus(f.status); setShowFilters(true); };
  // Evaluated albums
  const evaluatedAlbums = useMemo(() => {
    return albums.filter((a) => isAlbumInRankings(a));
  }, [albums]);

  const unratedCount = useMemo(() => {
    return albums.filter((a) => !isAlbumInRankings(a)).length;
  }, [albums]);

  // Overall statistics for evaluated albums
  const { totalCount, overallAverage, bestRating } = useMemo(() => {
    if (evaluatedAlbums.length === 0) {
      return { totalCount: 0, overallAverage: null, bestRating: null };
    }

    let sum = 0;
    let max = -1;

    evaluatedAlbums.forEach((a) => {
      const stats = calculateAlbumStats(a.tracks);
      if (stats.averageRating !== null) {
        sum += stats.averageRating;
        if (stats.averageRating > max) max = stats.averageRating;
      }
    });

    return {
      totalCount: evaluatedAlbums.length,
      overallAverage: sum / evaluatedAlbums.length,
      bestRating: max >= 0 ? max : null,
    };
  }, [evaluatedAlbums]);

  // Unique artists list for filter dropdown (includes individual collaborative artists)
  const artistOptions = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((a) => {
      const refs = getAlbumArtistRefs(a);
      refs.forEach((r) => set.add(r.name));
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: 'TUTTI GLI ARTISTI' },
      ...sorted.map((art) => ({ value: art, label: art.toUpperCase() })),
    ];
  }, [albums]);

  const editionOptions = [
    { value: 'all', label: 'TUTTE LE EDIZIONI' },
    { value: 'standard', label: 'SOLO STANDARD' },
    { value: 'deluxe', label: 'DELUXE' },
    { value: 'remaster', label: 'REMASTER' },
    { value: 'modified', label: 'VERSIONE MODIFICATA' },
  ];

  const sortOptions = [
    { value: 'voto' as const, label: 'PER VOTO' },
    { value: 'anno' as const, label: 'PER ANNO' },
    { value: 'titolo' as const, label: 'PER TITOLO' },
    { value: 'artista' as const, label: 'PER ARTISTA' },
  ];

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    albums.forEach((a) => set.add(a.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [albums]);

  // Filtered and sorted list
  const filteredAlbums = useMemo(() => {
    const source = albums.filter(a => inLibraryView(a, libraryStatus));
    return source
      .filter((a) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = a.title.toLowerCase().includes(q);
          const matchArtist = a.artistName.toLowerCase().includes(q);
          const matchAnyArtist = a.artists?.some((art) => art.name.toLowerCase().includes(q));
          if (!matchTitle && !matchArtist && !matchAnyArtist) return false;
        }

        if (selectedArtist !== 'all') {
          const refs = getAlbumArtistRefs(a);
          const hasArtist = refs.some((r) => r.name.toLowerCase() === selectedArtist.toLowerCase());
          if (!hasArtist && a.artistName.toLowerCase() !== selectedArtist.toLowerCase()) {
            return false;
          }
        }

        if (selectedEdition !== 'all') {
          if (selectedEdition === 'standard' && (a.editionType || 'standard') !== 'standard') return false;
          if (selectedEdition === 'deluxe' && a.editionType !== 'deluxe') return false;
          if (selectedEdition === 'remaster' && a.editionType !== 'remaster') return false;
          if (selectedEdition === 'modified' && a.editionType !== 'modified') return false;
        }

        if (selectedYear !== 'all' && a.year !== selectedYear) {
          return false;
        }

        return true;
      })
      .map((album) => {
        const stats = calculateAlbumStats(album.tracks);
        return {
          album,
          average: stats.averageRating,
          ratedCount: stats.ratedCount,
          totalTracks: stats.totalTracks,
        };
      })
      .sort((a, b) => {
        if (selectedSort === 'voto') {
          const diff = (b.average ?? -1) - (a.average ?? -1);
          if (Math.abs(diff) > 0.00001) return diff;
          return a.album.title.localeCompare(b.album.title);
        }
        if (selectedSort === 'anno') {
          return b.album.year - a.album.year;
        }
        if (selectedSort === 'titolo') {
          return a.album.title.localeCompare(b.album.title);
        }
        if (selectedSort === 'artista') {
          return a.album.artistName.localeCompare(b.album.artistName);
        }
        return 0;
      });
  }, [
    albums,
    libraryStatus,
    searchQuery,
    selectedArtist,
    selectedEdition,
    selectedYear,
    selectedSort,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl w-full"
    >
      {/* Top Category Badge (Universal Music Branding - Requirement 14) */}
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8e8e93] mb-3">
        COLLEZIONE MUSICALE · ARCHIVIO
      </div>

      {/* Main Editorial Title */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-3">
        La <span className="text-[#c7ff36]">classifica</span>
      </h1>

      <p className="text-sm md:text-[15px] text-[#a3a3a3] max-w-2xl font-light mb-8 leading-relaxed">
        Ogni album vale la media dei voti traccia per traccia. Dal progetto più memorabile al meno riuscito.
      </p>

      {/* Three Stats Counters */}
      <div className="grid grid-cols-3 gap-6 pt-2 pb-6 border-b border-[#1c1c20] mb-8 max-w-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
        >
          <div className="text-[10px] tracking-[0.2em] font-medium text-[#77777f] uppercase mb-1">
            ALBUM
          </div>
          <div className="font-editorial text-3xl md:text-4xl text-white">
            <AnimatedMetric value={totalCount} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-[10px] tracking-[0.2em] font-medium text-[#77777f] uppercase mb-1">
            MEDIA
          </div>
          <div className="font-editorial text-3xl md:text-4xl text-white">
            <AnimatedMetric value={overallAverage} rating />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="text-[10px] tracking-[0.2em] font-medium text-[#77777f] uppercase mb-1">
            MIGLIOR VOTO
          </div>
          <div className="font-editorial text-3xl md:text-4xl text-[#c7ff36]">
            <AnimatedMetric value={bestRating} rating />
          </div>
        </motion.div>
      </div>

      {/* Unrated Albums Banner (Requirement 7: clickable entire card without 'Valuta' button) */}
      {unratedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01, borderColor: 'rgba(199,255,54,0.45)' }}
          whileTap={{ scale: 0.99 }}
          onClick={onNavigateNuoveUscite}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateNuoveUscite();
            }
          }}
          className="bg-[#121c09] border border-[#293d14] rounded-2xl px-5 py-4 flex items-center justify-between mb-8 shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#c7ff36] select-none"
        >
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c7ff36] animate-pulse shrink-0" />
            <span className="text-xs md:text-sm text-[#e4f5bb] font-normal">
              <strong className="font-bold text-white">{unratedCount}</strong> album aspettano il tuo voto
            </span>
          </div>
          <span className="text-xs font-mono text-[#c7ff36] uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Apri elenco →
          </span>
        </motion.div>
      )}

      <SavedLibraryViews filters={{ search: searchQuery, artist: selectedArtist, edition: selectedEdition, sort: selectedSort, year: selectedYear, status: libraryStatus }} onApply={applyFilters} />
      {/* Controls Bar */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold tracking-wider transition-all cursor-pointer ${
            showFilters
              ? 'border-[#c7ff36] text-[#c7ff36] bg-[#1a2410] shadow-[0_0_12px_rgba(199,255,54,0.2)]'
              : 'border-[#292929] bg-[#111111] text-white hover:bg-[#1a1a1e]'
          }`}
        >
          <SlidersHorizontal size={13} />
          <span>FILTRI</span>
        </motion.button>

        <span className="text-[11px] font-mono text-[#66666e] tracking-widest uppercase">
          {filteredAlbums.length} ALBUM
        </span>
      </div>

      {/* Expandable Filters Panel with Custom Modern Dropdowns (Requirement 13) */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-visible mb-8 z-30 relative"
          >
            <div className="bg-[#101013] border border-[#222227] rounded-3xl p-5 space-y-5 shadow-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                    CERCA
                  </label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#66666f]"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cerca album o artista"
                      className="w-full bg-[#141418] border border-[#25252c] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-[#55555c] focus:outline-none focus:border-[#c7ff36] transition-colors"
                    />
                  </div>
                </div>

                {/* Custom Artist Dropdown */}
                <CustomDropdown
                  label="ARTISTA"
                  value={selectedArtist}
                  options={artistOptions}
                  onChange={setSelectedArtist}
                />

                {/* Custom Edition Dropdown */}
                <CustomDropdown
                  label="EDIZIONE"
                  value={selectedEdition}
                  options={editionOptions}
                  onChange={setSelectedEdition}
                />

                {/* Custom Sort Dropdown */}
                <CustomDropdown
                  label="ORDINA"
                  value={selectedSort}
                  options={sortOptions}
                  onChange={setSelectedSort}
                />
              </div>

              <label className="text-xs text-[#9dad90] block">Mostra<select aria-label="Stato album nella vista" className="mt-2 block w-full rounded-xl border border-[#3b4c2d] bg-[#1a2412] p-3 text-white" value={libraryStatus} onChange={e => setLibraryStatus(e.target.value as LibraryFilters['status'])}><option value="confirmed">Solo album confermati</option><option value="all">Tutto l’archivio</option><option value="incomplete">Album incompleti</option><option value="favorites">Preferiti: media almeno 8</option></select></label>
              {/* Year Chips */}
              <div className="pt-2">
                <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
                  ANNO
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedYear('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                      selectedYear === 'all'
                        ? 'border border-[#c7ff36] text-[#c7ff36] bg-[#18230f]'
                        : 'bg-[#141418] text-[#8e8e93] hover:text-white border border-[#25252c]'
                    }`}
                  >
                    TUTTI
                  </motion.button>
                  {availableYears.map((yr) => (
                    <motion.button
                      key={yr}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedYear(yr)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                        selectedYear === yr
                          ? 'border border-[#c7ff36] text-[#c7ff36] bg-[#18230f]'
                          : 'bg-[#141418] text-[#8e8e93] hover:text-white border border-[#25252c]'
                      }`}
                    >
                      {yr}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Table / Rows with Multi-artist interactive links */}
      {filteredAlbums.length === 0 ? (
        <div className="py-16 text-center border border-[#1a1a1e] rounded-3xl bg-[#0e0e11]">
          <p className="text-neutral-400 text-sm">Nessun album trovato con i filtri selezionati.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#17171b]">
          {filteredAlbums.map((item, index) => {
            const { album, average, totalTracks } = item;
            const rank = index + 1;
            const artistRefs = getAlbumArtistRefs(album, artists);

            return (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: (index % 6) * 0.035, duration: 0.32 }}
                whileHover={{ x: 6, backgroundColor: '#131318' }}
                onClick={() => onSelectAlbum(album.id)}
                className="group flex items-center justify-between py-3.5 px-3 rounded-2xl transition-all cursor-pointer select-none"
              >
                {/* Left: Rank + Artwork + Titles */}
                <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                  {/* Position number */}
                  <span className="w-6 sm:w-8 text-center font-bold text-lg sm:text-xl text-[#c7ff36] shrink-0 group-hover:scale-110 transition-transform">
                    {rank}
                  </span>

                  {/* Album Cover */}
                  <div className="relative overflow-hidden rounded-xl w-12 h-12 sm:w-14 sm:h-14 bg-[#161618] shrink-0 border border-[#222226]">
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-108"
                      loading="lazy"
                    />
                  </div>

                  {/* Title & Artist (Multi-artist support - Requirement 1) */}
                  <div className="min-w-0 pr-2">
                    <h3 className="text-xs sm:text-sm font-semibold tracking-wide text-white group-hover:text-[#c7ff36] transition-colors truncate">
                      {album.title}
                    </h3>
                    <p className="text-xs text-[#8e8e93] truncate mt-0.5">
                      {artistRefs.length > 1 ? (
                        artistRefs.map((art, aIdx) => (
                          <span key={`${art.id}-${aIdx}`}>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectArtist) onSelectArtist(art.id, art.name);
                              }}
                              className="hover:text-[#c7ff36] hover:underline cursor-pointer transition-colors"
                            >
                              {art.name}
                            </span>
                            {aIdx < artistRefs.length - 1 && ', '}
                          </span>
                        ))
                      ) : (
                        <span
                          onClick={(e) => {
                            if (onSelectArtist && artistRefs[0]) {
                              e.stopPropagation();
                              onSelectArtist(artistRefs[0].id, artistRefs[0].name);
                            }
                          }}
                          className="hover:text-[#c7ff36] hover:underline cursor-pointer transition-colors"
                        >
                          {album.artistName}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Track Count + Rating */}
                <div className="flex items-center gap-6 sm:gap-10 shrink-0 text-right">
                  <span className="hidden md:inline-block text-[11px] font-mono tracking-wider text-[#66666f] uppercase">
                    {totalTracks} TRACCE
                  </span>

                  <span className="font-bold text-lg sm:text-xl text-[#c7ff36] tracking-tight min-w-[70px] drop-shadow-[0_0_10px_rgba(199,255,54,0.1)] group-hover:scale-105 transition-transform font-mono">
                    {formatRating(average)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
