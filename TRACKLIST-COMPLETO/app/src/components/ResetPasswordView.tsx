import { motion } from 'motion/react';
import React, { useState } from 'react';

export function ResetPasswordView({ token, onClose }: { token: string; onClose: (completed?: boolean) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8 || password.length > 128) { setError('Usa da 8 a 128 caratteri.'); return; }
    if (password !== confirm) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }), signal: AbortSignal.timeout(20000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossibile reimpostare la password.');
      setPassword(''); setConfirm(''); setDone(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore di connessione. Riprova.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-5">
    <section className="w-full max-w-md rounded-3xl border border-[#28282e] bg-[#111114] p-7">
      <p className="text-[#c7ff36] tracking-[0.25em] text-xs mb-5">TRACKLIST</p>
      <h1 className="text-2xl font-semibold mb-3">{done ? 'Password aggiornata' : 'Imposta una nuova password'}</h1>
      {done ? <><p className="text-sm text-neutral-300 mb-6" role="status">La password è stata aggiornata. Le sessioni precedenti sono state disconnesse: accedi di nuovo.</p><motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} onClick={() => onClose(true)} className="rounded-xl bg-[#c7ff36] text-black px-5 py-3 font-semibold">Vai all’accesso</motion.button></> : <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} onSubmit={submit} className="space-y-4">
        <p className="text-sm text-neutral-400">Il link ricevuto via email è valido per 30 minuti e può essere usato una sola volta.</p>
        <label className="block text-sm">Nuova password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="block w-full mt-2 p-3 rounded-xl bg-[#1b1b20] border border-[#33333a]" /></label>
        <label className="block text-sm">Conferma password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} className="block w-full mt-2 p-3 rounded-xl bg-[#1b1b20] border border-[#33333a]" /></label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} disabled={busy} className="w-full rounded-xl bg-[#c7ff36] text-black p-3 font-semibold disabled:opacity-50">{busy ? 'Salvataggio…' : 'Salva nuova password'}</motion.button>
        <motion.button whileHover={{ y: -1, scale: 1.025 }} whileTap={{ scale: 0.965 }} type="button" onClick={() => onClose(false)} className="text-sm text-neutral-400 underline">Torna all’accesso</motion.button>
      </motion.form>}
    </section>
  </main>;
}
