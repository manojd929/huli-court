# HuliCourt — Production deployment runbook

_Last updated: 2026-07-06_

This is the hand-off for taking HuliCourt live on Vercel. The code is
deploy-ready (typecheck, lint, tests, and production build all pass, and the
database is already migrated). The steps below need **your interactive Vercel
auth**, which a headless agent session can't perform — so run them yourself;
they take ~5 minutes.

## 0. Decision: which Supabase project is production?

- **Recommended (MVP): reuse the current Supabase project as production.** It's
  already on the latest schema (all migrations applied), has clean data (test
  data was wiped), and holds the 4 commissioner accounts. Fastest path live.
- **Alternative (cleaner separation): create a fresh prod Supabase project.**
  More isolation between dev and prod, but you'd re-run migrations
  (`npx prisma migrate deploy`), re-provision commissioner accounts, and swap
  all the env vars. Do this later if/when you want a separate staging DB.

The steps below assume the recommended path (reuse current project).

## 1. Environment variables (set these on Vercel)

All live in `.env` locally. Copy the values into Vercel → Project → Settings →
Environment Variables (Production, and Preview if you want preview deploys):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** (`...pooler...:6543`) — used at runtime |
| `DIRECT_URL` | Supabase **session pooler** (`...:5432`) — used for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — used for admin user provisioning |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (player/team/league image uploads); optional but recommended |
| `NEXT_PUBLIC_APP_URL` | set to your **production URL** (e.g. `https://hulicourt.com`) after first deploy, then redeploy |

Tip: `vercel env pull` / `vercel env add` can script this once linked.

## 2. Deploy steps

```bash
# From the project root, on the code you want to ship:
vercel login            # interactive
vercel link             # create/attach the Vercel project
# add the env vars from the table above (dashboard or `vercel env add`)
vercel --prod           # build + deploy to production
```

If deploying from GitHub instead: connect the repo in the Vercel dashboard and
push — Vercel auto-builds. Set the env vars first either way.

## 3. Post-deploy checklist

1. Set `NEXT_PUBLIC_APP_URL` to the real production URL, then redeploy (it's
   baked into the client build).
2. In Supabase → Authentication → URL Configuration, add the production origin
   to the allowed redirect/site URLs so login cookies work.
3. Smoke test: open the site, `/login`, sign in with a commissioner account
   (see `docs/commissioner-accounts.md`), create a league + a tournament, run a
   quick draft. Open `/tournament/<slug>/tv` in an incognito window (public).
4. Point your domain (`hulicourt.com` / `.in`) at Vercel when ready.

## 4. Known launch gaps (accept or address before/after go-live)

From the pre-launch code review (2026-07-06). None are blockers for a
controlled launch; listed so nothing is a surprise.

- **No error tracking (Sentry).** Not installed. As a stopgap, unexpected server
  errors now `console.error(...)` before returning the generic message — check
  **Vercel → Logs** to diagnose issues. Add Sentry when you can (~1 hour).
- **No self-serve password reset or change-password UI.** Rotate passwords via
  the Supabase dashboard for now. Wire Supabase's reset flow soon.
- **Signup abuse protection is minimal** (no email verification / rate limit /
  CAPTCHA). Fine behind a private launch; add Cloudflare Turnstile before
  publicizing the `/signup` URL widely.
- **The tournament snapshot API (`/api/tournaments/[slug]/snapshot`) is public
  by slug** — this powers the projector/TV board and is intentional. It exposes
  rosters/purses/live state (not emails). Add a per-tournament "private board"
  toggle later if desired.
- **Deferred review hardening (non-blocking):** auction transactions use
  READ COMMITTED (the bid `bidCount` compare-and-set already makes concurrent
  bids safe — verified by test); auction auto-complete uses a global slot count
  (consistent with the snake draft, bounded by squad caps); `Pick.slotIndex`
  has no unique constraint (admin-serialized, low risk). Revisit if you scale to
  many simultaneous auctions.

## 5. Security posture (verified this review)

- **Tenant isolation on reads is enforced.** Every authenticated tournament page
  calls `requireTournamentViewAccess` — a signed-in user can only view a
  tournament they created, manage via their org, or participate in as a team
  owner. Cross-tenant slug guessing returns not-found (verified).
- Write/mutation paths re-check ownership in the service layer.
- The public TV board (`/tv`) and public league page (`/league/<slug>`) are
  intentionally unauthenticated and expose no emails/notes.
