import { AnimatedMetric } from './AnimatedMetric';
import { useSaveAndClose } from '../hooks/useSaveAndClose';
import React, { useState, useMemo } from 'react';
import { User, LogOut, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, AuthUser, UserProfile } from '../types';
import { calculateAlbumStats, formatRating, isAlbumEvaluated } from '../utils/musicMath';
import { ImageUploadInput } from './ImageUploadInput';
import { Cloud, CloudCheck, LogIn } from 'lucide-react';

interface ProfiloViewProps {
  appearance: 'original' | 'light' | 'glass';
  onAppearanceChange: (value: 'original' | 'light' | 'glass') => void;
  profile: UserProfile;
  albums: Album[];
  authUser?: AuthUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onSaveProfile: (updated: UserProfile) => void;
  onSelectAlbum: (albumId: string) => void;
  onSelectArtist: (artistId: string, artistName: string) => void;
  onResetData: () => void;
}

export const ProfiloView: React.FC<ProfiloViewProps> = ({
  appearance,
  onAppearanceChange,
  profile,
  albums,
  authUser,
  onOpenAuth,
  onLogout,
  onSaveProfile,
  onSelectAlbum,
  onSelectArtist,
  onResetData,
}) => {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const { saveAndClose, saveError, isSaving, clearSaveError } = useSaveAndClose();

  // Dynamic statistics
  const { totalAlbums, ratedAlbums, unratedAlbums, overallAverage, totalTracksVoted } =
    useMemo(() => {
      const total = albums.length;
      const evaluated = albums.filter((a) => isAlbumEvaluated(a));
      const unrated = total - evaluated.length;

      let sumAverages = 0;
      let totalVotedTracks = 0;

      evaluated.forEach((a) => {
        const stats = calculateAlbumStats(a.tracks);
        if (stats.averageRating !== null) {
          sumAverages += stats.averageRating;
        }
        totalVotedTracks += stats.ratedCount;
      });

      return {
        totalAlbums: total,
        ratedAlbums: evaluated.length,
        unratedAlbums: unrated,
        overallAverage: evaluated.length > 0 ? sumAverages / evaluated.length : null,
        totalTracksVoted: totalVotedTracks,
      };
    }, [albums]);

  // I TUOI VOTI PIÙ ALTI
  const topRatedAlbums = useMemo(() => {
    return albums
      .filter((a) => isAlbumEvaluated(a))
      .map((album) => {
        const stats = calculateAlbumStats(album.tracks);
        return {
          album,
          average: stats.averageRating || 0,
        };
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 5);
  }, [albums]);

  // ARTISTI PIÙ PRESENTI
  const topArtists = useMemo(() => {
    const map = new Map<
      string,
      {
        artistName: string;
        albumsCount: number;
        ratingsSum: number;
        ratingsCount: number;
      }
    >();

    albums.forEach((alb) => {
      const existing = map.get(alb.artistName) || {
        artistName: alb.artistName,
        albumsCount: 0,
        ratingsSum: 0,
        ratingsCount: 0,
      };

      existing.albumsCount++;

      alb.tracks.forEach((t) => {
        if (t.rating !== null) {
          existing.ratingsSum += t.rating;
          existing.ratingsCount++;
        }
      });

      map.set(alb.artistName, existing);
    });

    return Array.from(map.values())
      .map((item) => ({
        artistName: item.artistName,
        albumsCount: item.albumsCount,
        average: item.ratingsCount > 0 ? item.ratingsSum / item.ratingsCount : null,
      }))
      .sort((a, b) => b.albumsCount - a.albumsCount)
      .slice(0, 5);
  }, [albums]);

  const [isEditing, setIsEditing] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    return saveAndClose(() => {
      onSaveProfile({
        ...profile,
        name: name.trim() || profile.name,
        email: email.trim() || profile.email,
        avatarUrl: avatarUrl.trim(),
      });
    }, () => { setSavedSuccess(true); setIsEditing(false); });
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
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8e8e93] mb-3">
        <User size={13} className="text-[#8e8e93]" />
        <span>PROFILO</span>
      </div>

      {/* User Header with Avatar & Name */}
      <div className="flex items-center gap-5 sm:gap-6 mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 bg-[#161619] border-2 border-[#2b2b35] flex items-center justify-center shadow-lg">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-editorial text-2xl sm:text-3xl text-[#c7ff36]">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal font-editorial tracking-tight text-white mb-0.5">
            {profile.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#77777f] font-mono tracking-wider">
            {profile.email}
          </p>
        </div>
      </div>

      <section aria-labelledby="appearance-title" className="bg-[#121215] border border-[#29292f] rounded-3xl p-5 sm:p-6 mb-8">
        <h2 id="appearance-title" className="text-xl text-white mb-1">Aspetto del sito</h2>
        <p className="text-sm text-[#8e8e93] mb-5">Scegli il tuo stile. Si applica subito e viene ricordato su questo browser.</p>
        <div role="group" aria-label="Scegli lo stile del sito" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([{ id: 'original', name: 'Nero', description: 'Lo stile originale, scuro ed essenziale.' }, { id: 'light', name: 'Bianco', description: 'Superfici chiare e testo ad alto contrasto.' }, { id: 'glass', name: 'Glass', description: 'Vetro traslucido e colori della copertina.' }] as const).map(theme => (
            <button key={theme.id} type="button" aria-pressed={appearance === theme.id} onClick={() => onAppearanceChange(theme.id)} className={`appearance-option rounded-2xl border p-4 text-left ${appearance === theme.id ? 'border-[#c7ff36]' : 'border-[#29292f]'}`}>
              <span aria-hidden="true" className={`appearance-preview appearance-preview-${theme.id}`}><span /><span /><span /></span>
              <span className="flex justify-between items-center text-white text-base mt-3">{theme.name}{appearance === theme.id && <Check size={17} className="text-[#c7ff36]" />}</span>
              <span className="block text-xs text-[#8e8e93] mt-1">{theme.description}</span>
            </button>
          ))}
        </div>
      </section>
      {/* Cloud Account Status Banner (Requirement 11 & 13) */}
      {authUser ? (
        <div className="bg-[#10190c] border border-[#233816] rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#1c2c11] border border-[#304d1e] flex items-center justify-center text-[#c7ff36]">
              <Cloud size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Account connesso · stato del salvataggio in basso</span>
                <span className="w-2 h-2 rounded-full bg-[#c7ff36] animate-pulse" />
              </div>
              <p className="text-xs text-[#8e8e93] font-mono mt-0.5">
                Connesso come <span className="text-white">{authUser.email}</span>
              </p>
            </div>
          </div>
          {onLogout && (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-[#17171e] border border-[#2b2b36] hover:border-red-800 text-xs text-[#a3a3a8] hover:text-red-400 font-medium transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
            >
              <LogOut size={13} />
              <span>Disconnetti account</span>
            </motion.button>
          )}
        </div>
      ) : (
        <div className="bg-[#121216] border border-[#23232c] rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#18181f] border border-[#282833] flex items-center justify-center text-[#c7ff36]">
              <Cloud size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Archivio Locale (Non sincronizzato)</div>
              <p className="text-xs text-[#8e8e93] mt-0.5">
                Accedi o crea un account per sincronizzare voti e recensioni su tutti i tuoi dispositivi.
              </p>
            </div>
          </div>
          {onOpenAuth && (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-[#c7ff36] text-black text-xs font-semibold tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer self-start sm:self-auto flex items-center gap-1.5 shadow-sm"
            >
              <LogIn size={13} />
              <span>Accedi / Registrati</span>
            </motion.button>
          )}
        </div>
      )}

      {/* Credentials Edit Box */}
      {!isEditing && <div className="mb-8 flex items-center gap-4">
        {savedSuccess && <p role="status" className="text-sm text-[#c7ff36]">Profilo salvato</p>}
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} className="rounded-xl border border-[#33333a] px-5 py-2 text-sm text-white" onClick={() => { setName(profile.name); setEmail(profile.email); setAvatarUrl(profile.avatarUrl || ''); clearSaveError(); setSavedSuccess(false); setIsEditing(true); }}>Modifica profilo</motion.button>
      </div>}
      {isEditing && <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0f0f12] border border-[#1e1e23] rounded-3xl p-6 sm:p-8 mb-10 shadow-xl"
      >
        <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} aria-label="Modifica profilo" onSubmit={handleSubmit} className="space-y-6">
          {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
                NOME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#161619] border border-[#26262c] focus:border-[#c7ff36] rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#161619] border border-[#26262c] focus:border-[#c7ff36] rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          <ImageUploadInput
            label="FOTO PROFILO / AVATAR (URL O FILE LOCALE)"
            value={avatarUrl}
            onChange={setAvatarUrl}
            placeholder="https://... o carica dal tuo dispositivo"
          />

          <div className="flex items-center gap-4 pt-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
                    disabled={isSaving}
              className="px-6 py-2.5 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer shadow-[0_0_15px_rgba(199,255,54,0.2)] flex items-center gap-1.5"
            >
              {savedSuccess ? <Check size={14} /> : null}
              <span>{isSaving ? 'Salvataggio…' : 'Salva'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onResetData}
              title="Reimposta catalogo ai dati di fabbrica"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#2a2a30] text-xs font-semibold tracking-wider text-[#8e8e93] hover:text-white hover:border-[#44444e] transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Esci / Reset Archivio</span>
            </motion.button>
          </div>
        </motion.form>
      </motion.div>}

      {/* 5 Personal Stat Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 pb-6 border-b border-[#1c1c20] mb-10">
        <div>
          <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
            ALBUM
          </div>
          <div className="font-editorial text-3xl sm:text-4xl text-white"><AnimatedMetric value={totalAlbums} /></div>
        </div>

        <div>
          <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
            VALUTATI
          </div>
          <div className="font-editorial text-3xl sm:text-4xl text-white"><AnimatedMetric value={ratedAlbums} /></div>
        </div>

        <div>
          <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
            DA VALUTARE
          </div>
          <div className="font-editorial text-3xl sm:text-4xl text-white"><AnimatedMetric value={unratedAlbums} /></div>
        </div>

        <div>
          <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
            MEDIA
          </div>
          <div className="font-editorial text-3xl sm:text-4xl text-[#c7ff36]">
            <AnimatedMetric value={overallAverage} rating />
          </div>
        </div>

        <div>
          <div className="text-[10px] tracking-widest font-semibold text-[#77777f] uppercase mb-1">
            TRACCE VOTATE
          </div>
          <div className="font-editorial text-3xl sm:text-4xl text-white">
            <AnimatedMetric value={totalTracksVoted} />
          </div>
        </div>
      </div>

      {/* Two Cards: I TUOI VOTI PIÙ ALTI & ARTISTI PIÙ PRESENTI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* I TUOI VOTI PIÙ ALTI */}
        <div data-motion-panel className="bg-[#0d0d10] border border-[#1e1e23] rounded-3xl p-6 shadow-xl">
          <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-5">
            I TUOI VOTI PIÙ ALTI
          </div>

          <div className="divide-y divide-[#17171b]">
            {topRatedAlbums.map((item, idx) => (
              <motion.div
                key={item.album.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ x: 4, backgroundColor: '#121216' }}
                onClick={() => onSelectAlbum(item.album.id)}
                className="py-3 px-2 flex items-center justify-between rounded-xl transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="font-mono text-xs text-[#55555c] w-4 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <img
                    src={item.album.coverUrl}
                    alt={item.album.title}
                    className="w-11 h-11 rounded-lg object-cover bg-[#161619] shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                      {item.album.title}
                    </h4>
                    <p className="text-xs text-[#77777f] truncate">{item.album.artistName}</p>
                  </div>
                </div>

                <div className="font-editorial text-sm sm:text-base text-white font-medium shrink-0 ml-2">
                  {formatRating(item.average)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ARTISTI PIÙ PRESENTI */}
        <div data-motion-panel className="bg-[#0d0d10] border border-[#1e1e23] rounded-3xl p-6 shadow-xl">
          <div className="text-[11px] font-semibold tracking-widest text-[#c7ff36] uppercase mb-5">
            ARTISTI PIÙ PRESENTI
          </div>

          <div className="divide-y divide-[#17171b]">
            {topArtists.map((artist, idx) => (
              <motion.div
                key={artist.artistName}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ x: 4, backgroundColor: '#121216' }}
                onClick={() => onSelectArtist(artist.artistName, artist.artistName)}
                className="py-3.5 px-2 flex items-center justify-between rounded-xl transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="font-mono text-xs text-[#55555c] w-4 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-white tracking-wide group-hover:text-[#c7ff36] transition-colors truncate">
                      {artist.artistName}
                    </h4>
                    <p className="text-[11px] text-[#77777f] font-mono mt-0.5">
                      {artist.albumsCount} {artist.albumsCount === 1 ? 'album' : 'album'}
                    </p>
                  </div>
                </div>

                <div className="font-mono text-xs font-semibold text-white shrink-0 ml-2">
                  {formatRating(artist.average, 2)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
