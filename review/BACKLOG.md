# Backlog (Fase 2), 15 novembre 2026 sera

Fonti: `review/giuria.md` (voto 6,5) e `review/consegna.md` (voto 5). Le altre dodici
revisioni non esistono: il limite d'uso ha fermato gli agenti tre volte (giocatore nuovo,
primi cinque minuti, accessibilità, mani e gesti, prestazioni, direzione artistica, audio,
testi, motivo per tornare, comfort VR, robustezza, codice). Il collaudo da giocatore nuovo
resta **non fatto**. Stop al codice: 16 novembre ore 12:00.

Ordine: impatto sul voto diviso rischio. Tutte le voci costano 0 draw call.

| # | Problema | Criterio o premio | Impatto | Rischio | Stato |
|---|---|---|---|---|---|
| 1 | Descrizione Devpost di 854 parole (richieste circa 500), idee originali sepolte, sezione mani da manuale (723 parole) | Rifinitura; Innovazione | 5 | basso | FARE |
| 2 | Il giudice fa una visita sola: non vede ritorno, durata della pausa, riepilogo, giorni di fila. Serve un link "Second visit" (`?nextvisit`) accanto a "Try it" in Devpost e in cima al README | Reason to Come Back; Design | 5 | basso | FARE |
| 3 | Numeri superati in DEVPOST, README, QA-REPORT (78 draw call invece di 62-74; 31 test invece di 59; tempi vecchi; "four stages"; "birds" tra i piani futuri) | Implementazione tecnica | 3 | basso | FARE |
| 4 | "Everything also works by looking" non è vero per rastrello e pannello Comfort | Accessibility; onestà | 3 | basso | FARE |
| 5 | Ammissione di "solo emulatore" detta due volte e senza metodo: dirla una volta, come metodo di lavoro | Implementazione tecnica | 3 | basso | FARE |
| 6 | README senza blocco "For judges" e senza le funzioni del 14 sera (arrivo, sagoma, primo respiro, musica) | Rifinitura | 3 | basso | FARE |
| 7 | `DEMO-VIDEO.md` fermo al pomeriggio del 14: scaletta nuova da 2:45 sui nomi `vNN`, con scena del ritorno (durata, riepilogo), una scena continua senza un solo pizzico, didascalia "recorded in the WebXR emulator" | Rifinitura; i tre premi | 5 | basso | FARE |
| 8 | Crediti incompleti: librerie (IWSDK, super-three, uikit, Lucide, elics) e font Inter (OFL 1.1) | Regole (licenze) | 3 | basso | FARE |
| 9 | `public/ui/AGENTS.md` e `public/scenes/AGENTS.md` finiscono sul sito pubblicato | Rifinitura | 1 | basso | FARE |
| 10 | Immagini Devpost tutte vecchie (giardino di prima del 14 pomeriggio); mancano palpebre a metà, sagoma, pianta appassita e guarita, anello "tieni fermo", riepilogo con respiri veri, quattro stagioni | Rifinitura | 4 | basso | FARE se il limite d'uso lo permette, altrimenti all'autore |
| 11 | "Tieni fermo" va cercato: 30 s di attesa prima del suggerimento Comfort | Accessibility | 3 | medio (cambia i tempi del tutorial) | FORSE: chiesto in RICHIESTE |
| 12 | Nel video e nelle immagini non si vede una mano (l'emulatore disegna solo contorni sottili) | Rifinitura; requisito hands-first | 5 | non risolvibile da codice | NO da parte nostra: vedi RICHIESTE |
| 13 | Nessuna prova su un visore | Implementazione tecnica | 4 | non risolvibile senza visore | NO: resta in WIN-REPORT |
| 14 | Video: non esiste, clip vecchie | tutto | 5 | lavoro dell'autore | RICHIESTE |
| 15 | Ammissione al programma Meta VR Start e regolamento non riletti | validità della consegna | 5 | lavoro dell'autore | RICHIESTE |
| 16 | Manca `LICENSE` (serve la scelta dell'autore) | Regole | 2 | basso | RICHIESTE |
| 17 | `sproutBreath` senza registrazione: il primo respiro è letto dalla voce del dispositivo | First Five Minutes | 3 | lavoro dell'autore | RICHIESTE |

Scartato per tempo: correzioni al gioco che nessuna revisione ha potuto provare. Nessuna
voce FARE cambia un gesto o toglie qualcosa.
