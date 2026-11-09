import { motion } from 'motion/react';
import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, Check, ExternalLink } from 'lucide-react';
import { Album, CustomCollection } from '../types';
import { VinylCollection } from './VinylCollection';

interface RaccolteViewProps {
  collections: CustomCollection[];
  albums: Album[];
  onSaveCollection: (collection: CustomCollection) => void;
  onDeleteCollection: (id: string) => void;
  onSelectAlbum: (albumId: string) => void;
}

export const RaccolteView: React.FC<RaccolteViewProps> = ({
  collections,
  albums,
  onSaveCollection,
  onDeleteCollection,
  onSelectAlbum,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<string[]>([]);

  const handleToggleAlbum = (id: string) => {
    setSelectedAlbumIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveCollection({
      id: `col-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      albumIds: selectedAlbumIds,
      isPublic: true,
      createdAt: new Date().toISOString().split('T')[0],
    });

    setName('');
    setDescription('');
    setSelectedAlbumIds([]);
    setIsCreating(false);
  };

  return (
    <div className="max-w-6xl w-full">
      {/* Category label */}
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8e8e93] mb-3">
        PLAYLIST & TIER LIST · TRACKLIST 2.0
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-normal font-handwritten tracking-tight text-white mb-2">
            Raccolte <span className="text-[#c7ff36]">personali</span>
          </h1>
          <p className="text-sm text-[#a3a3a3] font-light max-w-xl">
            Crea elenchi e raccolte tematiche personalizzate con i tuoi album preferiti.
          </p>
        </div>

        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 transition-all cursor-pointer self-start sm:self-auto shadow-sm"
        >
          <Plus size={15} />
          <span>NUOVA RACCOLTA</span>
        </motion.button>
      </div>

      {/* Creation Modal / Inline Form */}
      {isCreating && (
        <div data-motion-panel className="bg-[#101014] border border-[#23232a] rounded-3xl p-6 sm:p-8 mb-10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
            CREA NUOVA RACCOLTA
          </h3>
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                Nome raccolta
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. I 10 dischi della mia vita, Classici underground..."
                className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1">
                Descrizione
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve spiegazione del tema o criterio..."
                className="w-full bg-[#161619] border border-[#26262c] rounded-xl px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-2">
                Seleziona gli album ({selectedAlbumIds.length} selezionati)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto p-1">
                {albums.map((alb) => {
                  const isSelected = selectedAlbumIds.includes(alb.id);
                  return (
                    <div
                      key={alb.id}
                      onClick={() => handleToggleAlbum(alb.id)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#c7ff36] bg-[#16210b]'
                          : 'border-[#222228] bg-[#141418] hover:bg-[#1a1a20]'
                      }`}
                    >
                      <img
                        src={alb.coverUrl}
                        alt={alb.title}
                        className="w-8 h-8 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white uppercase truncate">
                          {alb.title}
                        </div>
                        <div className="text-[10px] text-[#77777f] truncate">{alb.artistName}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs text-[#77777f] hover:text-white"
              >
                Annulla
              </motion.button>
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs uppercase hover:brightness-110"
              >
                Crea raccolta
              </motion.button>
            </div>
          </motion.form>
        </div>
      )}

      {/* Collections List */}
      <div className="space-y-8">
        {collections.map((col, index) => {
          const colAlbums = col.albumIds
            .map((id) => albums.find((a) => a.id === id))
            .filter((a): a is Album => !!a);

          return (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: Math.min(index, 5) * 0.055, duration: 0.35 }}
              className="bg-[#0e0e11] border border-[#1e1e24] rounded-3xl p-6 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-editorial text-white uppercase tracking-tight">
                    {col.name}
                  </h3>
                  {col.description && (
                    <p className="text-xs text-[#8e8e93] font-light mt-1">{col.description}</p>
                  )}
                  <div className="text-[10px] font-mono text-[#55555c] mt-2">
                    {colAlbums.length} ALBUM · CREATA IL {col.createdAt}
                  </div>
                </div>

                <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                  onClick={() => onDeleteCollection(col.id)}
                  title="Elimina raccolta"
                  className="p-2 text-[#55555c] hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </motion.button>
              </div>

              <VinylCollection name={col.name} albums={colAlbums} onSelectAlbum={onSelectAlbum} />
              {/* Grid of albums in collection */}
              {col.dreamTracklist && <div className="rounded-2xl p-5 mt-4 border border-white/10" style={{ background: `radial-gradient(circle at top right, ${col.dreamTracklist.theme}33, #12180d 75%)` }}><p className="text-xs tracking-widest mb-3" style={{ color: col.dreamTracklist.theme }}>IL MIO DISCO IDEALE · {col.dreamTracklist.tracks.length} TRACCE</p><ol className="space-y-2">{col.dreamTracklist.tracks.map((ref, index) => { const album = albums.find(a => a.id === ref.albumId); const track = album?.tracks.find(t => t.id === ref.trackId); return <li key={`${ref.albumId}-${ref.trackId}`}><button className="text-sm text-left text-[#d7e0cf] hover:text-[#c7ff36]" disabled={!album} onClick={() => onSelectAlbum(ref.albumId)}>{index + 1}. {track?.title || 'Traccia non più disponibile'} <span className="text-[#8e9c81]">· {track?.artists || album?.artistName}</span></button></li>; })}</ol><p className="text-xs text-[#8e9c81] mt-4">Puoi caricare e modificare la sequenza in Per te → Disco ideale.</p></div>}

            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
