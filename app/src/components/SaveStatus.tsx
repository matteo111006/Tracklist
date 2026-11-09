import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { storage, SyncStatus } from '../services/storage';

export function SaveStatus() {
  const [status, setStatus] = useState<SyncStatus>(storage.getSyncStatus());
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = (e: Event) => setStatus((e as CustomEvent).detail);
    const fail = (e: Event) => setError((e as CustomEvent).detail);
    const uncaught = (e: ErrorEvent) => { if (e.error?.message?.startsWith('Salvataggio non riuscito')) setError(e.error.message); };
    window.addEventListener('tracklist:sync_status', sync);
    window.addEventListener('tracklist:storage_error', fail);
    window.addEventListener('error', uncaught);
    return () => {
      window.removeEventListener('tracklist:sync_status', sync);
      window.removeEventListener('tracklist:storage_error', fail);
      window.removeEventListener('error', uncaught);
    };
  }, []);
  const labels: Record<SyncStatus, string> = {
    local: 'Archivio locale · salvato nel browser',
    pending: 'Salvato nel browser · sincronizzazione in attesa',
    syncing: 'Salvato nel browser · sincronizzazione in corso…',
    synced: 'Salvato e sincronizzato con il server',
    error: 'Salvato nel browser · server non raggiungibile, nuovo tentativo automatico',
  };
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} data-save-status={status} className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-3 right-3 z-[100] max-w-[calc(100vw-24px)] rounded-xl border border-[#333338] bg-[#141416] px-4 py-2 text-xs text-neutral-300 shadow-lg" role={error ? 'alert' : 'status'} aria-live="polite">
    <span>{error || labels[status]}</span>
    {!error && (status === 'error' || status === 'pending') && <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} className="ml-3 text-[#c7ff36] underline" onClick={() => { void storage.pushToCloud(); }}>Riprova</motion.button>}
    {error && <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} className="ml-3 text-[#c7ff36] underline" onClick={() => setError('')}>Chiudi</motion.button>}
  </motion.div>;
}
