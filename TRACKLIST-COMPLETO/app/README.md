# TRACKLIST

Applicazione React e TypeScript per catalogare, valutare e confrontare album.

## Avvio locale

Richiede Node.js 22.12 o successivo e npm.

    npm ci
    npm run dev

Aprire http://127.0.0.1:3000. Senza una sessione verificata viene mostrato solo il login. Ogni account ha un archivio separato e i nuovi account partono vuoti. Una sessione ancora valida viene ripristinata dopo il controllo sul server.

## Controlli e produzione

    npm test
    npm run typecheck
    npm run build
    npm start

La build genera dist/ per l'interfaccia e dist-server/ per il backend. npm start avvia entrambi sulla stessa origine. npm run preview fornisce un'anteprima della build con le API.

Il server usa PORT (predefinita 3000) e HOST (predefinito 127.0.0.1). Nell'hosting impostare HOST=0.0.0.0, abilitare HTTPS tramite l'hosting e montare un volume persistente per .data/. TRACKLIST_DATA_DIR permette di scegliere la directory padre di .data/.

Non includere .data/ nel repository o nel frontend pubblico: contiene account, sessioni e archivi personali. Questa consegna non include tali file né credenziali.

Il catalogo storico è stato spostato nel backend e rimosso dai file pubblici. L'accesso di migrazione è limitato al proprietario indicato in `.data/legacy-owner.json`, già configurato sull'istanza locale; conservarlo insieme ai dati in caso di trasferimento del server. In alternativa l'amministratore può impostare `LEGACY_CATALOG_OWNER_ID`. I riferimenti locali del vecchio formato vengono risolti solo dopo l'accesso del proprietario. Le vecchie immagini di riferimento e i backup presenti nell'archivio iniziale sono stati conservati fuori dalla cartella pubblica, nella directory di lavoro privata.

## Spotify e servizi esterni

Configurare SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET nell'ambiente del server o nel file .env. In sviluppo sono letti anche i file .env.local di Vite. Le chiavi restano sul server. In loro assenza vengono usati servizi pubblici alternativi quando disponibili.

Il recupero password è integrato con Resend. Impostare RESEND_API_KEY, EMAIL_FROM e APP_URL; vedere CONFIGURAZIONE-EMAIL.md. La prima prova senza dominio usa onboarding@resend.dev e invia solo alla casella associata all'account Resend. `npm run email:check` controlla la configurazione senza inviare email.

Vedere NOTE-CORREZIONI.md per correzioni, politica dei conflitti e limiti del backend a istanza singola.
