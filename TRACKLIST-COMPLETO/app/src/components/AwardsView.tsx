import { useViewMemory } from '../hooks/useViewMemory';
import { ExtraAwards } from './InsightsPanels';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Trophy, Crown, Music, Users, Sparkles, Flame, Star, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Album, Artist } from '../types';
import { calculateYearAwards, formatRating } from '../utils/musicMath';
import { ArtistAvatar } from './ArtistAvatar';

interface AwardsViewProps {
  albums: Album[];
  artists?: Artist[];
  onSelectAlbum: (albumId: string) => void;
  onSelectArtist?: (artistId: string, artistName: string) => void;
}

export const AwardsView: React.FC<AwardsViewProps> = ({
  albums,
  artists = [],
  onSelectAlbum,
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

  const reducedMotion = useReducedMotion();
  const [selectedYear, setSelectedYear] = useViewMemory<number>('awards.year', 2026);
  const [awardTab, setAwardTab] = useViewMemory<'album' | 'artists' | 'special'>('awards.tab', 'album');

  const awards = useMemo(() => {
    return calculateYearAwards(albums, selectedYear, artists);
  }, [albums, selectedYear, artists]);
  const summaryStats = awardTab === 'artists' ? awards.artistStats : awards.stats;

  // Lookup artist avatar photo by name
  const getArtistPhoto = (name: string): string => {
    const found = artists.find(
      (a) => a.name.toLowerCase() === name.toLowerCase() || a.id.toLowerCase() === name.toLowerCase()
    );
    return (
      found?.imageUrl ||
      `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop`
    );
  };

  const getArtistId = (name: string): string => {
    const found = artists.find((a) => a.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : `art-${name.toLowerCase().replace(/\s+/g, '-')}`;
  };

  // Subtle confetti canvas animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = 420);

    const particles: {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      rotation: number;
      color: string;
      opacity: number;
    }[] = [];

    const colors = ['#c7ff36', '#dfff66', '#a3e635', '#eab308', '#ca8a04', '#4d7c0f'];

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 5 + 3,
        speedY: Math.random() * 0.7 + 0.3,
        speedX: (Math.random() - 0.5) * 0.5,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: Math.random() * 0.6 + 0.25,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += 1;

        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [selectedYear, reducedMotion]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="relative max-w-6xl w-full"
    >
      {/* Background Floating Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute top-0 left-0 w-full h-[450px] z-0 opacity-60"
      />

      <div className="relative z-10">
        {/* Label */}
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8e8e93] mb-3">
          PREMI STAGIONALI
        </div>

        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-2">
              Gli <span className="text-[#c7ff36]">Awards</span>
            </h1>
            <p className="text-sm md:text-[15px] text-[#a3a3a3] max-w-2xl font-light leading-relaxed">
              I migliori album, brani e artisti dell'anno, calcolati oggettivamente dai tuoi voti traccia per traccia.
            </p>
          </div>

          {/* Year Pills */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {availableYears.map((yr) => {
              const isActive = yr === selectedYear;
              return (
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#c7ff36] text-black shadow-[0_0_15px_rgba(199,255,54,0.3)] font-bold'
                      : 'bg-[#151518] text-[#8e8e93] hover:text-white border border-[#232328]'
                  }`}
                >
                  {yr}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Category Tabs: Album & Brani vs Artisti (Requirement 5) */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#1c1c22] pb-4 mb-8">
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={() => setAwardTab('album')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              awardTab === 'album'
                ? 'bg-[#18230f] border border-[#2c4014] text-[#c7ff36] shadow-[0_0_15px_rgba(199,255,54,0.15)]'
                : 'text-[#8e8e93] hover:text-white hover:bg-[#121216]'
            }`}
          >
            <Trophy size={14} />
            <span>Awards Album & Brani</span>
          </motion.button>

          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={() => setAwardTab('artists')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              awardTab === 'artists'
                ? 'bg-[#18230f] border border-[#2c4014] text-[#c7ff36] shadow-[0_0_15px_rgba(199,255,54,0.15)]'
                : 'text-[#8e8e93] hover:text-white hover:bg-[#121216]'
            }`}
          >
            <Users size={14} />
            <span>Awards Artisti ({selectedYear})</span>
          </motion.button>
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: .97 }} onClick={() => setAwardTab('special')} aria-pressed={awardTab === 'special'} className={awardTab === 'special' ? 'rounded-xl border border-[#6e5730] bg-[#282011] px-5 py-2.5 text-xs font-semibold uppercase text-[#edc878]' : 'rounded-xl border border-transparent px-5 py-2.5 text-xs font-semibold uppercase text-[#9e947d] hover:text-[#edc878]'}>Premi speciali</motion.button>
        </div>

        {/* Year Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 pb-6 border-b border-[#1c1c20] mb-10 max-w-2xl">
          <div>
            <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
              ALBUM VALUTATI
            </div>
            <div className="font-editorial text-3xl sm:text-4xl text-white">
              {summaryStats.totalAlbums}
            </div>
          </div>

          <div>
            <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
              ARTISTI UNICI
            </div>
            <div className="font-editorial text-3xl sm:text-4xl text-white">
              {summaryStats.uniqueArtists}
            </div>
          </div>

          <div>
            <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
              BRANI VOTATI
            </div>
            <div className="font-editorial text-3xl sm:text-4xl text-white">
              {summaryStats.totalTracksRated}
            </div>
          </div>

          <div>
            <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
              MEDIA ANNUALE
            </div>
            <div className="font-editorial text-3xl sm:text-4xl text-[#c7ff36]">
              {formatRating(summaryStats.averageAlbumRating, 2)}
            </div>
          </div>
        </div>

        {/* TAB 1: ALBUM & BRANI AWARDS */}
        {awardTab === 'special' && <ExtraAwards key={'special-' + selectedYear} albums={albums} artists={artists} year={selectedYear} onSelectAlbum={onSelectAlbum} onSelectArtist={onSelectArtist} />}
        {awardTab === 'album' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`tab-album-${selectedYear}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {/* Requirement 8: Clear Standard Editions Only Badge */}
              <div className="flex items-center gap-2 mb-4 px-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141418] border border-[#26262e] text-[11px] font-mono text-[#a3a3a3]">
                  <ShieldCheck size={13} className="text-[#c7ff36]" />
                  <span>Solo edizioni standard ammesse al titolo di Album dell'Anno (deluxe e repack escluse)</span>
                </span>
              </div>

              {/* ALBUM DELL'ANNO SECTION */}
              <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 mb-12 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-[11px] font-semibold text-[#c7ff36] tracking-[0.2em] uppercase">
                    ALBUM DELL'ANNO · {selectedYear}
                  </div>
                  <span className="text-[10px] font-mono uppercase text-[#77777f] border border-[#222228] px-2.5 py-0.5 rounded-full">
                    EDIZIONE STANDARD
                  </span>
                </div>

                {awards.bestAlbum ? (
                  <div>
                    {/* Winner Big Card */}
                    <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8 mb-8 pb-8 border-b border-[#18181c]">
                      {/* Winner Artwork with Trophy Badge */}
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        onClick={() => onSelectAlbum(awards.bestAlbum!.album.id)}
                        className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shrink-0 bg-[#161619] border border-[#2b2b34] shadow-2xl cursor-pointer"
                      >
                        <img
                          src={awards.bestAlbum.album.coverUrl}
                          alt={awards.bestAlbum.album.title}
                          className="w-full h-full object-cover"
                        />
                        {/* Floating Pulse Trophy Badge */}
                        <motion.div
                          animate={{ scale: [1, 1.08, 1] }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#c7ff36] text-black flex items-center justify-center shadow-[0_0_15px_rgba(199,255,54,0.4)]"
                        >
                          <Trophy size={16} strokeWidth={2.5} />
                        </motion.div>
                      </motion.div>

                      {/* Winner Details */}
                      <div className="flex-1 min-w-0">
                        <h2
                          onClick={() => onSelectAlbum(awards.bestAlbum!.album.id)}
                          className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-white uppercase tracking-tight hover:text-[#c7ff36] transition-colors cursor-pointer"
                        >
                          {awards.bestAlbum.album.title}
                        </h2>

                        <div className="text-sm sm:text-base text-[#8e8e93] font-medium mt-1">
                          {awards.bestAlbum.album.artistName}
                        </div>

                        <div className="flex items-baseline gap-3 mt-4">
                          <div className="font-editorial text-4xl sm:text-5xl text-[#c7ff36] drop-shadow-[0_0_15px_rgba(199,255,54,0.25)]">
                            {formatRating(awards.bestAlbum.average)}
                          </div>
                          <div className="text-xs text-[#77777f] font-mono uppercase tracking-wider">
                            VOTO MEDIO
                          </div>
                        </div>

                        <div className="text-[11px] font-mono tracking-wider text-[#66666f] uppercase mt-2">
                          {awards.bestAlbum.album.label || 'INDIPENDENTE'} ·{' '}
                          {awards.bestAlbum.album.tracks.length} TRACCE
                        </div>
                      </div>
                    </div>

                    {/* TOP 10 ALBUMS OF THE YEAR */}
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-4">
                        <Crown size={14} className="text-[#c7ff36]" />
                        <span>TOP 10 ALBUM STANDARD DELL'ANNO</span>
                      </div>

                      <div className="divide-y divide-[#17171b]">
                        {awards.top10Albums.slice(1).map((item, idx) => {
                          const rank = idx + 2;
                          return (
                            <motion.div
                              key={item.album.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              whileHover={{ x: 4, backgroundColor: '#121216' }}
                              onClick={() => onSelectAlbum(item.album.id)}
                              className="py-3 px-2 flex items-center justify-between rounded-lg transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <span className="font-mono text-xs text-[#55555c] w-5 text-center group-hover:text-[#c7ff36]">
                                  {rank}
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
                                  <p className="text-xs text-[#77777f] truncate">
                                    {item.album.artistName}
                                  </p>
                                </div>
                              </div>

                              <div className="font-editorial text-sm sm:text-base text-[#e0e0dc] font-medium">
                                {formatRating(item.average, 3)}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#66666f] italic">
                    Nessun album standard valutato per l'anno {selectedYear}.
                  </p>
                )}
              </div>

              {/* BRANI DELL'ANNO SECTION */}
              <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 mb-12 shadow-2xl">
                <div className="text-[11px] font-semibold text-[#c7ff36] tracking-[0.2em] uppercase mb-6">
                  BRANI DELL'ANNO · {selectedYear}
                </div>

                {awards.songAward.winningScore !== null ? (
                  <div>
                    {/* Row of Winning Tied Covers */}
                    <div className="flex flex-wrap items-start gap-5 sm:gap-6 mb-6">
                      {awards.songAward.tiedWinners.map((song, idx) => (
                        <div
                          key={idx}
                          className="w-24 sm:w-28 flex flex-col items-start cursor-pointer group"
                        >
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover bg-[#161619] border border-[#26262e] mb-2 shadow-lg group-hover:scale-105 transition-transform"
                          />
                          <div className="text-[11px] font-semibold text-white uppercase tracking-wide truncate w-full group-hover:text-[#c7ff36]">
                            {song.title}
                          </div>
                          <div className="text-[10px] text-[#77777f] uppercase truncate w-full">
                            {song.albumTitle}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Big Score Readout */}
                    <div className="flex items-baseline gap-3 mb-8 pb-8 border-b border-[#18181c]">
                      <div className="font-editorial text-4xl sm:text-5xl text-[#c7ff36] drop-shadow-[0_0_15px_rgba(199,255,54,0.25)]">
                        {formatRating(awards.songAward.winningScore, 2)}
                      </div>
                      <div className="text-xs text-[#77777f] font-mono uppercase tracking-wider">
                        {awards.songAward.tiedCount} BRANI A PARI MERITO
                      </div>
                    </div>

                    {/* TOP 10 SONGS */}
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-4">
                        <Music size={14} className="text-[#c7ff36]" />
                        <span>TOP 10 BRANI</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        {awards.songAward.topSongs.map((song, idx) => (
                          <div
                            key={idx}
                            className="py-2.5 px-2 flex items-center justify-between rounded-lg transition-colors hover:bg-[#121216]"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <span className="font-mono text-xs text-[#55555c] w-5 text-center shrink-0">
                                {song.isTie ? '=' : song.rank}
                              </span>
                              <img
                                src={song.coverUrl}
                                alt={song.title}
                                className="w-9 h-9 rounded-lg object-cover bg-[#161619] shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-white uppercase tracking-wide truncate">
                                  {song.title}
                                </h4>
                                <p className="text-[11px] text-[#77777f] truncate">
                                  {song.artist} · {song.albumTitle}
                                </p>
                              </div>
                            </div>

                            <div className="font-mono text-xs font-semibold text-white shrink-0 ml-2">
                              {formatRating(song.rating, 2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#66666f] italic">
                    Nessun brano valutato per l'anno {selectedYear}.
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* TAB 2: ARTIST AWARDS (Requirement 5) */}
        {awardTab === 'artists' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`tab-artist-${selectedYear}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-10 mb-14"
            >
              <p className="text-xs text-[#a3a3a3] flex items-center gap-2"><ShieldCheck size={15} className="shrink-0 text-[#c7ff36]" />Tutti gli Awards Artisti considerano solo edizioni standard e deluxe confermate. Remaster e versioni modificate sono escluse, anche dallo storico dell’artista rivelazione. A parità di punteggio, tutti i vincitori sono premiati ex aequo.</p>
              {/* HERO: MIGLIOR ARTISTA DELL'ANNO */}
              {awards.artistAwards.bestArtistsOfYear.length > 0 ? (
                <section aria-label="Vincitori miglior artista dell’anno" className="bg-gradient-to-br from-[#131d0a] to-[#0a0a0c] border border-[#2b3e15] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#c7ff36] uppercase mb-6">
                    <Crown size={16} />
                    <span>MIGLIOR ARTISTA DELL'ANNO · {selectedYear}{awards.artistAwards.bestArtistsOfYear.length > 1 ? ' · EX AEQUO' : ''}</span>
                  </div>

                  <div className={`grid gap-8 ${awards.artistAwards.bestArtistsOfYear.length > 1 ? 'xl:grid-cols-2' : ''}`}>
                  {awards.artistAwards.bestArtistsOfYear.map(winner => (
                  <div key={winner.artistName} className="flex flex-col sm:flex-row items-center sm:items-start gap-6 min-w-0">
                    {/* Big Circular Photo */}
                    <div
                      onClick={() =>
                        onSelectArtist &&
                        onSelectArtist(
                          getArtistId(winner.artistName),
                          winner.artistName
                        )
                      }
                      className="cursor-pointer group shrink-0"
                    >
                      <ArtistAvatar
                        imageUrl={getArtistPhoto(winner.artistName)}
                        name={winner.artistName}
                        size="2xl"
                        className="border-2 border-[#c7ff36] shadow-[0_0_30px_rgba(199,255,54,0.3)] group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <h2
                        onClick={() =>
                          onSelectArtist &&
                          onSelectArtist(
                            getArtistId(winner.artistName),
                            winner.artistName
                          )
                        }
                        className="font-editorial text-3xl sm:text-4xl font-normal text-white tracking-tight hover:text-[#c7ff36] transition-colors cursor-pointer break-words"
                      >
                        {winner.artistName}
                      </h2>

                      <p className="text-xs sm:text-sm text-[#8e8e93] font-light mt-1">
                        Vincitore del titolo per consistenza qualitativa e gradimento generale nel {selectedYear}.
                      </p>

                      <div className="grid grid-cols-2 gap-4 pt-5 mt-5 border-t border-white/10 max-w-xs">
                        <div>
                          <div className="text-[10px] font-mono text-[#8e8e93] uppercase">MEDIA VOTO</div>
                          <div className="font-editorial text-3xl text-[#c7ff36]">
                            {formatRating(winner.score)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-mono text-[#8e8e93] uppercase">ALBUM</div>
                          <div className="font-editorial text-3xl text-white">
                            {winner.albumCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  ))}
                  </div>
                </section>
              ) : (
                <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-8 text-center text-xs text-[#77777f]">
                  Nessun artista ha soddisfatto i criteri per l'anno {selectedYear}.
                </div>
              )}

              {/* GRID OF SPECIAL CATEGORIES */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. MIGLIOR COLLABORAZIONE */}
                <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-4">
                      <Sparkles size={14} />
                      <span>MIGLIOR COLLABORAZIONE{awards.artistAwards.bestCollaborations.length > 1 ? ' · EX AEQUO' : ''}</span>
                    </div>

                    {awards.artistAwards.bestCollaborations.length > 0 ? awards.artistAwards.bestCollaborations.map(winner => (
                      <div key={winner.albumId}>
                        <div
                          onClick={() => onSelectAlbum(winner.albumId)}
                          className="flex items-center gap-4 mb-4 cursor-pointer group"
                        >
                          <img
                            src={winner.coverUrl}
                            alt={winner.albumTitle}
                            className="w-16 h-16 rounded-xl object-cover bg-[#161619] shrink-0 border border-[#25252c]"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white uppercase truncate group-hover:text-[#c7ff36] transition-colors">
                              {winner.albumTitle}
                            </h4>
                            <p className="text-xs text-[#8e8e93] truncate">
                              {winner.artists}
                            </p>
                            <div className="font-editorial text-2xl text-[#c7ff36] mt-1">
                              {formatRating(winner.average)}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#77777f] font-light">
                          Album congiunto o collaborativo con il voto medio più elevato nel {selectedYear}.
                        </p>
                      </div>
                    )) : (
                      <p className="text-xs text-[#66666f] italic">Nessun joint album valutato nel {selectedYear}.</p>
                    )}
                  </div>
                </div>

                {/* 2. ARTISTA PIÙ VALUTATO (Volume) */}
                <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-4">
                      <Flame size={14} />
                      <span>ARTISTA PIÙ VALUTATO{awards.artistAwards.mostEvaluatedArtists.length > 1 ? ' · EX AEQUO' : ''}</span>
                    </div>

                    {awards.artistAwards.mostEvaluatedArtists.length > 0 ? awards.artistAwards.mostEvaluatedArtists.map(winner => (
                      <div key={winner.artistName}>
                        <div
                          onClick={() =>
                            onSelectArtist &&
                            onSelectArtist(
                              getArtistId(winner.artistName),
                              winner.artistName
                            )
                          }
                          className="flex items-center gap-4 mb-4 cursor-pointer group"
                        >
                          <ArtistAvatar
                            imageUrl={getArtistPhoto(winner.artistName)}
                            name={winner.artistName}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate group-hover:text-[#c7ff36] transition-colors">
                              {winner.artistName}
                            </h4>
                            <div className="text-xs text-[#8e8e93] font-mono mt-0.5">
                              {winner.detail}
                            </div>
                            <div className="font-editorial text-2xl text-[#c7ff36] mt-1">
                              {winner.score} tracce
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#77777f] font-light">
                          L'artista con il maggior numero di tracce valutate nel tuo archivio.
                        </p>
                      </div>
                    )) : (
                      <p className="text-xs text-[#66666f] italic">Nessun dato sufficiente.</p>
                    )}
                  </div>
                </div>

                {/* 3. ARTISTA RIVELAZIONE / PIÙ ATTIVO */}
                <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-4">
                      <Star size={14} />
                      <span>ARTISTA RIVELAZIONE{awards.artistAwards.breakoutArtists.length > 1 ? ' · EX AEQUO' : ''}</span>
                    </div>

                    {awards.artistAwards.breakoutArtists.length > 0 ? awards.artistAwards.breakoutArtists.map(winner => (
                      <div key={winner.artistName}>
                        <div
                          onClick={() =>
                            onSelectArtist &&
                            onSelectArtist(
                              getArtistId(winner.artistName),
                              winner.artistName
                            )
                          }
                          className="flex items-center gap-4 mb-4 cursor-pointer group"
                        >
                          <ArtistAvatar
                            imageUrl={getArtistPhoto(winner.artistName)}
                            name={winner.artistName}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white truncate group-hover:text-[#c7ff36] transition-colors">
                              {winner.artistName}
                            </h4>
                            <div className="text-xs text-[#8e8e93] font-mono mt-0.5">
                              {winner.detail}
                            </div>
                            <div className="font-editorial text-2xl text-[#c7ff36] mt-1">
                              {formatRating(winner.score)}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#77777f] font-light">
                          Debutto d'eccellenza con impatto qualitativo elevato registrato nel {selectedYear}.
                        </p>
                      </div>
                    )) : (
                      <p className="text-xs text-[#66666f] italic">Nessun dato disponibile.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* TOP ARTISTI RANKING TABLE */}
              {awards.artistAwards.topArtists.length > 0 && (
                <div data-motion-panel className="bg-[#0d0d10] border border-[#1d1d22] rounded-3xl p-6 sm:p-8 shadow-xl">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#77777f] uppercase mb-6">
                    <Crown size={14} className="text-[#c7ff36]" />
                    <span>CLASSIFICA TOP ARTISTI · {selectedYear}</span>
                  </div>

                  <div className="divide-y divide-[#17171b]">
                    {awards.artistAwards.topArtists.map((artist) => (
                      <div
                        key={artist.artistName}
                        onClick={() =>
                          onSelectArtist &&
                          onSelectArtist(getArtistId(artist.artistName), artist.artistName)
                        }
                        className="py-3 px-2 flex items-center justify-between rounded-xl hover:bg-[#121216] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="font-mono text-xs text-[#55555c] w-5 text-center group-hover:text-[#c7ff36]">
                            {artist.rank}
                          </span>
                          <ArtistAvatar
                            imageUrl={getArtistPhoto(artist.artistName)}
                            name={artist.artistName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                              {artist.artistName}
                            </h4>
                            <p className="text-xs text-[#77777f] truncate">
                              {artist.detail}
                            </p>
                          </div>
                        </div>

                        <div className="font-editorial text-base sm:text-lg text-[#c7ff36] font-medium">
                          {formatRating(artist.score, 3)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};
