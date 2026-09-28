# AIIA TrialOps

**One governed trial record. One connected workflow.**

A judge-ready prototype for **Smart India Hackathon 2026 — Problem SIH26046** (MedTech / BioTech / HealthTech).
A synthetic clinical-trial operations workspace for Ayurveda trials that connects: trial readiness → screening + consent → enrollment → visits/CRF/labs → AE/SAE + pharmacovigilance → monitoring queries → ethics/CTRI tracking → audit → interoperable exports.

> ⚠️ **Synthetic demo data — not for clinical use.** This is a student MVP. It is not a production CTMS, not a clinical
> decision system, and not an official CTRI/CDSCO/ABDM portal. No regulatory certification or production compliance is claimed.

---

## Quick start

```bash
npm install
npm run build
npm start          # http://localhost:3000
# or for development: npm run dev
```

**Demo password for every account: `demo1234`** — or use the one-click role buttons on the login page.

---

## Hosting for free (SIH-ready)

The app auto-detects its environment — no code changes are needed to deploy. Pick one of these two free options:

### Option A — Vercel (recommended: fast, always-on link)

1. **Push to GitHub**
   ```bash
   cd aiia-trialops
   git init && git add -A && git commit -m "AIIA TrialOps demo"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/<your-username>/aiia-trialops.git
   git branch -M main && git push -u origin main
   ```
2. **Deploy:** go to [vercel.com](https://vercel.com) (sign in with GitHub) → **Add New → Project** → import the repo → leave all defaults (it detects Next.js) → **Deploy**. You get a permanent `https://<project>.vercel.app` link. That's it — it runs in **MEMORY mode** out of the box.

3. **(Recommended) Add free shared state via Upstash.** Without this, each serverless instance keeps its own copy of the demo state, so during a judge session an action could appear to "un-happen" if requests bounce between instances. Upstash (free tier, ~2 min) gives every instance one shared database:
   - [upstash.com](https://upstash.com) → sign in → **Create Database** (any region, e.g. ap-south-1 Mumbai) → open it → **REST API** section → copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   - In Vercel → your project → **Settings → Environment Variables** → add both names/values (all environments) → **Redeploy**.
   - Verify: open `https://<project>.vercel.app/api/health` → `"storage": "UPSTASH REDIS (free tier) — shared & persistent…"`. Settings page also shows the mode.

   Notes: free Upstash limits (10k commands/day, 256 MB) are far beyond this demo's needs. On serverless, "Reset Demo Data" reseeds the shared DB; already-warm instances sync on their next cold start (or just redeploy/retry after a minute).

### Option B — Render.com free web service (single server, zero extra accounts)

1. Push to GitHub exactly as above.
2. [render.com](https://render.com) → **New + → Web Service** → connect the repo → Runtime **Node**, Build `npm install && npm run build`, Start `npm start` (a `render.yaml` blueprint is included if you prefer **New + → Blueprint**).
3. Free-tier behaviour: the service **sleeps after ~15 min idle**; the first visitor waits ~30–60 s while it wakes. State uses **FILE mode** (consistent while awake; reseeds when Render restarts/redeploys the instance). Health check: `/api/health`.

**Comparison:** Vercel+Upstash = instant cold starts + shared state (best for judges opening a link anytime). Render = simplest (no second service) but slow wake-ups and state resets on restart. For the live *presentation itself*, a laptop running `npm start` remains the most bulletproof option.

---

| Role | Email | Sees |
|---|---|---|
| PI | `pi@demo.local` | Full clinical review, safety review, query resolution, CTRI |
| Coordinator | `coordinator@demo.local` | Screening, consent, enrollment, visits, CRF, labs, query responses |
| Monitor | `monitor@demo.local` | Assigned site only; read-only source; findings + queries |
| PV Officer | `pv@demo.local` | Safety queue, follow-up, completeness, closure |
| Ethics Member | `ethics@demo.local` | Ethics approvals/renewals, CTRI panel |
| Leadership | `leadership@demo.local` | Aggregate KPIs only — no participant-level access |
| Admin | `admin@demo.local` | Users, settings, demo reset, judge scenario |

## The 90-second judge demo

1. Sign in as **Coordinator** (one click). The **Judge Demo** button (bottom-left) is a 12-step guided walkthrough that auto-ticks as real state changes.
2. **Overview** → note KPIs: Enrolled **24/40**, Open queries **5**, Safety follow-up **3**, Ethics/CTRI alerts **2**, Missing data **4**.
3. **Trial** → readiness = READY FOR ENROLLMENT (ethics + CTRI + site + consent version verified).
4. **Participant AYU-0025** → enrollment gate shows exactly one blocker: *“Consent has not been accepted.”*
5. **Consent tab** → Accept (language + witness + simulated signature) → gate recomputes to READY.
6. **Enroll** → KPI flips to 25/40; audit entry written; visit schedule auto-created. Duplicate codes are rejected server-side (409).
7. **Visits tab** → Baseline: add CRF (validated), add lab, complete visit.
8. **Safety** → report an **SAE** → PV task auto-created, safety KPI 3→4, notification + audit.
9. Sign out → **PV Officer** → review/follow-up the case (closure enforces completeness).
10. Sign out → **Monitor** → raise a query. **Coordinator** responds (text + source context) → **Monitor/PI** resolves → open-queries KPI falls.
11. **Audit** → every step above, with actor/role/time/old→new/reason.
12. **Reports & Exports** → download **FHIR R4 bundle** and **DM/VS/AE-like CSVs** + mapping dictionary with validation exceptions.

Admin → Settings → **Reset Demo Data** / **Load Judge Scenario** restores the seeded state for repeat presentations.

## Architecture

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS.** Server components render from the store; all mutations go through `/api/*` route handlers that **validate → authorize → apply state transition → write audit → return updated state** (uniform 400/403/404/409 + request-ID error contract).
- **Adaptive LOCAL DEMO MODE (no credentials required):** auth is a simulated demo session (shared password, httpOnly cookie). The synthetic database (`lib/seed.ts`) auto-selects its store: **Upstash Redis** when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set (free-tier shared state for Vercel), **local JSON file** on writable-filesystem hosts, or **pure memory** on serverless without Redis (labelled in Settings). **Reset Demo Data** reseeds any mode.
- **Production path (documented, not required to run):** `supabase/schema.sql` contains the full Supabase Postgres schema — UUID keys, FKs, unique (trial, subject_code), indexes, restrictive deletes, and Row Level Security policies (site-scoped monitors, leadership aggregate-only). Service-role keys are never exposed to the client.
- **Role-based access:** role-aware menus are UX only; every API checks the permission matrix (`lib/auth.ts`) server-side. Monitors are site-scoped; Leadership is blocked from participant-level endpoints.
- **AI boundaries:** “AI Assist” is rules-based completeness checking + an aggregate-only summary draft. It never decides eligibility, diagnosis, causality, seriousness, treatment, consent validity, or regulatory applicability.
- **Interoperability:** FHIR R4 bundle (Patient/Encounter/Consent/Observation, synthetic coded IDs) and CDISC-style CSVs (DM/VS/AE-like + mapping dictionary) generated live from data, with validation exceptions shown. No external transmission — integrations are mocked.

## Seeded demo world

Trial **AIIA-AYU-026-DEMO** (protocol v1.2, 3 sites, target 40) with 24 enrolled coded participants (AYU-0001…0024), plus deliberately imperfect records: **AYU-0025** blocked on consent (passes the gate once fixed), **AYU-0026** multi-blocker, an open **SAE** with PV follow-up due, **5 open queries** (1 overdue), 2 overdue visits + 2 incomplete CRFs (missing-data assistant fodder), an expired site ethics approval and a CTRI renewal due in 21 days. Two other active trials make the ACTIVE-TRIALS KPI real.

## Honest boundaries

- Audit history is **application-level**; no WORM/tamper-proof claim.
- Exports are **sample mapping demonstrations**, not validated SDTM/ADaM/Define-XML.
- CTRI states **DRAFT / REF / REGISTERED** are distinct; REF is never shown as registration.
- All external submissions (CTRI/CDSCO/ABDM/NPvCC) are **mocked**.
- Consent signatures are **simulated**; no legal e-signature validity is claimed.
- No real patient data ever: participants are coded identities (AYU-####) only.
