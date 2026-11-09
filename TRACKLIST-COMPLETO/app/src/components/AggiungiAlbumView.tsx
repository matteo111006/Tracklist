import { motion } from 'motion/react';
import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Plus, Loader2, Music2 } from 'lucide-react';
import { Album, EditionType, Track } from '../types';
import { searchMusicOnline, fetchAlbumTracks, SearchResultAlbum } from '../services/musicSearch';
import { ImageUploadInput } from './ImageUploadInput';
import { cleanRecordLabel } from '../utils/labelCleaner';
import { storage } from '../services/storage';

interface AggiungiAlbumViewProps {
  onBack: () => void;
  onSaveAlbum: (album: Album) => void;
}

export const AggiungiAlbumView: React.FC<AggiungiAlbumViewProps> = ({
  onBack,
  onSaveAlbum,
}) => {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  // Manual Form States
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [releaseDate, setReleaseDate] = useState('2026-04-10');
  const [editionType, setEditionType] = useState<EditionType>('standard');
  const [label, setLabel] = useState('');
  const [genres, setGenres] = useState('Rap/Hip Hop');
  const [coverUrl, setCoverUrl] = useState('');
  const [tracklistRaw, setTracklistRaw] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Smart Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultAlbum[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [personalizeSearch, setPersonalizeSearch] = useState(true);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Inserisci il titolo dell\'album.');
      return;
    }
    if (!artistName.trim()) {
      setErrorMsg('Inserisci almeno un artista.');
      return;
    }

    const albumId = `alb-${Date.now()}`;
    const year = releaseDate ? new Date(releaseDate).getFullYear() || 2026 : 2026;

    // Parse tracklist lines
    const trackLines = tracklistRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const tracks: Track[] =
      trackLines.length > 0
        ? trackLines.map((line, idx) => {
            // Line format e.g. "LA VITA - Artista, Featuring" or simply "INTRO"
            const parts = line.split('-');
            const trackTitle = parts[0]?.trim() || `Traccia ${idx + 1}`;
            const trackArtists = parts[1]?.trim() || artistName;
            return {
              id: `tr-${albumId}-${idx + 1}`,
              albumId,
              trackNumber: idx + 1,
              title: trackTitle.toUpperCase(),
              artists: trackArtists,
              rating: null,
            };
          })
        : [
            {
              id: `tr-${albumId}-1`,
              albumId,
              trackNumber: 1,
              title: 'TRACCIA 1',
              artists: artistName,
              rating: null,
            },
          ];

    // Format date in Italian (e.g. 10 APR 2026)
    const formattedDate = new Date(releaseDate).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).toUpperCase();

    const newAlbum: Album = {
      id: albumId,
      title: title.trim().toUpperCase(),
      artistId: `art-${artistName.toLowerCase().replace(/\s+/g, '-')}`,
      artistName: artistName.trim(),
      releaseDate,
      releaseDateFormatted: formattedDate,
      year,
      coverUrl:
        coverUrl.trim() ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop',
      label: cleanRecordLabel(label) || 'Indipendente',
      genres: genres.trim() || 'Rap/Hip Hop',
      duration: `${tracks.length * 3} min`,
      editionType,
      tracks,
    };

    onSaveAlbum(newAlbum);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMsg('');
    try {
      const results = await searchMusicOnline(searchQuery, personalizeSearch ? storage.getAlbums() : []);
      setSearchResults(results);
      if (results.length === 0) {
        setErrorMsg('Nessun album trovato per la ricerca inserita.');
      }
    } catch {
      setErrorMsg('Errore durante la ricerca online.');
    } finally {
      setIsSearching(false);
    }
  };

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState<string | null>(null);

  const handleAutoLookup = async () => {
    if (!title.trim() && !artistName.trim()) {
      setErrorMsg('Inserisci almeno il titolo dell\'album o l\'artista per avviare la ricerca automatica.');
      return;
    }
    setIsLookingUp(true);
    setErrorMsg('');
    setLookupSuccess(null);
    try {
      const res = await fetch(
        `/api/spotify/lookup-cover?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artistName)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          if (data.coverUrl) setCoverUrl(data.coverUrl);
          if (data.releaseDate) setReleaseDate(data.releaseDate);
          if (data.label) setLabel(cleanRecordLabel(data.label));
          if (data.artist && !artistName.trim()) setArtistName(data.artist);
          if (data.title && !title.trim()) setTitle(data.title);
          setLookupSuccess(`Copertina e metadati trovati su Spotify per "${data.title || title}"!`);
        } else {
          setErrorMsg('Nessuna corrispondenza trovata su Spotify / Apple Music.');
        }
      }
    } catch {
      setErrorMsg('Errore durante la ricerca automatica di copertina e info.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSelectSearchResult = async (item: SearchResultAlbum) => {
    setImportingId(item.id);
    try {
      const { tracks, label: fetchedLabel, releaseDate: fetchedDate, genres: fetchedGenres } = await fetchAlbumTracks(item.id);
      const albumId = `alb-${Date.now()}`;

      const finalTracks: Track[] =
        tracks.length > 0
          ? tracks.map((t, idx) => ({ ...t, id: `tr-${albumId}-${idx + 1}`, albumId }))
          : item.tracks && item.tracks.length > 0
          ? item.tracks.map((t, idx) => ({ ...t, id: `tr-${albumId}-${idx + 1}`, albumId }))
          : [
              {
                id: `tr-${albumId}-1`,
                albumId,
                trackNumber: 1,
                title: 'TRACCIA 1',
                artists: item.artistName,
                rating: null,
              },
            ];

      const actualDate = fetchedDate || item.releaseDate;
      const formattedDate = new Date(actualDate).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).toUpperCase();

      const newAlbum: Album = {
        id: albumId,
        title: item.title,
        artistId: `art-${item.artistName.toLowerCase().replace(/\s+/g, '-')}`,
        artistName: item.artistName,
        releaseDate: actualDate,
        releaseDateFormatted: formattedDate,
        year: Number(actualDate.slice(0, 4)) || item.year,
        coverUrl: item.coverUrl,
        label: cleanRecordLabel(fetchedLabel || item.label || 'Indipendente'),
        genres: fetchedGenres || item.genres,
        duration: `${finalTracks.length * 3} min`,
        editionType: 'standard',
        tracks: finalTracks,
      };

      onSaveAlbum(newAlbum);
    } catch {
      setErrorMsg('Errore nell\'importazione delle tracce dell\'album.');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="max-w-4xl w-full">
      {/* Back button */}
      <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#77777f] hover:text-white uppercase mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>INDIETRO</span>
      </motion.button>

      {/* Editorial Title */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-3">
        Aggiungi un <span className="text-[#c7ff36]">album</span>
      </h1>

      <p className="text-sm text-[#a3a3a3] max-w-xl font-light mb-6 leading-relaxed">
        Inserisci i dati dell'album e, se vuoi, la tracklist. I voti li dai subito dopo, traccia per traccia.
      </p>

      {/* Mode Switcher */}
      <div className="inline-flex p-1 bg-[#121215] border border-[#222227] rounded-xl mb-8">
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={() => {
            setMode('manual');
            setErrorMsg('');
          }}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-colors cursor-pointer ${
            mode === 'manual'
              ? 'bg-[#1e1e24] text-white shadow-sm'
              : 'text-[#77777f] hover:text-white'
          }`}
        >
          INSERIMENTO MANUALE
        </motion.button>
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={() => {
            setMode('auto');
            setErrorMsg('');
          }}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-colors cursor-pointer ${
            mode === 'auto'
              ? 'bg-[#1e1e24] text-[#c7ff36] shadow-sm'
              : 'text-[#77777f] hover:text-white'
          }`}
        >
          <Sparkles size={13} />
          <span>RICERCA AUTOMATICA 2.0</span>
        </motion.button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {mode === 'manual' ? (
        /* Manual Form (faithful replica of screenshot 08) */
        <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleManualSubmit} className="space-y-6">
          {/* TITOLO */}
          <div>
            <label className="block text-[11px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
              TITOLO
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="IL NOME DELL'ALBUM"
              className="w-full bg-[#121215] border border-[#222227] rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#44444a] focus:outline-none focus:border-[#c7ff36] transition-colors uppercase font-medium tracking-wide"
            />
          </div>

          {/* ARTISTI & DATA DI USCITA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
                ARTISTI
              </label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Artista, feat."
                className="w-full bg-[#121215] border border-[#222227] rounded-xl px-4 py-3 text-sm text-white placeholder-[#44444a] focus:outline-none focus:border-[#c7ff36] transition-colors font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
                DATA DI USCITA
              </label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full bg-[#121215] border border-[#222227] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7ff36] transition-colors"
              />
            </div>
          </div>

          {/* TRACKLIST */}
          <div>
            <label className="block text-[11px] font-semibold text-[#66666f] tracking-widest uppercase mb-2">
              TRACKLIST <span className="font-normal text-[#44444b] lowercase">— una traccia per riga, facoltativa</span>
            </label>
            <textarea
              rows={6}
              value={tracklistRaw}
              onChange={(e) => setTracklistRaw(e.target.value)}
              placeholder={"INTRO\nLA VITA - Artista, Featuring\nTRACCIA 3"}
              className="w-full bg-[#121215] border border-[#222227] rounded-xl p-4 text-xs font-mono text-white placeholder-[#44444b] focus:outline-none focus:border-[#c7ff36] transition-colors leading-relaxed"
            />
          </div>

          {/* Additional details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] tracking-widest uppercase mb-1.5">
                EDIZIONE
              </label>
              <select
                value={editionType}
                onChange={(e) => setEditionType(e.target.value as EditionType)}
                className="w-full bg-[#121215] border border-[#222227] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#c7ff36] transition-colors cursor-pointer"
              >
                <option value="standard">Standard</option>
                <option value="deluxe">Deluxe</option>
                <option value="remaster">Remaster</option>
                <option value="modified">Versione modificata</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#66666f] tracking-widest uppercase">
                  METADATI AUTOMATICI
                </span>
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  type="button"
                  onClick={handleAutoLookup}
                  disabled={isLookingUp}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#18181f] border border-[#2b2b36] hover:border-[#c7ff36] text-[11px] font-mono text-[#c7ff36] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLookingUp ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span>{isLookingUp ? 'Ricerca in corso...' : 'Trova copertina & info online'}</span>
                </motion.button>
              </div>

              {lookupSuccess && (
                <div className="p-2.5 rounded-xl bg-[#13220c] border border-[#294d13] text-[#c7ff36] text-xs font-mono">
                  {lookupSuccess}
                </div>
              )}

              <ImageUploadInput
                label="COPERTINA ALBUM (URL O FILE LOCALE)"
                value={coverUrl}
                onChange={setCoverUrl}
                placeholder="https://... o carica dal tuo dispositivo"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-4 pt-4">
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="submit"
              className="px-6 py-3 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer shadow-sm"
            >
              Aggiungi album
            </motion.button>

            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="button"
              onClick={onBack}
              className="px-5 py-3 text-xs font-semibold tracking-wider text-[#77777f] hover:text-white uppercase transition-colors cursor-pointer"
            >
              ANNULLA
            </motion.button>
          </div>
        </motion.form>
      ) : (
        /* Smart Online Search (2.0 feature) */
        <div className="space-y-6">
          <label className="flex items-center gap-2 text-xs text-[#a3a3ad]">
            <input type="checkbox" checked={personalizeSearch} onChange={e => setPersonalizeSearch(e.target.checked)} />
            Dai priorità agli artisti e ai generi del mio archivio nella prossima ricerca
          </label>
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per album o artista (es. Marracash, Kid Yugi, Shiva, Lazza)..."
              className="flex-1 bg-[#121215] border border-[#222227] rounded-xl px-4 py-3 text-sm text-white placeholder-[#44444a] focus:outline-none focus:border-[#c7ff36] transition-colors"
            />
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              type="submit"
              disabled={isSearching}
              className="px-6 py-3 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
              <span>CERCA</span>
            </motion.button>
          </motion.form>

          {/* Search Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {searchResults.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-[#121215] border border-[#202026] hover:border-[#303038] rounded-xl flex items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="w-14 h-14 rounded-lg object-cover shrink-0 bg-[#1a1a20]"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate tracking-wide">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#8e8e93] truncate mt-0.5">{item.artistName}</p>
                    <p className="text-[10px] text-[#55555c] font-mono mt-1">
                      {item.year} · {item.genres}
                    </p>
                  </div>
                </div>

                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  disabled={importingId === item.id}
                  className="px-3.5 py-1.5 rounded-full bg-[#1a1a22] hover:bg-[#c7ff36] text-white hover:text-black font-semibold text-[11px] tracking-wider uppercase transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  {importingId === item.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plus size={13} />
                  )}
                  <span>IMPORTA</span>
                </motion.button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
