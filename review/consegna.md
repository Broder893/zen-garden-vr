# Revisione della consegna (Devpost)

15 novembre 2026, ramo `polish` (`e6affc2`; `main` = `origin/main` = `rc-0` = `0d98fca`).
Sola lettura, nessun uso dell'emulatore. Eseguito solo `npm test` (59 test, tutti verdi).
Immagini di lavoro: `artifacts/review/consegna/devpost-sheet-0.jpg` e `-1.jpg`.

## 1. Voto: 5 / 10 (quanto la consegna è pronta)

L'app è pubblicata e i documenti tecnici sono ricchi, ma ciò che il giudice vede per primo
non è pronto: il video non esiste e tutte le clip e le immagini mostrano un giardino
vecchio, la descrizione è lunga quasi il doppio del richiesto e contiene numeri superati.
Inoltre le regole ufficiali non sono state rilette: c'è un requisito di ammissione (iscrizione
al programma Meta VR Start) che `PROGETTO.md` non cita.

## 2. Regole ufficiali: cosa ho trovato in rete

- La pagina ufficiale e il regolamento (`start-developer-competition-26.devpost.com` e
  `/rules`) **non sono leggibili da qui** (HTTP 403). Il confronto qui sotto usa l'annuncio
  di Meta e la stampa; per il resto vale `PROGETTO.md`. **L'autore deve rileggere il
  regolamento a mano prima di consegnare.**
- Confermato: scadenza 18 novembre 2026; categoria Productivity ("routine-based habits");
  "must be fully usable with hands, end-to-end"; consigli su uso da seduti, avvio rapido,
  pausa e ripresa, qualcosa di soddisfacente entro 10 minuti; i giudici provano ciò che
  si consegna.
- **Differenze rispetto a `PROGETTO.md`:**
  1. **Ammissione**: il concorso è aperto ai soli membri del programma Meta VR Start; chi
     non lo è deve fare domanda prima di consegnare. `PROGETTO.md` non ne parla.
  2. **Dispositivi**: Meta VR Glasses, Meta Quest o entrambi. Il modulo potrebbe chiedere
     il dispositivo scelto: per noi "Meta Quest" (il campo visivo degli occhiali non è
     stato provato).
  3. Premi: l'annuncio parla di 20 premi da 20.000 a 100.000 dollari; vincitori verso
     l'11 dicembre 2026 (l'app e il servizio dell'albero devono restare in linea almeno
     fino ad allora).
  4. Non verificabili da qui: orario e fuso della scadenza, durata massima del video,
     limite della tagline, se basta un link WebXR o serve un pacchetto, regola "un premio
     per progetto", pesi dei criteri.
- Fonti: [annuncio Meta](https://developers.meta.com/horizon/blog/meta-connect-2026-vr-start-developer-competition/),
  [forum Meta](https://communityforums.atmeta.com/news-announcements-24/meta-vr-start-developer-competition-2026-180286),
  [UploadVR](https://www.uploadvr.com/meta-launches-1-million-competition-for-hands-first-apps-ahead-of-vr-glasses/),
  [Road to VR](https://roadtovr.com/meta-vr-glasses-dev-competition-1m-2026/),
  [MoguraVR](https://www.moguravr.com/meta-vr-start-developer-competition-2026/).

## 3. I 5 problemi più gravi

### 1. Il video non esiste e tutto il materiale girato è vecchio
- **Cosa succede**: il video è obbligatorio e pesa su "Rifinitura e presentazione" e sui
  tre premi speciali (va mostrato: sole mani, accessibilità, ritorno). Oggi non c'è nulla
  di montabile.
- **Prova**:
  - `DEVPOST.md:23`: "_(add the YouTube/Vimeo link)_".
  - `artifacts/video/` contiene solo `v01`-`v07` (su 17 previste da
    `scripts/record-extra.sh:23`), registrate il 14 novembre tra le 15:56 e le 16:21, cioè
    **prima** di: germogli Blender (`a7430a7`, 17:55), foresta nuova (`55d133d`, 18:13),
    ombre dipinte (`91cc6e9`, `a698f4d`), giardino karesansui (`08264a0`, 18:38), vento,
    nuvole, particelle, uccelli (19:25-20:05), tavolo, durata della pausa, giorni di fila
    (20:29-20:48), arrivo con titolo, sagoma, risposte ai gesti, primo respiro, musica
    (21:24-22:18). Durate: 8 + 12 + 20 + 20 + 20 + 15 + 64 = **159 s (2:39)**, senza
    accessibilità, ritorno, stagioni e albero condiviso: aggiungendoli si supera 3:00.
  - `artifacts/01-*.webm` ... `09-*.webm`: del 4-5 novembre, **senza traccia audio**
    (ffprobe) e con il bonsai procedurale.
  - Aggiornate e utilizzabili: `artifacts/first-minutes/first-minutes.webm` (116 s, con
    audio, 22:38; presa 2 s prima dello spostamento della sagoma, `times.md`) e
    `artifacts/animations/after-*.webm` (4 x 10 s, ma precedenti alle funzioni della sera).
  - `DEMO-VIDEO.md` (ultima modifica 20:13) non conosce le funzioni della sera: la scaletta
    (righe 65-73) apre con "eyelids open" invece dell'arrivo della lucciola con il titolo;
    nessuna inquadratura di sagoma, primo respiro con il germoglio, riepilogo della pausa,
    giorni di fila, tavolo spostabile. Cita le clip `01`-`09` in `artifacts/` (righe 16-28)
    mentre lo script nuovo scrive `v01`-`v17` in `artifacts/video/`.
- **Correzione più piccola**: (noi) riscrivere solo la tabella di `DEMO-VIDEO.md:63-73` sui
  nomi `vNN` e su questa scaletta da 2:45: arrivo e titolo 0:00-0:12; seme, acqua, primo
  respiro 0:12-0:40; potatura e fioritura a 2x 0:40-1:00; pausa respiro con palpebre
  1:00-1:25; Comfort (tieni fermo, una mano, alto contrasto, tavolo) 1:25-1:50; pianta
  appassita che si riprende 1:50-2:00; ritorno (fiore, regalo, giorni di fila, riepilogo)
  2:00-2:25; stagioni 2:25-2:38; chiusura 2:38-2:45. (Autore) registrare di nuovo tutte le
  clip, montare, caricare.
- **Rischio**: medio (tempo: è il lavoro più lungo rimasto, tutto a mano). **Draw call**: 0.

### 2. Ammissione e regolamento non verificati
- **Cosa succede**: se l'autore non è membro del programma Meta VR Start la consegna non è
  valida, qualunque sia la qualità. Inoltre non è confermato che un link WebXR basti come
  "app provabile".
- **Prova**: annuncio Meta (sezione 2); `PROGETTO.md` non contiene "Start program" né
  "membership"; pagina delle regole non raggiungibile da qui (403).
- **Correzione più piccola**: (autore, oggi) controllare l'iscrizione al programma e
  rileggere `/rules`: fuso della scadenza, formato richiesto, durata del video, campi del
  modulo. (Noi) aggiungere le due righe a `PROGETTO.md` dopo la sua risposta.
- **Rischio**: basso per la correzione; alto se si scopre tardi. **Draw call**: 0.

### 3. La descrizione è lunga quasi il doppio e la sezione sulle mani è un manuale
- **Cosa succede**: "circa 500 parole" richieste; un giudice che ha cento progetti legge
  l'inizio e salta. Tocca "Rifinitura e presentazione".
- **Prova** (`DEVPOST.md`, conteggio senza segni Markdown):

  | Sezione | Righe | Parole | Caratteri |
  |---|---|---|---|
  | Tagline | 13 | 24 | **124** (limite 140: va bene) |
  | Descrizione, tutta | 28-58 | **854** | 4693 |
  | Inspiration | 30-34 | 70 | 344 |
  | What it does | 36-45 | **521** | 2780 |
  | How we built it | 47-53 | 222 | 1316 |
  | What's next | 55-57 | 29 | 168 |
  | How the hand interactions work | 61-78 | **723** | 3860 |

  Punti più lunghi: riga 38 (129 parole), riga 72 (107), riga 73 (112), riga 75 (77).
- **Correzione più piccola**: "What it does" a circa 250 parole (otto punti da 25-35
  parole: tagliare gli elenchi, per esempio a riga 38 tenere solo arrivo, gesto mostrato in
  luce e "the tree first grows within half a minute"); "How we built it" a circa 130
  (togliere il dettaglio dell'animazione ambientale); descrizione totale 480-520. Sezione
  mani a circa 300 parole: un rigo per gesto, senza soglie (0,4 s, 90%, 2,5 s, 512 pixel),
  che restano nel `README.md`.
- **Rischio**: basso. **Draw call**: 0.

### 4. Numeri superati e frasi non del tutto vere in `DEVPOST.md` e `README.md`
- **Cosa succede**: un giudice tecnico che apre `?debug` o il `QA-REPORT.md` trova numeri
  diversi; tocca "Implementazione tecnica". Niente promesse mediche trovate (cercati
  anxiety, stress, heal, therapy, cure, relief: solo "stressed" riferito alla pianta) e
  nessuna frase "provato su Quest": `DEVPOST.md:53` e `README.md:192, 231` dicono
  correttamente che è stato usato solo l'emulatore.
- **Prova**:
  - Draw call: `DEVPOST.md:51` "at most about 78 draw calls"; `README.md:161` "at most
    about 78"; `README.md:202` "Last run: 76-77 calls seated and 77-78 with the eyes
    closed". `QA-REPORT.md:219` e `:275` (14 novembre): **62-74**. Anche
    `QA-REPORT.md:23` riporta ancora 76-78 nella tabella iniziale.
  - Test: `QA-REPORT.md:24` "31 tests pass"; oggi `npm test` = **59** (`QA-REPORT.md:274`).
  - Tempi: `README.md:248-249` "planted 10 s, first growth 21 s, mature 49 s, bloom 76 s";
    `QA-REPORT.md:263-266`: 10,5-13,0 / 22,2-25,7 / fioritura 77,5-81,0 s, primo respiro
    26-30 s.
  - `DEVPOST.md:41` "No hand tracking? Everything also works by looking": lo sguardo copre
    seme, annaffiatoio, forbici, vasca, pietra e durata della pausa (`src/gaze-care.ts`,
    `README.md:61-63`), non il rastrello né il pannello Comfort.
  - `DEVPOST.md:51` "the guide's two voices are generated ... (Kokoro TTS)": 83 frasi su
    84 hanno la registrazione; `sproutBreath` ("Breathe in with your sprout...",
    `src/guide.ts:115`) non è in `public/voices/manifest.json` e viene letta dalla voce
    del dispositivo, proprio nel primo minuto (`QA-REPORT.md:284`).
  - `DEVPOST.md:57` promette "birds" tra i piani futuri, ma `DEVPOST.md:42` li dà già
    presenti.
  - `README.md:15` "four stages" contro `README.md:138` "five ... models" e
    `DEVPOST.md:51` "five growth stages".
- **Correzione più piccola**: sostituire i numeri (62-74 draw call, 59 test, tempi del 14
  novembre) nelle righe citate; riga 41 "Every care also works by looking"; riga 57
  togliere "birds"; `README.md:15` "five stages (seed, sprout, young, mature, in bloom)".
  Per `sproutBreath` serve una registrazione dell'autore: id `sproutBreath`, voce
  `firefly`, testo esatto "Breathe in with your sprout..."; se non arriva, nessuna modifica
  (il ripiego funziona).
- **Rischio**: basso. **Draw call**: 0.

### 5. Licenze: manca `LICENSE`, crediti incompleti per font e librerie
- **Cosa succede**: "contenuti originali o con licenza libera" va dimostrato; il link al
  codice sorgente senza licenza lascia il codice "tutti i diritti riservati" e i crediti
  non coprono ciò che viene distribuito nel pacchetto pubblicato.
- **Prova**:
  - Nessun file `LICENSE` nella radice. `vite.config.ts:4-5` e
    `src/scene-assets/lib/hardsurface.ts` hanno l'intestazione "Copyright (c) Meta
    Platforms ... MIT license found in the LICENSE file in the root directory", file che
    non esiste.
  - `CREDITS.md:41` cita solo "IWSDK and Three.js, under their own open-source licenses",
    senza nome della licenza. Non citati: `@pmndrs/uikit`, `uikit-horizon`, `uikit-lucide`
    (`package.json:21-23`, MIT, con icone Lucide, ISC), `super-three` (MIT), `elics` (MIT).
  - **Font**: il pacchetto pubblicato contiene `dist/assets/inter-*.js` (423 kB): è il
    font Inter in formato MSDF, da `@pmndrs/msdfonts` ("redistributes fonts from Google
    Fonts"); Inter è sotto SIL Open Font License 1.1. `CREDITS.md:36` dice solo "UI uses
    the IWSDK UIKitML toolkit".
  - Modelli Blender, voci Kokoro (Apache 2.0, modello e voci indicati,
    `CREDITS.md:18-22`) e suoni sintetizzati: a posto. Nessun logo o marchio nelle
    immagini e nell'interfaccia viste.
- **Correzione più piccola**: (noi) in `CREDITS.md` una tabella "Libraries and fonts" con
  nome, versione, licenza (IWSDK MIT, super-three MIT, @pmndrs/uikit e varianti MIT,
  Lucide ISC, elics MIT, Inter OFL 1.1, Kokoro Apache 2.0). (Autore) scegliere la licenza
  del proprio codice; poi noi aggiungiamo `LICENSE` con il suo nome e, in coda, la nota MIT
  di Meta per i due file del modello di partenza.
- **Rischio**: basso. **Draw call**: 0.

## 4. Problemi minori

1. **Tutte le 10 immagini di `artifacts/devpost/` sono vecchie** (14 novembre 15:32-15:39,
   prima di foresta nuova, karesansui, ombre dipinte, germogli Blender). In particolare
   `h-comfort-high-contrast.png` non ha la riga "Table" e `thumbnail.png` mostra la foresta
   vecchia. Formato 1800x1200 (3:2), 1-2,3 MB: giusto. Sostitute già pronte e recenti:
   `artifacts/first-minutes/arrival-title.png`, `goal-ghost.png`,
   `feedback-petal-shower.png`; `artifacts/features/1-comfort-table-buttons.png`,
   `5-break-summary.png`, `6-badge-days-in-a-row.png` (controllarne il formato). Le altre
   vanno rifatte dall'autore con l'emulatore. Rischio basso, 0 draw call.
2. **Ogni push su `main` ripubblica** (`.github/workflows/deploy.yml:7-9`): dopo la
   consegna un push cambia l'app che i giudici provano. Correzione: tag `submission` sul
   commit consegnato e nessun push su `main` fino all'11 dicembre (lavoro solo su rami);
   in caso di errore, `workflow_dispatch` sul tag. Rischio basso.
3. **File pubblicati per errore**: `public/ui/AGENTS.md` e `public/scenes/AGENTS.md`
   finiscono in `dist/ui/` e `dist/scenes/` e quindi sul sito. Correzione: una riga in
   `deploy.yml` dopo la build, `rm -f dist/ui/AGENTS.md dist/scenes/AGENTS.md`. Rischio basso.
4. **Il repository pubblico contiene `PROGETTO.md`** (in italiano, con la strategia sui
   premi) e le cartelle `.claude/`, `.agents/`, `.cursor/`, `.codex/`. Non viola regole;
   l'autore decide se va bene che i giudici lo leggano. Nessun segreto tracciato
   (`.env.development.local` è ignorato da git).
5. **`README.md` senza sezione per i giudici e senza le funzioni della sera**: `?fresh` e
   `?nextvisit` sono solo a riga 252, sotto "Run it locally"; mancano arrivo, sagoma,
   primo respiro, musica che cresce (nessuna occorrenza di "silhouette", "flies in",
   "layer"). Anche `QUEST-TEST.md` non le cita. Correzione: sotto la riga 9 un blocco "For
   judges" di 5 righe (link, `?fresh` per ripartire, `?nextvisit` per il ritorno, Comfort
   per l'accessibilità, `?input=none` per lo sguardo) e un punto in "The experience".
6. **`?fresh` funziona anche sul sito pubblicato** (`QA-REPORT.md:186`): mai mettere quel
   parametro nel link del modulo o del video.
7. **"Built with"** (`DEVPOST.md:82`) non cita Blender né Cloudflare Workers, usati e
   descritti nel testo.
8. **La build pubblicata non esegue `npm test`** (`deploy.yml:30-31`: solo typecheck e
   build). Facoltativo: aggiungere `- run: npm test`.

## 5. Pubblicazione: cosa ho verificato

- `vite.config.ts:45` `base: './'`: percorsi relativi, funziona sotto `/zen-garden-vr/`.
- `deploy.yml`: Node 22, `npm ci`, typecheck, build, `dist/` su GitHub Pages; `main` è a
  `0d98fca`, uguale a `origin/main`: il sito mostra le funzioni del 14 sera (non
  controllato in rete).
- L'indirizzo resta stabile e gratuito finché il repository resta pubblico, con lo stesso
  nome e lo stesso proprietario. Rinominare o rendere privato rompe sia il link sia
  l'albero condiviso (il servizio accetta solo l'origine del sito,
  `server/shared-tree/src/index.ts:29`).
- Albero condiviso: l'indirizzo del servizio è scritto nel codice
  (`src/save/shared-tree-api.ts:30-32`), quindi la build pubblicata lo usa senza variabili.
  Se il servizio è spento il giudice vede l'albero "offline" con gli ultimi conteggi e
  nessun errore (`QA-REPORT.md:120`). Non verificato da qui che il servizio risponda oggi.

## 6. Lista di controllo della consegna

Stato: **pronto** / **da fare** / **da rifare**. Chi: **noi** (codice o documenti) oppure
**autore** (a mano).

### Ammissione e regole
| Voce | Stato | Chi |
|---|---|---|
| Iscrizione al programma Meta VR Start | da verificare subito | autore |
| Rilettura del regolamento ufficiale (fuso, video, formato, campi) | da fare | autore |
| Progetto iniziato dopo il 24 settembre (New Experience) | pronto (primo commit di novembre) | - |
| Solo mani, da seduti, entro 60 cm | pronto nei testi; provato solo in emulatore | - |
| Nessuna promessa medica | pronto | - |
| Nessun marchio o logo di terzi | pronto | - |

### Modulo Devpost
| Voce | Stato | Chi |
|---|---|---|
| Nome "Bloom Break" | pronto | autore (incolla) |
| Tagline, 124 caratteri | pronto | autore (incolla) |
| Categoria Productivity, divisione New Experience | pronto | autore |
| Dispositivo (se chiesto): Meta Quest | da decidere | autore |
| Descrizione (circa 500 parole) | da rifare: 854 parole | noi |
| Interazioni con le mani | da rifare: 723 parole | noi |
| Numeri e frasi da correggere (problema 4) | da fare | noi |
| "Built with": aggiungere Blender, Cloudflare Workers | da fare | noi |
| Link all'app | pronto (senza `?fresh`) | autore (incolla) |
| Link al codice | pronto; controllare che il repository sia pubblico | autore |
| Link al video | da fare | autore |
| Miniatura 3:2 | da rifare (foresta vecchia) | autore (scatto), noi (indicare la scena) |
| Galleria di immagini | da rifare: 10 su 10 vecchie; 6 sostitute già pronte | autore |
| Invio del modulo entro il 16 novembre | da fare | autore |

### Video
| Voce | Stato | Chi |
|---|---|---|
| Scaletta sotto i 3 minuti aggiornata al 14 sera | da rifare | noi (`DEMO-VIDEO.md`) |
| Clip `v01`-`v07` | da rifare (giardino vecchio) | autore |
| Clip `v08`-`v17` (accessibilità, ritorno, stagioni, albero, appassimento) | da fare | autore |
| Montaggio, didascalie in inglese, 1080p | da fare | autore |
| Solo riprese vere dell'app, niente video generati | pronto come regola | autore |
| Caricamento pubblico su YouTube o Vimeo | da fare | autore |
| Link in `DEVPOST.md:23` e nel `README.md` | da fare | noi, dopo il caricamento |

### Documenti del repository
| Voce | Stato | Chi |
|---|---|---|
| `README.md`: sezione per i giudici, funzioni della sera, numeri | da fare | noi |
| `CREDITS.md`: librerie, font Inter, licenze con nome | da fare | noi |
| `LICENSE` | da fare | autore (scelta), noi (file) |
| `QA-REPORT.md`: righe 23-24 allineate al 14 novembre | da fare | noi |
| `QUEST-TEST.md`: casi per arrivo, sagoma, primo respiro | da fare | noi |
| Registrazione della frase `sproutBreath` | facoltativo | autore |

### Pubblicazione
| Voce | Stato | Chi |
|---|---|---|
| Build e pubblicazione automatica da `main` | pronto | - |
| Prova del link pubblicato in un browser (e su un Quest, se capita) | da fare | autore |
| Servizio dell'albero condiviso in linea fino all'11 dicembre | da verificare | autore |
| Togliere i due `AGENTS.md` dal sito | da fare | noi |
| Tag `submission` e nessun push su `main` dopo la consegna | da fare | noi (tag), autore (disciplina) |
| Repository pubblico, non rinominato, fino al giudizio | da mantenere | autore |
