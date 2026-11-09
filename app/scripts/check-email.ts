import dotenv from 'dotenv';
import { assertEmailConfigured } from '../server/email';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
try {
  assertEmailConfigured();
  console.log('Configurazione email presente. Per verificare la consegna usa Password dimenticata con un account di prova registrato.');
} catch {
  console.error('Invio email non attivo. Compila RESEND_API_KEY, EMAIL_FROM e APP_URL in .env.local (sviluppo) o nell’ambiente del server (produzione). Nessuna email inviata.');
  process.exitCode = 1;
}
