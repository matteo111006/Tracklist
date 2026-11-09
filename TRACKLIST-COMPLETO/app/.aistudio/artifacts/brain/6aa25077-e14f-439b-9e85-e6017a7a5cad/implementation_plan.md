# Persistenza Permanente, Sincronizzazione Multi-Dispositivo & Modifica Manuale Artisti

Risoluzione definitiva del problema di reset dei dati al refresh della pagina, sincronizzazione cloud multi-dispositivo tramite autenticazione con account personale e interfaccia dedicata per la modifica manuale di foto e biografie degli artisti nella scheda artista.

## Revisione Utente & Decisioni Confermate

> [!IMPORTANT]
> Decisioni confermate dall'utente nella Fase 1 di chiarimento:
> - **Sincronizzazione Multi-Dispositivo**: Accesso con account personale per sincronizzare tutti i dispositivi in tempo reale tramite backend cloud.
> - **Modifica Foto e Biografia Artista**: Pulsante dedicato "Modifica Artista" direttamente nella scheda dell'artista con upload fotografico locale, campo URL e textarea biografia.

---

## 1. Analisi delle Cause del Problema di Reset

Dall'analisi del codice attuale sono emerse le cause precise per cui le modifiche si resettano o sembrano perdersi al refresh:

1. **Mancanza di Pull Cloud automatico all'avvio dell'applicazione (`App.tsx`)**:
   - Quando l'utente ricarica la pagina o apre l'app da un altro dispositivo con il proprio account, `storage.pullFromCloud()` non veniva mai invocato al montaggio di `App.tsx` (era presente solo al momento del click su "Accedi"). Di conseguenza, lo stato locale non recuperava i dati salvati sul server cloud.
2. **Sovrascrittura automatica di foto e biografie (`ArtistaView.tsx`)**:
   - Quando l'utente caricava una foto o salvava una bio, la proprietà `isManualImage` / `isManualBio` non veniva sempre valorizzata a `true`.
   - Ad ogni apertura/refresh della scheda artista, l'`useEffect` di background rilevava l'artista e lanciava chiamate a Spotify (`/api/spotify/lookup-cover`) e Wikipedia (`/api/artist/bio`), sovrascrivendo le modifiche manuali dell'utente.
3. **Gestione del ciclo di vita del LocalStorage**:
   - `storage.saveAlbum`, `storage.saveArtist` e `storage.updateTrackRating` salvano su `localStorage`. Se un'immagine viene caricata senza compressione adeguata o se la sessione non è sincronizzata, il salvataggio locale può fallire o risultare isolato nel browser specifico.

---

## 2. Esperienza Utente & Flussi di Interazione

### A. Modifica Manuale Foto e Biografia Artista
- **Pulsante "Modifica Artista"**: Posizionato nella testata della scheda artista (`ArtistaView.tsx`), accanto al nome dell'artista, con icona a matita (`Pencil`).
- **Modale di Modifica Completa**:
  - **Fotografia dell'artista**:
    - Upload diretto da file locale (JPG, PNG, WEBP) con compressione ottica a 600x600px.
    - Campo alternativo per inserire un URL immagine online.
    - Anteprima istantanea e pulsante "Ripristina foto originale".
  - **Biografia / Descrizione**:
    - Area di testo espandibile con conteggio caratteri (max 1.500 caratteri).
    - Tasto opzionale "Genera / Cerca bio online" per avere una base di partenza modificabile.
  - **Lock Anti-Sovrascrittura**:
    - Flag esplicito `isManualBio: true` e `isManualImage: true`.
    - Nessun processo automatico potrà più modificare o sovrascrivere l'artista.
  - **Pulsanti di azione**: "Annulla" e "Salva Modifiche" con feedback visivo immediato ("Salvato ✓").

### B. Persistenza e Sincronizzazione Multi-Dispositivo
- **Avvio dell'applicazione (`App.tsx`)**:
  - All'avvio dell'app viene verificata la sessione utente (`/api/auth/me`). Se presente una sessione attiva, viene eseguito immediatamente `storage.pullFromCloud()` per caricare istantaneamente voti, album, raccolte e modifiche agli artisti aggiornati da qualsiasi dispositivo.
- **Salvataggio Real-Time e Auto-Sync**:
  - Ogni azione (voto a una traccia, inserimento/modifica album, modifica foto o bio artista) salva immediatamente nel database locale e invia con debounce una richiesta a `/api/sync` sul server.
- **Indicatore di Stato nella Sidebar**:
  - Se l'utente è loggato: indicatore discreto "Cloud Sincronizzato" con nome utente e avatar.
  - Se l'utente non è loggato: pulsante chiaro "Accedi / Sincronizza" che spiega che l'accesso garantisce la sincronizzazione automatica su tutti i dispositivi.

---

## 3. Architettura Tecnica & Flusso dei Dati

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
│  - Mount: check /api/auth/me -> storage.pullFromCloud()│
│  - State: albums, artists, profile, collections, auth  │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       ┌────────▼────────┐      ┌────────▼────────┐
       │   ArtistaView   │      │ AlbumDetailView │
       │ [Modifica Art.] │      │ [Valuta Tracce] │
       └────────┬────────┘      └────────┬────────┘
                │                        │
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│                   storage.ts (Service)                 │
│  - saveArtist(artist, { isManualBio, isManualImage })  │
│  - updateTrackRating(), saveAlbum()                    │
│  - localStorage (persistenza offline/istantanea)       │
│  - scheduleCloudSync() -> POST /api/sync               │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│            Server API (/api/auth & /api/sync)          │
│  - .data/userdata/<userId>.json                        │
│  - Sincronizzazione permanente condivisa multi-device  │
└────────────────────────────────────────────────────────┘
```

---

## 4. Piano di Esecuzione Dettagliato

1. **Protezione dei dati degli artisti contro le sovrascritture automatiche**:
   - In `src/types/index.ts`: verificare e consolidare `isManualBio?: boolean` e `isManualImage?: boolean` nel tipo `Artist`.
   - In `src/components/ArtistaView.tsx`:
     - Disattivare le chiamate automatiche di fetch bio/cover se `currentArtist.isManualBio` o `currentArtist.isManualImage` sono impostati.
     - Implementare il modale completo di modifica artista con anteprima foto, upload locale, campo URL, editor bio e salvataggio con flag manuali attivi.
2. **Risoluzione definitiva del reset al refresh della pagina**:
   - In `src/App.tsx`:
     - Aggiungere al montaggio del componente la verifica della sessione utente e la sincronizzazione iniziale: `storage.pullFromCloud()`.
     - Assicurare che tutti i listener di eventi (`tracklist:albums_updated`, `tracklist:artists_updated`, ecc.) aggiornino immediatamente lo stato di React.
3. **Rafforzamento della sincronizzazione cloud in `src/services/storage.ts`**:
   - In `storage.saveArtist`: preservare rigidamente i flag `isManualBio` e `isManualImage`.
   - Gestire i casi in cui `localStorage` sia pieno o corrotto (try-catch difensivo con serializzazione pulita).
   - Assicurare che `pushToCloud()` invii tutti gli artisti personalizzati e che `pullFromCloud()` li memorizzi preservando i flag manuali.
4. **Verifica End-to-End con browser headless (Playwright)**:
   - Login con account utente.
   - Modifica manuale della foto e della biografia di un artista.
   - Valutazione di un album.
   - Ricaricamento completo della pagina (`reload`).
   - Verifica visiva che i voti, la foto e la descrizione dell'artista siano rimasti intatti e salvati nel cloud.
