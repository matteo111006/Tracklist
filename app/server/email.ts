import crypto from 'node:crypto';

export class EmailError extends Error {
  constructor(public readonly code: 'not_configured' | 'unavailable') {
    super(code === 'not_configured' ? 'Il servizio email deve essere configurato dal gestore del sito.' : 'Il servizio email non è disponibile al momento. Riprova più tardi.');
  }
}

function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = process.env.APP_URL?.trim();
  if (!apiKey || !from || !appUrl || appUrl === 'MY_APP_URL') throw new EmailError('not_configured');
  let url: URL;
  try { url = new URL(appUrl); } catch { throw new EmailError('not_configured'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || /[\r\n]/.test(from)) throw new EmailError('not_configured');
  url.pathname = url.pathname.replace(/\/?$/, '/');
  return { apiKey, from, url };
}

export function assertEmailConfigured(): void { config(); }

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const { apiKey, from, url } = config();
  url.hash = 'reset-password=' + token;
  const resetUrl = url.toString();
  const text = `Hai richiesto di reimpostare la password di TRACKLIST.\n\nApri questo link entro 30 minuti:\n${resetUrl}\n\nIl link può essere usato una sola volta. Se non hai richiesto il recupero, ignora questa email: la tua password non cambia.`;
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'password-reset/' + crypto.createHash('sha256').update(token).digest('hex') },
      body: JSON.stringify({ from, to: [to], subject: 'Reimposta la password di TRACKLIST', text,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;background:#111;color:#eee"><h1 style="color:#c7ff36">TRACKLIST</h1><h2>Reimposta la password</h2><p>Hai richiesto una nuova password per il tuo account.</p><p><a href="${escape(resetUrl)}" style="display:inline-block;background:#c7ff36;color:#111;padding:14px 22px;border-radius:12px;text-decoration:none">Imposta una nuova password</a></p><p>Il link scade tra 30 minuti e può essere usato una sola volta.</p><p>Se non hai richiesto il recupero, ignora questa email. La tua password non cambia.</p></div>` }),
    });
    if (!response.ok) throw new EmailError('unavailable');
    const result = await response.json();
    if (!result.id) throw new EmailError('unavailable');
  } catch { throw new EmailError('unavailable'); }
}
