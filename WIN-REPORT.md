# Bloom Break: rapporto finale (16 novembre 2026, mattina)

Stato pubblicato: `main` = tag **`rc-1`** (vedi sotto per il commit), sito
https://broder893.github.io/zen-garden-vr/ controllato da una scheda nuova del browser
integrato: carica, mostra il giardino e il primo sottotitolo, nessun errore in console.
Il servizio dell'albero condiviso pubblicato risponde (`/tree` 200).

Tutto è stato provato **solo nell'emulatore WebXR** (IWER, profilo Quest 3) con mani
scritte da script. Nulla è stato provato su un visore.

## Com'è andato il piano

Il piano prevedeva 14 analisi in parallelo, un backlog, correzioni in rami separati, una
controprova con agenti nuovi e il rilascio. Il limite d'uso del modello ha fermato gli
agenti tre volte (14 notte, 15 mattina, 15 sera), ogni volta pochi minuti dopo la partenza.
Sono arrivate **due analisi su quattordici**: la giuria (`review/giuria.md`) e la
consegna (`review/consegna.md`). Le altre dodici, compreso il collaudo da giocatore nuovo,
**non esistono**. Per questo:

- il backlog (`review/BACKLOG.md`) si basa solo su quelle due analisi;
- non ho toccato il codice del gioco: nessuna correzione sarebbe stata verificata da chi
  doveva trovare i problemi, e lo stop era vicino. Tutte le voci fatte sono di
  presentazione, documenti, crediti e pubblicazione (0 draw call);
- la controprova con agenti nuovi non c'è stata. Al suo posto: controlli completi, la
  sessione lunga di 15 minuti e il sito pubblicato, fatti da me.

## Voti

| | Prima (giuria, su `rc-0`) | Dopo |
|---|---|---|
| Innovazione e creatività | 6 | non rivalutato |
| Design dell'esperienza | 7 | non rivalutato (gioco invariato) |
| Implementazione tecnica | 7,5 | non rivalutato (gioco invariato) |
| Rifinitura e presentazione | 5,5 | non rivalutato |
| Best First Five Minutes | 7,5 | non rivalutato |
| Best Accessibility Forward | 7 | non rivalutato |
| Best Reason to Come Back | 5,5 | non rivalutato |
| Complessivo | 6,5 | non rivalutato |

Non c'è un voto "dopo": nessun giudice nuovo ha potuto lavorare. La giuria stimava che le
sue cinque correzioni (tutte di presentazione) potessero portare il complessivo a circa
7,5. Ne sono state fatte tre per intero (testo Devpost, link alla seconda visita,
immagini nuove) e due solo in parte, perché dipendono da te (video con mani visibili,
prova su un visore).

## Cosa è cambiato (ramo `polish`, unito in `main`)

| Commit | Cosa |
|---|---|
| `f7f3c0a` | `DEVPOST.md`: descrizione da 854 a circa 560 parole, idee originali in testa (occhi chiusi, pianta che perdona), sezione mani da 723 a circa 390 parole, numeri attuali (62-74 draw call, 59 test), "every care also works by looking" al posto di "everything", emulatore detto una volta come metodo, link **Second visit** (`?nextvisit`), tagline nuova (106 caratteri) |
| `318f3fd` | `README.md`: blocco **For judges** (`?fresh`, `?nextvisit`, Comfort, emulatore), le funzioni dei primi minuti nella descrizione, numeri e tempi attuali; tabella iniziale di `QA-REPORT.md` con rimando alle misure nuove |
| `5966d32` | `CREDITS.md`: tutte le librerie e il font pubblicati, con versione e licenza lette dai pacchetti (IWSDK, super-three, elics, uikit e kit: MIT; Lucide: ISC; Inter: SIL OFL 1.1). La pubblicazione toglie `ui/AGENTS.md` e `scenes/AGENTS.md` dal sito (verificato: 404) |
| `01433ca` | `DEMO-VIDEO.md`: scaletta da 2:45 sul gioco attuale (arrivo e sagoma, primo respiro, scena continua senza pizzico, ritorno con durata e riepilogo, didascalia "hands are scripted"), con l'elenco delle clip aggiornate e di quelle da rifare |
| `7175968` | `QUEST-TEST.md`: le prove per arrivo, sagoma, primo respiro, risposte ai gesti e musica |
| `0025144`, `e6affc2` | `review/`: contesto per gli agenti, le due analisi, backlog, richieste |

Prima dello stop, il 14 sera (già in `rc-0`): arrivo con titolo, sagoma dell'obiettivo,
risposte ai gesti, primo respiro con il germoglio, musica a strati, tavolo regolabile,
durata della pausa con riepilogo, giorni di fila (vedi `QA-REPORT.md`).

### Immagini nuove per Devpost (`artifacts/devpost-16nov/`, 1800x1200)

| File | Cosa mostra |
|---|---|
| `1-eyes-half-closed.png` | le palpebre a metà su "Open your eyes." al tramonto (candidata miniatura) |
| `2-wilted-and-well-again.png` (e `2a`, `2b`) | la stessa pianta appassita e poi guarita |
| `3-hold-to-select-high-contrast.png` | l'anello di "tieni fermo" che si riempie accanto all'annaffiatoio, in alto contrasto (il cartello dice "Offline for now": in sviluppo il servizio punta al computer locale) |
| `4-break-summary.png` | il riepilogo della pausa con numeri veri (3 respiri, 1 annaffiatura, 5 giorni di fila) |
| `5-four-seasons.png` (e `5-spring` ... `5-winter`) | lo stesso giardino nelle quattro stagioni |

Già pronte dal 14 sera: `artifacts/first-minutes/arrival-title.png`, `goal-ghost.png`,
`feedback-petal-shower.png`, `feedback-canopy-opening.png`; `artifacts/features/`
(pannello Comfort con il tavolo, durata della pausa, targa con i giorni). Le immagini di
`artifacts/devpost/` sono vecchie: non usarle.

## Controlli sullo stato finale

| Controllo | Esito |
|---|---|
| `npm run typecheck`, `npm test`, `npm run build` | verdi; 59 test |
| `npm run check:budget` | 62-73 draw call (limite 80, obiettivo 76), circa 48k triangoli |
| Primi minuti da `?fresh` (14 sera, gioco invariato da allora) | meraviglia 1,5 s; seme 10,5-13 s; prima crescita 22-26 s; primo respiro 26-30 s; fioritura 77-81 s |
| Sessione di 15 minuti | vedi sotto |
| Sito pubblicato | carica, giardino e sottotitolo visibili, console senza errori, `AGENTS.md` assenti, servizio dell'albero condiviso raggiungibile |

### Sessione di 15 minuti (emulatore, 16 novembre)

Il giardino più pesante (fiorito, autunno, giorno, qualità alta, tutti gli sblocchi e i
sette fiori), una misura di 15 s ogni minuto (`artifacts/review/long-session.txt`). Nel
frattempo il gioco ha fatto da solo una pausa di respiro con le palpebre e la fine della
pausa con il riepilogo.

| | Minimo | Massimo |
|---|---|---|
| Frame medio | 16,66 ms | 16,67 ms (il tetto dei 60 Hz dell'emulatore) |
| Frame p99 | 19,7 ms | 22,5 ms |
| Frame peggiore | 20,4 ms | 27,1 ms |
| Memoria JS (build di sviluppo) | 289 MB | 324 MB, oscilla con il garbage collector |
| Geometrie / texture / programmi | 94 / 12 / 30 | 105 / 12 / 31, fermi dal quinto minuto |
| Draw call (due occhi) | 138 | 150 (durante il respiro) |

Nessuna perdita visibile: geometrie, texture e programmi smettono di crescere dopo la
pausa di respiro e la fine della pausa. Questi tempi vengono da un computer desktop e
non dicono nulla della GPU del Quest.

## Cosa ho scartato e perché

- **Correzioni al gioco**: nessuna, perché le analisi che dovevano trovarle (giocatore
  nuovo, primi cinque minuti, accessibilità, mani, comfort, prestazioni, codice) non sono
  state fatte. Cambiare il gioco senza quelle prove, a poche ore dallo stop, era più
  rischioso del beneficio.
- **Suggerimento Comfort dopo 15 s invece di 30 s** (giuria): cambia i tempi del
  tutorial, quindi l'ho messo tra le decisioni tue.
- **Mani visibili nel video**: l'emulatore non le disegna come mani vere; non si risolve
  con il codice.

## Cosa resta da decidere o fare a te (`review/RICHIESTE.md`)

1. **Ammissione**: il concorso è aperto ai membri del programma Meta VR Start. Verificalo
   e rileggi il regolamento sulla pagina Devpost (da qui risponde 403): fuso della
   scadenza, durata del video, limite della tagline, se basta un link WebXR, campi del
   modulo (dispositivo: Meta Quest).
2. **Video**: non esiste. Registra di nuovo le clip con `bash scripts/record-extra.sh`
   (le `v01`-`v07` attuali sono vecchie), monta seguendo `DEMO-VIDEO.md`, caricalo e
   incolla il link in `DEVPOST.md`.
3. **Mani nel video**: se un conoscente ha un Quest, 30 secondi dal visore valgono più di
   tutto; altrimenti la didascalia "hands are scripted".
4. **Voce `sproutBreath`** (voce della lucciola): "Breathe in with your sprout...".
5. **Licenza del codice** (per esempio MIT): poi va aggiunto `LICENSE`.
6. **Immagini Devpost**: sceglile da `artifacts/devpost-16nov/` e `artifacts/first-minutes/`.
7. **Dopo la consegna, nessun push su `main`** fino ai risultati (verso l'11 dicembre):
   ogni push ripubblica il sito che i giudici provano. Tieni il servizio dell'albero
   condiviso acceso fino ad allora.
8. **Decisione**: suggerimento Comfort dopo 15 s invece di 30 s?
9. **Giardino di sviluppo**: la copia salvata del giardino del browser di sviluppo è stata
   sovrascritta con uno stato di prova durante le analisi; ora è un giardino fiorito
   pulito. Non tocca il sito né i giocatori.

## Cosa solo un Quest vero può confermare

- Frequenza reale (almeno 60, meglio 72 fps) e costo degli shader (vento, nuvole, sabbia)
  sulla GPU del Quest; i tempi del frame dell'emulatore non valgono.
- Riconoscimento del pizzico, della mano aperta "not now" e del rastrello con mani vere,
  piccole e grandi; perdita del tracciamento.
- Altezza e distanza del tavolo per persone diverse, e se il recenter funziona con il
  recenter del sistema.
- Comfort: arrivo della lucciola, palpebre, buio, luminosità, testi ai bordi del campo
  visivo.
- Voci registrate e voce di ripiego nel browser del Quest, livelli di musica e ambiente
  nelle cuffie del visore.
- Caricamento dal link pubblicato sulla rete reale (tempo e memoria).
