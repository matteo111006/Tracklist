# Pubblicare TRACKLIST su Render con database Turso

Su Render free il disco si azzera a ogni riavvio, quindi account e archivi ora
sono salvati su Turso (SQLite gestito). In locale, senza configurare nulla,
l'app usa il file `.data/tracklist.db`.

## 1. Creare il database su Turso

Dal sito https://turso.tech (oppure con la CLI `turso`):

    turso db create tracklist
    turso db show tracklist --url        -> TURSO_DATABASE_URL (libsql://...)
    turso db tokens create tracklist     -> TURSO_AUTH_TOKEN

Le tabelle vengono create automaticamente al primo avvio.

## 2. Copiare i dati esistenti (facoltativo)

Se hai gia' account e archivi nella vecchia cartella `app/.data` (file JSON):

1. Nella cartella `app`, metti URL e token in `.env.local`:

       TURSO_DATABASE_URL="libsql://..."
       TURSO_AUTH_TOKEN="..."

2. Esegui:

       npm install
       npm run db:migrate

Copia utenti, archivi e il proprietario del catalogo storico. Le sessioni non
vengono copiate: dopo la migrazione basta rifare l'accesso.

Attenzione: con TURSO_DATABASE_URL in `.env.local` anche l'avvio locale usera'
Turso (stessi dati del sito online). Togli la riga se vuoi tornare al file locale.

## 3. Pubblicare su Render

1. Fai il push del repository su GitHub (`.data/` e `.env*` sono gia' esclusi).
2. Su Render: New > Blueprint e scegli il repository: `render.yaml` nella radice
   configura tutto (cartella `TRACKLIST-COMPLETO/app`, build, avvio, health check).
   In alternativa crea un Web Service a mano con:
   - Root Directory: `TRACKLIST-COMPLETO/app`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
3. Variabili d'ambiente:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (obbligatorie)
   - `APP_URL` = indirizzo pubblico, es. `https://tracklist.onrender.com`
     (serve per i link di recupero password)
   - facoltative: `RESEND_API_KEY`, `EMAIL_FROM`, `SPOTIFY_CLIENT_ID`,
     `SPOTIFY_CLIENT_SECRET`, `GEMINI_API_KEY`, `LEGACY_CATALOG_OWNER_ID`

Nei log di Render all'avvio deve comparire `Database: Turso`.

## Note

- Sul piano free Render sospende il servizio dopo un periodo di inattivita':
  la prima apertura puo' richiedere qualche decina di secondi, ma i dati restano.
- Le copertine caricate come immagini finiscono dentro l'archivio dell'utente:
  archivi molto pesanti rallentano il salvataggio. Preferisci copertine via URL.
