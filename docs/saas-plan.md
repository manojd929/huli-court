# SaaS Plan: Franchise League Platform for Badminton & Cricket

_Last updated: 2026-07-06 · Status: Phase 0/1 foundations implemented (see below)_

## Implementation status (2026-07-06)

Built and verified (typecheck, lint, tests, production build all green):

- **Allocation methods** — `Tournament.allocationMethod` with all three MVP methods:
  - Snake draft (existing engine, unchanged)
  - Random assignment (`src/services/allocation-service.ts`, pure planner in
    `src/lib/draft/random-assignment.ts`, admin panel at `/tournament/[slug]/admin`)
  - Live auction (`src/services/auction-service.ts`): lots, purses, optimistic-
    concurrency bidding, sold/unsold/re-auction, auto-complete when squads fill.
    Commissioner desk + owner bidding room + TV banner. Per-player base price
    editable in the player dialog.
- **Multi-tenancy** — `Organization` + `OrganizationMembership` models;
  tournaments attach to the creator's org (created lazily for legacy admins);
  dashboard and management access include org admins; backfill script
  `npm run db:backfill-organizations`.
- **Self-serve signup** — `/signup` creates organizer account + league org and
  signs straight in (linked from `/login`).
- **Tests** — purse/bid validation and random-assignment cap compliance
  (`src/lib/draft/*.test.ts`).

**Pending deploy steps** (the Supabase DB configured in `.env` was unreachable
during the build — project likely paused):

1. Restore/unpause the Supabase project (or point `.env` at a new one)
2. `npx prisma migrate deploy` (applies `20260706000000_saas_allocation_auction_orgs`)
3. `npm run db:backfill-organizations`

**Deliberately deferred:** payments (Razorpay/Stripe), share cards, Sentry,
free-tier caps enforcement, org-member management UI, RLS (app talks to
Postgres via privileged Prisma connection; isolation is enforced at the
service layer).

## TL;DR

There is a validated gap in the market: nobody credible offers the full franchise-league
lifecycle — player registration → draft/auction → auto-rosters → fixtures → live scoring →
season stats — for both badminton and cricket. The market is split between scoring giants
with no drafts or auctions (CricHeroes, CricClubs) and shallow pay-per-auction tools with
no tournament ops (CricAuction, Super Player Auction).

**Strategy:** launch with a genuinely free draft product (our existing snake draft is the
most production-ready part of the codebase), then monetize with the IPL-style live auction
that the market already pays ₹1,500–6,000 per event for. Draft = acquisition, auction =
monetization, season ops = retention.

---

## 1. Where we stand today (codebase audit)

The existing app (HuliCourt) is a solid single-tenant foundation.

**Assets to leverage directly:**

- Commissioner/owner role model with defense-in-depth access control, audit logging
  (`DraftLog`), idempotent pick confirmation
- Live draft room: owner nomination → commissioner confirm flow, spotlight categories,
  phone-optimized owner view
- Public TV/projector board (`src/components/draft/tv-display-client.tsx`) — a marketing
  asset, not just a feature (see growth loop)
- Post-draft ops: fixtures (round-robin + manual), singles/doubles matches, scoring,
  standings, knockouts — already badminton-shaped
- Snapshot-based polling + optional Supabase Realtime (`src/hooks/use-draft-live-sync.ts`)
- Clean tournament-scoped schema (`prisma/schema.prisma`) with soft deletes and proper
  constraints

**Gaps that block SaaS:**

1. **No auction mechanics.** Today's flow is a snake draft. The Indian franchise-league
   market's paid product is IPL-style auctions: team purses, base prices, live bidding,
   sold/unsold, re-auction rounds.
2. **No multi-tenancy.** No org/tenant layer, global user roles, unauthenticated snapshot
   API relying on slug obscurity. Feasible (all data is tournament-scoped) but real work:
   org FK across tables, Supabase RLS, org-scoped roles, self-serve onboarding.
3. **No payments, no self-serve signup, no player self-registration** (players are entered
   by admins today).
4. **No cricket.** Match model is singles/doubles racquet-shaped.
5. Near-zero test coverage, two 1,000+ LOC service files (`draft-service.ts`,
   `tournament-service.ts`), no error tracking.

## 2. Competitive landscape

| Segment | Players | Auction/Draft? | Tournament ops? | Weakness |
|---|---|---|---|---|
| Cricket scoring giants | CricHeroes (tens of millions of users, ₹99/mo PRO), CricClubs ($1–3/player/mo, diaspora-strong), STUMPS (free) | ❌ | ✅ deep | No draft/auction module — organizers run auctions elsewhere and re-enter squads manually |
| Auction-only tools | CricAuction (₹4,999/auction), Super Player Auction (₹3–5k), Auction Chase | ✅ auction only | ❌ shallow/none | No fixtures/scoring continuity; cricket-first; rough UX; nothing is free beyond 2–3 teams |
| Closest to our concept | CrickHunt (₹1.5–6k/auction), AuctionPro (from ₹1,499/event) | ✅ auction only | ✅ basic | Tiny, cricket-first, rough; badminton support superficial |
| Badminton | BWF Tournament Planner (dated Windows desktop), Playtomic/Swish (booking-first), PLAYINGA/Rackonnect | ❌ | ✅ draws only | Nobody does franchise/auction badminton leagues; wide open |
| Generic | Challonge, Tournify (€40–120/tournament), LeagueLobster | ❌ | ✅ generic | No sport-native logic, no drafts/auctions |

**Status quo:** most organizers use Excel + projector + WhatsApp for player allocation —
the auction vendors' entire marketing is "Excel vs app" (broken formulas, overspent
purses, double bids). Nobody in either camp offers a free draft.

**Biggest competitive risk:** CricHeroes ships a native auction module and owns the
cricket side overnight. Mitigations: speed, badminton beachhead, and winning on
auction→season continuity rather than the auction screen alone.

## 3. Differentiation strategy

1. **Free drafts — the acquisition wedge.** Every competitor charges from the first event
   and only does auctions. "Run your league's draft completely free, projector board
   included" is a hook none of them can match without cannibalizing their pricing. Drafts
   also fit real use cases auctions don't: corporate leagues and badminton clubs often
   prefer drafts (faster, fairer-feeling, no auctioneer needed, work for small groups).
2. **"Franchise league in a box" — the continuity moat.** Drafted/auctioned squads flow
   automatically into rosters → fixtures → scorecards → per-player season stats tied to
   draft position or auction price ("value-for-money" leaderboards are a highly shareable
   artifact nobody has).
3. **Badminton-native first, cricket-lite second.** Badminton franchise leagues have
   effectively zero purpose-built tooling, and our fixtures engine is already
   badminton-shaped. For cricket, do NOT compete with CricHeroes on ball-by-ball scoring
   in v1 — start with innings-summary scoring (totals, wickets, NRR), enough for
   standings and box-cricket leagues.
4. **Hybrid/remote drafts and auctions for diaspora leagues.** US/UK leagues run Zoom +
   spreadsheet events; our realtime room + public TV board is already 80% of the remote
   experience. Dollar-priced, this is an unserved premium niche.
5. **Broadcast-grade shareability as the growth loop.** Every draft/auction is a local
   event with 50–500 watchers. WhatsApp-ready "PICKED"/"SOLD" player cards, YouTube
   overlay mode, sponsor logo slots on the TV board — watermarked on the free tier. The
   watermark IS the customer acquisition channel.

## 4. Player allocation — MVP scope (3 methods)

Allocation is a pluggable module chosen at tournament setup (`allocationMethod` on
`Tournament`, strategy per method). The existing `DraftPhase` state machine, `Pick`,
`DraftOrderSlot`, squad-cap validation, live board, TV view, and audit log are
method-agnostic and serve all three.

| Method | How it works | Tier | Build cost |
|---|---|---|---|
| **Snake draft** | Order reverses each round (1→8, 8→1); owner nominates, commissioner confirms | Free | Already built |
| **Random/lottery assignment** | System assigns players to teams respecting roster-group caps; instant balanced teams for casual leagues | Free | Small — one-shot generator over existing validation rails |
| **Live auction (IPL-style)** | Team purses, player base prices, open bidding (owner phones as paddles), bid increments, sold/unsold, re-auction rounds, purse tracker on TV board | Paid flagship | The Phase 1b build |

**Deliberately cut from MVP:**

- _Linear draft_ — adds picker clutter without differentiation; snake covers the need.
  Trivial to add later if requested.
- _Blind/sealed bid_ — niche; would delay the auction that actually monetizes. Revisit
  post-launch as a lower-priced paid tier if organizers ask.

## 5. Roadmap

**Phase 0 — SaaS foundations (~4–6 weeks)**

- Multi-tenancy: `Organization` entity, org-scoped roles, RLS policies, tenant-safe
  snapshot API (signed/public toggle per tournament)
- Self-serve onboarding: org signup → create tournament → invite owners via magic links
  (replace admin-provisioned accounts)
- Hardening: error tracking (Sentry), decompose the two mega-services, tests on the money
  paths (pick confirmation, purse math, roster caps)

**Phase 1a — Launch: free draft product (~2–3 weeks, overlaps Phase 0)**

- Allocation-method picker with snake draft + random assignment
- Player self-registration with photo (+ optional entry-fee payment: Razorpay for India,
  Stripe for diaspora)
- Shareable "PICKED" cards (WhatsApp-sized, watermarked on free tier)
- Free tier caps: 1 active tournament, ≤8 teams
- **This is the launch.** It is complete enough to replace Excel+projector for free.

**Phase 1b — Monetize: live auction (~4–6 weeks)**

- Auction mode on the same confirm/audit rails: purses, base prices, live bidding,
  sold/unsold, re-auction, purse tracker on TV board
- Sponsor slots on TV/stream views; "SOLD" share cards
- Marketed first to existing free-draft organizers

**Phase 2 — Cricket-lite + season depth (~6–8 weeks)**

- Cricket match model: innings summaries, NRR, configurable points-table rules,
  box-cricket-friendly formats
- Badminton polish: group→knockout draw generation, best-of-3 to 21 scoring, court
  scheduling
- Player season stats + price/pick-vs-performance analytics
- Mobile score entry for on-court referees (PWA, not native apps)

**Phase 3 — Growth & moat (ongoing)**

- Remote-auction premium tier (diaspora), YouTube overlay mode
- Public league pages (SEO), league websites
- Season layer: multi-tournament seasons, player retention rules between seasons,
  productized clone-tournament flow (script already exists)
- Ball-by-ball cricket scoring only if the market pulls for it

## 6. Pricing

| Tier | Price | Includes |
|---|---|---|
| **Free** | ₹0 | Snake draft + random assignment, 1 active tournament, ≤8 teams, fixtures + scoring + standings, watermarked TV board and share cards |
| **Per-event (auction)** | ₹1,999 / ₹3,999 / ₹5,999 by team count | Live auction, purse tracking, sponsor slots, no watermark. Undercuts CricAuction's ₹4,999 while including the season ops they lack |
| **League OS (annual)** | ~₹14,999/yr | Unlimited events and teams, all allocation methods, custom branding, priority support |
| **Diaspora** | $49–99/event | Same product + remote bidding, dollar margin |

Gate the free tier by **team count and concurrent tournaments, not by features** — a free
8-team draft must feel genuinely complete (that's the differentiator). Later: take-rate on
player entry-fee collection (payments become the real business at scale).

## 7. Go-to-market

- **Beachhead:** our own network's leagues → corporate badminton + box cricket leagues in
  1–2 Indian metros → US diaspora cricket leagues (Atlanta/Bay Area-style 60-team seasons)
- **Distribution:** every free-tier draft projects the brand to a room and a WhatsApp
  group; SEO on public league/tournament pages; venue partnerships (TurfTown, Hudle,
  Playo are discovery channels, not competitors)
- **North-star metric:** allocation events (drafts + auctions) run per month. Signups feed
  it; season retention hangs off it. Track free→paid conversion (draft league → auction
  league) as the core funnel.

## 8. Risks

1. **CricHeroes ships auctions** → speed, badminton beachhead, continuity moat
2. **Auction-tool cloning is cheap** (~6 clones exist) → moat is season continuity + data,
   not the auction screen; free draft tier raises the bar clones can't match profitably
3. **Free tier cannibalizes auction revenue** → auctions are a different occasion with
   validated willingness-to-pay; draft users are net-new organizers, not lost sales
4. **Badminton spend per event is lower than cricket** → badminton is the wedge,
   cricket-lite is the revenue
5. **Two sports = scope creep** → Phase 1 ships badminton + allocation only; cricket
   match modeling waits for Phase 2

## 9. Immediate next steps

1. Design the `Organization`/tenancy schema migration and RLS policy set
2. Spec the allocation-method abstraction (`allocationMethod` on `Tournament`, strategy
   interface over the existing `DraftPhase`/`Pick` rails) with snake, random, and auction
   as the three implementations
3. Spec the auction state machine (purse, base price, bid, sold/unsold, re-auction) as an
   extension of `DraftPhase`
4. Interview 5–10 league organizers to validate: free-draft appeal, auction price points,
   and whether random assignment matters to casual leagues
