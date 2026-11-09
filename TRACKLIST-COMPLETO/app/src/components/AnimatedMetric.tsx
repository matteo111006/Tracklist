import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { formatRating } from '../utils/musicMath';

export function AnimatedMetric({ value, rating = false, decimals }: { value: number | null; rating?: boolean; decimals?: number }) {
  const reduced = useReducedMotion();
  const current = useRef(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === null) return;
    if (reduced || current.current === value) { current.current = value; setDisplay(value); return; }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 650);
      const next = from + (value - from) * (1 - Math.pow(1 - progress, 3));
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else current.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  const format = (n: number | null) => rating ? formatRating(n, decimals) : n === null ? '—' : Math.round(n).toLocaleString('it-IT');
  return <span className="tabular-nums" aria-label={format(value)}><span aria-hidden="true">{format(value === null ? null : reduced ? value : display)}</span></span>;
}
