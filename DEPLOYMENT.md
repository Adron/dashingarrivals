# Deploying to Vercel

This app is a standard Next.js project — Vercel auto-detects it, so the first
deploy is mostly clicking through the import flow. Serverless functions are pinned
to **`pdx1` (Portland)** via `vercel.json` — the closest Vercel region to Seattle
and to the OneBusAway API, which keeps upstream latency low.

## Prerequisites

- The GitHub repo (`Adron/dashingarrivals`) — already set up.
- A Vercel account (the free **Hobby** plan is enough — the app is designed to run
  without cron or paid features).
- _Recommended:_ a production OneBusAway key. Email `oba_api_key@soundtransit.org`
  (include your name and that you agree to the Transit Data Terms of Use). The
  public `TEST` key works but is **shared and rate-limited**, so real traffic will
  hit 429s without your own key.

## 1. Import the project

1. Go to <https://vercel.com/new>.
2. Import the **`Adron/dashingarrivals`** repository (authorize Vercel for the repo
   if prompted — since it's private, grant access).
3. Framework preset **Next.js** is auto-detected. Leave build/output settings at
   their defaults (`npm run build`).
4. Add environment variables (next section), then **Deploy**.

## 2. Environment variables

Set these under **Project → Settings → Environment Variables** (apply to
Production and Preview). With **none** set, the app still runs against real feeds
using the shared `TEST` key — but set at least `OBA_API_KEY` for real traffic.

| Variable | Recommended value | Required? | Notes |
|---|---|---|---|
| `OBA_API_KEY` | _your OBA key_ | Recommended | Falls back to `TEST` (rate-limited). |
| `OBA_BASE_URL` | `https://api.pugetsound.onebusaway.org` | No | Default already correct. |
| `NEXT_PUBLIC_BASEMAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/liberty` | No | MapLibre basemap. |
| `NEXT_PUBLIC_POLL_MS` | `5000` | No | Client vehicle poll interval (ms). |
| `CACHE_TTL_MS` | `5000` | No | Server snapshot freshness (ms). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | _from Upstash_ | No | Shared cache — see step 3. |

## 3. (Optional) Shared cache with Upstash Redis

Without Redis, each serverless instance keeps its **own** in-memory snapshot cache
— perfectly fine for launch. To share one cached snapshot across all instances
(fewer upstream calls under load):

1. In the Vercel dashboard: **Storage → Marketplace → Upstash → Redis**, create a
   database, and connect it to this project.
2. Vercel injects the connection env vars automatically. The app reads either
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` **or** `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`, so no code change is needed.
3. Redeploy. The cache layer detects Redis on boot and starts using it.

## 4. Deploy & auto-deploys

- The first deploy publishes to a `*.vercel.app` URL.
- Every push to `main` triggers a **production** deploy; pull requests get **preview**
  deployments. (The GitHub Actions CI also runs lint/typecheck/test/build on each
  push/PR.)

## 5. Custom domain — `dashingarrivals.com`

1. **Project → Settings → Domains → Add** `dashingarrivals.com` (and optionally
   `www.dashingarrivals.com`).
2. At your DNS registrar, add the records Vercel shows. Typically:
   - Apex `dashingarrivals.com` → **A** record to `76.76.21.21`, _or_ point the
     domain's nameservers to Vercel.
   - `www` → **CNAME** to `cname.vercel-dns.com`.
3. Vercel verifies the domain and auto-provisions HTTPS.
4. Once it resolves, the site is live at <https://dashingarrivals.com/> and the
   README **Vercel** badge goes green.

## CLI alternative

Prefer the terminal? From this project directory:

```bash
npm i -g vercel      # or: npx vercel
vercel               # first run: log in + link the project
vercel --prod        # deploy to production
```

In a Claude Code session you can run the interactive login yourself with
`! npx vercel` (the `!` prefix runs it in your terminal so the login prompt works).

## Notes

- API routes (`/api/vehicles`, `/api/stops`, `/api/stops/[id]/arrivals`) run on the
  **Node.js runtime** because they decode GTFS-realtime protobuf — not the edge
  runtime.
- `npm run build` does not call the upstream transit feeds, so CI and local builds
  never fail if an agency feed is momentarily down.
