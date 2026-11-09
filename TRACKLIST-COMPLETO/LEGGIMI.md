# TRACKLIST — copia completa privata

## Avvio su Windows

1. Estrai tutto lo ZIP in una cartella, mantenendo la struttura.
2. Fai doppio clic su `AVVIA-TRACKLIST.cmd`.
3. Apri http://127.0.0.1:3000 nel browser e accedi al tuo account.
4. Lascia aperta la finestra del server. Per arrestarlo, premi Ctrl+C in quella finestra.

La copia include Node.js per Windows e le dipendenze gia' installate. Non serve reinstallarle per l'avvio normale su un computer Windows compatibile. Se la porta 3000 e' occupata dall'anteprima originale, chiudi quella copia oppure cambia il valore PORT nel file di avvio.

## Contenuto

- `app/src`, `app/public`, `app/index.html`: codice e risorse del sito.
- `app/server`: backend, autenticazione, sincronizzazione e integrazioni.
- `app/dist` e `app/dist-server`: versione compilata pronta all'avvio.
- `app/node_modules`: dipendenze installate, incluse le componenti native Windows.
- `app/package.json`, `app/package-lock.json` e file di configurazione: dipendenze e istruzioni per ricompilare.
- `app/.data`: account e archivi salvati sul server al momento della copia.
- `app/.env.local`: configurazione privata dei servizi gia' impostati.
- `app/test`, test accanto ai sorgenti e `app/scripts`: controlli e strumenti.
- Tutti gli altri file del progetto originale, comprese le guide e il catalogo storico privato.
- `runtime/node.exe`: runtime Windows usato per l'avvio.

## Copia privata

Questo pacchetto contiene dati degli account e chiavi dei servizi. Conservalo come backup privato: non caricarlo integralmente in un repository pubblico e non condividerlo con altre persone. Non serve comunicare le chiavi in chat.

## Dati e servizi esterni

Gli archivi inclusi sono quelli gia' salvati sul server durante l'esportazione. Bozze non sincronizzate rimaste esclusivamente in un altro browser non possono essere trasferite automaticamente. Preferenze locali del browser, come il tema, si possono reimpostare nel Profilo.

Le copertine collegate a URL esterni richiedono che la relativa fonte resti disponibile; le immagini caricate e salvate nei dati sono incluse. Email, IA, Spotify e altri cataloghi continuano a dipendere dalla connessione Internet, dalle chiavi e dagli account dei rispettivi servizi. La copia non trasferisce la proprieta' di quegli account. Per recupero password o utilizzo su un altro indirizzo verifica il valore dell'URL dell'app nella configurazione email.

## Modifiche e ricompilazione

`AVVIA-SVILUPPO.cmd` avvia l'editor locale con aggiornamento delle modifiche ai sorgenti. Per lavorare con i comandi npm, installa Node.js compatibile e usa dalla cartella `app`:

```text
npm run typecheck
npm test
npm run build
```

La nuova build verra' usata da `AVVIA-TRACKLIST.cmd`. Su sistemi diversi da Windows reinstalla le dipendenze con `npm ci`, perche' quelle incluse sono specifiche del computer Windows di origine.
