import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Disc3 } from 'lucide-react';
import type { Album } from '../types';
import '../vinyl.css';

export function VinylCollection({ name, albums, onSelectAlbum }: { name: string; albums: Album[]; onSelectAlbum: (id: string) => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const selected = albums[active];
  const go = (index: number) => {
    const el = viewport.current;
    const card = el?.children[Math.max(0, Math.min(index, albums.length - 1))] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    let accumulated = 0, lastStep = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? el.clientWidth : 1);
      if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)) return;
      event.preventDefault();
      accumulated += delta;
      if (Math.abs(accumulated) < 45 || Date.now() - lastStep < 650) return;
      const direction = Math.sign(accumulated);
      accumulated = 0; lastStep = Date.now();
      const cards = Array.from(el.children) as HTMLElement[];
      const center = el.scrollLeft + el.clientWidth / 2;
      const nearest = cards.reduce((best, card, index) => Math.abs(card.offsetLeft + card.offsetWidth / 2 - center) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - center) ? index : best, 0);
      const next = cards[Math.max(0, Math.min(nearest + direction, cards.length - 1))];
      if (next) el.scrollTo({ left: next.offsetLeft - (el.clientWidth - next.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => { setActive(index => Math.min(index, Math.max(0, albums.length - 1))); }, [albums.length]);

  return <section className="vinyl-gallery" aria-label={`Vinili della raccolta ${name}`}>
    <div className="vinyl-header"><div><p className="vinyl-eyebrow"><Disc3 size={14} /> LA TUA COLLEZIONE, SU VINILE</p><h4>{name}</h4></div></div>
    {!albums.length ? <p className="vinyl-empty">Questa raccolta non contiene ancora album. Aggiungi dei dischi per sfogliarli qui.</p> : <>
      <div className="vinyl-shelf"><div className="vinyl-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Scorri i vinili con la rotella, il trackpad o i tasti freccia" onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') { e.preventDefault(); go(e.key === 'Home' ? 0 : e.key === 'End' ? albums.length - 1 : active + (e.key === 'ArrowRight' ? 1 : -1)); }
      }} onScroll={() => {
        const el = viewport.current;
        if (!el) return;
        const center = el.scrollLeft + el.clientWidth / 2;
        let closest = 0, distance = Infinity;
        Array.from(el.children).forEach((node, index) => { const card = node as HTMLElement; const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center); if (d < distance) { closest = index; distance = d; } });
        setActive(closest);
      }}>
        {albums.map((album, index) => <button type="button" className={`vinyl-card ${index === active ? 'is-active' : index < active ? 'is-before' : 'is-after'}`} key={album.id} style={{ zIndex: index === active ? albums.length + 2 : index < active ? index + 1 : albums.length - index }} aria-label={`${index + 1}. ${album.title}, ${album.artistName}`} aria-pressed={index === active} onClick={() => go(index)}>
          <span className="vinyl-object">
            <span className="vinyl-sleeve"><img src={album.coverUrl} alt={album.title} draggable={false} /><span className="vinyl-sleeve-light" /></span>
          </span>
        </button>)}
      </div></div>
      <div className="vinyl-caption" aria-live="polite" aria-atomic="true"><span className="vinyl-position">{String(active + 1).padStart(2, '0')} / {String(albums.length).padStart(2, '0')}</span><h5>{selected?.title}</h5><p>{selected?.artistName} · {selected?.year}</p></div>
      <div className="vinyl-controls"><button type="button" className="vinyl-icon" aria-label="Vinile precedente" disabled={active === 0} onClick={() => go(active - 1)}><ArrowLeft size={20} /></button><button type="button" className="vinyl-open" onClick={() => selected && onSelectAlbum(selected.id)}>Apri album</button><button type="button" className="vinyl-icon" aria-label="Vinile successivo" disabled={active === albums.length - 1} onClick={() => go(active + 1)}><ArrowRight size={20} /></button></div>
      <p className="vinyl-hint">Sfoglia con le frecce, la rotella del mouse o il trackpad. Su telefono, scorri con il dito.</p>
    </>}
  </section>;
}
