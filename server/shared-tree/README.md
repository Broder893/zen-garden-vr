# Shared tree service

The tiny online service behind the Zen Garden's shared tree (PROGETTO.md, point 8):
a Cloudflare Worker with a D1 (SQLite) database. Free tier, no credit card.

Live at `https://zen-shared-tree.zen-shared-tree.workers.dev` (database `zen-shared-tree`).

## What it stores

Only anonymous counts: cares per UTC day, and per random garden id per day (to count
gardens and cap each at 40 cares a day). No names, no chat, no IP addresses: the rate
limit per connection (12 care requests a minute) is Cloudflare's in-memory limiter.
CORS admits only the published app and local development.

```
GET  /tree       -> { day, today, gardens, total }
POST /tree/care  { garden, count? (1-5) } -> { day, today, gardens, total, accepted }
```

## Run it locally

```bash
cd server/shared-tree
npm install
npm run db:local      # creates the tables in a local database
npm run dev           # http://localhost:8787
npm test              # 16 API checks against it
```

The app in development reads `VITE_SHARED_TREE_URL` from `.env.development.local`
(`VITE_SHARED_TREE_URL=http://localhost:8787`).

## Deploy (once)

```bash
cd server/shared-tree
npx wrangler login                     # opens Cloudflare in the browser
npx wrangler d1 create zen-shared-tree # copy the database_id into wrangler.toml
npm run db:remote                      # creates the tables online
npm run deploy                         # prints https://zen-shared-tree.<you>.workers.dev
```

Then set that address as `SHARED_TREE_DEFAULT_URL` in `src/save/shared-tree-api.ts`
(or `VITE_SHARED_TREE_URL` in the build), commit and push: GitHub Pages rebuilds.
If the service is ever down, the garden keeps working and the sign says "Offline".
