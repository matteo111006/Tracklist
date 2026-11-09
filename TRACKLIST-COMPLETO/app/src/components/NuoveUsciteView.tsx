import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Album } from '../types';
import { isAlbumInRankings } from '../utils/musicMath';

interface NuoveUsciteViewProps {
  albums: Album[];
  onSelectAlbum: (albumId: string) => void;
  onNavigateAggiungi: () => void;
}

export const NuoveUsciteView: React.FC<NuoveUsciteViewProps> = ({
  albums,
  onSelectAlbum,
  onNavigateAggiungi,
}) => {
  const unratedAlbums = useMemo(() => {
    return albums
      .filter((a) => !isAlbumInRankings(a))
      .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  }, [albums]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl w-full"
    >
      {/* Top category label */}
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8e8e93] mb-3">
        RACCOLTA · DA ASCOLTARE
      </div>

      {/* Editorial Title (Requirement 12) */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-3">
        Album da <span className="text-[#c7ff36]">valutare</span>
      </h1>

      <p className="text-sm md:text-[15px] text-[#a3a3a3] max-w-2xl font-light mb-6 leading-relaxed">
        Gli album in attesa del tuo voto. Clicca su qualsiasi album per ascoltarlo e assegnare i voti traccia per traccia.
      </p>

      {/* Counter */}
      <div className="text-[11px] font-mono tracking-widest text-[#77777f] uppercase mb-8">
        {unratedAlbums.length} ALBUM DA VALUTARE
      </div>

      {/* Grid of Unrated Album Cards */}
      {unratedAlbums.length === 0 ? (
        <div className="py-20 text-center border border-[#1a1a1e] rounded-2xl bg-[#0e0e11] px-4">
          <p className="text-neutral-300 text-base font-medium mb-2">
            Non ci sono album in attesa di valutazione!
          </p>
          <p className="text-[#77777f] text-xs max-w-md mx-auto mb-6">
            Tutti gli album presenti nel tuo archivio sono già stati valutati o non hai ancora aggiunto nuovi dischi.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNavigateAggiungi}
            className="px-5 py-2.5 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider hover:brightness-110 transition-all cursor-pointer shadow-[0_0_15px_rgba(199,255,54,0.2)]"
          >
            AGGIUNGI UN ALBUM
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {unratedAlbums.map((album, idx) => {
            return (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: (idx % 6) * 0.04, duration: 0.32 }}
                whileHover={{ y: -4, borderColor: '#3a3a46', backgroundColor: '#131318' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectAlbum(album.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectAlbum(album.id);
                  }
                }}
                className="group bg-[#0f0f12] border border-[#1e1e23] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-lg select-none hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] focus:outline-none focus:ring-2 focus:ring-[#c7ff36]"
              >
                <div>
                  {/* Album Cover */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden mb-4 border border-[#25252c] bg-[#16161a]">
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>

                  {/* Title & Artist */}
                  <h3 className="text-sm sm:text-[15px] font-semibold text-white tracking-wide uppercase group-hover:text-[#c7ff36] transition-colors truncate">
                    {album.title}
                  </h3>
                  <p className="text-xs text-[#8e8e93] truncate mt-1">
                    {album.artistName}
                  </p>
                </div>

                {/* Bottom Row (Requirement 7: clean interactive footer without 'Valuta' button) */}
                <div className="mt-6 pt-3.5 border-t border-[#1a1a1e] flex items-center justify-between text-xs">
                  <span className="font-mono text-[#66666f] text-[11px] uppercase tracking-wider">
                    {album.releaseDateFormatted || album.releaseDate}
                  </span>

                  <span className="font-mono text-[11px] text-[#77777f] group-hover:text-[#c7ff36] transition-colors">
                    {album.tracks.length} tracce
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
