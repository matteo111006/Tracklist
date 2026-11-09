# Attivazione email TRACKLIST

L'integrazione Resend e il recupero password sono implementati. Nessuna email reale è stata ancora inviata: manca la chiave API del tuo account.

## Prima prova senza dominio

1. Crea un account su https://resend.com/signup usando la casella su cui vuoi ricevere la prova.
2. In https://resend.com/api-keys crea una chiave con permesso di invio (Sending access).
3. Nel file locale `.env.local` del progetto inserisci la chiave nella variabile `RESEND_API_KEY`. Non incollarla in chat e non usare variabili che iniziano con `VITE_`.
4. Per questa prova sono già predisposti:

```dotenv
APP_URL="http://127.0.0.1:3000"
EMAIL_FROM="TRACKLIST <onboarding@resend.dev>"
```

Il mittente di test può inviare solo alla casella associata al tuo account Resend. Non serve comprare un dominio per questa prima prova. Fonte: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

5. Esegui `npm run email:check`; se il server Vite non ricarica automaticamente la configurazione, riavvia `npm run dev`.
6. In TRACKLIST crea un account con lo stesso indirizzo usato su Resend, poi usa Password dimenticata. L'account deve esistere su questa istanza locale: gli account di una precedente versione online non sono trasferiti automaticamente.
7. Apri il link ricevuto nell'email, imposta la nuova password e prova ad accedere. Non condividere il link di recupero: consente di cambiare la password.

## Uso con utenti reali

Occorre aggiungere un dominio di tua proprietà in https://resend.com/domains e verificare i record DNS richiesti. Imposta EMAIL_FROM su un indirizzo del dominio verificato e APP_URL sull'indirizzo HTTPS del sito pubblicato. Mantieni disattivato il click tracking per le email di recupero password.

Sul server pubblicato configura le variabili nei segreti dell'hosting o in `.env`; `.env.local` è usato dallo sviluppo Vite. Non inserire segreti negli ZIP, nel frontend, in `public/` o nel repository. Conserva la directory `.data` su un volume persistente.

## Comportamento implementato

- Email in italiano, in formato testo e HTML.
- Link monouso valido 30 minuti; nel database è memorizzato solo l'hash del token.
- Token nel frammento URL, escluso dalla richiesta HTTP e dai normali log del server.
- Richiesta con risposta generica per gli indirizzi non registrati; massimo tre link attivi per account e limite delle richieste per IP.
- Password da 8 a 128 caratteri; cambio password con invalidazione di tutti i link di recupero e delle sessioni precedenti.
- Errori del provider gestiti senza esporre la chiave API o fingere un invio.
- Test automatici con provider simulato: nessun invio esterno durante i test.

La conferma positiva del provider indica che ha accettato l'email, non che la casella l'abbia già ricevuta. La prova reale va confermata aprendo la casella destinataria.
