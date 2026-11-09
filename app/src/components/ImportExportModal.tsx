import { motion } from 'motion/react';
import React, { useState } from 'react';
import { X, Download, Upload, AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet } from 'lucide-react';
import { storage } from '../services/storage';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importJsonText, setImportJsonText] = useState('');
  const [previewInfo, setPreviewInfo] = useState<{
    albumsCount: number;
    artistsCount: number;
    valid: boolean;
    error?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const json = storage.exportDataJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracklist-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({ type: 'success', text: 'Backup JSON esportato con successo!' });
  };

  const handleExportCSV = () => {
    const csv = storage.exportDataCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracklist-voti-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({ type: 'success', text: 'Esportazione CSV completata!' });
  };

  const handlePreviewImport = (text: string) => {
    setImportJsonText(text);
    setStatusMessage(null);
    try {
      const parsed = JSON.parse(text);
      if (!parsed.albums || !Array.isArray(parsed.albums)) {
        setPreviewInfo({
          albumsCount: 0,
          artistsCount: 0,
          valid: false,
          error: 'Manca la lista degli album nel file.',
        });
        return;
      }
      setPreviewInfo({
        albumsCount: parsed.albums.length,
        artistsCount: parsed.artists?.length || 0,
        valid: true,
      });
    } catch {
      setPreviewInfo({
        albumsCount: 0,
        artistsCount: 0,
        valid: false,
        error: 'JSON non valido o sintassi errata.',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handlePreviewImport(content);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    try {
      const result = storage.importDataJSON(importJsonText);
      setStatusMessage({
        type: 'success',
        text: `Importati con successo ${result.importedAlbums} album e ${result.importedArtists} artisti!`,
      });
      setPreviewInfo(null);
      setImportJsonText('');
      onDataChanged();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Errore durante l\'importazione.',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div data-motion-panel className="bg-[#111114] border border-[#26262c] rounded-3xl p-6 sm:p-8 max-w-xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c1c20] mb-6">
          <div className="flex items-center gap-2">
            <h3 className="font-editorial text-2xl text-white">Importazione & Esportazione</h3>
          </div>
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            aria-label="Chiudi importazione ed esportazione"
            onClick={onClose}
            className="text-[#66666f] hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2 p-1 bg-[#16161a] border border-[#222227] rounded-xl mb-6">
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'bg-[#22222a] text-white shadow-sm'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Esporta Libreria
          </motion.button>
          <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'bg-[#22222a] text-white shadow-sm'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Importa Backup
          </motion.button>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                : 'bg-red-950/40 border border-red-800 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {activeTab === 'export' ? (
          <div className="space-y-4">
            <p className="text-xs text-[#a3a3a3] font-light leading-relaxed">
              Esporta la tua intera collezione musicale, comprese tutte le valutazioni per traccia, recensioni e metadati.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                onClick={handleExportJSON}
                className="p-5 bg-[#16161a] border border-[#25252c] hover:border-[#c7ff36] rounded-2xl flex flex-col items-start gap-2.5 transition-all text-left group cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-[#202028] text-[#c7ff36] group-hover:scale-105 transition-transform">
                  <FileJson size={22} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white tracking-wide">
                    Backup Completo (JSON)
                  </div>
                  <div className="text-[11px] text-[#77777f] mt-1 font-light">
                    Perfetto per migrazione e salvataggio 1:1.
                  </div>
                </div>
              </motion.button>

              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                onClick={handleExportCSV}
                className="p-5 bg-[#16161a] border border-[#25252c] hover:border-[#c7ff36] rounded-2xl flex flex-col items-start gap-2.5 transition-all text-left group cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-[#202028] text-[#c7ff36] group-hover:scale-105 transition-transform">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white tracking-wide">
                    Tabella Tracce (CSV)
                  </div>
                  <div className="text-[11px] text-[#77777f] mt-1 font-light">
                    Apri su Excel o Google Sheets.
                  </div>
                </div>
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[#a3a3a3] font-light leading-relaxed">
              Carica un file JSON di backup esportato precedentemente per ripristinare o unire i tuoi album e voti.
            </p>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1.5">
                Seleziona file .json
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full text-xs text-[#8e8e93] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#202028] file:text-white hover:file:bg-[#2a2a34] cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#66666f] uppercase mb-1.5">
                Oppure incolla il contenuto JSON
              </label>
              <textarea
                rows={4}
                value={importJsonText}
                onChange={(e) => handlePreviewImport(e.target.value)}
                placeholder='{ "version": "2.0", "albums": [...] }'
                className="w-full bg-[#161619] border border-[#26262c] rounded-xl p-3 text-xs font-mono text-white placeholder-[#55555c] focus:outline-none focus:border-[#c7ff36]"
              />
            </div>

            {/* Anteprima e Controllo duplicati */}
            {previewInfo && (
              <div
                className={`p-4 rounded-xl border text-xs ${
                  previewInfo.valid
                    ? 'bg-[#14200b] border-[#293d14] text-[#c7ff36]'
                    : 'bg-red-950/40 border-red-800 text-red-300'
                }`}
              >
                {previewInfo.valid ? (
                  <div>
                    <div className="font-semibold mb-1">Anteprima backup valida:</div>
                    <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                      <li>{previewInfo.albumsCount} album pronti per l'unione</li>
                      <li>{previewInfo.artistsCount} profili artista inclusi</li>
                      <li>I duplicati esistenti con stesso ID verranno aggiornati</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <strong>Errore file:</strong> {previewInfo.error}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-[#77777f] hover:text-white"
              >
                Chiudi
              </motion.button>
              <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }}
                type="button"
                disabled={!previewInfo?.valid}
                onClick={handleConfirmImport}
                className="px-5 py-2 rounded-xl bg-[#c7ff36] text-black font-semibold text-xs tracking-wider uppercase hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                Conferma Importazione
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
