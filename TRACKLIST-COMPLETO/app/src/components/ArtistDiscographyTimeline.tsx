import { useSaveAndClose } from '../hooks/useSaveAndClose';
import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Disc3,
  SlidersHorizontal,
  EyeOff,
  Edit3,
  RotateCcw,
  Upload,
  X,
  Calendar,
  Layers,
  Music,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Album, DiscographyItem, ArtistTimelineOverrides } from '../types';
import { storage } from '../services/storage';

interface ArtistDiscographyTimelineProps {
  artistId: string;
  artistName: string;
  existingAlbums: Album[];
  onSelectAlbum: (albumId: string) => void;
  onAddAlbum: (album: DiscographyItem) => void;
}

export const ArtistDiscographyTimeline: React.FC<ArtistDiscographyTimelineProps> = ({
  artistId,
  artistName,
  existingAlbums,
  onSelectAlbum,
  onAddAlbum,
}) => {
  const [rawItems, setRawItems] = useState<DiscographyItem[]>([]);
  const [overrides, setOverrides] = useState<ArtistTimelineOverrides>(() =>
    storage.getArtistTimelineOverrides(artistName)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'album' | 'ep'>('all');
  const [isEditMode, setIsEditMode] = useState(false);
  const { saveAndClose, saveError, isSaving, clearSaveError } = useSaveAndClose();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiscographyItem | null>(null);
  const [isManageHiddenOpen, setIsManageHiddenOpen] = useState(false);

  // Form state for add / edit modal
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'album' | 'ep'>('album');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formReleaseDate, setFormReleaseDate] = useState('');
  const [formTracksCount, setFormTracksCount] = useState<number>(10);
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formSpotifyUrl, setFormSpotifyUrl] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const yearRefs = useRef(new Map<number, HTMLElement>());
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ownAlbums = React.useMemo(() => existingAlbums.filter(album =>
    album.artists?.some(artist => artist.name.toLowerCase().trim() === artistName.toLowerCase().trim()) ||
    album.artistName.split(/[,;&]/).some(name => name.toLowerCase().trim() === artistName.toLowerCase().trim())
  ), [existingAlbums, artistName]);
  const anchors = JSON.stringify(ownAlbums.slice(0, 40).map(album => ({ title: album.title, year: album.year, spotifyId: album.spotifyId })));

  // Sync overrides with storage events
  useEffect(() => {
    const handleStorageChange = () => {
      setOverrides(storage.getArtistTimelineOverrides(artistName));
    };
    window.addEventListener('tracklist:timeline_updated', handleStorageChange);
    return () => {
      window.removeEventListener('tracklist:timeline_updated', handleStorageChange);
    };
  }, [artistName]);

  // Load raw discography from API
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setRawItems([]);

    async function loadDiscography() {
      try {
        const res = await fetch(
          `/api/spotify/artist-discography?id=${encodeURIComponent(artistId)}&name=${encodeURIComponent(
            artistName
          )}&anchors=${encodeURIComponent(anchors)}`
        );
        if (!res.ok) throw new Error('Failed to fetch discography');
        const data = await res.json();
        if (!isCancelled && Array.isArray(data.albums)) {
          setRawItems(data.albums);
        }
      } catch (err) {
        console.warn('Could not load artist discography timeline:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadDiscography();
    return () => {
      isCancelled = true;
    };
  }, [artistId, artistName, anchors]);

  // Merge rawItems with user overrides (hidden items, edited metadata, custom added albums)
  const displayItems = React.useMemo(() => {
    const hiddenSet = new Set((overrides.hiddenIds || []).map((h) => h.toLowerCase().trim()));
    const seenTitleKeys = new Set<string>();

    const normalizeKey = (t: string) =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();

    const result: DiscographyItem[] = [];

    // 1. Process server items
    for (const item of rawItems) {
      const idKey = item.id.toLowerCase().trim();
      const titleKey = item.title.toLowerCase().trim();
      const normKey = normalizeKey(item.title);

      if (hiddenSet.has(idKey) || hiddenSet.has(titleKey) || hiddenSet.has(normKey)) {
        continue;
      }

      if (normKey && seenTitleKeys.has(normKey)) continue;
      if (normKey) seenTitleKeys.add(normKey);

      const edits = overrides.editedAlbums?.[item.id] || overrides.editedAlbums?.[titleKey];
      result.push(edits ? { ...item, ...edits } : item);
    }

    // The user's own archive remains available even when external identity
    // cannot be verified. Never substitute an unrelated namesake catalog.
    for (const album of ownAlbums) {
      const normKey = normalizeKey(album.title);
      if (seenTitleKeys.has(normKey) || hiddenSet.has(album.id.toLowerCase()) || hiddenSet.has(album.title.toLowerCase().trim()) || hiddenSet.has(normKey)) continue;
      seenTitleKeys.add(normKey);
      result.push({ id: album.id, title: album.title, artistName: album.artistName, releaseDate: album.releaseDate, year: album.year, coverUrl: album.coverUrl, type: 'album', tracksCount: album.tracks.length, spotifyId: album.spotifyId, spotifyUrl: album.spotifyUrl });
    }

    // 2. Process custom albums added by user
    for (const custom of overrides.customAlbums || []) {
      const idKey = custom.id.toLowerCase().trim();
      const titleKey = custom.title.toLowerCase().trim();
      const normKey = normalizeKey(custom.title);

      if (hiddenSet.has(idKey) || hiddenSet.has(titleKey) || hiddenSet.has(normKey)) {
        continue;
      }

      if (normKey && seenTitleKeys.has(normKey)) continue;
      if (normKey) seenTitleKeys.add(normKey);

      const edits = overrides.editedAlbums?.[custom.id] || overrides.editedAlbums?.[titleKey];
      result.push(edits ? { ...custom, ...edits } : custom);
    }

    // 3. Chronological Sort: Newest left (index 0) to Oldest right
    result.sort((a, b) => {
      const yearA = a.year || (a.releaseDate ? parseInt(a.releaseDate.split('-')[0], 10) : 0);
      const yearB = b.year || (b.releaseDate ? parseInt(b.releaseDate.split('-')[0], 10) : 0);
      if (yearB !== yearA) return yearB - yearA;

      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      if (!isNaN(dateA) && !isNaN(dateB) && dateB !== dateA) return dateB - dateA;
      return 0;
    });

    return result;
  }, [rawItems, overrides, ownAlbums]);

  // Apply Album / EP type filters
  const filteredItems = displayItems.filter((item) => {
    if (filterType === 'album') return item.type !== 'ep';
    if (filterType === 'ep') return item.type === 'ep';
    return true;
  });

  const yearGroups = React.useMemo(() => {
    const groups = new Map<number, DiscographyItem[]>();
    for (const item of filteredItems) {
      const year = item.year || Number(item.releaseDate?.slice(0, 4)) || 0;
      groups.set(year, [...(groups.get(year) || []), item]);
    }
    return [...groups].sort(([a], [b]) => b - a).map(([year, items]) => ({ year, items }));
  }, [filteredItems]);
  const visibleYear = yearGroups.some(group => group.year === activeYear) ? activeYear : yearGroups[0]?.year;
  useEffect(() => {
    setActiveYear(null);
    scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [filterType, artistId]);
  const goToYear = (year: number) => {
    const container = scrollContainerRef.current;
    const target = yearRefs.current.get(year);
    if (!container || !target) return;
    setActiveYear(year);
    const left = target.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
    container.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const updateVisibleYear = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const left = container.getBoundingClientRect().left;
    const nearest = yearGroups.reduce<{ year: number; distance: number } | null>((best, group) => {
      const el = yearRefs.current.get(group.year);
      if (!el) return best;
      const distance = Math.abs(el.getBoundingClientRect().left - left);
      return !best || distance < best.distance ? { year: group.year, distance } : best;
    }, null);
    if (nearest) setActiveYear(nearest.year);
  };
  const formatRelease = (date: string) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
    const parsed = new Date(date + 'T12:00:00');
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = (direction === 'left' ? -1 : 1) * Math.max(260, scrollContainerRef.current.clientWidth * 0.8);
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Check if an item is already evaluated/present in user's TRACKLIST catalog
  const getCatalogMatch = (item: DiscographyItem): Album | undefined => {
    const itemNorm = item.title.toLowerCase().trim();
    return existingAlbums.find(
      (a) => (item.spotifyId && a.spotifyId === item.spotifyId) || a.title.toLowerCase().trim() === itemNorm
    );
  };

  // Manual Timeline Actions
  const handleHideAlbum = (item: DiscographyItem) => {
    const idKey = item.id.toLowerCase().trim();
    const titleKey = item.title.toLowerCase().trim();
    const currentHidden = overrides.hiddenIds || [];
    const newHidden = Array.from(new Set([...currentHidden, idKey, titleKey]));
    // Also remove from customAlbums if it was user-created
    const newCustom = (overrides.customAlbums || []).filter(
      (c) => c.id !== item.id && c.title.toLowerCase().trim() !== titleKey
    );

    const updated: ArtistTimelineOverrides = {
      ...overrides,
      hiddenIds: newHidden,
      customAlbums: newCustom,
    };
    setOverrides(updated);
    storage.saveArtistTimelineOverrides(artistName, updated);
  };

  const handleRestoreHidden = (hiddenIdentifier: string) => {
    const clean = hiddenIdentifier.toLowerCase().trim();
    const updated: ArtistTimelineOverrides = {
      ...overrides,
      hiddenIds: (overrides.hiddenIds || []).filter((h) => h.toLowerCase().trim() !== clean),
    };
    setOverrides(updated);
    storage.saveArtistTimelineOverrides(artistName, updated);
  };

  const handleResetAllOverrides = () => {
    if (window.confirm(`Vuoi ripristinare la discografia predefinita per ${artistName}?`)) {
      storage.resetArtistTimelineOverrides(artistName);
      setOverrides({ hiddenIds: [], customAlbums: [], editedAlbums: {} });
      setIsManageHiddenOpen(false);
    }
  };

  const openAddModal = () => {
    clearSaveError();
    setFormTitle('');
    setFormType('album');
    setFormYear(new Date().getFullYear());
    setFormReleaseDate(`${new Date().getFullYear()}-01-01`);
    setFormTracksCount(10);
    setFormCoverUrl(
      'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80'
    );
    setFormSpotifyUrl('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: DiscographyItem) => {
    clearSaveError();
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(item.type === 'ep' ? 'ep' : 'album');
    setFormYear(item.year || new Date().getFullYear());
    setFormReleaseDate(item.releaseDate || `${item.year || 2024}-01-01`);
    setFormTracksCount(item.tracksCount || (item.type === 'ep' ? 5 : 12));
    setFormCoverUrl(item.coverUrl || '');
    setFormSpotifyUrl(item.spotifyUrl || '');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    return saveAndClose(() => {
      if (!formTitle.trim()) throw new Error('Inserisci il titolo dell’album o EP prima di salvare.');

      const finalYear = Number(formYear) || new Date().getFullYear();
      const finalDate =
        formReleaseDate && formReleaseDate.startsWith(String(finalYear))
          ? formReleaseDate.trim()
          : `${finalYear}-01-01`;

      if (editingItem) {
        // Editing existing album
        const edits: Partial<DiscographyItem> = {
          title: formTitle.trim(),
          type: formType,
          year: finalYear,
          releaseDate: finalDate,
          tracksCount: Number(formTracksCount) || (formType === 'ep' ? 5 : 12),
          coverUrl: formCoverUrl.trim(),
          spotifyUrl: formSpotifyUrl.trim(),
        };

        const updated: ArtistTimelineOverrides = {
          ...overrides,
          editedAlbums: {
            ...(overrides.editedAlbums || {}),
            [editingItem.id]: edits,
            [editingItem.title.toLowerCase().trim()]: edits,
          },
        };

        storage.saveArtistTimelineOverrides(artistName, updated);
        setOverrides(updated);
        setEditingItem(null);
        setIsAddModalOpen(false);
        setFormTitle('');
        setFormCoverUrl('');
        setFormSpotifyUrl('');
      } else {
        // Adding new custom album
        const newAlbum: DiscographyItem = {
          id: `custom-alb-${Date.now()}`,
          title: formTitle.trim(),
          artistName,
          type: formType,
          year: finalYear,
          releaseDate: finalDate,
          tracksCount: Number(formTracksCount) || (formType === 'ep' ? 5 : 12),
          coverUrl: formCoverUrl.trim(),
          spotifyUrl: formSpotifyUrl.trim(),
          isCustom: true,
        };

        const updated: ArtistTimelineOverrides = {
          ...overrides,
          customAlbums: [...(overrides.customAlbums || []), newAlbum],
        };

        storage.saveArtistTimelineOverrides(artistName, updated);
        setOverrides(updated);
        setIsAddModalOpen(false);
        setEditingItem(null);
        setFormTitle('');
        setFormCoverUrl('');
        setFormSpotifyUrl('');
      }
    }, () => { setIsEditMode(false); });
  };

  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setFormCoverUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const hiddenCount = (overrides.hiddenIds || []).length;
  const hasCustomEdits =
    hiddenCount > 0 ||
    (overrides.customAlbums && overrides.customAlbums.length > 0) ||
    Object.keys(overrides.editedAlbums || {}).length > 0;

  return (
    <div
      className={`mt-8 mb-12 bg-[#0c0d0b] border rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden transition-colors ${
        isEditMode ? 'border-[#c7ff36]/40 shadow-[0_0_30px_rgba(199,255,54,0.06)]' : 'border-[#1d1d23]'
      }`}
    >
      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="mb-6 -mt-2 py-2 px-4 rounded-xl bg-[#16220d] border border-[#2b4014] text-[#c7ff36] text-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} />
            <span className="font-semibold">MODALITÀ MODIFICA TIMELINE ATTIVA</span>
            <span className="text-[#8e8e93] text-[11px] hidden sm:inline">
              — Puoi eliminare uscite errate, modificare titoli e anni, o aggiungere album storici.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={openAddModal}
              className="px-2.5 py-1 rounded-lg bg-[#c7ff36] text-black font-semibold text-[11px] hover:bg-[#d4ff66] flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus size={12} strokeWidth={2.5} />
              <span>Aggiungi Album</span>
            </motion.button>
            {hasCustomEdits && (
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                onClick={handleResetAllOverrides}
                className="px-2.5 py-1 rounded-lg bg-[#1f1f26] text-[#ff8888] hover:bg-[#2b1f1f] text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Ripristina</span>
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Header with Title and Scroll Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#18181e] mb-6">
        <div>
          <div className="text-[10px] font-semibold text-[#8e8e93] tracking-widest uppercase flex items-center gap-2 mb-1">
            <Disc3 size={13} className="text-[#c7ff36]" />
            <span>DISCOGRAFIA · IL PERCORSO</span>
            {hasCustomEdits && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#1c2a12] text-[#c7ff36] border border-[#2d4219]">
                PERSONALIZZATA
              </span>
            )}
          </div>
          <h3 className="text-3xl sm:text-4xl font-editorial tracking-[-0.045em] text-white">
            Anno dopo <span className="text-[#c7ff36]">anno.</span>
          </h3>
          <p className="text-xs text-[#77777f] mt-0.5">
            Ogni uscita, un punto nella storia. Esplora gli album e gli EP attraverso gli anni.
          </p>
        </div>

        {/* Filters, Edit mode, and Navigation controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-[#141418] border border-[#23232a] rounded-xl text-xs">
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              aria-pressed={filterType === 'all'} onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterType === 'all' ? 'bg-[#23232c] text-white' : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              Tutti
            </motion.button>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              aria-pressed={filterType === 'album'} onClick={() => setFilterType('album')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterType === 'album' ? 'bg-[#23232c] text-white' : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              Album
            </motion.button>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              aria-pressed={filterType === 'ep'} onClick={() => setFilterType('ep')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterType === 'ep' ? 'bg-[#23232c] text-white' : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              EP
            </motion.button>
          </div>

          {/* Edit Timeline Toggle Button (Requested feature) */}
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={() => setIsEditMode(!isEditMode)}
            title="Personalizza manualmente la timeline"
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isEditMode
                ? 'bg-[#c7ff36] text-black border-[#c7ff36] shadow-[0_0_12px_rgba(199,255,54,0.3)]'
                : 'bg-[#141418] hover:bg-[#1f1f26] text-[#8e8e93] hover:text-white border-[#23232a]'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>{isEditMode ? 'Fine modifica' : 'Modifica timeline'}</span>
          </motion.button>

          {/* Left / Right scroll buttons */}
          <div className="flex items-center gap-1.5">
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={() => scroll('left')}
              title="Scorri verso le uscite più recenti"
              className="p-2 rounded-xl bg-[#141418] hover:bg-[#1f1f26] text-white border border-[#23232a] transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </motion.button>
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={() => scroll('right')}
              title="Scorri verso le uscite passate"
              className="p-2 rounded-xl bg-[#141418] hover:bg-[#1f1f26] text-white border border-[#23232a] transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#c7ff36] border-t-transparent animate-spin mb-3" />
          <span className="text-xs text-neutral-400 font-mono">
            Caricamento della discografia ufficiale da Spotify in corso...
          </span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 text-xs flex flex-col items-center justify-center gap-3">
          <p>Nessuna uscita visualizzata per questo artista con i filtri attuali.</p>
          {isEditMode && (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs flex items-center gap-2 cursor-pointer hover:bg-[#d4ff66]"
            >
              <Plus size={14} />
              <span>Aggiungi manualmente il primo album</span>
            </motion.button>
          )}
          {hiddenCount > 0 && (
            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
              onClick={handleResetAllOverrides}
              className="text-[#c7ff36] hover:underline text-xs flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Ripristina le uscite nascoste ({hiddenCount})</span>
            </motion.button>
          )}
        </div>
      ) : (
        <div>
          {/* A year index doubles as direct navigation along the time axis. */}
          <div className="flex flex-col gap-4 mb-7 sm:mb-9">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-[#777d70]">
              <span>{yearGroups.length} {yearGroups.length === 1 ? 'anno' : 'anni'} · {filteredItems.length} {filteredItems.length === 1 ? 'uscita' : 'uscite'}</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#c7ff36]" />Dal presente agli esordi</span>
            </div>
            <nav aria-label="Vai a un anno della discografia" className="flex gap-2 overflow-x-auto pb-1">
              {yearGroups.map(({ year, items }) => (
                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} key={year} onClick={() => goToYear(year)} aria-label={'Vai al ' + (year || 'anno non disponibile') + ', ' + items.length + (items.length === 1 ? ' uscita' : ' uscite')} aria-current={visibleYear === year ? 'date' : undefined}
                  className={`shrink-0 flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c7ff36] ${visibleYear === year ? 'bg-[#c7ff36] border-[#c7ff36] text-[#11140b]' : 'border-[#272c22] text-[#9aa18f] hover:border-[#677843] hover:text-white'}`}>
                  {year || 'N.D.'}<span className={`text-[10px] font-mono ${visibleYear === year ? 'text-[#43561c]' : 'text-[#626b57]'}`}>{String(items.length).padStart(2, '0')}</span>
                </motion.button>
              ))}
            </nav>
          </div>

          <div ref={scrollContainerRef} onScroll={updateVisibleYear} role="region" aria-label={'Timeline discografica di ' + artistName} tabIndex={0}
            className="overflow-x-auto pb-5 scroll-smooth overscroll-x-contain focus-visible:outline-2 focus-visible:outline-[#c7ff36]/60 rounded-lg"
            style={{ scrollSnapType: 'x proximity', scrollbarColor: '#434e2e #151812', scrollbarWidth: 'thin' }}>
            <div className="flex items-start min-w-full w-max">
              {yearGroups.map(({ year, items }, groupIndex) => (
                <motion.section initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.4, delay: Math.min(groupIndex, 3) * 0.045 }} key={year} ref={el => { if (el) yearRefs.current.set(year, el); else yearRefs.current.delete(year); }}
                  aria-label={'Uscite del ' + (year || 'anno non disponibile')} className="shrink-0 relative pr-7 sm:pr-10" style={{ scrollSnapAlign: 'start', width: Math.max(232, items.length * 188 + (items.length - 1) * 14 + 40) }}>
                  {/* The year is the main landmark; all its releases share a single segment. */}
                  <div className="h-[114px] relative">
                    <div className="flex items-baseline gap-3">
                      <h4 className={`text-[54px] sm:text-[64px] font-semibold leading-none tracking-[-0.07em] tabular-nums ${visibleYear === year ? 'text-[#c7ff36]' : 'text-[#e0e4d9]'}`}>{year || '—'}</h4>
                      {groupIndex === 0 && <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#92a27b]">Più recente</span>}
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-[#737e65]">{items.length} {items.length === 1 ? 'pubblicazione' : 'pubblicazioni'}</p>
                    <div aria-hidden="true" data-timeline-axis className="absolute bottom-[16px] left-0 right-0 h-px bg-[#3b472b]" />
                    <div aria-hidden="true" className="absolute bottom-[17px] left-0 right-0 h-[12px] opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(to right, #55633d 0px, #55633d 1px, transparent 1px, transparent 24px)', maskImage: 'linear-gradient(to bottom, transparent, black)' }} />
                    <span data-timeline-node aria-hidden="true" className={`absolute bottom-[11px] left-0 h-[11px] w-[11px] rounded-full border-2 border-[#0c0d0b] ring-1 ${visibleYear === year ? 'bg-[#c7ff36] ring-[#c7ff36]/60 shadow-[0_0_16px_#c7ff3640]' : 'bg-[#7c8f58] ring-[#55683b]'}`} />
                  </div>

                  <div className="flex items-stretch gap-3.5">
                    {items.map(item => {
                      const matchedAlbum = getCatalogMatch(item);
                      return <motion.article whileHover={{ y: -6 }} whileTap={{ scale: 0.985 }} key={item.id} className="group relative w-[188px] shrink-0 flex flex-col rounded-2xl border border-[#262c21] bg-[#141710] p-2.5 transition-colors hover:border-[#6e8444]">
                        <span aria-hidden="true" className="absolute -top-[17px] left-5 h-[16px] w-px bg-[#3b472b]" />
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-[#22271b]">
                          <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                          <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/75 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-white backdrop-blur">{item.type === 'ep' ? 'EP' : 'Album'}</span>
                          {matchedAlbum && <span title="Già nel tuo archivio" className="absolute bottom-2 right-2 rounded-full bg-[#c7ff36] p-1 text-black"><Check size={11} strokeWidth={3} /></span>}
                          {isEditMode && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/65 backdrop-blur-[2px]">
                            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} onClick={() => openEditModal(item)} aria-label={'Modifica ' + item.title} title="Modifica informazioni album" className="rounded-xl border border-white/20 bg-[#242c1a] p-3 text-white hover:bg-[#c7ff36] hover:text-black"><Edit3 size={16} /></motion.button>
                            <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} onClick={() => handleHideAlbum(item)} aria-label={'Nascondi ' + item.title} title="Rimuovi questo album dalla timeline" className="rounded-xl border border-red-300/20 bg-[#321d1d] p-3 text-red-200 hover:bg-red-700"><EyeOff size={16} /></motion.button>
                          </div>}
                        </div>
                        <div className="px-1 pb-1 pt-3 flex flex-col flex-1">
                          <div className="flex justify-between gap-2 mb-2 text-[9px] font-mono uppercase tracking-wider text-[#889775]"><span>{formatRelease(item.releaseDate) || 'Data non disponibile'}</span>{item.tracksCount ? <span>{item.tracksCount} tr.</span> : null}</div>
                          <h5 title={item.title} className="text-[12px] font-semibold leading-relaxed text-[#edf0e7] line-clamp-2 mb-4">{item.title}</h5>
                          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} onClick={() => matchedAlbum ? onSelectAlbum(matchedAlbum.id) : onAddAlbum(item)} aria-label={(matchedAlbum ? 'Apri ' : 'Aggiungi ') + item.title}
                            className={`mt-auto flex items-center justify-between border-t border-[#2a3320] pt-3 text-[10px] font-semibold transition-colors ${matchedAlbum ? 'text-[#c7ff36] hover:text-white' : 'text-[#a7b19b] hover:text-[#c7ff36]'}`}>
                            <span>{matchedAlbum ? 'Nel tuo archivio' : 'Aggiungi all’archivio'}</span>{matchedAlbum ? <ChevronRight size={13} /> : <Plus size={13} />}
                          </motion.button>
                        </div>
                      </motion.article>;
                    })}
                  </div>
                </motion.section>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#242b1e] pt-4 text-[9px] uppercase tracking-[0.17em] text-[#68745a]">
            <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-[#c7ff36]" />{yearGroups[0]?.year || '—'} · Presente</span>
            <span className="hidden sm:block">Scorri per ripercorrere la discografia →</span>
            <span>{yearGroups.at(-1)?.year || '—'} · Esordi</span>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT ALBUM IN TIMELINE */}
      <AnimatePresence>
        {(isAddModalOpen || Boolean(editingItem)) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#101014] border border-[#282832] rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl relative"
            >
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }}
                className="absolute top-5 right-5 p-2 rounded-xl bg-[#1a1a20] hover:bg-[#282834] text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </motion.button>

              <div className="flex items-center gap-2 mb-1 text-[11px] font-mono uppercase tracking-widest text-[#c7ff36]">
                <Edit3 size={13} />
                <span>{editingItem ? 'Modifica Uscita' : 'Aggiungi Album alla Timeline'}</span>
              </div>
              <h3 className="text-xl font-editorial text-white mb-4">
                {editingItem ? editingItem.title : `Nuova uscita per ${artistName}`}
              </h3>

              <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleSaveForm} className="space-y-4">
                {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                    Titolo dell'album o EP
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Es. Orange County California"
                    className="w-full bg-[#16161b] border border-[#2b2b35] focus:border-[#c7ff36] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                    Tipo di uscita
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      type="button"
                      onClick={() => setFormType('album')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        formType === 'album'
                          ? 'bg-[#18260e] text-[#c7ff36] border-[#395318]'
                          : 'bg-[#15151a] text-[#8e8e93] border-[#22222a] hover:text-white'
                      }`}
                    >
                      Album / Mixtape
                    </motion.button>
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      type="button"
                      onClick={() => setFormType('ep')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        formType === 'ep'
                          ? 'bg-[#18260e] text-[#c7ff36] border-[#395318]'
                          : 'bg-[#15151a] text-[#8e8e93] border-[#22222a] hover:text-white'
                      }`}
                    >
                      EP
                    </motion.button>
                  </div>
                </div>

                {/* Release date & Year */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                      Anno di uscita
                    </label>
                    <input
                      type="number"
                      required
                      min={1950}
                      max={2030}
                      value={formYear}
                      onChange={(e) => {
                        const y = parseInt(e.target.value, 10);
                        setFormYear(y);
                        setFormReleaseDate(`${y}-01-01`);
                      }}
                      className="w-full bg-[#16161b] border border-[#2b2b35] focus:border-[#c7ff36] rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                      Data completa (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      value={formReleaseDate}
                      onChange={(e) => {
                        setFormReleaseDate(e.target.value);
                        if (e.target.value) {
                          setFormYear(parseInt(e.target.value.split('-')[0], 10));
                        }
                      }}
                      className="w-full bg-[#16161b] border border-[#2b2b35] focus:border-[#c7ff36] rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* Tracks count */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                    Numero di tracce
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formTracksCount}
                    onChange={(e) => setFormTracksCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#16161b] border border-[#2b2b35] focus:border-[#c7ff36] rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-colors font-mono"
                  />
                </div>

                {/* Cover artwork URL or file upload */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mb-1.5">
                    Copertina dell'album
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formCoverUrl}
                      onChange={(e) => setFormCoverUrl(e.target.value)}
                      placeholder="https://... o carica un file"
                      className="flex-1 bg-[#16161b] border border-[#2b2b35] focus:border-[#c7ff36] rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-colors"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileSelected}
                    />
                    <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Carica da file locale"
                      className="p-2.5 rounded-xl bg-[#1d1d25] hover:bg-[#2b2b36] text-[#c7ff36] border border-[#2c2c38] transition-colors cursor-pointer"
                    >
                      <Upload size={14} />
                    </motion.button>
                  </div>
                  {formCoverUrl && (
                    <div className="mt-2 flex items-center gap-3 p-2 bg-[#141419] rounded-xl border border-[#202028]">
                      <img
                        src={formCoverUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover bg-black"
                      />
                      <span className="text-[10px] text-[#77777f] truncate flex-1">
                        Anteprima copertina valida
                      </span>
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <div className="pt-3 border-t border-[#1a1a22] flex items-center justify-end gap-2">
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingItem(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#16161c] hover:bg-[#202028] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Annulla
                  </motion.button>
                  <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-[#c7ff36] hover:bg-[#d6ff55] text-black text-xs font-bold transition-colors cursor-pointer shadow-lg"
                  >
                    {isSaving ? 'Salvataggio…' : 'Salva nella timeline'}
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
