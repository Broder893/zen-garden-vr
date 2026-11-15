# Giuria: Bloom Break (15 novembre 2026, ramo `polish`)

Cinque giudici, sulla base di ciò che un giudice vede davvero: link, video, pagina Devpost,
forse il repository. Niente emulatore: letti `DEVPOST.md`, `README.md`, `DEMO-VIDEO.md`,
`CREDITS.md`, `QUEST-TEST.md`, `QA-REPORT.md`, `PROGETTO.md`, la struttura di `src/`, `test/`,
`scripts/`; guardate le immagini di `artifacts/devpost/`, `artifacts/features/`,
`artifacts/first-minutes/` e quattro fotogrammi delle clip (`artifacts/video/v03`, `v04`,
`v05`, `artifacts/first-minutes/first-minutes.webm`). Copie ridotte e fotogrammi in
`artifacts/review/giuria/`. `npm test`: 59 test su 59 passano. Nulla è stato provato su un
visore, e il video definitivo non esiste ancora: lo giudico dal piano e dalle clip registrate.

## Voto complessivo: 6,5 su 10

Media dei quattro criteri (6 + 7 + 7,5 + 5,5) / 4 = 6,5. Un progetto solido e molto più
curato della media, con un tema già visto cento volte e una presentazione che oggi nasconde
proprio le due o tre cose che lo distinguono. Così com'è: finalista plausibile nella
categoria, non tra i primi tre. Con le cinque correzioni sotto (tutte di presentazione, zero
draw call) può arrivare a 7,5.

## Giudice 1, Innovazione e creatività: 6

Bonsai, giardino zen, respiro guidato, lucciola: è il tema più inflazionato delle esperienze
rilassanti, e miniatura e anteprima non dicono altro.

- **Alza il voto**: le palpebre ("Close your eyes", il mondo cambia mentre sono chiuse, con
  coda dei cambiamenti in `src/change-queue.ts`) sono l'unica idea che non ho visto altrove.
  La pianta che appassisce e guarisce sei volte più in fretta mentre respiri lega cura e
  respiro in una meccanica vera, non in due minigiochi affiancati. Il vento che segue il
  respiro. L'albero condiviso asincrono.
- **Abbassa il voto**: queste idee sono al terzo e al secondo punto di un elenco di otto in
  `DEVPOST.md` (righe 38-45), dopo una tagline che descrive un bonsai qualsiasi. Annaffiare,
  potare, livelli, regalo giornaliero, stagioni: tutto standard. "Productivity" è sostenuta
  solo dalla durata della pausa, che alla prima visita non esiste.
- **Cosa lo distingue davvero**: occhi chiusi più cambiamento non visto; guarigione col
  respiro. **Cosa no**: tutto il resto dell'elenco.

## Giudice 2, Design dell'esperienza: 7

Ritmo dei primi minuti pensato e misurato; ogni gesto ha una risposta; nessun errore punisce.
Ma dopo la fioritura la prima visita non ha più niente da dare.

- **Alza**: primo premio in 22-26 s, primo respiro a 26-30 s, fioritura a 78-81 s
  (`artifacts/first-minutes/times.md`). Sagoma dell'obiettivo, gesti fantasma, attrezzi che
  tornano al posto, "non ora" con la mano aperta, vie d'uscita dalle palpebre, primi minuti
  protetti dagli errori, fine della pausa mai a metà respiro.
- **Abbassa**: il tutorial arriva alla fioritura in un minuto e mezzo; poi "Rest, rake the
  sand..." e la prima pausa respiro arriva dopo 2-4 minuti di cura, quando non c'è più
  niente da curare. Timer, riepilogo, giorni di fila, regalo e sblocchi compaiono solo dalla
  seconda visita: un giudice ne fa una. Tutti i tempi sono di una mano scriptata, nessuno di
  una persona. Troppi sistemi per una pausa di cinque minuti (8 voci nel pannello Comfort,
  targa, cartello, pannello della durata, riepilogo): rischio di affollamento ai bordi.

## Giudice 3, Implementazione tecnica: 7,5

Il repository è la parte migliore del progetto. Il tetto è l'assenza totale di hardware.

- **Alza**: 13.000 righe in sistemi ECS piccoli e leggibili; moduli puri con 59 test
  (salvataggio con migrazioni v1, v2, v3, livelli, schemi di respiro, stagioni, coda dei
  cambiamenti, giorni di fila); budget automatico a 80 draw call e 100k triangoli
  (`scripts/check-budget.sh`); vento e nuvole negli shader senza draw call; qualità che si
  adatta; ripieghi per salvataggio, audio, voci, rete; servizio condiviso con validazione e
  limiti e un suo test; sessione di 15 minuti senza perdite (`QA-REPORT.md`).
- **Abbassa**: "almeno 60 fps su Quest" non è dimostrato: i 60 fps di `QA-REPORT.md` sono il
  tetto dell'emulatore su un computer. Il tracciamento reale delle mani (pizzico, mano
  aperta, tre dita come rastrello, 1,5 cm dalla sabbia) non è mai stato visto. Il servizio
  pubblicato e GitHub Pages non sono stati raggiunti dal computer di prova ("Not verified
  here"). `src/guide.ts` è un file da 883 righe che conosce quasi tutti gli altri sistemi.
  Nessun file `LICENSE` nel repository. Le clip mostrano il cartello "Offline for now".

## Giudice 4, Rifinitura e presentazione: 5,5

La documentazione interna è esemplare, ma il giudice non la legge. Quello che vede oggi è
incompleto o vecchio.

- **Alza**: pagina di atterraggio pulita con avanzamento del caricamento e messaggio
  d'errore; sottotitoli ovunque; voci registrate; `CREDITS.md` completo; coerenza visiva
  del low poly; piano del video con regole sensate (aggancio nei primi 5 secondi, niente
  voce fuori campo).
- **Abbassa**: il video non c'è (`DEVPOST.md` riga 23: "_(add the YouTube/Vimeo link)_").
  In tutte le immagini e le clip non si vede mai una mano: annaffiatoio e forbici volano da
  soli. Le immagini Devpost mostrano il giardino di prima del pomeriggio del 14. La
  descrizione è di 865 parole contro le circa 500 richieste, più 732 sulle mani. Il testo
  scritto da ingegnere ("checks the WebXR input sources every quarter second") dove serve
  un invito. "What's next" promette "birds", che ci sono già. Sottotitoli piccoli a 1080p.

## Giudice 5, premi speciali

| Premio | Voto | Credibilità come vincitore |
|---|---|---|
| Best First Five Minutes | 7,5 | Media-alta. È il premio più alla portata: tempi misurati e mostrabili, arrivo, obiettivo in luce, risposta a ogni gesto. Frena il fatto che i cinque minuti si esauriscono in due. |
| Best Accessibility Forward | 7 | Media. L'elenco è tra i più ampi che si vedano (tieni fermo, sguardo, una mano, alto contrasto, testo grande, ritmo, dissolvenze, tavolo regolabile, sottotitoli sempre). Ma è tutto dichiarato e nulla dimostrato con una persona o un visore. |
| Best Reason to Come Back | 5,5 | Bassa. Livelli, regalo, fiori, giorni di fila, albero condiviso esistono, ma il giudice non li incontra, e gli sblocchi sono decorazioni (vaso, lanterna, ruscello). |

### La singola cosa che più manca, per premio

- **First Five Minutes**: una prova che una persona vera, non uno script, arrivi al primo
  germoglio entro il minuto. Senza visore: un video continuo, non tagliato, dei primi 90
  secondi con il cronometro dell'app in sovrimpressione nel montaggio, da mettere come
  seconda immagine o link nella pagina. In più manca la registrazione di `sproutBreath`
  ("Breathe in with your sprout..."): il primo respiro, a 26 s, oggi è letto dalla voce
  del dispositivo e nel video è muto.
- **Accessibility Forward**: "tieni fermo" va cercato. Chi non riesce a pizzicare aspetta
  30 secondi (`COMFORT_HINT_SECONDS`, `src/guide.ts` riga 206) e poi deve toccare un
  pulsante piccolo sull'angolo del tavolo. Manca una scena del video in cui tutta la cura
  (seme, acqua, taglio, respiro) è fatta senza un solo pizzico, in 15 secondi continui.
- **Reason to Come Back**: il giudice deve poter vedere la seconda visita senza aspettare
  ore. `?nextvisit` esiste ma è in fondo a `README.md` (riga 252): manca un link "Second
  visit" accanto a "Try it".

## I 5 problemi più gravi

### 1. Nel video e nelle immagini non si vede mai una mano

- **Cosa succede**: in un concorso "hands-first" gli attrezzi volano da soli. Il giudice
  non può valutare le interazioni con le mani e sospetta che non siano mai state provate.
  Tocca Rifinitura, Design, e la domanda del modulo sulle mani.
- **Prova**: `artifacts/review/giuria/frames.jpg` (fotogrammi di `artifacts/video/v04-water-grow.webm`
  a 8 s e `v05-prune.webm` a 10 s: annaffiatoio e forbici sospesi, nessuna mano);
  `artifacts/first-minutes/feedback-shoot-falling.png` e `feedback-petal-shower.png`; nessuna
  delle dieci immagini di `artifacts/devpost/` contiene una mano.
- **Correzione più piccola**: nessun codice. Nel montaggio aggiungere una didascalia fissa
  sulle scene di cura: "Recorded in the WebXR emulator: hands are scripted and not drawn",
  e tenere in quadro il gesto fantasma, che la mano la suggerisce. Se entro il 16 un
  conoscente ha un Quest, 30 secondi di ripresa dal visore con mani vere valgono più di
  tutto il resto (`QUEST-TEST.md`, prova breve). Prima di rifare le clip, l'autore controlli
  nella documentazione IWSDK se l'emulatore può disegnare le mani nella vista registrata:
  non l'ho verificato e non invento l'opzione.
- **Rischio**: basso. **Draw call**: 0.

### 2. Nessuna prova su un visore, e il testo lo dice in due punti senza attenuarlo

- **Cosa succede**: il requisito "almeno 60 fps su Quest" e tutte le soglie dei gesti
  restano dichiarazioni. Il giudice tecnico abbassa il voto di un punto intero; quello dei
  premi non può credere a "Accessibility" senza un visore. Tocca Implementazione tecnica.
- **Prova**: `DEVPOST.md` riga 53 ("We had no headset..."); `QA-REPORT.md`, tabella dei 15
  minuti ("60 fps (the emulator's ceiling)") e sezione "Not verified here"; `README.md`
  riga 192 ("the app could not be tried on a real headset").
- **Correzione più piccola**: la prova breve di 10 minuti di `QUEST-TEST.md` su un Quest
  prestato, con `?debug` per leggere fps e draw call, e una riga in `DEVPOST.md` con il
  numero misurato. Se il visore non c'è: spostare la frase in "How we built it" in forma
  di metodo ("every step is replayed by scripted hands on the Quest 3 profile; a script
  fails the build above 80 draw calls") e togliere la seconda ammissione da "What's next"
  ("Tuning on real Quest hardware" come prima voce).
- **Rischio**: basso. **Draw call**: 0.

### 3. Il giudice fa una visita sola e non vede né il ritorno né la "pausa"

- **Cosa succede**: durata della pausa, avviso dell'ultimo minuto, riepilogo, giorni di
  fila, regalo, fiore nuovo, sblocchi: tutto parte dalla seconda visita. La prima finisce
  con la fioritura a circa 80 secondi e poi non propone altro per 2-4 minuti. Tocca
  Reason to Come Back, la categoria Productivity e il Design.
- **Prova**: `README.md` righe 94-96 ("From the second visit on... The first visit is the
  tutorial, with no timer"); `artifacts/first-minutes/times.md` (bloom 77,5-81 s);
  `README.md` riga 27 (pause "every two to four minutes of care").
- **Correzione più piccola**: nessun codice. In `DEVPOST.md`, sotto "Try it", una seconda
  riga: "**Second visit (what coming back looks like):**
  https://broder893.github.io/zen-garden-vr/?nextvisit". Stessa riga in cima a `README.md`
  e nella descrizione del video. Nel video, la scena del ritorno (2:20-2:38 del piano) deve
  mostrare il pannello "How long is your break?" e il riepilogo
  (`artifacts/features/3-break-length.png`, `5-break-summary.png`), non solo il fiore.
- **Rischio**: basso (`?nextvisit` è già in produzione, `QA-REPORT.md` P2-14).
  **Draw call**: 0.

### 4. Il testo Devpost è un elenco di funzioni lungo il doppio, con le idee originali in mezzo

- **Cosa succede**: chi ha letto cento pagine si ferma alla tagline e al primo punto, e lì
  trova un bonsai con una lucciola. Le palpebre e la guarigione col respiro arrivano dopo.
  Tocca Innovazione e Rifinitura.
- **Prova**: `DEVPOST.md`: descrizione di 865 parole (il brief chiede circa 500), sezione
  sulle mani di 732; riga 13 (tagline); righe 38-45 (otto punti, alcuni di 90 parole);
  riga 73 (dettagli di polling in un testo per giudici); riga 57 ("birds and butterflies"
  in "What's next", mentre gli uccelli ci sono già, riga 42); riga 23 (link del video
  mancante).
- **Correzione più piccola**: solo testo. Tagline: "Close your eyes, breathe, and open them
  on a garden that changed: a hands-only bonsai break that forgives." (104 caratteri).
  Ordine dei punti: occhi chiusi, pianta che guarisce col respiro, primi cinque minuti,
  comfort, ritorno; stagioni e albero condiviso in una riga ciascuno. Ogni punto al massimo
  35 parole. Nella sezione mani togliere i numeri di implementazione (quarti di secondo,
  18 punti, 512 pixel) e lasciare gesto ed effetto. In "What's next" togliere "birds".
- **Rischio**: basso. **Draw call**: 0.

### 5. Le immagini Devpost sono vecchie e scelgono i momenti sbagliati

- **Cosa succede**: la galleria è la prima cosa guardata. Mostra dieci varianti dello
  stesso bonsai in un giardino che non è più quello pubblicato, e nessuno dei momenti che
  distinguono il progetto. Tocca Rifinitura e Innovazione.
- **Prova**: `artifacts/devpost/thumbnail.png`, `a-arrival-sunset.png`, `b-spring.png`
  (ore 15:32-15:39 del 14: grandi massi e lanterna dietro il tavolo, niente vasca né
  cartello) contro `artifacts/first-minutes/arrival-loop.png` (ore 21:15: gruppo di tre
  rocce, vasca, cartello, targa). Mancano del tutto: sagoma dell'obiettivo, pianta
  appassita, anello di "tieni fermo", riepilogo della pausa, giorni di fila. In
  `first-minutes/arrival-title.png` il titolo "Bloom Break" è quasi illeggibile sul cielo
  chiaro. Nei fotogrammi delle clip il cartello dice "Offline for now".
- **Correzione più piccola**: rifare sei immagini con lo strumento `shot` già pronto
  (`review/EMULATORE.md`): 1) palpebre a metà con il sottotitolo; 2) sagoma dell'obiettivo
  (`goal-ghost`); 3) pianta appassita accanto alla stessa pianta guarita; 4) anello di
  "tieni fermo" con alto contrasto; 5) riepilogo della pausa con respiri diversi da zero
  (oggi `features/5-break-summary.png` dice "0 calm breaths"); 6) quattro stagioni in un
  solo collage. Miniatura: l'immagine 1, non il bonsai frontale. Per le riprese, cartello
  con conteggi veri (il salvataggio di prova `SAVE_GROWN` in `scripts/record-extra.sh` lo
  fa già: usarlo anche per le clip v03-v05) e titolo dell'arrivo ripreso con
  `?time=sunset`, dove si legge.
- **Rischio**: basso. **Draw call**: 0.

## Problemi minori

1. `sproutBreath` senza registrazione (`QA-REPORT.md`, note del 14 sera; assente in
   `public/voices/manifest.json`): il primo respiro è muto nel video. Serve all'autore: id
   `sproutBreath`, testo esatto "Breathe in with your sprout...". Rischio basso, 0 draw call.
2. Servizio dell'albero condiviso e GitHub Pages mai raggiunti (`QA-REPORT.md`, "Not
   verified here"): aprire il link da un telefono e versare una cura prima di consegnare.
   Rischio basso, 0.
3. Sottotitoli piccoli nelle clip a 1080p (`artifacts/review/giuria/frames.jpg`): registrare
   con "Text size: Large". Rischio basso, 0.
4. Nessun file `LICENSE` nel repository pubblico, mentre `CREDITS.md` parla di contenuti
   originali: aggiungere una licenza prima del 16. Rischio basso, 0.
5. Targa del livello e cartello tagliati dal bordo destro in quasi ogni fotogramma delle
   clip: nelle riprese girare la testa di pochi gradi a destra o tenerli fuori quadro.
   Rischio basso, 0.
