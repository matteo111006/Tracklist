# TRACKLIST — correzioni del 8 novembre 2026

## Salvataggi e sincronizzazione

- Eliminata la ricorsione tra inizializzazione album e artisti.
- I voti sono scritti subito nel browser; Fatto li conferma in una sola operazione senza riscrivere una vecchia copia dell'album.
- Modifiche offline riconciliate all'avvio successivo, al ritorno della connessione o tornando alla pagina.
- Sincronizzazioni serializzate con timeout, ritentativi e revisioni sul server. Una risposta lenta non cancella le modifiche fatte durante la richiesta.
- Unione delle modifiche per album, traccia e campo rispetto all'ultima copia sincronizzata. In caso di modifica concorrente dello stesso campo prevale la modifica locale del dispositivo che sta riconciliando.
- Dati locali separati per account. Solo la registrazione trasferisce l'archivio ospite al nuovo account.
- Migrazione dei dati esistenti v4/v5 e memorizzazione compatta del catalogo iniziale.
- Indicatore visibile per salvataggio nel browser, attesa, sincronizzazione completata ed errore. Gli errori di spazio non vengono più ignorati.

## Altre correzioni

- Token obbligatorio per leggere e scrivere archivi sul server: non basta un ID utente.
- Scritture del server tramite file temporaneo e sostituzione, validazione degli archivi e rifiuto delle revisioni obsolete.
- Limitazione dei tentativi di accesso e risposte autenticate escluse dalla cache.
- API condivise tra sviluppo, anteprima della build e server di produzione.
- Ricerca Spotify adattata alla risposta reale del backend. Voti associati al brano corrispondente, senza trasferirli a una canzone diversa nella stessa posizione. Tracce manuali mantenute.
- Aggiornamenti asincroni di copertine e biografie uniti ai dati attuali; protezione delle personalizzazioni manuali.
- Bozze escluse da classifica, confronto, Awards e Wrapped; disponibili tra gli album da valutare.
- Confronto corretto anche con media zero.
- Annullamento cancellazione con ripristino dei voti e delle raccolte.
- Backup JSON esteso a raccolte, personalizzazioni delle discografie e cancellazioni.
- Corretti gli hook React nelle finestre condivisione e import/export; gestione errori delle copertine remote nell'esportazione grafica.
- Dipendenze compatibili e package-lock riproducibile.
- Pulsanti Salva uniformati: chiusura dell'editor dopo salvataggio riuscito, errori mostrati senza perdere i campi, protezione dai doppi clic. Il profilo torna in visualizzazione dopo Salva e la timeline termina la modalità di modifica.
- Login obbligatorio senza sessione verificata, nessuna esposizione temporanea del catalogo durante la verifica. Nuovi account vuoti e nessuna copia automatica degli album dell'ospite. Stato degli editor ripulito all'uscita e al cambio account.
- Catalogo storico spostato nel backend con accesso riservato al proprietario; rimossi backup e immagini di riferimento dalle risorse pubbliche. Anche il server di sviluppo blocca i percorsi di dati, segreti e sorgenti privati.
- Timeline artisti riprogettata con anni grandi, asse cronologico graduato e pubblicazioni raggruppate per anno. Navigazione diretta tramite anni, evidenziazione dell'anno visibile, filtri Album/EP e scorrimento adattato allo schermo. Resa desktop e mobile verificata nell'anteprima; nessuna modifica ai dati della discografia.
- Animazioni diffuse: feedback di passaggio e pressione sui pulsanti, ingresso dei moduli, comparsa progressiva delle liste quando entrano nello schermo, schede raccolte animate, contatori nelle classifiche/profilo/statistiche/Wrapped, asse e nodi della timeline, conferma visiva della sincronizzazione e messa a fuoco dei campi. Impostazione di movimento ridotto rispettata globalmente; contatori istantanei e coriandoli disattivati con tale preferenza. Verificati menu mobile, filtri, finestre e salvataggio con chiusura; TypeScript e build superati.

## Verifica

88 test automatici superati su persistenza, offline, richieste concorrenti, conflitti, account, autorizzazioni API, recupero password, invio email simulato, import/export, Spotify, statistiche e personalizzazioni. Inclusi test con due account e ID falsificato e blocco delle risorse private. Controllo TypeScript e build di frontend/backend completati. Verificato nel browser il login obbligatorio senza sessione, e il mantenimento dei 294 album del proprietario dopo la verifica della sessione esistente.
Verifica nel browser: modifica voto, conferma, ricaricamento, controllo del valore persistito e ripristino del voto di prova; apertura condivisione e import/export.

## Limiti e configurazione

Questa è una copia locale corretta, non una distribuzione sulla precedente istanza online.
La sincronizzazione tra dispositivi richiede lo stesso server pubblicato con una directory .data persistente. La pubblicazione dei soli file statici non fornisce account o sincronizzazione.
Il backend conserva gli archivi in file JSON: per più processi o istanze concorrenti occorre un database condiviso transazionale. Le revisioni attuali proteggono le richieste concorrenti della singola istanza Node.
Il recupero password è implementato tramite Resend, con link monouso di 30 minuti e revoca delle vecchie sessioni. L'attivazione dell'invio reale richiede la chiave API del proprio account; vedere CONFIGURAZIONE-EMAIL.md.
Le credenziali Spotify sono facoltative; i ripieghi pubblici dipendono dai servizi esterni. Le API esterne non sono state validate con credenziali Spotify reali.
L'archivio locale dipende dall'origine: usare sempre lo stesso indirizzo, per esempio http://127.0.0.1:3000, senza alternarlo con localhost o altre porte.

## Wrapped, Awards e statistiche avanzate

- Wrapped: profilo basato sui voti, quota di tracce da 8 in su, dieci perfetti, artisti esplorati, avanzamento dell'archivio, confronto con l'anno precedente e riepilogo JSON scaricabile. Gli anni sono quelli di uscita degli album, non periodi di ascolto.
- Awards: nuova scheda Premi speciali con album più omogeneo, miglior apertura, miglior chiusura e quota di brani da 9 in su. Ammessi album standard confermati con almeno cinque tracce tutte valutate; pareggi condivisi. Artista in crescita confrontato con l'anno precedente, collaborazioni incluse.
- Statistiche: filtri per anno ed edizione applicati a tutte le schede, esportazione CSV, nuova scheda Approfondimenti con dispersione dei voti, percentuale da 8 in su, dieci, recensioni, album omogenei e album da completare. Bozze escluse dalle metriche ufficiali; voto zero valido.
- Otto test aggiuntivi per dati vuoti, zero, bozze, anni, pareggi, ordine della tracklist, crescita degli artisti e protezione delle celle CSV. Verificati filtri vuoti e ripristino, download CSV, criteri dei premi e layout mobile senza overflow. Nessun errore console; TypeScript e build superati.

- Awards Artisti: tutte le categorie, le collaborazioni, i riepiloghi e lo storico dell'artista rivelazione considerano solamente standard e deluxe confermate. Remaster e versioni modificate escluse. Regole di Awards Album e Brani mantenute. Test dedicato su esclusioni, deluxe, conteggi, storico e dati vuoti superato.


- Awards Artisti: tutti i vincitori con uguale punteggio sono inclusi, anche nelle collaborazioni e nelle categorie per conteggio. Classifica con posizioni condivise e tutti gli ex aequo al quinto posto. I migliori artisti ex aequo condividono una sola scheda con titolo unico. Test dedicato ai pareggi e al limite di classifica superato; anteprima verificata con Sfera Ebbasta e Shiva nel 2025.


- Tipografia aggiornata a Nunito Sans variabile: forme più morbide, titoli con peso 500, grassetti alleggeriti e cifre allineate nei riepiloghi. Anteprima verificata e build completata.

- Tipografia rivista: Lato per interfaccia e numeri, Lora in corsivo per gli accenti dei titoli principali. Introdotti corsivi reali nei testi introduttivi di Classifica, Wrapped, Awards e Statistiche e nella frase della sidebar. Sostituisce Nunito Sans. Build e stili nel browser verificati.

- Tipografia finale: Source Sans 3 per testi e numeri, Dancing Script con lettere collegate per alcune parole dei titoli. Rimossi i corsivi dalle introduzioni e dalla frase della sidebar. Verificata la resa effettiva del font scritto a mano nell'anteprima; build completata.

- Uniformato Dancing Script all'intero titolo nelle sezioni con accenti scritti a mano: Classifica, Album da valutare, Aggiungi, Confronto, Wrapped, Awards, Raccolte e Statistiche. Mantenuti gli accenti verdi. Verificati nel browser La classifica e Album da valutare; build completata.

## Nuove esperienze musicali (modalità locale)

- Nuova pagina iniziale Per te, dopo l'accesso: sfida giornaliera con medie nascoste, album da completare, riascolti e scoperta del giorno. La scelta della sfida è salvata per account e giorno, con le medie del momento; non cambia i voti.
- Identità musicale: media, percentuale da 8 in su, confronto apertura/finale, generi ed esempi verificabili. Le etichette descrittive hanno criteri visibili e non rappresentano un'analisi psicologica.
- Chiedi all'archivio: domande locali riconosciute su aperture/finali, migliori/peggiori album, anno di uscita, omogeneità e artisti discontinui, con risultati apribili. Le domande non riconosciute mostrano i limiti e gli esempi, senza inventare risposte.
- Scoperte: tre proposte motivate tra album ancora da valutare, feedback persistente (conosciuto/interessato/non fa per me), lista interessi e ricerca online facoltativa con aggiunta all'archivio. La ricerca filtra risultati non pertinenti e ha timeout; la disponibilità dipende dai cataloghi esterni.
- Disco ideale: scelta e ricerca delle tracce, eliminazione dei duplicati tra edizioni, riordino, copertina a colori, salvataggio privato nelle Raccolte, caricamento/modifica ed esportazione SVG di copertina e sequenza. Massimo 20 tracce; nessun audio viene esportato.
- Wrapped raccontato: modalità narrativa o ironica con dati effettivi, scheda SVG condivisibile e racconto TXT scaricabile, per anno di uscita.
- Confronto standard/deluxe: medie, delta, titoli comuni, brani aggiunti e relativa media, con indicazione dei dati mancanti e dei confronti provvisori.
- Riascolta e rivaluta nelle schede album: modulo separato con vecchi voti visibili, nota facoltativa e salvataggio finale che chiude il modulo. Annulla non cambia i voti.
- Cronologia: fino a 100 versioni per album, grafico delle medie, registro generale e ripristino che conserva lo stato precedente. Il primo evento conserva una copia dello stato preesistente, con data dei vecchi voti dichiarata sconosciuta. Si registrano voti, tracklist, titolo, artista, anno, edizione, generi, etichetta e recensione; copertine e durata non fanno parte del ripristino.
- Cronologia, feedback, sfide e tracklist ideali inclusi nei backup e nella sincronizzazione per account; validazione condivisa per import e server. Compressione trasparente dei dati locali con lz-string, compatibile con la lettura dei dati precedenti; i backup esportati restano normali JSON.
- Nessun modello IA generativo collegato, come richiesto per questa prima modalità senza chiave: analisi, risposte riconosciute e racconti sono calcolati localmente. Non sono stati aggiunti percorsi, obiettivi o notifiche ricorrenti.
- 88 test automatici superati, TypeScript e build completati. Verifiche nel browser: nuova home, identità, domande, riordino ed esportazione disco ideale, apertura/annullamento riascolto, confronto edizioni, racconto/esportazione Wrapped e layout mobile senza overflow. Verifica delle scritture, del ripristino e dell'isolamento account eseguita con dati sintetici nei test, senza riscrivere i voti reali per provare le nuove funzioni.
- Ricaricare le schede già aperte per usare la nuova versione e il formato di memorizzazione locale aggiornato.

## Gemini attivato

- Collegamento reale a Google Gemini per Identità musicale, domande libere all'archivio, suggerimenti di album e Wrapped raccontato. Pulsanti espliciti di generazione; nessun invio automatico al caricamento.
- Chiave API esclusivamente sul server, caricata da .env.local in sviluppo e produzione. Verificato che la chiave non sia inclusa nel bundle del browser. Modello configurabile con GEMINI_MODEL, predefinito gemini-flash-lite-latest, verificato con la chiave fornita.
- Endpoint IA autenticati: leggono l'archivio dell'account associato al token, ignorando ID utente o cataloghi inseriti nel corpo della richiesta. Il contesto comprende solo metadati musicali, statistiche calcolate e voti; esclusi profilo, email, recensioni, note di cronologia, copertine e credenziali.
- Risposte JSON validate, riferimenti album limitati a quelli del proprio contesto, testi resi come testo semplice, raccomandazioni verificabili tramite ricerca nel catalogo. Non è presente navigazione autonoma del modello.
- Errori di rete, quota, autorizzazione e formato gestiti senza esporre il corpo degli errori del fornitore. Timeout, una generazione per account alla volta, limite di 20 richieste per 15 minuti e cache privata per 10 minuti. Limiti del contesto e possibili errori dell'IA indicati nell'interfaccia; modalità locale conservata.
- Le modifiche ai voti in attesa di sincronizzazione vengono inviate al proprio server prima della generazione; la richiesta è annullata se cambia l'account.
- Diagnostica npm run ai:check con dati sintetici; prova reale superata. Verificate nel browser la generazione del ritratto musicale e la risposta a una domanda libera con dati effettivi. 78 test automatici, TypeScript e build superati.

## Upgrade di utilizzo e navigazione

- Ricerca globale sempre accessibile nella barra superiore, con Ctrl+K o Cmd+K, categorie Album/Artisti/Tracce, selezione con frecce e Invio, chiusura con Esc. I risultati delle tracce aprono la scheda evidenziando e raggiungendo il brano corretto. La ricerca usa soltanto l'archivio dell'account corrente.
- Navigazione con URL, pulsanti Indietro/Avanti e memoria dello scorrimento per voce della cronologia. Il ritorno da un album conserva ricerca, filtri e ordinamento. I controlli Indietro nelle schede tornano alla pagina di provenienza. I collegamenti a un album non disponibile nell'account mostrano un messaggio senza esporre dati altrui.
- Preferenze della schermata conservate nella sessione della scheda, separate per account: classifica, anno e scheda di Awards/Wrapped/Statistiche, scheda artista, confronti e sezione di Per te.
- Valutazione rapida da tastiera: voto con virgola o punto, Invio per confermare e avanzare, precedente, salto e salvataggio finale con chiusura. I voti restano in bozza fino a Salva e chiudi; Annulla non modifica l'archivio. Controllo di intervallo e passi di 0,25, voto zero valido, protezione da cambiamenti concorrenti della tracklist o dello stesso voto.
- Confronto con il voto precedente e delta immediato, sia nel modulo rapido/riascolto sia nella valutazione con slider. Riascolti e cronologia conservano il funzionamento precedente.
- Barra mobile inferiore con Per te, Cerca, Aggiungi e Archivio, compatibile con l'area sicura dello schermo. Indicatore di sincronizzazione posizionato sopra la barra.
- Viste salvate nell'account: filtri, ricerca, anno, edizione, artista e ordinamento. Comandi rapidi Standard dell'anno corrente, Album incompleti e Preferiti da riascoltare (media almeno 8 su album confermati). Le viste includono anche la possibilità di mostrare tutto l'archivio; le medie mancanti restano trattini. Rimozione annullabile e massimo 30 nuove viste dall'interfaccia. Viste comprese in backup e sincronizzazione.
- Conversazioni Gemini persistenti: selezione della conversazione, risposte precedenti, approfondimenti con contesto letto dall'account autenticato, data di generazione, esportazione del dialogo e avviso quando l'archivio musicale è cambiato. Conservate le 20 conversazioni più recenti e le ultime 12 risposte per conversazione. Le risposte generate prima dell'introduzione di questo salvataggio non vengono ricostruite.
- Validazione di viste e conversazioni condivisa fra import e API; isolamento tra account verificato anche tentando di usare un ID conversazione appartenente ad altri. Le classifiche fornite a Gemini includono ordinamento numerico già calcolato e riferimenti coerenti.
- Nessun intervento di ottimizzazione delle prestazioni richiesto nell'elenco escluso: nessun caricamento differito delle sezioni, virtualizzazione delle liste o modifica delle copertine/animazioni.
- 88 test automatici superati, TypeScript e build completati. Verificati nel browser: ricerca globale e Ctrl+K, apertura del brano trovato, validazione del voto rapido, avanzamento/ritorno e annullamento, filtri conservati, Indietro/Avanti con ripristino della stessa posizione, conversazione reale con approfondimento recuperata dopo ricarica, barra e ricerca su mobile senza overflow.

## Editor artista ampliato
Finestra ampia con foto e biografia affiancate su desktop, area testo ridimensionabile, contenuto scorrevole e comandi sempre visibili. Dialogo separato dalla pagina per evitare ritagli dovuti alle animazioni; navigazione da tastiera e blocco dello scorrimento di sfondo. Campi immagine adattabili agli spazi stretti. TypeScript e build verificati; ultima verifica mobile nel browser integrato non disponibile per timeout del server locale.


## Biografie degli artisti musicali
La ricerca verifica il ruolo musicale e la corrispondenza con gli album dell'archivio, scarta luoghi, soggetti mitologici e disambiguazioni e non sceglie più indiscriminatamente il primo risultato. Se non ci sono elementi sufficienti, mantiene la descrizione attuale e mostra un messaggio nell'editor. Le biografie manuali restano protette dagli aggiornamenti automatici. Le risposte di arricchimento vengono scartate dopo un cambio account. Verifica: 91 test superati, TypeScript e build riusciti.


## Identità degli artisti nella timeline
I cataloghi esterni richiedono riscontro con un album dell'archivio (ID Spotify oppure titolo completo e anno). Rimossi i ripieghi sul primo risultato e i confronti parziali dei nomi; l'attribuzione usa gli ID dei cataloghi. I cataloghi senza riscontri vengono esclusi e la timeline conserva le uscite presenti nell'archivio e quelle personalizzate. Le fonti possono quindi mostrare meno uscite quando l'identità non è verificabile. Verifica: 94 test superati, TypeScript e build riusciti.


## Ricerca automatica contestuale
Risultati ordinati per corrispondenza del testo, artisti presenti e genere prevalente dell'archivio, con opzione per disattivare la personalizzazione. Deduplicazione per titolo e artista, confronto per parole intere e catalogo Deezer complementare anche quando Spotify restituisce un risultato. Importazione tracce e metadati Deezer supportata. Prova reale: Persona restituisce Marracash per primo con contesto Marracash/rap e recupera 17 tracce. 97 test superati; TypeScript e build verificati.


## Prova stile Glass
Aspetto Glass predefinito: sfondo blu petrolio con luce diffusa, pannelli traslucidi, bordi luminosi, navigazione e campi coordinati. Il pulsante in alto permette il ritorno immediato allo stile originale e ricorda la preferenza sul browser. File CSS separato e copia dello stile precedente conservata. Verificati TypeScript, build e passaggio Glass/originale nell'anteprima.


## Aspetto nel Profilo: Nero, Bianco e Glass
Rimosso il pulsante di stile dalla barra superiore. Nel Profilo la sezione Aspetto del sito permette di scegliere Nero (originale), Bianco e Glass con anteprime, selezione accessibile e applicazione immediata. La scelta viene ricordata sul browser. Glass resta attivo; il tema chiaro usa superfici bianche, testo scuro e accenti verdi leggibili. Verificati i tre cambi nell'anteprima, TypeScript e build.


## Raccolte in vinile
Dal nome della raccolta o dal pulsante Sfoglia i vinili si apre un carosello con custodie, dischi a solchi concentrici, riflessi e prospettiva realizzati in CSS. L'ordine segue gli album della raccolta, parte dal primo e si controlla con frecce, rotella, trackpad, tastiera e scorrimento touch. Apri album porta alla scheda del disco selezionato. Nessuna modifica ai dati della raccolta; temi Nero, Bianco e Glass supportati, movimento ridotto rispettato. Verificato nell'anteprima il passaggio dal primo al secondo disco e il ritorno da tastiera.

