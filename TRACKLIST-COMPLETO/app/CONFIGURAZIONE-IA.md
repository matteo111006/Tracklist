# Configurazione IA di TRACKLIST

La chiave Gemini si trova esclusivamente nel file locale `.env.local`, nella directory del progetto:

```env
GEMINI_API_KEY="la_tua_chiave"
GEMINI_MODEL="gemini-flash-lite-latest"
```

GEMINI_MODEL è facoltativo. Non usare il prefisso VITE_ per la chiave. In produzione si possono usare le variabili d'ambiente del server; hanno precedenza sui file locali. Riavvia il server dopo una modifica alle variabili.

La chiave e `.env.local` sono esclusi dallo ZIP del progetto. Prima di avviare una copia estratta, configura la sua chiave e le altre variabili già documentate.

## Verifica

Esegui `npm run ai:check`: la prova usa album sintetici, non invia l'archivio personale e non stampa la chiave. Per il sito: accedi, apri **Per te**, poi **Identità musicale** o **Chiedi all'archivio**, e premi il pulsante Gemini. In **Scoperte** e **Wrapped** trovi le altre generazioni.

L'interfaccia mostra quali dati vengono inviati prima del clic. Ogni richiesta è autenticata e usa solo l'archivio dell'account corrente. Le funzioni locali restano disponibili senza chiave o se la quota Gemini termina.

Il server limita ogni account a 20 generazioni in 15 minuti, una alla volta, e riutilizza per 10 minuti le risposte alla stessa richiesta con gli stessi dati. Per più istanze server, limiti e cache devono essere condivisi tramite un servizio comune.
