# Puget Sound Transit — Live Map

[![CI](https://github.com/Adron/dashingarrivals/actions/workflows/ci.yml/badge.svg)](https://github.com/Adron/dashingarrivals/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/github/deployments/Adron/dashingarrivals/Production?logo=vercel&logoColor=white&label=vercel)](https://dashingarrivals.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-5-396CB2?logo=maplibre&logoColor=white)](https://maplibre.org/)

**Live site:** [dashingarrivals.com](https://dashingarrivals.com/)

A TriMet-style live transit map for the Puget Sound region (Seattle, Bellevue,
Redmond, Tacoma, Everett, and beyond). It shows **every active transit vehicle in
service in real time** — buses, trains, and (later) ferries — on an interactive
map you can pan, zoom, filter, and click for details.

Built with **Next.js (App Router) + MapLibre GL**, deployed on **Vercel**.

## How it works

- **Data:** Vehicle positions come from the [OneBusAway Puget Sound regional
  API](https://api.pugetsound.onebusaway.org) as GTFS-realtime protobuf, one
  endpoint per agency. A single OneBusAway key covers King County Metro, Sound
  Transit, Pierce, Kitsap, Everett, and Intercity. (Washington State Ferries and
  Community Transit are separate sources, added in later phases.)
- **Server:** `GET /api/vehicles` fetches each enabled agency feed (Node runtime),
  decodes the protobuf, normalizes everything into one `Vehicle` list, and caches a
  merged snapshot with a short TTL + single-flight (`lib/cache.ts`). This decouples
  the upstream fetch rate from the number of connected clients — upstream is hit at
  most ~once per TTL regardless of traffic, and works on any Vercel plan.
- **Client:** A MapLibre map (`components/MapView.tsx`) polls `/api/vehicles` every
  ~5s and eases each vehicle from its previous position to the new one on a
  `requestAnimationFrame` loop, so markers glide instead of jumping.

## Getting started

```bash
npm install
cp .env.example .env.local   # no keys required to start
npm run dev                  # http://localhost:3000
```

The app always uses live feeds. The OneBusAway public `TEST` key works for limited
development; request a production key by emailing `oba_api_key@soundtransit.org`,
then set `OBA_API_KEY` in your environment.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit tests (protobuf decode + normalize) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Configuration

See `.env.example` for all variables. Key ones:

- `OBA_API_KEY` — OneBusAway key (`TEST` for dev).
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis (Vercel Marketplace) for a
  shared snapshot cache + analytics store across serverless instances. Blank ⇒
  per-instance memory (ephemeral, not shared).
- `NEXT_PUBLIC_BASEMAP_STYLE_URL` — MapLibre style (default: OpenFreeMap, no key).

## Deploy

Hosted on **Vercel** (auto-detected Next.js). Functions are pinned to `pdx1`
(Portland) via `vercel.json` for low latency to Seattle and the OneBusAway API.
Push to `main` → production deploy; PRs → preview deploys.

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full walkthrough: importing the
repo, environment variables, optional Upstash Redis cache, and pointing
`dashingarrivals.com` at it. Shortest path: import the repo at
[vercel.com/new](https://vercel.com/new), set `OBA_API_KEY`, and deploy.

## Tech notes

- **MapLibre GL v5** (not v6): v6 is ESM-only with a split module-worker that
  doesn't bundle cleanly under Next; v5's UMD build with an inlined worker is
  bundler-agnostic and battle-tested.
- **Node runtime** on `/api/vehicles` — protobuf decoding isn't reliable on edge.
- The map calls `resize()` + uses a `ResizeObserver` so it renders correctly in
  flex/dynamic containers.

## Roadmap

- **Now:** live vehicle map for King County Metro + Sound Transit.
- **Next:** GTFS routes lookup (human route labels + correct train typing for
  Link/Sounder), stop arrivals (OneBusAway REST), service alerts.
- **Later:** Pierce/Kitsap/Everett/Intercity/Community Transit, Washington State
  Ferries, trip planner, i18n.

See `.claude/` and the project plan for the full phased design.
