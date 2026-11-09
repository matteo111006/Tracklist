# Ottimizzazioni della versione Render + Turso

- Caricamento separato delle 12 sezioni principali con indicatore di attesa, mantenendo menu e navigazione disponibili.
- Compressione locale più veloce, compatibile con i vecchi dati LZ. Nessuna eliminazione di album, voti, recensioni o raccolte.
- Cache delle letture del browser invalidata quando il valore cambia in un'altra scheda o si cambia account.
- Recupero dello spazio tramite ricompressione dei vecchi dati TRACKLIST quando la quota è esaurita, senza cancellare archivi.
- Sincronizzazione senza riscrivere o aggiornare sezioni i cui dati sono identici.
- Risposte di sincronizzazione grandi compresse via gzip, quando il dispositivo lo supporta.
- Rimossi il banner “Il tempo cambia i voti”, il pannello Cronologia e la generazione di vecchie versioni dell'album.
- Cronologie precedenti rimosse dal database alla prima lettura, con controllo atomico della revisione. Le vecchie schede non possono reinserirle tramite sincronizzazione. I dati attuali rimangono invariati.
- La copia di sicurezza prima delle modifiche è nella cartella outputs della chat Codex.

Misurazione locale sul catalogo incluso, mediana di tre esecuzioni: compressione precedente 336 ms, nuova 47 ms; spazio da 103182 a 83854 caratteri. Questi valori misurano la sola compressione, non il tempo di apertura dell'intero sito.

Le modifiche ai sorgenti non aggiornano da sole un eventuale sito Render già pubblicato: serve un nuovo deploy. Le verifiche automatiche usano SQLite temporaneo e non il database Turso reale.
