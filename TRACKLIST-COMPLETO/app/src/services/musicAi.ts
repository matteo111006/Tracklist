import { storage } from './storage';
import type { AiRequest, AiResult } from '../types/ai';

export async function getMusicAiStatus(signal?: AbortSignal): Promise<boolean> {
  const token = storage.getAuthToken();
  if (!token) return false;
  const response = await fetch('/api/ai/status', { headers: { Authorization: `Bearer ${token}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('Stato Gemini non disponibile.');
  const result = await response.json();
  return result.configured === true;
}
export async function requestMusicAi(request: AiRequest, signal?: AbortSignal): Promise<AiResult> {
  const token = storage.getAuthToken();
  if (!token) throw new Error('Accedi per usare Gemini.');
  // The server reads this account's catalog, so pending local edits must arrive first.
  if (storage.getSyncStatus() !== 'synced' && !await storage.pushToCloud()) throw new Error('Prima di usare Gemini occorre sincronizzare i tuoi ultimi voti. Puoi usare intanto la modalità locale.');
  if (signal?.aborted || token !== storage.getAuthToken()) throw new Error('Richiesta annullata.');
  const response = await fetch('/api/ai/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Gemini non è disponibile. Usa la modalità locale.');
  if (signal?.aborted || token !== storage.getAuthToken()) throw new Error('Richiesta annullata dopo il cambio di account.');
  return result as AiResult;
}
