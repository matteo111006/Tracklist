import { uniqueId } from '../utils/uniqueId';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readAppRoute, routeUrl, type AppRoute } from '../utils/usability';

export function useAppNavigation(ownerId?: string) {
  const [route, setRoute] = useState<AppRoute>(() => readAppRoute(window.location.search));
  const [entryKey, setEntryKey] = useState(() => window.history.state?.tlKey || uniqueId());
  const owner = useRef(ownerId); owner.current = ownerId;
  const current = useRef(route); current.current = route;
  const currentKey = useRef(entryKey);
  const positions = useRef(new Map<string, number>());
  const pendingScroll = useRef<number | null>(window.history.state?.tlScroll || 0);
  const saveScroll = useCallback(() => { positions.current.set(currentKey.current, window.scrollY); const state = window.history.state; if (state?.tlKey) window.history.replaceState({ ...state, tlScroll: window.scrollY }, ''); }, []);
  const navigate = useCallback((next: AppRoute, replace = false) => {
    saveScroll();
    const same = routeUrl(current.current) === routeUrl(next);
    if (same && !replace) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const key = uniqueId();
    const state = { tlKey: key, tlOwner: owner.current, tlScroll: 0, tlIndex: replace ? (window.history.state?.tlIndex || 0) : (window.history.state?.tlIndex || 0) + 1 };
    window.history[replace ? 'replaceState' : 'pushState'](state, '', routeUrl(next));
    pendingScroll.current = 0; current.current = next; currentKey.current = key; setRoute(next); setEntryKey(key);
  }, [saveScroll]);
  const reset = useCallback(() => navigate({ view: 'esperienze' }, true), [navigate]);
  const back = useCallback(() => { if ((window.history.state?.tlIndex || 0) > 0 && window.history.state?.tlOwner === owner.current) { saveScroll(); window.history.back(); } else navigate({ view: 'classifica' }, true); }, [navigate, saveScroll]);
  useEffect(() => {
    const previous = window.history.scrollRestoration; window.history.scrollRestoration = 'manual';
    const initial = window.history.state || {};
    if (ownerId && initial.tlOwner && initial.tlOwner !== ownerId) reset();
    else { const key = initial.tlKey || currentKey.current; currentKey.current = key; window.history.replaceState({ ...initial, tlKey: key, tlOwner: ownerId || initial.tlOwner, tlScroll: initial.tlScroll || 0, tlIndex: initial.tlIndex || 0 }, '', window.location.href); }
    const pop = () => {
      const state = window.history.state;
      if (owner.current && state?.tlOwner && state.tlOwner !== owner.current) { reset(); return; }
      const next = readAppRoute(window.location.search);
      const key = state?.tlKey || uniqueId();
      pendingScroll.current = positions.current.get(key) ?? state?.tlScroll ?? 0; current.current = next; currentKey.current = key; setRoute(next); setEntryKey(key);
    };
    const rememberPosition = () => positions.current.set(currentKey.current, window.scrollY);
    window.addEventListener('scroll', rememberPosition, { passive: true });
    window.addEventListener('popstate', pop); window.addEventListener('pagehide', saveScroll); window.addEventListener('beforeunload', saveScroll);
    return () => { window.history.scrollRestoration = previous; window.removeEventListener('scroll', rememberPosition); window.removeEventListener('popstate', pop); window.removeEventListener('pagehide', saveScroll); window.removeEventListener('beforeunload', saveScroll); };
  }, [ownerId, reset, saveScroll]);
  const restoreScroll = useCallback((completedEntryKey: string) => {
    // Exit animations also emit completion: only the entering history entry may restore.
    if (completedEntryKey !== currentKey.current || pendingScroll.current === null) return;
    const top = pendingScroll.current; pendingScroll.current = null;
    const track = current.current.trackId && top === 0 ? document.getElementById(`track-${current.current.trackId}`) : null;
    if (track) { track.scrollIntoView({ block: 'center' }); track.focus({ preventScroll: true }); }
    else window.scrollTo({ top, behavior: 'instant' });
  }, []);
  return { route, entryKey, navigate, reset, back, restoreScroll };
}
