# Feature Documentation

## Purpose
HuliCourt is a tournament operations platform for running live snake drafts and then managing post-draft fixtures and results for badminton-style leagues. The product is optimized for two roles:
- `ADMIN` users who create and operate tournaments.
- `OWNER` users who represent a franchise and participate in the live draft for their assigned team.

The implementation is centered on a tournament slug workspace at `/tournament/[slug]`, with the tournament state determining which surfaces are visible and which actions are allowed.

## Core Product Flows

### 1. Authentication and role admission
- Supabase Auth provides login and cookie-backed sessions.
- Middleware protects most application routes and leaves `/tournament/[slug]/tv` public for projector display.
- Login completion is restricted to `UserProfile` rows with `ADMIN` or `OWNER` roles.
- `VIEWER` exists in the schema but is intentionally blocked from the portal.

### 2. Tournament creation and lifecycle
- Admins create tournaments from `/dashboard`.
- A tournament stores branding, format, roster depth, draft state, entry-fee metadata, and post-draft competition state.
- Tournaments are soft-deleted through `deletedAt`, preserving relational integrity for historical rows.
- Creation automatically seeds default roster categories and baseline squad rules.

### 3. Team and owner management
- Teams belong to a tournament and carry display metadata such as short name, color, and optional logo.
- Each team may be assigned one franchise owner through `Team.ownerUserId`.
- Owner credentials can be provisioned by the commissioner through the Supabase Admin API.
- Commissioners cannot assign themselves as owners, and assignee selection is filtered through league-specific eligibility rules.

### 4. Roster groups and player pool management
- Every player belongs to exactly one roster category.
- Commissioners can create, reorder, archive, restore, and edit roster groups while the tournament is still in setup or ready state.
- Players support gender, notes, availability, locked state, elimination state, entry-fee status, optional photo, and soft delete.
- Bulk player updates are supported for category reassignment and entry-fee flags.

### 5. Owner-backed roster rows
- HuliCourt models a franchise owner as both a login and, when needed, a linked player row via `Player.linkedOwnerUserId`.
- These owner-backed rows are treated as real roster members.
- They are excluded from the draft nomination pool, but still count toward team composition, roster math, and generated fixtures.
- Sync logic keeps these rows aligned with current owner assignments and cleans up stale stub rows safely.

### 6. Squad rules
- Squad rules constrain how many players a team may carry from each roster category.
- The rules page is readable by owners and editable by commissioners.
- Validation is applied during pick confirmation unless the commissioner explicitly enables override mode.

### 7. Live draft operations
- The draft lifecycle moves through `SETUP`, `READY`, `LIVE`, `PAUSED`, `FROZEN`, `LOCKED`, and `COMPLETED`.
- Commissioners control draft order randomization, start/pause/resume, turn advancement, confirmation, undo, validation override, and spotlight category restrictions.
- Owners use the auction board to nominate players only when it is their team’s turn.
- Picks remain pending on `Tournament.pendingPick*` fields until the commissioner confirms them into `Pick` rows.
- Draft events are audit-trailed in `DraftLog`.

### 8. Navigation and visibility gating
- Navigation is role-aware and generated from one source of truth in `src/lib/navigation/tournament-nav-links.ts`.
- Before the draft is completed, users see league setup and auction surfaces.
- After completion, fixtures and tournament-run surfaces are revealed.
- Commissioners get setup and run controls; owners get read-heavy views plus `My Team` and live participation access.

### 9. Live board and sync behavior
- `/tournament/[slug]/tv` is a public display surface for rooms and projectors.
- Auction clients poll `/api/tournaments/[slug]/snapshot` and can also subscribe to Supabase Realtime updates.
- Polling cadence adapts to live vs idle draft states.
- Snapshot assembly merges confirmed picks, pending picks, owner-linked rows, roster-group metadata, and current spotlight configuration.

### 10. Fixtures and tournament run
- Fixtures unlock only after the draft reaches `COMPLETED`.
- Admins can generate round-robin ties, create manual ties or singles matches, assign participants, and manage deletions.
- For doubles formats, participant sync can auto-populate matches from confirmed team rosters and owner-linked rows.
- Match operations support status updates, score entry, automatic winner derivation, and team or player elimination toggles.
- Leaderboard standings are derived from recorded results rather than stored separately.

## Route Inventory

### Platform routes
- `/login`: credential entry.
- `/dashboard`: tournament list, role-aware.
- `/tournament/new`: create tournament.
- `/settings`: authenticated account settings surface.

### Tournament routes
- `/tournament/[slug]`: hub and branding summary.
- `/tournament/[slug]/categories`: roster-group management.
- `/tournament/[slug]/players`: player management.
- `/tournament/[slug]/teams`: team and owner management.
- `/tournament/[slug]/rules`: squad-rule management.
- `/tournament/[slug]/draft`: owner participation board.
- `/tournament/[slug]/admin`: commissioner control room.
- `/tournament/[slug]/tv`: public live display.
- `/tournament/[slug]/owner`: owner roster view.
- `/tournament/[slug]/fixtures`: fixture board and fixture admin surface.
- `/tournament/[slug]/run`: live match operations.
- `/tournament/[slug]/leaderboard`: standings and knockout board view.

## Feature Strengths
- Strong role-aware gating across page, action, and service layers.
- Good use of enums, soft deletes, and explicit tournament lifecycle state.
- Clear operational separation between commissioner actions and owner actions.
- Practical post-draft path that reuses drafted roster data for fixtures and standings.
- Snapshot-based live UI reduces client complexity and keeps business logic server-side.

## Engineering Assessment
The repo is already operating at a solid senior-engineer baseline for a focused internal product: business rules live mostly in services, validation is explicit, and the role model is consistently enforced. The strongest areas are draft-state modeling, access control around owner/admin surfaces, and using database constraints to protect core invariants.

The main gap relative to a stricter FAANG-style bar is not correctness so much as scale of abstraction. Several services, especially the draft and tournament domains, mix orchestration, persistence, and domain policy in the same files. That works today, but future growth would benefit from extracting repository modules and smaller domain units so transaction logic, policy checks, and read-model mapping can evolve independently.
