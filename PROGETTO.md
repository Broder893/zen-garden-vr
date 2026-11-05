# PROGETTO: Giardino Zen VR (Meta VR Start Developer Competition 2026)

> File di passaggio per Claude Code. Leggilo per intero prima di scrivere codice.
> Ultimo aggiornamento: 5 novembre 2026 (Fase 2: espansione concordata; aggiunto il punto 4b, la pianta appassisce).

## Obiettivo
Un'esperienza VR **rilassante, da seduti, usabile solo con le mani** (nessun controller), per i visori Meta Quest. Categoria: **Productivity** (abitudine legata a un momento ricorrente: pausa dal lavoro o sera). Divisione: **New Experience** (progetto iniziato dopo il 24 settembre 2026).

## Scadenza e contesto
- Consegna entro il **18 novembre 2026, ore 12:00 PT (21:00 in Italia)**. Dopo non si può modificare nulla.
- **Blocco delle nuove funzioni: 14 novembre.** 15-16 novembre: test finale, video, testi Devpost. **Consegna entro il 16 novembre** (2 giorni di margine).
- Non c'è un visore a disposizione: si sviluppa e si testa con un **emulatore WebXR nel browser**. Il video demo può essere registrato con un simulatore.
- Giudizio (25% ciascuno): Innovazione e creatività, Design dell'esperienza, Implementazione tecnica, Rifinitura e presentazione.
- Premi speciali (25.000 $ ciascuno) su cui progettiamo di proposito: **"Best First Five Minutes"** e **"Best Accessibility Forward"**. Per "Best Reason to Come Back" bastano livelli e stagioni. Ogni progetto vince un solo premio e i primi tre di ogni categoria non prendono premi speciali.

## Stack tecnico
- **IWSDK (Immersive Web SDK)**, WebXR. Requisiti: Node.js >= 20.19.0.
- Pubblicazione: **GitHub Pages con GitHub Actions** a ogni push su `main` (già attivo). I giudici devono poter aprire un link.
- **Non indovinare le API**: prima leggi la documentazione ufficiale di IWSDK e gli esempi del template, poi scrivi codice.

## Requisiti obbligatori delle regole
- **Hands-first**: tutta l'esperienza completabile con le mani, dall'inizio alla fine.
- Pensata per stare **seduti**: ogni interazione entro circa 60 cm (il "test del sedile d'aereo").
- Avvio rapido, pausa/ripresa pulite, qualcosa di soddisfacente in **10 minuti o meno**.
- Prestazioni: **almeno 60 fps su Quest**. Scena leggera, pochi oggetti e poche luci, texture piccole.
- Comfort per campi visivi diversi: UI e interazioni essenziali al centro, in uno spazio ristretto.
- Contenuti originali o con licenza libera. Niente loghi o marchi di terzi.
- Materiali in inglese (o con traduzione): sottotitoli in inglese per la guida.
- Non fare affidamento su passthrough o sulla stanza reale (non testabile senza visore).
- Il video non deve affidarsi a video generati con l'AI: mostrare l'esperienza reale.

## Stato attuale (Fase 1, completata)
Il nucleo è fatto e pubblicato: tavolo zen con luci a lanterna e mani; bonsai con annaffiatura, potatura e stadi di crescita; lucciola guida con sottotitoli e tutorial; meditazione guidata con respiro visivo; audio sintetizzato e voce guidata del dispositivo (Web Speech API); salvataggio tra le visite; fiori nella sabbia a ogni ritorno; ingresso con luci che si scaldano; pagina di atterraggio; README per i giudici; testo Devpost (`DEVPOST.md`), piano e registrazione del video (`DEMO-VIDEO.md`), checklist di prova su Quest (`QUEST-TEST.md`), `CREDITS.md`. **Prima di cominciare la Fase 2, leggi il codice in `src/` e questi file**: estendi quello che esiste, non riscriverlo.

## Idea (invariata)
Un piccolo giardino zen su un tavolo davanti all'utente, con una **lucciola luminosa come guida** (NPC non umano, costo basso): bonsai da curare (annaffiare, potare), angolo di meditazione con respiro guidato, e persistenza della crescita.

## Fase 2: espansione (in ordine di priorità)
Regola: ogni funzione entra solo se la precedente è finita, funziona nell'emulatore e non peggiora le prestazioni.

1. **Primi 5 minuti (premio "First Five Minutes")**
   - La lucciola insegna tutto con gesti e luce, senza muri di testo.
   - Una ricompensa visibile (la pianta cambia, un fiore, una luce) entro 5 minuti. Misura il tempo con un cronometro dall'ingresso al primo "momento soddisfacente".
   - Avvio rapido e pausa/ripresa pulite.

2. **Accessibilità (premio "Accessibility Forward")**
   - Interazione con lo sguardo o con l'attesa su un oggetto (dwell) come alternativa ai gesti di presa.
   - Sottotitoli ovunque e sempre disponibili (già presenti per la guida).
   - Ritmo del respiro regolabile (lento, medio, rapido).
   - Modalità ad alto contrasto.
   - Modalità con una sola mano.
   - Descrivi queste funzioni nel testo Devpost e nel video.

3. **Eventi di respirazione casuali durante la cura**
   - Mentre curi la pianta, a intervalli casuali (circa 2-4 minuti, con variazione) la lucciola si avvicina, cambia luce e invita con un sottotitolo ("Fermiamoci un momento a respirare").
   - Regole: mai mentre si tiene in mano forbici o annaffiatoio; mai due di fila; si può **rimandare senza penalità** con una mano aperta in avanti.
   - La scena si attenua e davanti all'utente compare l'**interfaccia del respiro**: cerchio di luce che si espande (inspira), si ferma (trattieni) e si restringe (espira), con le parole "Inspira / Trattieni / Espira" e un contatore dei cicli. 3-5 cicli, poi la scena torna normale e la pianta riceve un bonus di esperienza.
   - Tre schemi: semplice (4 s dentro, 6 s fuori), a quadrato (4-4-4-4), lungo e lento. Lo schema cambia col livello della pianta.
   - Opzionale: sincronizzazione con le mani (aprire le mani mentre si inspira).
   - Interfaccia al **centro del campo visivo**, a distanza comoda.
   - **Niente promesse mediche** nei testi ("riduce l'ansia", "cura lo stress"): parlare di relax, pausa e consapevolezza.
   - Riusa la meditazione guidata esistente (`src/meditation.ts`) dove possibile.

4. **Livelli e crescita del bonsai (premio "Reason to Come Back")**
   - Esperienza dalle azioni di cura (annaffiare, potare, meditare, tornare ogni giorno).
   - A soglie fisse la pianta si trasforma: seme, germoglio, giovane bonsai, bonsai maturo, bonsai fiorito. Estendi `src/bonsai-growth.ts`.
   - Sblocchi a ogni livello: un vaso diverso, una lanterna, un ruscello, un altro schema di respirazione.
   - Tutto salvato in locale (`src/persistence.ts`), con gestione degli errori se il salvataggio non è disponibile.
   - Piccolo regalo giornaliero e fiori nella sabbia a ogni ritorno (già presenti).

4b. **Cura attenta: la pianta appassisce, ma non muore mai (premio "Reason to Come Back" e "Design dell'esperienza")**
   - **Principio**: gli errori si vedono e si sentono, ma sono sempre recuperabili. Nessun "game over", nessuna perdita di esperienza, livello o stadio. Il tono resta quello di un giardino rilassante: la lucciola non rimprovera, suggerisce ("Lasciamola riposare un momento").
   - **Stati di salute** (nuovo stato da affiancare a `stage`, in `src/garden-components.ts`): *sana*, *stressata* (lieve), *appassita* (marcata). Dall'appassita si torna a sana senza perdere nulla. Ogni stato deve cambiare **forma e movimento**, non solo colore: foglie piegate, chioma più bassa, luce più fredda (serve anche per l'accessibilità e per l'alto contrasto).
   - **Troppa acqua** (`src/watering.ts`): oggi l'acqua è un valore 0..1 per stadio. Se si continua a versare con l'acqua già piena, si accumula un valore `overwater` (0..1) e il tronco cede: foglie che ingialliscono e si piegano, una pozza nel vaso. Con `overwater` alto la pianta diventa stressata e poi appassita. Il valore scende da solo col tempo (circa 60-90 secondi di attesa) e al ritorno della visita (il terreno si asciuga, come già avviene). Versare in eccesso **non dà esperienza** (evita di accumulare punti versando acqua a vuoto). La lucciola suggerisce di aspettare.
   - **Taglio sbagliato** (`src/pruning.ts`, `src/bonsai-growth.ts`): oggi si taglia toccando i germogli luminosi (`SHOOTS_BY_STAGE`, punti `CutPoint`), senza nozione di profondità. **Non misurare la profondità**: aggiungi al bonsai alcuni **rami sani non luminosi**, con il loro `CutPoint`. Tagliarne uno lascia un moncone e fa crescere `stress`; dopo circa tre tagli sbagliati la pianta appassisce. I monconi ricrescono al ritorno della visita. Tolleranza alta: il raggio di taglio esistente resta, e un taglio sbagliato non deve mai capitare per un tocco accidentale (usa la stessa logica "armata" già presente: le lame devono arrivare, non essere già lì).
   - **Germogli non ancora pronti** (facoltativo, dopo il resto): i germogli nuovi brillano solo dopo qualche secondo (vedi `GRACE_SECONDS`); tagliarli prima li fa ricrescere e dà un po' di stress. Insegna la pazienza.
   - **Recupero e collegamento con la meditazione**: la pianta stressata o appassita si riprende (a) aspettando, (b) con una **sessione di respirazione vicino a lei** (riusa `src/meditation.ts` e `src/breath-break.ts`: la pausa respiro è già una ricompensa, qui diventa anche una cura). Se l'utente trascura la pianta, appare "tesa" e la lucciola invita al respiro. È il collegamento centrale tra cura e meditazione: curalo bene.
   - **Insetti o foglie secche** (facoltativo, ultima priorità): piccole particelle sulla chioma che si tolgono con la mano o con un soffio; nessuna penalità se si ignorano. Aggiungi solo se avanza tempo.
   - **Stagioni**: il cambio di colore della chioma (punto 6) può entrare qui in versione minima: tinta della chioma legata alla data reale. Non serve altro in questa fase.
   - **Primi 5 minuti protetti**: **nessun appassimento prima del primo "momento soddisfacente"** (il cronometro esiste già in `src/first-moments.ts`). Gli errori lievi iniziano solo dopo, così il tutorial resta sereno. Verifica che un giocatore che non fa errori non veda mai niente di negativo.
   - **Accessibilità**: ogni errore ha un segnale **non solo visivo** (voce della lucciola in `src/audio/voice.ts`, un suono dolce in `src/audio/sound-engine.ts`, sottotitolo sempre attivo). Deve funzionare con "tieni fermo" (`src/dwell.ts`), con una sola mano e con alto contrasto (`src/comfort.ts`). L'annaffiatoio in modalità automatica non deve far annegare la pianta: limita l'erogazione quando l'acqua è piena.
   - **Salvataggio** (`src/save/garden-save.ts`): aggiungi i campi di salute (`stress`, `overwater`, monconi) e **alza `VERSION` da 1 a 2 con una migrazione**: un salvataggio della versione 1 deve caricarsi con valori sani, senza perdere esperienza e fiori. Aggiungi un test o almeno una verifica manuale di questo caso.
   - **Prestazioni**: nessuna draw call in più (siamo a circa 80). Cambia colore e posa con tinte e trasformazioni sui gruppi di foglie già esistenti, uniti per materiale come per il bonsai; niente luci in più. Niente animazione complessa di appassimento: bastano piegatura, abbassamento e tinta.
   - **Documentazione**: aggiorna `DEVPOST.md`, `README.md` (sezione sull'esperienza), `QUEST-TEST.md` (casi: troppa acqua, taglio sbagliato, recupero con il respiro, caricamento di un vecchio salvataggio) e `DEMO-VIDEO.md` (una scena breve in cui la pianta appassisce e si riprende). Nei testi: "cura attenta", non frasi mediche.
   - **Ordine di lavoro**: (1) salute e salvataggio con migrazione; (2) troppa acqua; (3) rami sani e taglio sbagliato; (4) recupero con il respiro; (5) segnali audio e voce; (6) stagioni minime; (7) germogli non pronti e insetti solo se avanza tempo.

5. **Giardino zen sullo sfondo**
   - Sabbia con linee rastrellate, sassi, una lanterna di pietra, una staccionata di bambù e un cielo al tramonto, tutto con forme semplici e luci economiche. Verifica prima cosa c'è già nella scena (sabbia compresa).
   - **Rastrello con la mano**: l'utente disegna linee nella sabbia, che restano come traccia (texture che si aggiorna, niente fisica).
   - Mantieni le prestazioni: pochi oggetti, unisci le mesh per materiale (come già fatto per il bonsai), niente luci in tempo reale in più.

6. **Atmosfera (rifinitura)**
   - Cambio di stagione del bonsai (ciliegio in fiore, foglie rosse d'autunno), ciclo giorno/notte con lucciole che aumentano la sera, pioggia o vento con suoni che aiutano la crescita.

7. **Prestazioni e solidità tecnica (da fare in parallelo)**
   - Budget: almeno 60 fps su Quest, controlla draw calls e numero di triangoli a ogni funzione (stato attuale: scena a circa 80 draw calls).
   - Contatore di fps in modalità debug, qualità regolabile, nessun errore se il salvataggio o l'audio non sono disponibili.
   - Esegui `npm run typecheck` e `npm run build` prima di ogni commit.

8. **Albero grande condiviso, asincrono (FACOLTATIVO)**
   - Da fare solo se i punti 1-7 sono finiti e stabili. Decisione entro il 11 novembre.
   - Un albero comune a tutti, che chi entra può annaffiare o potare, con un contatore delle "cure ricevute oggi". **Asincrono**, non in tempo reale: così i giudici che provano l'app da soli trovano comunque uno stato.
   - Richiede un piccolo servizio online minimale; nessun dato personale, nessuna chat, nomi facoltativi. Se il servizio non risponde, l'esperienza continua offline senza errori.
   - Candidato al premio "Best Social & Multiplayer".

## Fuori portata (non fare)
Multiplayer in tempo reale, più ambienti, guida con AI, passthrough, personaggi umani animati, modello Blender molto dettagliato. Se si vuole un bonsai migliore, resta **stilizzato a basso numero di poligoni** (sotto circa 10-20 mila triangoli per la pianta).

## Audio e licenze
- Musica: solo brani con licenza libera che permetta l'uso in un'app, oppure originali o sintetizzati. **Annotare fonte e licenza di ogni file** in `CREDITS.md`.
- Voce guida: **voce sintetica del dispositivo** (Web Speech API, `src/audio/voice.ts`), nessun file vocale distribuito; i sottotitoli restano sempre attivi come riserva.

## Test senza visore
- Usa l'emulatore WebXR del progetto (IWSDK).
- I gesti di annaffiare, potare e rastrellare sono approssimati dall'emulatore: tienili molto tolleranti.
- Se possibile, un test finale su un Quest di un conoscente prima della consegna (`QUEST-TEST.md`).

## Piano da qui alla consegna
- 5-6 novembre: punti 1 e 2 (primi 5 minuti, accessibilità).
- 7-8 novembre: punto 3 (eventi di respirazione).
- 9-10 novembre: punto 4 (livelli e crescita) e punto 4b (la pianta appassisce, recuperabile).
- 11-12 novembre: punto 5 (giardino zen e rastrello). Decisione sul punto 8 (albero condiviso).
- 13-14 novembre: punto 6 (atmosfera), rifinitura, ultimi controlli di prestazioni. **Blocco delle nuove funzioni il 14.**
- 15-16 novembre: aggiornare `DEVPOST.md` e `README.md`, registrare il video (`DEMO-VIDEO.md`), test finale, **consegnare su Devpost**.
- 17-18 novembre: solo margine per imprevisti, nessuna modifica.

## Da consegnare su Devpost
1. Link all'app (GitHub Pages), funzionante e gratuito fino al giudizio.
2. Video demo sotto i 3 minuti, pubblico su YouTube o Vimeo, che mostra l'esperienza reale (non generata con l'AI).
3. Modulo: nome, tagline (max 140 caratteri), categoria (Productivity), divisione (New Experience), descrizione (ispirazione, come è fatto, piani futuri; circa 500 parole), e come sono implementate le interazioni con le mani.
4. Ogni volta che una funzione cambia, aggiorna `DEVPOST.md`, `README.md`, `QUEST-TEST.md` e `DEMO-VIDEO.md`.

## Regole di lavoro per Claude Code
- Prima di scrivere, leggi la documentazione IWSDK e il codice esistente; non inventare API.
- Procedi per passi piccoli: ogni passo deve girare nell'emulatore prima del successivo.
- Mantieni la scena leggera; controlla le prestazioni a ogni funzione.
- Fai commit git a ogni funzione completata. Non rompere la pubblicazione automatica su GitHub Pages.
- Se un'idea rischia di far sforare la scadenza, proponi la versione più semplice.
