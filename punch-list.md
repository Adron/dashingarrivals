# Punch List — Deploy to Production

Everything you need to do to get **dashingarrivals** live and working in production.
The checklist below is the short version; detailed step-by-step instructions for each
item follow underneath.

Repo: <https://github.com/Adron/dashingarrivals> · Live: <https://www.dashingarrivals.com/>

---

## ✅ Immediate punch list

Required to have a working production deployment:

- [ ] **1. Merge the blank-map fix — PR #3.** This is what makes the live map actually render.
- [ ] **2. Merge the agencies + ferries — PR #2.** Full regional coverage (Pierce/Kitsap/Everett/Community Transit + WA State Ferries).
- [ ] **3. Set a production OneBusAway API key** in Vercel (`OBA_API_KEY`). Avoids rate-limit (429) gaps from the shared `TEST` key.
- [ ] **4. Clean up the Vercel environment variables.** Remove/correct the empty `NEXT_PUBLIC_*` vars and confirm `USE_MOCK` isn't `1`.
- [ ] **5. Verify the live site end-to-end** in a normal browser after it redeploys.

Optional / post-launch polish (nice to have, not blocking):

- [ ] 6. Provision Upstash Redis for a shared cache.
- [ ] 7. Confirm the custom domain + HTTPS.
- [ ] 8. Make the repo public (so README badges render for others).
- [ ] 9. Bump the CI GitHub Actions (clears a deprecation warning).
- [ ] 10. Add a data-sources / attribution credit.

---

## 📋 Instructions

### 1. Merge the blank-map fix — PR #3

**Why:** The live map was blank because `NEXT_PUBLIC_BASEMAP_STYLE_URL` and
`NEXT_PUBLIC_POLL_MS` are set to empty strings in Vercel, and the old config used `??`
(which doesn't treat `""` as "unset"). The map got an empty style URL → no basemap, and
`pollMs` became `NaN` → runaway polling. PR #3 switches those defaults to `||` so empty
values fall back to the defaults. **The map needs no API key** — this was purely the
empty-env trap.

**Do this:**
1. Open <https://github.com/Adron/dashingarrivals/pull/3> and review the diff (two files:
   `lib/clientConfig.ts`, `lib/config.ts`).
2. Confirm the CI check (`lint · typecheck · test · build`) is green.
3. Click **Merge pull request** → **Confirm merge**.
4. Vercel auto-deploys `main` to production. Watch the deploy in the Vercel dashboard
   (Deployments tab) until it's **Ready**.
5. Hard-reload <https://www.dashingarrivals.com/> — the map should now render.

CLI alternative:
```bash
gh pr merge 3 --squash --delete-branch
```

---

### 2. Merge the agencies + ferries — PR #2

**Why:** Adds Community Transit, Pierce, Kitsap, and Everett transit plus Washington State
Ferries, expanding coverage from ~440 to ~880 live vehicles across the region.

**Do this:**
1. Open <https://github.com/Adron/dashingarrivals/pull/2>.
2. It's a couple commits behind `main` (the alerts PR merged after it was opened) — there
   are **no conflicts**, but if GitHub shows an **"Update branch"** button, click it.
3. Confirm CI is green, then **Merge pull request**.
4. Vercel redeploys production automatically.

CLI alternative:
```bash
gh pr merge 2 --squash --delete-branch
```

> Tip: merge **PR #3 first**, then **PR #2**, so each deploy is clean.

---

### 3. Set a production OneBusAway API key

**Why:** The app currently uses OneBusAway's shared public `TEST` key. With seven agencies
now polling, that key hits rate limits (HTTP 429), which shows up as vehicles/stops/alerts
briefly dropping out. Your own key removes that.

**Do this:**
1. Request a key: email **`oba_api_key@soundtransit.org`** with your first/last name, your
   email, and a note that you've read and agree to the Transit Data Terms of Use.
   (Turnaround is typically a few business days.)
2. When it arrives, add it in Vercel: **Project → Settings → Environment Variables → Add**
   - **Key:** `OBA_API_KEY`
   - **Value:** *(your key)*
   - **Environments:** check **Production** and **Preview**
3. **Redeploy** so the new value takes effect: Vercel → Deployments → latest → **⋯ →
   Redeploy** (or push any commit).

> The Washington State Ferries source needs **no** key — it's a public WSDOT endpoint.

---

### 4. Clean up the Vercel environment variables

**Why:** Two client vars are set to empty strings, which caused the blank map (PR #3 makes
that non-fatal, but you should still fix the config). This is also where you confirm the app
runs on real data.

**Do this:** In **Vercel → Project → Settings → Environment Variables**:

1. **Remove** (or set to real values) these if they exist and are blank:
   - `NEXT_PUBLIC_BASEMAP_STYLE_URL` — delete it (the code default is fine), **or** set it to
     `https://tiles.openfreemap.org/styles/liberty`.
   - `NEXT_PUBLIC_POLL_MS` — delete it, **or** set it to `5000`.
2. **Confirm** `USE_MOCK` is **not** `1` (delete it or set `0`) so production uses live feeds.
3. **Redeploy** after any change (env-var edits don't apply to existing deployments).

Recommended production env vars:

| Variable | Value | Required? |
|---|---|---|
| `OBA_API_KEY` | *(your OBA key)* | Recommended (see item 3) |
| `USE_MOCK` | *(unset, or `0`)* | — |
| `NEXT_PUBLIC_BASEMAP_STYLE_URL` | *(unset, or the OpenFreeMap URL)* | — |
| `NEXT_PUBLIC_POLL_MS` | *(unset, or `5000`)* | — |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | *(from Upstash — item 6)* | Optional |

> Rule of thumb: if you're not setting a real value, **delete** the variable rather than
> leaving it blank.

---

### 5. Verify the live site end-to-end

After items 1–4 have deployed, open <https://www.dashingarrivals.com/> in a normal
(foreground) browser tab and confirm:

- [ ] The **basemap renders** (streets, water, labels — not a blank/dark area).
- [ ] **Vehicle dots** appear across the region and **glide** as they update (~every 5s).
- [ ] The **agency/type filters** (bottom-left) toggle vehicles on/off.
- [ ] **Zoom in** past ~street level → **stop markers** appear → click one → the **arrivals
      panel** shows live countdowns.
- [ ] The **"⚠ N service alerts"** pill (top center) opens a list of alerts.
- [ ] Open DevTools → **Network**: requests to `tiles.openfreemap.org` succeed, and
      `/api/vehicles` is polled about **once every 5s** (not in a tight loop).

If the map is still blank, open DevTools → **Console** and check for errors, and confirm the
deploy that includes PR #3 is the one serving `www`.

---

### 6. (Optional) Provision Upstash Redis for a shared cache

**Why:** Without Redis, each serverless instance keeps its own in-memory snapshot cache —
fine for launch. Redis lets all instances share one cached snapshot, reducing upstream calls
under real traffic.

**Do this:**
1. Vercel → **Storage → Marketplace → Upstash → Redis**, create a database, and **connect**
   it to this project.
2. Vercel injects the connection vars automatically. The app reads either
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` **or** `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`, so no code change is needed.
3. Redeploy. The cache layer detects Redis on boot.

---

### 7. (Optional) Confirm the custom domain + HTTPS

`dashingarrivals.com` already redirects to `www.dashingarrivals.com` and serves from the
`pdx1` region. To finish:
1. Vercel → **Project → Settings → Domains** — confirm both `dashingarrivals.com` and
   `www.dashingarrivals.com` show **Valid Configuration** with HTTPS issued.
2. Decide your canonical host (currently apex → `www`); that's fine to leave as-is.

---

### 8. (Optional) Make the repo public

The README status badges (CI, Vercel) and any social preview only render for anonymous
viewers if the repo is public. If you want that:
- GitHub → repo **Settings → General → Danger Zone → Change visibility → Public**.

(Leave it private if you prefer — the app itself is unaffected.)

---

### 9. (Optional) Bump the CI GitHub Actions

CI logs a cosmetic warning that `actions/checkout@v4` / `actions/setup-node@v4` run on a
deprecated Node. When newer majors are available, bump them in
`.github/workflows/ci.yml` (e.g. `@v5`). Non-blocking.

---

### 10. (Optional) Add a data-sources / attribution credit

For good citizenship and to satisfy data terms, add a small credit (e.g. a footer link or
an "About / Data" panel):
- **OneBusAway** (Sound Transit regional API) — Transit Data Terms of Use.
- **OpenStreetMap / OpenFreeMap** — already shown in the map's attribution control.
- **WSDOT** — Washington State Ferries vessel data.

---

## Quick reference

| Item | Where | Link |
|---|---|---|
| Blank-map fix | GitHub PR | <https://github.com/Adron/dashingarrivals/pull/3> |
| Agencies + ferries | GitHub PR | <https://github.com/Adron/dashingarrivals/pull/2> |
| OBA key request | Email | `oba_api_key@soundtransit.org` |
| Env vars / domain / storage | Vercel dashboard | Project → Settings |
| Full deploy walkthrough | Repo | [`DEPLOYMENT.md`](./DEPLOYMENT.md) |
