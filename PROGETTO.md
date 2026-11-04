# PROGETTO: Giardino Zen VR (Meta VR Start Developer Competition 2026)

> File di passaggio per Claude Code. Leggilo per intero prima di scrivere codice.

## Obiettivo
Un'esperienza VR **rilassante, da seduti, usabile solo con le mani** (nessun controller), per i visori Meta Quest. Categoria: **Productivity** (abitudine legata a un momento ricorrente: pausa dal lavoro o sera). Divisione: **New Experience** (progetto iniziato dopo il 24 settembre 2026).

## Scadenza e contesto
- Consegna entro il **18 novembre 2026, ore 12:00 PT (21:00 in Italia)**. Dopo non si può modificare nulla.
- Non c'è un visore a disposizione: si sviluppa e si testa con un **emulatore WebXR nel browser**. Il video demo può essere registrato con un simulatore.
- Giudizio (25% ciascuno): Innovazione e creatività, Design dell'esperienza, Implementazione tecnica, Rifinitura e presentazione.
- Premi speciali interessanti: "Best Reason to Come Back", "Best First Five Minutes".

## Stack tecnico
- **IWSDK (Immersive Web SDK)**, WebXR. Requisiti: Node.js >= 20.19.0.
- Creazione progetto: `npm create @iwsdk@latest`
- Pubblicazione: GitHub Pages (o Vercel). I giudici devono poter aprire un link.
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

## Idea
Un piccolo giardino zen su un tavolo davanti all'utente, con una **lucciola luminosa come guida** (NPC non umano, costo basso). Tre zone:

1. **Bonsai da curare**
   - Annaffiare: afferri un annaffiatoio e lo inclini; l'acqua esce solo se inclini davvero.
   - Potare: afferri le forbici e chiudi il pizzico sui rami evidenziati.
   - Il bonsai cresce a stadi (germoglio, giovane, chioma piena, con fiori) in base alla cura.
2. **Angolo di meditazione**
   - Un cuscino o una pietra con luce che pulsa.
   - Meditazione guidata di 1-3 minuti: respiro visivo (sfera che si espande e si restringe), voce guida, sottotitoli, musica zen.
3. **Persistenza**
   - Lo stato del bonsai (stadio, cura, numero di sessioni) viene salvato in locale (`localStorage`, con gestione degli errori) e ricaricato alla sessione successiva.

### La lucciola guida
Piccola sfera di luce che fluttua, segue lo sguardo e le mani, cambia colore e intensità secondo la fase. Spiega le azioni con **sottotitoli brevi** e suoni (niente muri di testo). Primo tutorial: "pizzica il seme per iniziare".

## Priorità (fare in quest'ordine)
1. Progetto base IWSDK che parte nell'emulatore: tavolo + illuminazione + hand tracking funzionante.
2. Bonsai con annaffiatura e potatura (zone di presa **grandi e tolleranti**, nessuna precisione richiesta).
3. Lucciola guida con sottotitoli e primo tutorial.
4. Meditazione guidata con respiro visivo.
5. Audio: musica di sottofondo, suoni di acqua e forbici, voce guida.
6. Salvataggio della crescita.
7. Rifinitura: luci morbide, transizioni, onboarding fluido nei primi 5 minuti.

### Solo se avanza tempo
- Un secondo elemento nel giardino (altra pianta, decorazioni).
- Ciclo giorno/notte che cambia la luce.
- Piccole ricompense per tornare (es. un fiore dopo 3 sessioni).

### Fuori portata (non fare)
Multiplayer, più ambienti, guida con AI, passthrough, personaggi umani animati.

## Audio e licenze
- Musica: solo brani con licenza libera che permetta l'uso in un'app (es. CC0 o royalty-free con uso consentito), oppure originali. **Annotare fonte e licenza di ogni file** in `CREDITS.md`.
- Voce guida: registrata dall'utente oppure sintetica con termini che permettano l'uso. In entrambi i casi in inglese, con sottotitoli. *(Scelta ancora da fare.)*

## Test senza visore
- Usa un emulatore WebXR nel browser (verifica nella documentazione IWSDK quale è consigliato).
- I gesti di annaffiare e potare sono approssimati dall'emulatore: tienili molto tolleranti.
- Se possibile, un test finale su un Quest di un conoscente prima della consegna.

## Piano di massima (14 giorni)
- Giorni 1-3: progetto base, scena, mani nell'emulatore.
- Giorni 4-8: ciclo completo (bonsai, guida, meditazione).
- Giorni 9-11: grafica, luci, audio, salvataggio.
- Giorni 12-13: pubblicazione, test, video demo (< 3 minuti, in inglese).
- Giorno 14: margine per imprevisti.

## Da consegnare su Devpost
1. Link all'app (GitHub Pages o simile), funzionante e gratuito fino al giudizio.
2. Video demo sotto i 3 minuti, pubblico su YouTube o Vimeo, che mostra l'esperienza reale (non AI-generated).
3. Modulo: nome, tagline (max 140 caratteri), categoria (Productivity), divisione (New Experience), descrizione (ispirazione, come è fatto, piani futuri; circa 500 parole), e come sono implementate le interazioni con le mani.

## Regole di lavoro per Claude Code
- Prima di scrivere, leggi la documentazione IWSDK; non inventare API.
- Procedi per passi piccoli: ogni passo deve girare nell'emulatore prima del successivo.
- Mantieni la scena leggera; controlla le prestazioni spesso.
- Fai commit git a ogni funzione completata.
- Se un'idea rischia di far sforare la scadenza, proponi la versione più semplice.
