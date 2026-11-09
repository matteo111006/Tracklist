import { useEffect, useState } from 'react';
import { storage } from '../services/storage';

export function useViewMemory<T>(name: string, initial: T) {
  const key = `tracklist-ui:${storage.getAuthUser()?.id || 'guest'}:${name}`;
  const [value, setValue] = useState<T>(() => { try { const raw = sessionStorage.getItem(key); return raw === null ? initial : JSON.parse(raw); } catch { return initial; } });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* View preferences are optional; catalog persistence is handled separately. */ } }, [key, value]);
  return [value, setValue] as const;
}
