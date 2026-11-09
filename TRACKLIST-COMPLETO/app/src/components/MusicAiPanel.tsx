import { storage } from '../services/storage';
import { musicFingerprint } from '../utils/usability';
import { useViewMemory } from '../hooks/useViewMemory';
import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, LoaderCircle, ArrowUpRight } from 'lucide-react';
import type { Album } from '../types';
import type { AiRequest, AiResult, AiConversation } from '../types/ai';
import { getMusicAiStatus, requestMusicAi } from '../services/musicAi';
import { downloadInsights } from './InsightsPanels';

const actionClass = 'rounded-xl border border-[#58753b] px-4 py-2.5 bg-[#253b16] text-[#d0f6ac] text-sm hover:border-[#c7ff36] disabled:opacity-40 disabled:cursor-default';
export function useMusicAiAvailability() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getMusicAiStatus(controller.signal).then(value => { if (!controller.signal.aborted) setAvailable(value); }).catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, []);
  return available;
}
export function MusicAiBadge() {
  const available = useMusicAiAvailability();
  return <span className="inline-flex gap-2 items-center text-xs text-[#a5bd90] rounded-full border border-[#35432b] px-3 py-1.5 mt-4"><Sparkles size={12} />{available === null ? 'Verifica Gemini…' : available ? 'Gemini configurato · attivalo quando vuoi' : 'Modalità locale disponibile'}</span>;
}
const timestamp = (value?: string) => value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : 'Data non disponibile';
const featureLabels = { identity: 'Genera il mio ritratto con Gemini', archive: 'Chiedi a Gemini', discovery: 'Suggeriscimi tre album con Gemini', wrapped: 'Racconta il mio anno con Gemini' };

export function MusicAiPanel({ request, albums, onSelectAlbum, onSearch }: { request: AiRequest; albums: Album[]; onSelectAlbum?: (id: string) => void; onSearch?: (query: string) => void }) {
  const available = useMusicAiAvailability();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<AiResult | null>(null), [exported, setExported] = useState(false);
  const [conversations, setConversations] = useState<AiConversation[]>(() => storage.getProfile().aiConversations || []);
  const [thread, setThread] = useState<AiConversation | null>(null), [followup, setFollowup] = useState('');
  const [rememberedId, setRememberedId] = useViewMemory(`gemini.thread.${request.feature}.${request.year || 'all'}.${request.tone || 'narrative'}`, '');
  const matching = (list: AiConversation[]) => list.filter(c => c.feature === request.feature && (request.feature !== 'wrapped' || c.year === request.year) && (!request.tone || (c.tone || 'narrative') === request.tone));
  const active = useRef<AbortController | null>(null);
  const context = JSON.stringify(request);
  useEffect(() => {
    const list = storage.getProfile().aiConversations || [];
    const choices = matching(list);
    const sameQuestion = (c: AiConversation) => request.feature !== 'archive' || !request.question?.trim() || c.messages.some(m => m.question === request.question?.trim());
    const saved = rememberedId === '__new__' ? undefined : choices.find(c => c.id === rememberedId) || choices.find(sameQuestion);
    setConversations(list); setThread(saved || null); setResult(saved?.messages.at(-1) || null);
    setError(''); setBusy(false); setExported(false); setFollowup('');
    return () => active.current?.abort();
  }, [context]);
  useEffect(() => {
    const changed = () => setConversations(storage.getProfile().aiConversations || []);
    window.addEventListener('tracklist:profile_updated', changed);
    return () => window.removeEventListener('tracklist:profile_updated', changed);
  }, []);
  const load = (id: string) => { const selected = conversations.find(c => c.id === id); setRememberedId(id || '__new__'); setThread(selected || null); setResult(selected?.messages.at(-1) || null); setError(''); setFollowup(''); setExported(false); };
  const generate = async (payload: AiRequest = { ...request, conversationId: undefined }) => {
    if (busy) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setExported(false);
    try {
      const generated = await requestMusicAi(payload, controller.signal);
      if (controller.signal.aborted) return;
      setResult(generated);
      try { const saved = storage.saveAiTurn(payload, generated); setThread(saved); setRememberedId(saved.id); setFollowup(''); }
      catch (cause) { setThread(null); setRememberedId(''); setError('Risposta generata, ma non salvata: ' + (cause as Error).message + ' Puoi scaricare il testo.'); }
    }
    catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message || 'Gemini non è disponibile.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const changedSince = !!result?.catalogFingerprint && result.catalogFingerprint !== musicFingerprint(albums);
  return <section aria-label={`Gemini ${request.feature}`} className="rounded-2xl border border-[#405631] bg-gradient-to-br from-[#1a2812] to-[#10150c] p-4 sm:p-5 my-5 min-w-0">
    <div className="flex items-center gap-2 text-[#c7ff36] text-sm mb-2"><Sparkles size={16} /><h3>La prospettiva di Gemini</h3></div>
    <p className="text-xs leading-relaxed text-[#9eae90]">Al clic invii a Google Gemini una sintesi dei tuoi album, voti, domanda ed eventuale conversazione precedente. Dati di accesso, email, recensioni e note personali sono esclusi. Le risposte vengono conservate nel tuo account. Le analisi locali restano disponibili.</p>
    <div className="flex flex-wrap items-center gap-3 mt-4"><button className={actionClass} disabled={busy || available !== true || (request.feature === 'archive' && !request.question?.trim())} onClick={() => void generate()}>{busy ? <span className="flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" />Gemini sta elaborando…</span> : featureLabels[request.feature]}</button>{available === false && <span className="text-xs text-[#9eae90]">Gemini non è configurato o il server non è raggiungibile.</span>}{available === null && <span className="text-xs text-[#9eae90]">Verifica del servizio…</span>}</div>
    {!!matching(conversations).length && <div className="flex flex-col sm:flex-row gap-2 mt-4"><label className="min-w-0 flex-1 text-xs text-[#9eae90]">Conversazioni salvate<select aria-label={`Conversazioni Gemini ${request.feature}`} className="block mt-2 w-full min-w-0 bg-[#1c2814] border border-[#405631] text-white rounded-xl p-3 text-sm" value={thread?.id || ''} disabled={busy} onChange={e => load(e.target.value)}><option value="">Seleziona una conversazione</option>{matching(conversations).map(c => <option key={c.id} value={c.id}>{timestamp(c.updatedAt)} · {c.title}</option>)}</select></label><button className={actionClass + ' self-end'} disabled={busy} onClick={() => load('')}>Nuova conversazione</button></div>}
    {thread && thread.messages.length > 1 && <details className="mt-5 rounded-xl border border-[#35482a] p-4"><summary className="text-xs text-[#c7ff36] cursor-pointer">Messaggi precedenti ({thread.messages.length - 1})</summary>{thread.messages.slice(0, -1).map(message => <article key={message.id} className="mt-4 pt-3 border-t border-[#35482a]"><p className="text-[11px] text-[#819474]">{timestamp(message.generatedAt)}</p><p className="text-sm text-white mt-1">{message.question}</p><p className="text-sm text-[#a8ba9b] whitespace-pre-wrap mt-2">{message.text}</p></article>)}</details>}
    {error && <p role="alert" className="text-sm text-amber-200 mt-4">{error} Le funzioni locali restano utilizzabili.</p>}
    {result && <div role="status" className="mt-5"><p className="text-[11px] text-[#92a582] mb-2">Risposta generata il {timestamp(result.generatedAt)}</p>{thread?.messages.at(-1)?.question && <p className="text-sm text-white mb-3">{thread.messages.at(-1)!.question}</p>}{changedSince && <p className="text-xs text-amber-200 rounded-xl border border-amber-900 p-3 mb-3">L’archivio è cambiato dopo questa risposta. Puoi chiedere un aggiornamento; i voti attuali restano quelli nelle schede.</p>}<p className="whitespace-pre-wrap leading-relaxed text-[#d1ddc6] text-sm break-words">{result.text}</p>
      {result.albumIds.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{result.albumIds.map(id => { const album = albums.find(a => a.id === id); return album && onSelectAlbum ? <button key={id} onClick={() => onSelectAlbum(id)} className="text-xs text-[#c7ff36] border border-[#445938] rounded-lg px-3 py-2 flex items-center gap-1">{album.title}<ArrowUpRight size={12} /></button> : null; })}</div>}
      {result.recommendations.length > 0 && <div className="grid md:grid-cols-3 gap-3 mt-4">{result.recommendations.map((rec, i) => <article key={`${rec.artist}-${rec.title}-${i}`} className="rounded-xl border border-[#3c4e2f] bg-[#151e0f] p-4 min-w-0"><h4 className="text-white text-sm">{rec.title}</h4><p className="text-xs text-[#c7ff36] my-1">{rec.artist}</p><p className="text-xs text-[#a2b494] leading-relaxed mb-3">{rec.reason}</p>{onSearch && <button className="text-xs text-[#c7ff36] underline underline-offset-4" onClick={() => onSearch(`${rec.artist} ${rec.title}`)}>Verifica nel catalogo musicale</button>}</article>)}</div>}
      <p className="text-[11px] text-[#819474] mt-4">Generato da Gemini · {result.includedAlbums}/{result.totalAlbums} album nel contesto{result.cached ? ' · risposta riutilizzata' : ''}. {result.includedAlbums < result.totalAlbums ? 'Il catalogo è stato ridotto per rispettare il limite di elaborazione. ' : ''}L’IA può sbagliare: i voti ufficiali sono quelli nelle schede.</p>
      <button className={actionClass + ' mt-3'} onClick={() => { downloadInsights(`tracklist-gemini-${request.feature}.txt`, result.text + '\n\n' + result.recommendations.map(r => `${r.title} — ${r.artist}\n${r.reason}`).join('\n\n'), 'text/plain'); setExported(true); }}>{exported ? 'Testo IA scaricato' : 'Scarica testo IA'}</button>
      {thread && <><button className={actionClass + ' mt-3 sm:ml-2'} onClick={() => downloadInsights('tracklist-conversazione.txt', thread.messages.map(m => `${timestamp(m.generatedAt)}\nTU: ${m.question}\nGEMINI: ${m.text}`).join('\n\n'), 'text/plain')}>Esporta conversazione</button><form className="mt-5 pt-4 border-t border-[#35482a]" onSubmit={e => { e.preventDefault(); if (followup.trim()) void generate({ ...request, question: followup.trim(), conversationId: thread.id }); }}><label className="text-xs text-[#a9bc9a]">Continua questa conversazione<input aria-label="Domanda di approfondimento" className="block mt-2 w-full min-w-0 rounded-xl border border-[#425a31] bg-[#1b2913] text-white text-sm p-3" value={followup} maxLength={1000} onChange={e => setFollowup(e.target.value)} placeholder="es. E quali album dovrei riascoltare?" /></label><button className={actionClass + ' mt-3'} disabled={busy || available !== true || !followup.trim()}>Invia approfondimento</button></form><p className="text-[11px] text-[#819474] mt-3">Conservate le 20 conversazioni più recenti, con le ultime 12 risposte ciascuna. Incluse nei backup del tuo account.</p></>}
    </div>}
  </section>;
}
