# HuliCourt · Franchise draft platform

**HuliCourt** is a web app for running **live snake drafts** for sports clubs and leagues: franchises (teams), athlete roster photos, **fair pick order**, squad caps by **roster group**, and an **organizer vs franchise-owner** workflow where nominees send a pick and the **commissioner confirms** it before it lands on the board.

Built with **Next.js 16** (App Router), **React 19**, **PostgreSQL** via **Prisma 7**, **Supabase Auth**, and optional **Vercel Blob** for images.

---

## Features

### Tournaments & branding

- **Slug-based hubs** (`/tournament/[slug]`): card grid to open the right surface. **Commissioners** see setup plus **Manage auction** and **Live roster board** (see [Navigation](#navigation-commissioners-vs-franchise-owners)). **Franchise owners/participants** see read-only league views plus **My Team** and a live-only **Participate in auction** card.
- **Branding**: name, accent color (`colorHex`), optional logo uploaded to Blob when configured.
- **Lifecycle**: commissioner creates tournaments from **Dashboard**; tournaments can be **soft-deleted**.
- **`picksPerTeam`**: configurable roster depth for the snake schedule.

### Navigation (commissioners vs franchise owners)

- **Single source**: `src/lib/navigation/tournament-nav-links.ts` builds tournament chrome pills and hub card lists from whether the signed-in user is the tournament **`createdById`** commissioner.
- **Commissioner path** (ops-focused): **Home**, **Roster groups**, **All Players**, **All Teams**, **Rules**, **Manage auction**, **Live roster board**.
- **Participant/owner path** (read + participation): **Home**, **Roster groups**, **All Players**, **All Teams**, **Rules**, **Live roster board**, **My Team**.
- **Tournament cluster gating**: the entire **Tournament** navigation group stays hidden for both commissioner and owner until the commissioner explicitly ends the auction and the tournament reaches `DraftPhase.COMPLETED`. That same transition reveals **Fixtures** and **Knockout board** to owners, and **Fixtures**, **Run tournament**, and **Knockout board** to commissioners.
- **Live participation card**: when draft phase is `LIVE` or `PAUSED`, non-commissioners also see a **Participate in auction** hub card to open `/tournament/[slug]/draft`.
- **Routes still exist**: `/tournament/[slug]/draft` and `/tournament/[slug]/owner` remain; `/owner` is now the **My Team** roster surface.

### Access & roles

- **Commissioner** (tournament `createdById`): full setup (**Teams**, **Players**, **Roster groups**, **Rules**), runs **Manage auction** (shuffle, phases, confirm/undo, overrides, spotlight), edits hub branding when logged in.
- **Franchise owner**: separate Supabase login; nominates picks on **Participate in auction** (`/draft`) when `Team.ownerUserId` matches; cannot confirm picks.
- **Commissioner guardrails**: commissioner **cannot** be assigned as a team owner (`UserRole` / assignee rules in `franchise-owner-assignees`).
- **`UserProfile.role`**: `ADMIN`, `OWNER`, `VIEWER`; league owner accounts provisioned via service role receive `OWNER`.
- **Route protection** (`src/lib/supabase/middleware.ts` + page checks): **`/tournament/[slug]/tv`** is **public** (no login) for projector use; almost all other app/tournament URLs require Supabase session. **Manage auction** remains commissioner-only. **Teams / Players / Rules / roster groups** are owner-readable and commissioner-editable.
- **Portal admission**: only existing `UserProfile` rows with role `ADMIN` or `OWNER` are allowed to complete login/session establishment; `VIEWER` users are blocked from portal access.

### Franchise owner accounts (Supabase Admin API)

Requires **`SUPABASE_SERVICE_ROLE_KEY`** (server-only, never expose to the client).

- **Create owner login** from the **Teams** invite flow (`createLeagueOwnerAccount`): email/password, `email_confirm: true`, upserts `UserProfile` as `OWNER`.
- **Grant login from a roster row** (`createLeagueOwnerForPlayerAccount`): ties new auth user to `Player.linkedOwnerUserId` when the commissioner provisions credentials from **Players**.
- **Revoke** login from player (`revokeFranchiseLoginFromPlayer`): clears link once not still assigned as a **team** owner.
- **Remove owner from tournament** (`deleteFranchiseOwnerFromTournament`): clears `Team.ownerUserId` and `Player.linkedOwnerUserId` for that owner; blocked outside `SETUP` / `READY`.
- **Orphan cleanup** (`deleteAuthUserIfNoOwnerReferences`): deletes Supabase user and soft-deletes profile when nothing references them; never removes `ADMIN` profiles.

Eligible assignees for team ownership are derived from **`buildFranchiseOwnerAssigneeList`** (OWNER role / already linked-or-owning-in-this-league / not commissioner / not owning another tournament’s team unless already in this one, etc.).

### Owner-backed player rows

- A `Player.linkedOwnerUserId` row is still a **real player** on that franchise roster. It is not a non-playing placeholder for tournament operations.
- Owner-backed player rows are **pre-attached to the owner's team**, so they **do not** appear as draftable auction nominations.
- Owner-backed player rows **do** count in roster/category pool math, **do** appear on **My Team**, and **do** participate in generated fixtures and doubles pairings.

### Teams & ordering

- **Teams**: display order, optional short name, colors, logos, optional `ownerUserId`.
- **Snake draft order**: `DraftOrderSlot` rows; organizer **shuffle** persists order and logs `ORDER_RANDOMIZED`.
- **`draftOrderLocked`**: ordering sealed for go-live workflows as implemented in draft service.

### Roster groups & players

- **`RosterCategory`**: commissioner-defined roster groups per tournament (name, tint `colorHex`, display order); optional **`stableKey`** for seeded/automation buckets. Players and squad caps attach to exactly one roster group.
- **Gender**: `Gender` enum on each player (`Player`).
- **Flags**: unavailable, locked roster rows (`isUnavailable`, `isLocked`).
- **Photos** and notes; optional **`linkedOwnerUserId`** for franchise-login linkage and assignee eligibility.
- **Soft delete** players.
- **`playerEntryFeeMinorUnits`** + **`playerEntryFeeCurrencyCode`** on `Tournament` for optional localized entry-fee labeling in tooling where surfaced.

### Squad rules

- **`SquadRule`**: unique per `(tournamentId, rosterCategoryId)` cap (`maxCount`).
- **Rules page**: signed-in users can view pick-limit guidance and current caps; commissioner can edit via squad form and reconcile/auto-fill helpers (`reconcileSquadRulesForTournament` / squad utilities).

### Draft runtime

- **`DraftPhase`**: `SETUP` → `READY` → `LIVE` → pause/freeze/lock/completed semantics as surfaced in UI and enforced in **`draft-service`**.
- **Pending nomination** stored on **`Tournament`**: `pendingPickPlayerId`, `pendingPickTeamId`, idempotency key for duplicate nominate clicks.
- **Confirmed picks**: `Pick` rows (unique `(tournamentId, playerId)`), `confirmedByUserId`, `PickStatus.CONFIRMED` for persisted board state.
- **Validation**: roster caps / availability unless **`overrideValidation`** (admin-only toggle with audit via `DraftLog`).
- **`pickTimerSeconds`**: surfaced in snapshot/DTO for UI timing affordances where wired.
- **Admin actions**: start/pause/resume/freeze/unlock/lock, advance/revert/skip turn, shuffle, confirm pick, undo (clears pending or removes last confirmed), force sync variants as implemented, validation override confirmation.
- **Auction spotlight** (live): commissioner can narrow the nominate surface to nominees in **`Tournament.activeAuctionRosterCategoryId`**; **`null`** means all roster groups remain visible to owners/board clients per implementation.

### Client experiences

| Route | Audience | Behavior |
|-------|----------|----------|
| `/tournament/[slug]` | Signed-in users | Hub (cards differ for commissioner vs others) + commissioner branding edit |
| `/tournament/[slug]/categories` | Signed-in | Commissioner can manage; owners/participants read-only |
| `/tournament/[slug]/teams` | Signed-in | Commissioner can manage; owners/participants read-only |
| `/tournament/[slug]/players` | Signed-in | Commissioner can manage; owners/participants read-only |
| `/tournament/[slug]/rules` | Signed-in | Commissioner can manage; owners/participants read-only |
| `/tournament/[slug]/draft` | Signed-in | Live participation board for nomination when eligible |
| `/tournament/[slug]/owner` | Signed-in | **My Team** card view (owner-linked row + confirmed picks, including player photos when present) |
| `/tournament/[slug]/admin` | Commissioner | Manage auction control room |
| `/tournament/[slug]/tv` | **Public** | Live roster board for the room |

### Realtime-ish updates & API

- **Polling**: `useDraftLiveSync` hits **`GET /api/tournaments/[slug]/snapshot`** on tiered intervals when the tab is visible (clients such as Manage auction / TV poll at context-appropriate cadences).
- **Optional Supabase Realtime**: Postgres changes on **`Tournament`** (`id.eq.{uuid}`) trigger an immediate snapshot refresh when Realtime replication is configured in Supabase.

**Operational note**: the snapshot JSON route does not authenticate by default; secrecy relies on tournament **slug** (and HTTPS). Commissioners should treat URLs as sensitive if unpublished player data matters.

---

## Architecture (high level)

| Layer | Responsibility |
|-------|----------------|
| **`src/app/`** | Routes, redirects, composing server components |
| **`src/features/**`** | Server actions (`actions.ts`), feature forms/dialogs |
| **`src/services/**`** | Transactions, domain rules (`draft-service`, `tournament-service`, `roster-category-service`, `league-account-service`, `franchise-owner-auth`) |
| **`src/lib/**`** | Prisma client, Supabase SSR/browser clients, uploads, navigation (`navigation/tournament-nav-links`), guards (`tournament-access`, assignee helpers) |
| **`prisma/schema.prisma`** | Source of truth for enums/models/migrations |

Request pipeline: **`src/proxy.ts`** bundles the middleware matcher + delegates to **`src/lib/supabase/middleware.ts`** for Supabase cookie refresh and auth redirects (see **`src/proxy.ts`** matcher). Password/email flows finalize sessions via **`POST /api/auth/establish-session`** (Route Handler); draft rules otherwise stay off thin HTTP handlers aside from **`GET /api/tournaments/[slug]/snapshot`**.

---

## Data model highlights (`prisma/schema.prisma`)

- **Soft deletes**: `deletedAt` on `UserProfile`, `Tournament`, `Team`, `Player` (retain FK integrity and history-friendly queries).
- **Enums** (`UserRole`, `Gender`, `DraftPhase`, `PickStatus`, `DraftLogAction`) avoid magic strings in SQL.
- **`Tournament`**: draft phase, timer, slot index, locked order flags, pending pick columns, **`overrideValidation`**, **`activeAuctionRosterCategoryId`**, optional player entry fee fields, timestamps for draft start/end.
- **`DraftOrderSlot`**: materialized snake order `{ slotIndex → teamId }`.
- **`RosterCategory`**: commissioner-defined roster group per tournament (`name`, optional `colorHex`, `displayOrder`, optional **`stableKey`**, **`archivedAt`**).
- **`SquadRule`**: roster cap keyed by **`rosterCategoryId`** (unique per `(tournamentId, rosterCategoryId)`).
- **`Pick`**: one row per drafted player (`@@unique([tournamentId, playerId])`).
- **`DraftLog`**: append-only audit (`action`, `message`, optional JSON `payload`, `actorUserId`).
- **Ownership graph**: `Team.ownerUserId` → `UserProfile`; `Player.linkedOwnerUserId` for commissioner-provisioned “stub owner” linkage (`@@unique([tournamentId, linkedOwnerUserId])`).

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16, React 19 |
| UI | Tailwind CSS 4, Base UI primitives, shadcn-style patterns |
| Data | Prisma 7, `@prisma/adapter-pg`, `pg` |
| Auth | Supabase SSR (cookies) + service role for admin user provisioning |
| Storage | Vercel Blob (optional) for logos and player photos |
| Validation | Zod |
| Tests | Vitest |

---

## Prerequisites

- **Node.js** 20+ recommended (align with Vercel defaults).
- **PostgreSQL** database (Supabase hosted Postgres works well).
- **Supabase project** for authentication (`NEXT_PUBLIC_*` + anon key + **service role** for commissioner-created owner accounts).

---

## GitHub repository name & Vercel

The canonical repo slug is **`franchise-draft-platform`**. If yours still exists as **`franchise-draft-platofrm`** (typo), fix it on GitHub:

1. Open the repo on GitHub → **Settings** → **General** → **Repository name** → set to `franchise-draft-platform` → **Rename**.
2. Update any local clone:

   ```bash
   git remote set-url origin git@github.com:manojd929/franchise-draft-platform.git
   git fetch origin
   ```

3. **Vercel:** Open the project → **Settings** → **Git**. Confirm the connected repository is `manojd929/franchise-draft-platform`. If it still shows the old name or deploys do not run, use **Disconnect** (if available) and reconnect Git to the renamed repo.

**CLI alternative** (from the repo root, with [GitHub CLI](https://cli.github.com/) logged in): `gh repo rename franchise-draft-platform`

GitHub redirects the old URL for a while after rename, but Vercel should target the correct repository name so production hooks stay reliable.

---

## Getting started

### 1. Clone and install

```bash
git clone git@github.com:manojd929/franchise-draft-platform.git
cd franchise-draft-platform
npm install
```

### 2. Environment

Copy the template and fill in real values:

```bash
cp .env.example .env
```

See **[Environment variables](#environment-variables)** below. Never commit `.env`.

### 3. Database

Generate the client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
```

For a fresh Supabase DB, use the **session pooler** URL on port **5432** for Prisma CLI (`DIRECT_URL` in `.env.example`) so migrations work reliably over IPv4.

### 4. Baseline profile seed (optional)

Creates a fixed local admin profile row used in some dev setups:

```bash
npx tsx prisma/seed.ts
```

You still need a matching **Supabase Auth** user (same UUID) or sign up through the app so `UserProfile` syncs on login.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres URL for the running app (often Supabase **transaction** pooler `:6543` + `pgbouncer=true`). |
| `DIRECT_URL` | Yes for CLI | Postgres URL for **`prisma migrate`** (often **session** pooler `:5432`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (browser + server). |
| `SUPABASE_SERVICE_ROLE_KEY` | For owner provisioning | Server-only; powers franchise owner Auth user create/delete flows. |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob; enables upload buttons for logos/photos. |
| `NEXT_PUBLIC_APP_ORIGIN` | Optional | Canonical site URL (e.g. Vercel prod URL); used when printing links from demo seed. |

Demo-only seed toggles (`DEMO_SEED_*`, `DEMO_SEED_PRINT_CREDENTIALS`) are documented in **`prisma/seed-demo-tournament.ts`** and `.env.example`.

---

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (production / CI) |
| `npm run db:push` | Push schema without migration files (prototyping only) |
| `npm run seed:demo-tournament` | Provisions demo Supabase users + tournament (**run locally**, see script header) |

---

## Screens at draft time

| Screen | Who | Purpose |
|--------|-----|---------|
| **Manage auction** (`/tournament/[slug]/admin`) | Commissioner | Shuffle order, phase controls, **confirm** picks, pause/skip/advance, validation overrides, roster-group spotlight when live |
| **Live roster board** (`/tournament/[slug]/tv`) | Everyone in the room | Hall / projector view (**no login**); refreshes with draft state |
| **Participate in auction** (`/tournament/[slug]/draft`) | Franchise owners (+ other signed-in participants) | Nomination board when it is your franchise’s clock (surfaced by hub card when auction is live/paused) |
| **My Team** (`/tournament/[slug]/owner`) | Franchise owner | Team roster card view: owner-linked row and confirmed picks, with photos when available |

Commissioners orchestrate live day from **Manage auction** plus this **Live roster board**; owners use **Participate in auction** and **My Team** as needed (see [Navigation](#navigation-commissioners-vs-franchise-owners)).

---

## Fixtures & tournament run

### Fixtures lifecycle

- **Fixtures route**: `/tournament/[slug]/fixtures`
- The full **Tournament** nav group stays hidden until the auction is marked **`COMPLETED`**.
- Fixtures unlock only after the commissioner explicitly ends the auction and the draft is marked **`COMPLETED`**.
- Commissioner can generate team round-robin ties from Fixtures.
- Owners/participants get **read-only** fixtures + leaderboard view.
- Generated doubles pairings use confirmed roster members from each team, including owner-backed player rows.

### Run tournament (admin ops)

- **Run route**: `/tournament/[slug]/run` (commissioner-only)
- Purpose: live match operations after fixtures are created.
- Admin can:
  - update match status (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
  - enter/update scores (`sideOneScore`, `sideTwoScore`)
  - reopen/correct results by changing status away from `COMPLETED`
  - eliminate / reinstate standings entities

### Result policy

- Completed match requires:
  - both scores present
  - non-tied score
- Winner is derived from score (`winnerSide`), not blindly trusted from client input.
- Current points rule: winner gets **1**, loser gets **0**.

### Leaderboard/standings

- Standings are **derived live** from completed matches (no manual aggregate table).
- Sort order:
  1. points
  2. wins
  3. point difference
  4. points scored
- Derived tracking columns:
  - matches played
  - wins / losses
  - points
  - points scored / conceded
  - point difference
  - eliminated status

### Singles vs doubles behavior

- **Doubles-only** tournaments:
  - standings aggregate by **team**
  - team elimination supported (`Team.isEliminated`)
- **Singles / mixed** tournaments:
  - standings aggregate by **player**
  - player elimination supported (`Player.isEliminated`)

### Schema updates for tournament running

- `FixtureStatus` enum includes:
  - `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `Team.isEliminated` and `Player.isEliminated` booleans added.

### Migration notes

- Apply migrations after pulling these changes:

```bash
npm run db:migrate
```

- If dev server still reflects old Prisma shape, restart and clear build cache:

```bash
rm -rf .next
npm run db:generate
npm run dev
```

---

## Deployment (Vercel)

1. Connect this repo to Vercel and set **all** env vars from `.env.example` (production values).
2. Ensure **`npm run build`** succeeds (`postinstall` runs **`prisma generate`**).
3. Run **`npm run db:migrate:deploy`** against production **once per migration change** (GitHub Action, Vercel deploy hook, or manual from a trusted machine). Use `DIRECT_URL` / non-pgbouncer URL for migrate if your provider requires it.
4. Do **not** run **`seed:demo-tournament`** on Vercel; it refuses when `VERCEL=1`.

Optional: configure Supabase Auth **redirect URLs** for your production domain (login callback).

---

## Project layout (high level)

```
src/app/           # App Router routes (marketing, dashboard, tournament/*, API snapshot + auth/session)
src/components/    # Shared UI and draft-room pieces
src/features/      # Feature modules (forms, server actions)
src/services/      # Domain services (draft, roster categories, tournament, league accounts)
src/lib/           # Auth, Prisma, Supabase, uploads, tournament nav links, access helpers
src/proxy.ts       # Middleware entry (session refresh + auth redirects)
prisma/            # Schema, migrations, seeds
```

Core draft logic lives in **`src/services/draft-service.ts`**. Tournament setup and provisioning live in **`src/services/tournament-service.ts`** plus **`src/services/league-account-service.ts`** and **`src/services/roster-category-service.ts`**.

### Dashboard behavior

- **Admins** see tournaments they created, plus admin controls (create tournament, manage/setup links, delete).
- **Owners** see tournaments where at least one team has `ownerUserId = currentUserId`; owner dashboard cards hide admin-only controls and emphasize **My Team** / viewer-safe links.

---

## Other product surfaces

- **`/settings`**: commissioner workspace appearance (**dashboard floor** preset swatches/backdrop layered behind tournament cards — stored per browser).

---

## License

Private / all rights reserved unless you add an explicit `LICENSE` file.
