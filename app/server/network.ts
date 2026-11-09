export function fetchWithTimeout(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal || AbortSignal.timeout(12000) });
}
