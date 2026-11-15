# Contesto per gli agenti di analisi (Fase 1)

Progetto: **Bloom Break**, esperienza WebXR (IWSDK) per Meta Quest, da seduti, solo con le
mani. Concorso: Meta VR Start Developer Competition 2026, categoria Productivity, divisione
New Experience. Stato: ramo `polish` (uguale a `main`, tag `rc-0`), 14 novembre 2026 sera.
Stop al codice: 16 novembre ore 12:00.

## Cosa conta per il voto
- Quattro criteri, 25% ciascuno: Innovazione e creatività; Design dell'esperienza;
  Implementazione tecnica; Rifinitura e presentazione.
- Premi speciali a cui puntiamo: Best First Five Minutes, Best Accessibility Forward,
  Best Reason to Come Back.
- Requisiti: tutto usabile con le sole mani, da seduti, entro circa 60 cm; almeno 60 fps
  su Quest; avvio rapido, pausa e ripresa pulite; contenuti originali o con licenza libera;
  materiali in inglese; nessuna promessa medica; niente passthrough.
- Non c'è un visore: tutto è stato provato solo nell'emulatore WebXR (profilo Quest 3).
  Non scrivere mai che qualcosa è stato provato su un visore.

## Regole per te
- **Sola lettura.** Non modificare nessun file del progetto, non fare commit, checkout,
  stash, reset. Non riavviare il server di sviluppo. L'unico file che scrivi è
  `review/<nome>.md` (il nome te lo dà il tuo incarico); immagini di lavoro solo in
  `artifacts/review/<nome>/`.
- **Emulatore.** Ce n'è uno solo. Se il tuo incarico non dice "l'emulatore è tuo", non
  usarlo: niente `npx @iwsdk/cli browser|xr|ecs|scene|ui ...`, niente `npm run
  check:budget`, niente `npm run dev`. Puoi leggere codice, documenti, misure e immagini
  già raccolte, ed eseguire `npm run typecheck` e `npm test`.
- Misure e immagini già raccolte: `QA-REPORT.md` (tutte le misure), `artifacts/first-minutes/`
  (video e tempi dei primi minuti, fotogrammi dell'arrivo e delle risposte ai gesti),
  `artifacts/features/` (pannello Comfort, tavolo, durata pausa, riepilogo, targa),
  `artifacts/animations/` (clip prima/dopo di vento, nuvole, particelle, uccelli),
  `artifacts/environment/`, `artifacts/horizon/`, `artifacts/glow/`, `artifacts/qa/`,
  `artifacts/devpost/` (immagini Devpost, in parte vecchie). Per guardare un'immagine
  grande riducila prima (per esempio con PIL a 900 px di larghezza) e leggi la copia.
- Documenti: `PROGETTO.md` (brief), `README.md`, `DEVPOST.md`, `QA-REPORT.md`,
  `QUEST-TEST.md`, `DEMO-VIDEO.md`, `CREDITS.md`, `AGENTS.md` (regole IWSDK). Codice in
  `src/`, interfacce in `public/ui/`, scena in `public/scenes/main.iwsdk.scene.json`,
  voci in `public/voices/` (testi in `LINES`, `src/guide.ts`).

## Cosa devi consegnare: `review/<nome>.md`, in italiano
1. **Voto da 1 a 10** per la tua area, con due righe di motivazione da giudice severo che
   ha visto cento progetti.
2. **I 5 problemi più gravi**, dal più grave. Per ognuno:
   - cosa succede e perché pesa sul voto (quale criterio o premio tocca);
   - **prova**: file e riga, oppure screenshot (percorso), oppure tempo o valore misurato;
   - **la correzione più piccola possibile** (cosa cambiare e dove);
   - **rischio** della correzione: basso / medio / alto;
   - **costo in draw call**: 0, +1, ... (il limite è 80 per occhio, oggi 62-74; obiettivo 76 o meno).
3. Facoltativo: fino a 5 problemi minori, una riga ciascuno, stesso formato in breve.

Niente elogi, niente proposte vaghe ("migliorare la UX"), niente funzioni nuove grandi.
Vincoli sulle correzioni: mai indebolire accessibilità, sottotitoli o ripieghi; mai luci
in tempo reale nuove; mai toccare il formato del salvataggio senza migrazione e test; mai
inventare API di IWSDK. Modelli Blender e frasi vocali nuove li prepara l'autore: se una
correzione ne ha bisogno, dillo (id e testo esatto della frase).

Alla fine rispondi con: il voto, i titoli dei 5 problemi e il percorso del file scritto.
