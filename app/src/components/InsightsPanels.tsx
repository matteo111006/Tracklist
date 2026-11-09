import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Download, ArrowUpRight, Trophy, Target, CheckCircle2 } from 'lucide-react';
import type { Album, Artist } from '../types';
import { calculateCollectionInsights, calculateSpecialAwards, calculateWrappedInsights } from '../utils/listeningInsights';
import { formatRating } from '../utils/musicMath';
import { AnimatedMetric } from './AnimatedMetric';

export function downloadInsights(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const panel = 'rounded-3xl border border-[#262d21] bg-[#10130e] p-5 sm:p-7';
const muted = 'text-xs leading-relaxed text-[#8e9684]';
const metric = 'text-2xl sm:text-3xl font-semibold tracking-tight text-[#c7ff36] tabular-nums';
const pct = (value: number | null) => value === null ? '—' : formatRating(value, 1) + '%';

export function WrappedInsights({ albums, year, onSelectAlbum }: { albums: Album[]; year: number; onSelectAlbum: (id: string) => void }) {
  const data = useMemo(() => calculateWrappedInsights(albums, year), [albums, year]);
  const [exported, setExported] = useState(false);
  const exportYear = () => {
    downloadInsights('tracklist-wrapped-' + year + '.json', JSON.stringify({ year, basis: 'Anno di uscita degli album; voti confermati, non ascolti.', profile: data.profile, confirmedAlbums: data.current.confirmedAlbums, ratedTracks: data.current.totalRatings, uniqueArtists: data.uniqueArtists, trackAverage: data.current.average, positivePercentage: data.current.positivePercentage, perfectScores: data.current.perfectCount, catalogCoverage: data.current.coverage, previousYear: { year: year - 1, confirmedAlbums: data.previous.confirmedAlbums, trackAverage: data.previous.average }, averageDelta: data.averageDelta }, null, 2), 'application/json');
    setExported(true);
  };
  return <section className={panel} aria-label="Il tuo profilo musicale annuale" data-motion-panel>
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div><p className="text-[10px] tracking-[0.2em] uppercase text-[#c7ff36] mb-2">Il tuo modo di dare un voto</p><h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{data.profile}</h2><p className={muted + ' mt-2'}>{data.current.totalRatings < 10 ? 'Con almeno 10 voti confermati potremo descrivere il tuo profilo.' : 'Il profilo dipende dalla quota di tracce a cui hai dato almeno 8,00.'}</p></div>
      <motion.button whileHover={{ y: -2 }} whileTap={{ scale: .97 }} onClick={exportYear} className="shrink-0 self-start rounded-xl border border-[#3c4a2b] px-4 py-2.5 text-xs text-[#c7ff36] flex items-center gap-2"><Download size={14} />Scarica riepilogo</motion.button>
    </div>
    {exported && <p role="status" className="text-xs text-[#c7ff36] mb-4">Riepilogo JSON scaricato per l’anno selezionato.</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
      {[
        ['Tracce da 8 in su', pct(data.current.positivePercentage), data.current.positiveCount + ' su ' + data.current.totalRatings + ' voti'],
        ['Dieci perfetti', <AnimatedMetric value={data.current.perfectCount} />, 'Tracce con voto 10,00'],
        ['Artisti esplorati', <AnimatedMetric value={data.uniqueArtists} />, 'Inclusi i progetti condivisi'],
        ['Archivio valutato', pct(data.current.coverage), data.current.confirmedAlbums + ' su ' + data.current.totalAlbums + ' album'],
      ].map(([title, value, detail]) => <div key={String(title)} className="rounded-2xl bg-[#181d13] p-4"><p className="text-[10px] uppercase tracking-wider text-[#8e9684] mb-2">{title}</p><div className={metric}>{value}</div><p className="text-[10px] text-[#7d8772] mt-2">{detail}</p></div>)}
    </div>
    <div className="grid md:grid-cols-2 gap-6 border-t border-[#2a3322] pt-6">
      <div><h3 className="text-sm font-semibold text-white mb-4">Il confronto con il {year - 1}</h3>
        <table className="w-full table-fixed text-xs"><thead><tr className="text-[#89947d]"><th className="text-left font-normal pb-3">Per anno di uscita</th><th className="font-mono pb-3">{year - 1}</th><th className="font-mono text-[#c7ff36] pb-3">{year}</th></tr></thead><tbody>
          <tr className="border-t border-[#252d20]"><td className="py-3 text-neutral-300">Album valutati</td><td className="text-center text-neutral-300">{data.previous.confirmedAlbums}</td><td className="text-center text-white">{data.current.confirmedAlbums}</td></tr>
          <tr className="border-t border-[#252d20]"><td className="py-3 text-neutral-300">Media tracce</td><td className="text-center text-neutral-300">{formatRating(data.previous.average, 2)}</td><td className="text-center text-white">{formatRating(data.current.average, 2)}</td></tr>
        </tbody></table>
        <p className="text-xs text-[#c7ff36] mt-3">{data.averageDelta === null ? 'Servono voti in entrambi gli anni per confrontare le medie.' : (data.averageDelta >= 0 ? '+' : '') + formatRating(data.averageDelta, 2) + ' punti di media rispetto al ' + (year - 1)}</p>
      </div>
      <div><h3 className="text-sm font-semibold text-white mb-3">Da portare a termine</h3>
        {data.current.unfinished.slice(0, 3).map(({ album, rated, total }) => <motion.button whileHover={{ x: 3 }} key={album.id} onClick={() => onSelectAlbum(album.id)} className="w-full py-3 border-b border-[#252d20] text-left flex items-center justify-between gap-3"><span className="min-w-0"><span className="block text-xs text-white truncate">{album.title}</span><span className="text-[10px] text-[#88947a]">{rated}/{total} tracce valutate{album.evaluationStatus === 'draft' ? ' · bozza' : ''}</span></span><ArrowUpRight size={14} className="shrink-0 text-[#c7ff36]" /></motion.button>)}
        {!data.current.unfinished.length && <p className={muted}>{data.current.totalAlbums ? 'Tutti gli album di questo anno sono valutati e confermati.' : 'Aggiungi un album di questo anno per iniziare.'}</p>}
      </div>
    </div>
    <p className="text-[10px] text-[#68735d] mt-5">I periodi si riferiscono all’uscita degli album. Le medie usano i voti confermati delle singole tracce; non misurano il tempo di ascolto.</p>
  </section>;
}

export function ExtraAwards({ albums, artists, year, onSelectAlbum, onSelectArtist }: { albums: Album[]; artists: Artist[]; year: number; onSelectAlbum: (id: string) => void; onSelectArtist?: (id: string, name: string) => void }) {
  const data = useMemo(() => calculateSpecialAwards(albums, year, artists), [albums, year, artists]);
  const growth = data.growth.filter(a => Math.abs(a.delta - data.growth[0].delta) < 1e-9);
  return <section aria-label="Premi speciali" className="mt-10 space-y-5">
    <div><p className="text-[10px] tracking-[0.2em] text-[#d8b568] uppercase mb-2">Oltre il podio</p><h2 className="text-2xl font-semibold text-white">Premi speciali</h2><p className={muted + ' mt-2'}>Concorrono {data.eligibleCount} album standard con almeno 5 tracce, tutte valutate e confermate. I pareggi sono premiati insieme.</p></div>
    <div className="grid sm:grid-cols-2 gap-4">
      {data.categories.map((award, index) => <motion.article key={award.id + year} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }} transition={{ delay: index * .04 }} className="rounded-3xl border border-[#39301f] bg-gradient-to-br from-[#201b10] to-[#10100e] p-5 sm:p-6">
        <div className="flex justify-between items-center gap-3 mb-4"><Trophy size={18} className="text-[#e0bc70]" /><span className="text-[9px] font-mono uppercase tracking-widest text-[#9e8b64]">{year} · Premio speciale</span></div>
        <h3 className="text-lg font-semibold text-[#f0d79e] mb-2">{award.title}</h3><p className="text-[11px] text-[#a49c89] leading-relaxed mb-4">{award.criterion}</p>
        {award.winners.slice(0, 3).map(({ album }) => <motion.button whileHover={{ x: 3 }} key={album.id} onClick={() => onSelectAlbum(album.id)} className="w-full flex items-center gap-3 py-3 text-left border-t border-[#3b3220]"><img src={album.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-[#292316]" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-white truncate">{album.title}</span><span className="text-[10px] text-[#a49c89]">{album.artistName}</span></span><ArrowUpRight size={14} className="text-[#e0bc70] shrink-0" /></motion.button>)}
        {!award.winners.length && <p className="text-xs text-[#8f8673]">Nessun album idoneo per questo premio.</p>}
        {!!award.winners.length && <p className="text-xs font-mono text-[#e0bc70] mt-3">{award.id === 'highlights' ? pct(award.score) : award.id === 'consistency' ? 'σ ' + formatRating(award.score, 3) : formatRating(award.score, 2) + '/10'}{award.winners.length > 1 ? ' · ' + award.winners.length + ' vincitori ex aequo' : ''}</p>}
        {award.winners.length > 3 && <details className="mt-3 text-xs text-[#d8b568]"><summary className="cursor-pointer">Altri {award.winners.length - 3} vincitori</summary><div className="mt-2 space-y-2">{award.winners.slice(3).map(({ album }) => <button key={album.id} onClick={() => onSelectAlbum(album.id)} className="block text-left hover:underline">{album.title} · {album.artistName}</button>)}</div></details>}
      </motion.article>)}
    </div>
    <div className={panel}><h3 className="text-lg font-semibold text-white mb-2">Artista in crescita</h3><p className={muted}>Maggiore aumento della media degli album rispetto al {year - 1}. Serve almeno un album confermato per artista in ciascun anno; sono incluse le collaborazioni.</p>
      {growth.map(artist => <button disabled={!onSelectArtist} key={artist.id} onClick={() => onSelectArtist?.(artist.id, artist.name)} className="w-full py-4 mt-3 border-t border-[#2a3322] text-left flex justify-between items-center gap-3"><span><strong className="text-sm text-white">{artist.name}</strong><span className="block text-xs text-[#88947a] mt-1">{formatRating(artist.previous, 2)} → {formatRating(artist.current, 2)}</span></span><span className={metric}>+{formatRating(artist.delta, 2)}</span></button>)}
      {!growth.length && <p className="mt-4 text-sm text-[#929a88]">Nessun incremento confrontabile nei dati disponibili per questi due anni.</p>}
    </div>
  </section>;
}

export function StatisticsInsights({ albums, onSelectAlbum }: { albums: Album[]; onSelectAlbum: (id: string) => void }) {
  const data = useMemo(() => calculateCollectionInsights(albums), [albums]);
  return <motion.section key="insights" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" aria-label="Approfondimenti sui tuoi voti">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
      ['Dispersione dei voti', formatRating(data.deviation, 3), 'Deviazione standard: più bassa significa voti più vicini.'],
      ['Tracce da 8 in su', pct(data.positivePercentage), data.positiveCount + ' su ' + data.totalRatings + ' voti confermati.'],
      ['Dieci perfetti', data.perfectCount, 'Tracce a cui hai assegnato 10,00.'],
      ['Recensioni scritte', data.reviews, 'Album confermati con una tua recensione.'],
    ].map(([label, value, description]) => <div key={String(label)} className={panel}><p className="text-[10px] uppercase tracking-wider text-[#8d9880] mb-3">{label}</p><div className={metric}>{value}</div><p className={muted + ' mt-3'}>{description}</p></div>)}</div>
    <div className="grid lg:grid-cols-2 gap-6">
      <div className={panel}><h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2"><Target size={17} className="text-[#c7ff36]" />Album più omogenei</h2><p className={muted}>Dispersione crescente tra i voti delle tracce. Almeno 5 tracce, tutte valutate. Una media alta resta una misura distinta.</p>
        {data.consistent.slice(0, 5).map(({ album, deviation, mean }, index) => <motion.button whileHover={{ x: 3 }} key={album.id} onClick={() => onSelectAlbum(album.id)} className="w-full text-left flex items-center gap-3 border-t border-[#2a3322] py-4 mt-2"><span className="text-xs text-[#6f7e5e]">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block text-xs text-white truncate">{album.title}</strong><span className="text-[10px] text-[#8d9880]">Media {formatRating(mean, 2)}</span></span><span className="text-xs font-mono text-[#c7ff36]">σ {formatRating(deviation, 3)}</span></motion.button>)}
        {!data.consistent.length && <p className={muted + ' mt-4'}>Completa un album di almeno 5 tracce per confrontarne la coerenza.</p>}
      </div>
      <div className={panel}><h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2"><CheckCircle2 size={17} className="text-[#c7ff36]" />Avanzamento dell’archivio</h2><p className={muted}>{data.confirmedAlbums} album confermati su {data.totalAlbums} nel filtro selezionato.</p>
        <div className="h-2 rounded-full bg-[#252e1d] overflow-hidden my-5"><motion.div initial={{ width: 0 }} animate={{ width: data.coverage + '%' }} className="h-full bg-[#c7ff36]" /></div>
        <p className={metric}>{pct(data.coverage)}</p><p className="text-xs text-[#8d9880] mt-2 mb-4">Riprendi dagli album con più voti già inseriti.</p>
        {data.unfinished.slice(0, 5).map(({ album, rated, total }) => <motion.button whileHover={{ x: 3 }} key={album.id} onClick={() => onSelectAlbum(album.id)} className="w-full py-3 border-t border-[#2a3322] flex justify-between gap-3 text-left"><span className="text-xs text-white truncate">{album.title}</span><span className="text-[10px] text-[#c7ff36] whitespace-nowrap">{rated}/{total}{album.evaluationStatus === 'draft' ? ' · bozza' : ''}</span></motion.button>)}
        {!data.unfinished.length && <p className={muted}>{data.totalAlbums ? 'Nessuna valutazione da completare.' : 'Non ci sono album per questi filtri.'}</p>}
      </div>
    </div>
    <p className="text-[10px] text-[#77806e]">Dispersione e percentuali usano solo voti validi da 0 a 10 su album confermati. Il numero di brani può includere versioni presenti in più album.</p>
  </motion.section>;
}
