# Usare l'emulatore (solo l'agente a cui è stato assegnato, uno alla volta)

Il server di sviluppo è già acceso (https://localhost:8081, finestra Chromium gestita,
profilo Meta Quest 3). Non riavviarlo. Controllo: `npx @iwsdk/cli dev status` deve dare
`browserCommandReady: true`.

## Strumenti
In ogni comando Bash: `source review/tools/emu.sh` (ti mette nella cartella del progetto).

| Funzione | Cosa fa |
|---|---|
| `save_dev` / `restore_dev` | **all'inizio** salva il giardino dello sviluppatore, **alla fine** lo rimette. Obbligatori. |
| `goto "?fresh&season=spring&time=day&weather=clear"` | ricarica l'app con quei parametri (`?fresh` = salvataggio vuoto) |
| `enter` | entra in XR; `seat` mette la testa seduta (0, 1.2, 0) rivolta al tavolo, modalità mani |
| `value "espressione JS"` | valuta nell'app e stampa il valore (Python: `True`/`False`) |
| `js "(…, 0)"` | esegue JS nell'app senza stampare |
| `until_js "espressione" [tentativi]` | aspetta che sia vera (passi di 0,4 s) |
| `play 1-seed` | un gesto dimostrativo scritto in `.iwsdk-scripts/demo/<nome>.json`: `1-seed` (pizzica il seme), `2-water` (annaffiatoio), `3-prune-young`, `4-prune-mature` (forbici), `5-stone` (pietra del respiro), `6-hand-play`, `7-dwell-can`, `8-shared-water`, `9-dwell-basin` |
| `shot NOME CARTELLA [FOV]` | fotogramma 3D dell'occhio sinistro, 1800x1200 (parte dopo circa 3 s) |
| `small a.png a.jpg 900` | copia ridotta da guardare (leggi sempre la copia ridotta) |
| `pose '{"x":0,"y":1.2,"z":0}' '{"x":0,"y":0.95,"z":-0.6}'` | posizione della testa e punto guardato |
| `look '{"x":..,"y":..,"z":..}'` | gira la testa verso un punto |
| `B=$(entity Bonsai); set_bonsai xp 40` | forza un campo del bonsai (planted, xp, water, stress, overwater, prunedMask) |

Mani, a mano: `npx @iwsdk/cli xr run-sequence --input-json '{"device":"hand-right","body":"auto","steps":[...]}'`
(guarda un file in `.iwsdk-scripts/demo/` per la forma dei passi: `target`, `position`,
`pinch`, `duration`, `press`). `npx @iwsdk/cli xr list-targets` elenca i nomi che si possono
puntare o premere. Aiuto: `npx @iwsdk/cli xr --help`. Senza mani: `npx @iwsdk/cli xr
set-input-mode --input-json '{"mode":"controller"}'`.

## Cosa vede e sente il giocatore
- Sottotitolo ora a schermo: `value "__zen.guide.shownText"` (id della frase: `__zen.guide.shownLine`).
- Cronometro dell'app (secondi in VR): `value "JSON.stringify(__zen.moments.times)"` e
  `value "__zen.moments.clock"`. Momenti: wonder, planted, firstGrowth, firstBreath, mature, bloom.
- Parametri utili: `?fresh`, `?nextvisit` (conta come visita e giorno successivi),
  `?season=spring|summer|autumn|winter`, `?time=day|sunset|night`, `?weather=clear|rain|breeze`,
  `?quality=high|medium|low`, `?lids=off`, `?debug` (fps e draw call a schermo).
- Impostazioni Comfort: `value "JSON.stringify(__zen.comfort.settings)"`; per cambiarle come
  farebbe il pannello: `js "(__zen.comfort.set('dwell', true), 0)"` (chiavi: breathPace,
  highContrast, largeText, hands, dwell, softTransitions, quality).

## Limiti noti dello strumento (non sono difetti del gioco)
- Le linee bianche nel cielo sono i contorni delle mani dell'emulatore.
- Dopo aver spostato il tavolo (Comfort > Table) i tocchi automatici arrivano spostati
  della stessa misura.
- Scrivere un salvataggio in `localStorage` e poi ricaricare può essere sovrascritto dal
  salvataggio della pagina che si chiude: parti da `?fresh` e imposta lo stato con
  `set_bonsai`, oppure usa `?nextvisit`.
- L'emulatore gira a 60 o 144 Hz secondo lo schermo: i tempi del frame non valgono come
  misura per Quest.
- Il servizio dell'albero condiviso in locale è spento: l'errore `localhost:8787` in
  console è atteso.

Alla fine: `restore_dev`. Non lasciare l'app in uno stato di prova.
