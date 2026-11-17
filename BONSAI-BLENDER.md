# Bonsai Blender: integrazione (da fare con Claude Code)

I 5 modelli sono già in `public/models/`: `bonsai_0_seed.glb`, `bonsai_1_sprout.glb`, `bonsai_2_young.glb`, `bonsai_3_mature.glb`, `bonsai_4_blooming.glb`.

## Contenuto dei GLB
- Oggetti: `pot`, `soil`, `moss`, `trunk`, `foliage` (e `flowers`, `snow`, `fallen`, `puddle` dove servono).
- Materiale della chioma: `foliage` (da tingere dal codice per stagioni e salute). Fiori: `flower`.
- Punti di taglio: empties `cut_01`, `cut_02`, ... (l'ultimo è la cima).
- `snow` (inverno), `fallen` (autunno) e `puddle` (troppa acqua) sono sempre presenti: il gioco li mostra o nasconde.
- Stile basso poligono, tutta la pianta sotto 3.000 triangoli. Colori di base: estate.

## Passi (uno alla volta, ognuno deve girare nell'emulatore)
1. Leggi `bonsai-growth.ts`, `health.ts`, `pruning.ts`, `watering.ts`, `season.ts` e dove si crea il bonsai.
2. Prova SOLO `bonsai_3_mature.glb` al posto del bonsai attuale. Controlla scala, altezza del vaso, che i `cut_NN` coincidano con i punti di potatura, che la chioma si tinga dal codice.
3. Misura fps e draw calls (obiettivo 60 fps, circa 80 draw calls). Fai un rapporto prima di continuare.
4. Se va bene: collega gli altri livelli (seme, germoglio, giovane, fiorito) a `BonsaiStage`, poi `snow`/`fallen`/`puddle` a stagioni e salute. Il moncone del taglio sbagliato si crea dal codice.
5. `npm run typecheck` e `npm run build` prima di ogni commit. Non rompere GitHub Pages.

## Scadenze
Controllo il 12 novembre: se l'integrazione non è stabile, si resta col bonsai attuale. Blocco delle funzioni il 14.
Aggiorna `CREDITS.md` (modelli originali creati con Blender) e `DEVPOST.md` se i modelli entrano.
