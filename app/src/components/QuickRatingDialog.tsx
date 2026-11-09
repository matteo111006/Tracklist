import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowLeft, ArrowRight, SkipForward, Keyboard } from 'lucide-react';
import type { Album } from '../types';
import { formatRating } from '../utils/musicMath';
import { parseQuickRating, mergeRatingDraft } from '../utils/usability';
import { storage } from '../services/storage';
import { useModalFocus } from '../hooks/useModalFocus';

export function RatingDifference({ before, after }: { before: number | null | undefined; after: number | null | undefined }) {
  const delta = before != null && after != null ? after - before : null;
  return <span className="block text-xs text-[#9bac8c] mt-1">Precedente: {formatRating(before ?? null, 2)}{delta != null && <span className={delta > 0 ? 'text-[#c7ff36]' : delta < 0 ? 'text-amber-300' : 'text-[#9bac8c]'}> · {delta > 0 ? '+' : ''}{formatRating(delta, 2)}</span>}</span>;
}
export function QuickRatingDialog({ album, relisten = false, onClose, onSaved }: { album: Album; relisten?: boolean; onClose: () => void; onSaved?: () => void }) {
  const ref = useModalFocus(onClose), ratingInput = useRef<HTMLInputElement>(null);
  const [tracks] = useState(() => [...album.tracks].sort((a, b) => a.trackNumber - b.trackNumber));
  const [baseline] = useState(() => Object.fromEntries(tracks.map(t => [t.id, t.rating])));
  const [ratings, setRatings] = useState<Record<string, number | null>>(baseline);
  const [index, setIndex] = useState(0), [text, setText] = useState(tracks[0]?.rating == null ? '' : String(tracks[0].rating).replace('.', ',')), [note, setNote] = useState(''), [error, setError] = useState('');
  const track = tracks[index];
  useEffect(() => { ratingInput.current?.focus(); ratingInput.current?.select(); }, [index]);
  let preview: number | null = null; try { preview = parseQuickRating(text); } catch { /* Validation appears on confirmation, while incomplete typing remains allowed. */ }
  const latestDraft = () => ({ ...ratings, [track.id]: parseQuickRating(text) });
  const save = (draft = latestDraft()) => {
    try {
      const latest = storage.getAlbums().find(a => a.id === album.id);
      if (!latest || latest.deleted) throw new Error('Questo album non è più disponibile.');
      if (JSON.stringify(latest.tracks.map(t => t.id).sort()) !== JSON.stringify(tracks.map(t => t.id).sort())) throw new Error('La tracklist è cambiata: riapri la valutazione per usare i brani aggiornati.');
      const merged = mergeRatingDraft(baseline, draft, Object.fromEntries(latest.tracks.map(t => [t.id, t.rating])));
      if (!Object.values(merged).some(v => v !== null)) throw new Error('Assegna almeno un voto prima di salvare.');
      if (relisten) storage.saveRelisten(album.id, merged, note); else storage.confirmAlbumCompleted(album.id, merged);
      onSaved?.(); onClose();
    } catch (cause) { setError((cause as Error).message); }
  };
  const step = (direction: number, skip = false) => {
    try {
      const draft = skip ? ratings : latestDraft();
      if (direction > 0 && index === tracks.length - 1) { save(draft); return; }
      const next = Math.max(0, Math.min(tracks.length - 1, index + direction));
      setRatings(draft); setIndex(next); setText(draft[tracks[next].id] == null ? '' : String(draft[tracks[next].id]).replace('.', ',')); setError('');
    } catch (cause) { setError((cause as Error).message); }
  };
  if (!track) return null;
  return <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"><section ref={ref} role="dialog" aria-modal="true" aria-label={relisten ? 'Riascolta e rivaluta' : 'Valutazione rapida da tastiera'} className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl border border-[#40552f] bg-[#11170d] p-5 sm:p-8">
    <div className="flex justify-between items-start gap-3"><div><p className="text-xs uppercase tracking-widest text-[#95a786] mb-2">{album.title}</p><h2 className="text-2xl text-white flex items-center gap-2"><Keyboard size={22} className="text-[#c7ff36]" />{relisten ? 'Riascolta e rivaluta' : 'Valutazione rapida'}</h2></div><button aria-label="Chiudi valutazione rapida" className="p-2 text-[#a6b49a]" onClick={onClose}><X size={20} /></button></div>
    <p className="text-sm leading-relaxed text-[#96a98a] mt-3">Scrivi il voto e premi Invio per passare al brano seguente. Sull’ultimo brano Invio salva e chiude. I voti restano in bozza fino al salvataggio.</p>
    <div className="mt-6 flex items-center justify-between text-xs text-[#a8b99a]"><span>Traccia {index + 1} di {tracks.length}</span><span>{Math.round((index + 1) / tracks.length * 100)}%</span></div><div className="h-1 rounded-full bg-[#29351e] mt-2"><div className="h-full bg-[#c7ff36] rounded-full" style={{ width: `${(index + 1) / tracks.length * 100}%` }} /></div>
    <h3 className="text-xl text-white mt-6 break-words">{track.title}</h3><p className="text-sm text-[#94a486] mt-1">{track.artists}</p>
    <form onSubmit={event => { event.preventDefault(); step(1); }}><label className="text-sm text-[#b1c1a5] block mt-6">Nuovo voto<input ref={ratingInput} data-autofocus aria-label="Voto rapido della traccia" inputMode="decimal" autoComplete="off" maxLength={5} value={text} onChange={e => setText(e.target.value)} className="block w-full rounded-2xl bg-[#202f15] border border-[#4a6336] p-4 text-4xl text-[#c7ff36] mt-2 focus:outline-[#c7ff36]" placeholder="es. 8,25" onKeyDown={e => { if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1, true); } }} /></label><RatingDifference before={baseline[track.id]} after={preview} />
      {error && <p role="alert" className="text-sm text-amber-200 mt-3">{error}</p>}
      <div className="grid grid-cols-3 gap-2 mt-5"><button type="button" onClick={() => step(-1)} disabled={index === 0} className="rounded-xl border border-[#3b4c2d] p-3 text-sm text-[#c0d3b1] disabled:opacity-30 flex items-center justify-center gap-1"><ArrowLeft size={14} />Precedente</button><button type="button" onClick={() => step(1, true)} className="rounded-xl border border-[#3b4c2d] p-3 text-sm text-[#c0d3b1] flex items-center justify-center gap-1"><SkipForward size={14} />Salta</button><button className="rounded-xl bg-[#c7ff36] p-3 text-sm text-black flex items-center justify-center gap-1">{index === tracks.length - 1 ? 'Salva' : 'Conferma'}<ArrowRight size={14} /></button></div>
      {relisten && <label className="text-sm text-[#a8b99a] block mt-5">Nota del riascolto<textarea className="block mt-2 w-full bg-[#1b2514] border border-[#35472a] rounded-xl p-3 text-white" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>}
      <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-[#304024]"><button type="button" onClick={() => { try { save(latestDraft()); } catch (e) { setError((e as Error).message); } }} className="rounded-xl bg-[#c7ff36] px-4 py-3 text-sm text-black">Salva e chiudi</button><button type="button" onClick={onClose} className="text-sm text-[#adbd9f] px-3 py-2">Annulla</button></div>
      <p className="text-[11px] text-[#829773] mt-4">Vuoto = senza voto · Salta mantiene il voto precedente · Alt+← indietro · Alt+→ salta · Esc annulla</p>
    </form>
  </section></div>;
}
