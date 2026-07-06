# HuliCourt QA Test Cases

## Purpose
This document is the reusable manual QA checklist for HuliCourt. It is organized feature-by-feature so a future test pass can be executed without reverse-engineering the product again.

The focus is:
- authenticated access and role boundaries
- tournament setup workflows
- owner provisioning and owner-linked roster rows
- live draft behavior
- fixtures, tournament run, and standings
- responsive and regression checks

## Personas
- `Admin`: commissioner who creates and operates tournaments
- `Owner`: franchise owner with one assigned team
- `Guest`: unauthenticated user

## Recommended Test Environment
- App URL: `http://localhost:3000`
- Browsers: one desktop browser, one mobile-width viewport, and one public display tab for `/tv`
- Database: existing dev database is acceptable, but use clearly prefixed QA data
- Optional services:
  - Supabase Auth configured for login coverage
  - Supabase service role configured for owner invite/provisioning coverage
  - Blob storage configured if image upload flows need validation

## QA Data Set

### Tournament
- Name: `Sunday Badminton League - QA`
- Format: `DOUBLES_ONLY`
- Picks per team: `10`

### Teams
- `QA Smash Bros`
- `QA Net Ninjas`
- `QA Shuttle Squad`
- `QA Drop Shot Kings`

### Owners
- `ravi.qa@example.com`
- `karthik.qa@example.com`
- `ankit.qa@example.com`
- `rohit.qa@example.com`

### Player pool
- Around `80` QA-prefixed player rows
- At least `4` roster categories
- At least `1` owner-linked roster row
- A mix of:
  - players with photos
  - players without photos
  - unavailable players
  - locked players
  - paid and unpaid entry-fee rows

## Execution Notes
- Use fresh QA-prefixed names for any data created during a run.
- Capture failures with route, role, exact action, and observed result.
- When a test mutates state deeply, note whether follow-up tests depend on that state.
- If a flow is environment-dependent, mark it `Blocked by environment` rather than failing it incorrectly.

## Test Matrix

### 1. Authentication and Session Management

#### AUTH-01 Admin login succeeds
- Steps:
1. Open `/login`.
2. Sign in with a valid admin account.
- Expected:
1. Redirect lands on `/dashboard`.
2. Dashboard renders tournaments without a login loop.

#### AUTH-02 Owner login succeeds
- Steps:
1. Open `/login`.
2. Sign in with a valid owner account.
- Expected:
1. Redirect lands on `/dashboard`.
2. Only assigned tournaments are visible.

#### AUTH-03 Guest is redirected off protected routes
- Steps:
1. Sign out fully.
2. Open `/dashboard`.
3. Open `/tournament/{slug}/teams`.
4. Open `/tournament/{slug}/players`.
- Expected:
1. Each route redirects to `/login`.
2. The `next` parameter preserves the intended destination.

#### AUTH-04 Public TV route remains public
- Steps:
1. Sign out.
2. Open `/tournament/{slug}/tv`.
- Expected:
1. Page renders without authentication.
2. No protected data outside the intended public board surface is exposed.

#### AUTH-05 Login redirect sanitization works
- Steps:
1. Visit `/login?next=/dashboard`.
2. Sign in.
- Expected:
1. Redirect goes to `/dashboard`.
2. No malformed redirect target appears.

### 2. Dashboard and Tournament Creation

#### DASH-01 Admin sees create path
- Steps:
1. Log in as admin.
2. Open `/dashboard`.
- Expected:
1. `New tournament` action is visible.
2. Existing commissioner-owned tournaments are listed.

#### DASH-02 Owner sees assigned tournaments only
- Steps:
1. Log in as owner.
2. Open `/dashboard`.
- Expected:
1. Assigned tournaments are visible.
2. Tournament creation action is hidden.

#### DASH-03 Create tournament with valid input
- Steps:
1. Create a tournament from dashboard.
2. Fill name, format, and picks-per-team.
3. Submit.
- Expected:
1. Tournament is created successfully.
2. Slug is generated.
3. Tournament appears on dashboard.

#### DASH-04 Tournament creation validation
- Steps:
1. Try blank name.
2. Try too-short name.
3. Try invalid color hex if present.
4. Try out-of-range picks-per-team.
- Expected:
1. Validation error is shown.
2. No partial or corrupted tournament row is created.

#### DASH-05 Soft delete tournament
- Steps:
1. Delete a disposable QA tournament from dashboard.
2. Refresh dashboard.
- Expected:
1. Tournament disappears from the active list.
2. No hard-delete crash occurs.

### 3. Tournament Hub and Navigation

#### HUB-01 Commissioner tournament hub renders branding and counts
- Steps:
1. Open `/tournament/{slug}` as admin.
- Expected:
1. Branding form is visible.
2. Player, team, and roster-group counts render.
3. Summary badges show format and picks-per-team.

#### HUB-02 Owner tournament hub is read-oriented
- Steps:
1. Open `/tournament/{slug}` as owner.
- Expected:
1. Branding form is hidden.
2. Summary content renders without edit affordances.

#### HUB-03 Navigation before draft completion
- Steps:
1. Open tournament as admin while draft is not `COMPLETED`.
2. Open tournament as owner while draft is not `COMPLETED`.
- Expected:
1. League and auction nav groups render.
2. Tournament nav group is hidden for both roles.

#### HUB-04 Navigation after draft completion
- Steps:
1. Move draft to `COMPLETED`.
2. Refresh tournament pages for admin and owner.
- Expected:
1. Tournament nav group appears.
2. Admin sees `Fixtures`, `Run tournament`, and `Knockout board`.
3. Owner sees `Fixtures` and `Knockout board`.

### 4. Roster Groups

#### CAT-01 Commissioner can create roster group
- Steps:
1. Open `/tournament/{slug}/categories` as admin.
2. Add a new roster group with name and optional color.
- Expected:
1. New group appears in the list.
2. Group persists after refresh.

#### CAT-02 Commissioner can reorder roster groups
- Steps:
1. Move a roster group up or down.
2. Refresh page.
- Expected:
1. Display order updates.
2. Order persists after refresh.

#### CAT-03 Commissioner can archive an empty roster group
- Steps:
1. Choose a roster group with no active players.
2. Archive it.
- Expected:
1. Group is removed from active view.
2. No crash or orphaned rule state appears.

#### CAT-04 Archive is blocked when players still exist
- Steps:
1. Try to archive a roster group that still has players.
- Expected:
1. Action is blocked with a clear message.

#### CAT-05 Owner sees read-only roster groups
- Steps:
1. Open `/tournament/{slug}/categories` as owner.
- Expected:
1. Categories are visible.
2. No create, edit, archive, or reorder affordances appear.

### 5. Teams and Franchise Ownership

#### TEAM-01 Commissioner can create teams
- Steps:
1. Open `/tournament/{slug}/teams`.
2. Add all four QA teams.
- Expected:
1. Team rows render in the table.
2. Teams persist after refresh.

#### TEAM-02 Team validation
- Steps:
1. Submit an empty name.
2. Try invalid short name values if allowed by UI.
- Expected:
1. Validation errors are shown.
2. Invalid rows are not created.

#### TEAM-03 Commissioner can edit team metadata
- Steps:
1. Edit name, short name, color, or logo for one team.
2. Save and refresh.
- Expected:
1. Updated metadata renders consistently.
2. Table and dependent views use the new values.

#### TEAM-04 Owner sees teams page as read-only
- Steps:
1. Open `/tournament/{slug}/teams` as owner.
- Expected:
1. Team list is visible.
2. Edit controls are hidden.

#### TEAM-05 Invite or assign an owner to a team
- Steps:
1. Use the owner assignment flow from the teams page.
2. Assign a valid owner to a team.
- Expected:
1. Team row displays the owner.
2. Mapping persists after refresh.

#### TEAM-06 Prevent commissioner self-assignment as owner
- Steps:
1. Try to assign the commissioner account as a team owner.
- Expected:
1. Action is blocked.
2. Clear error feedback is shown.

#### TEAM-07 Remove owner from a team
- Steps:
1. Remove owner assignment from one team.
2. Refresh page.
- Expected:
1. Team shows no owner assigned.
2. Dependent owner behavior updates correctly.

#### TEAM-08 Remove owner login from tournament
- Steps:
1. Use the owner cleanup/removal flow if available.
2. Confirm the action.
- Expected:
1. Team ownership and linked owner references are cleaned up according to current rules.
2. No broken references remain on visible pages.

### 6. Players and Player Management

#### PLAYER-01 Commissioner can create a player manually
- Steps:
1. Open `/tournament/{slug}/players`.
2. Add a player with category, gender, and optional notes.
- Expected:
1. Player appears in the table.
2. Data persists after refresh.

#### PLAYER-02 Commissioner can bulk add players
- Steps:
1. Use quick-add/bulk add.
2. Submit about 20 QA names.
- Expected:
1. Valid players are inserted.
2. UI stays stable after large insert.

#### PLAYER-03 Commissioner can edit player metadata
- Steps:
1. Edit one player’s category, notes, gender, or photo.
2. Refresh page.
- Expected:
1. Updated values persist.
2. Category badges and dependent totals update correctly.

#### PLAYER-04 Commissioner can bulk update players
- Steps:
1. Select multiple players.
2. Change roster category and entry-fee flag in bulk.
- Expected:
1. All selected rows update.
2. Non-selected rows are unchanged.

#### PLAYER-05 Player validation
- Steps:
1. Try blank player name.
2. Try malformed or missing category input.
- Expected:
1. Validation error is shown.
2. No invalid row is created.

#### PLAYER-06 Soft delete player
- Steps:
1. Delete a disposable player row.
2. Refresh players page.
- Expected:
1. Row disappears from active list.
2. No table corruption or count mismatch occurs.

#### PLAYER-07 Owner sees players page as read-only
- Steps:
1. Open `/tournament/{slug}/players` as owner.
- Expected:
1. Player pool is visible.
2. Create, edit, delete, and bulk actions are hidden.

### 7. Rules and Pick Limits

#### RULE-01 Commissioner can update squad rules
- Steps:
1. Open `/tournament/{slug}/rules` as admin.
2. Set per-category max counts.
3. Save.
- Expected:
1. Values persist after refresh.
2. No missing-category rows appear.

#### RULE-02 Auto-fill limits from roster works
- Steps:
1. Use auto-fill.
2. Compare results to floor(pool divided by teams).
- Expected:
1. Each category receives the expected default cap.
2. UI guidance stays coherent.

#### RULE-03 Guidance reflects roster math
- Steps:
1. Create category pools that divide evenly.
2. Create category pools that leave a remainder.
- Expected:
1. Even split guidance shows no mismatch.
2. Uneven split guidance flags the remainder.

#### RULE-04 Owner sees read-only rules
- Steps:
1. Open `/tournament/{slug}/rules` as owner.
- Expected:
1. Rule table is visible.
2. Save and auto-fill controls are hidden.

### 8. Owner Provisioning and Owner-Linked Roster Rows

#### OWNER-01 Create franchise owner account from teams flow
- Steps:
1. Use the invite/provision flow from teams.
2. Create a new owner login.
- Expected:
1. Login is created successfully.
2. Owner is assignable to a team.

#### OWNER-02 Create franchise owner account from player row
- Steps:
1. Use the player-linked owner creation flow from players.
2. Provision login for that player row.
- Expected:
1. Player gains a `linkedOwnerUserId` relationship.
2. No duplicate owner linkage is created.

#### OWNER-03 Owner-linked player row is not draftable
- Steps:
1. Ensure a player row is linked to an owner.
2. Open admin draft board and owner draft board.
- Expected:
1. That row does not appear as a normal draftable nomination.
2. It remains treated as a roster member for the owning franchise.

#### OWNER-04 Owner-linked row appears in My Team
- Steps:
1. Log in as that owner.
2. Open `/tournament/{slug}/owner`.
- Expected:
1. The owner-linked row appears in roster cards.
2. Category and photo behavior render correctly.

#### OWNER-05 Revoke player-linked franchise login
- Steps:
1. Revoke franchise login from a player row when allowed.
2. Refresh players page.
- Expected:
1. Link is removed.
2. UI reflects the unlinked state without stale owner actions.

### 9. Draft Setup and Order Management

#### DRAFT-01 Randomize draft order
- Steps:
1. Open `/tournament/{slug}/admin` as commissioner.
2. Randomize order once.
- Expected:
1. Order updates.
2. Persisted order matches after refresh.

#### DRAFT-02 Re-randomize while still allowed
- Steps:
1. Before draft is sealed, randomize again if UI allows.
- Expected:
1. Order changes again.
2. No duplicate or missing slots occur.

#### DRAFT-03 Start draft
- Steps:
1. Move draft from setup or ready into live state.
- Expected:
1. Draft phase becomes `LIVE`.
2. Owner participation surface becomes meaningful for active turns.

#### DRAFT-04 Pause and resume draft
- Steps:
1. Pause a live draft.
2. Resume it.
- Expected:
1. Phase changes correctly.
2. Current turn and pending state remain intact.

#### DRAFT-05 Freeze, unlock, and lock controls
- Steps:
1. Exercise freeze, unlock, and lock controls in allowed order.
- Expected:
1. Phase transitions are reflected in UI.
2. Illegal actions are blocked with clear feedback.

### 10. Draft Participation and Pick Confirmation

#### PICK-01 Owner can nominate only on its turn
- Steps:
1. Log in as an owner whose team is not active.
2. Attempt to nominate.
3. Advance to that owner’s turn.
4. Attempt to nominate again.
- Expected:
1. Nomination is blocked when off-turn.
2. Nomination is allowed on-turn.

#### PICK-02 Admin confirms owner nomination
- Steps:
1. Have owner nominate a player.
2. Confirm from admin control room.
- Expected:
1. Pick becomes confirmed only after admin action.
2. Player is assigned to the correct team.

#### PICK-03 Pending pick is visible before confirmation
- Steps:
1. Have owner nominate a player.
2. Do not confirm immediately.
- Expected:
1. Pending state is visible to the admin board.
2. Player is not yet treated as fully drafted.

#### PICK-04 Undo last pick
- Steps:
1. Confirm a pick.
2. Undo the last pick.
- Expected:
1. Assignment is removed correctly.
2. Turn state is restored consistently.

#### PICK-05 Skip and revert turn
- Steps:
1. Advance one turn.
2. Skip a turn.
3. Revert a turn.
- Expected:
1. Current slot index updates correctly.
2. Snake order logic remains valid.

#### PICK-06 Manual assignment
- Steps:
1. Use manual assignment if available.
2. Assign one player directly to one team.
- Expected:
1. Player lands on the expected team.
2. Draft counts update correctly.

#### PICK-07 Locked player cannot be drafted normally
- Steps:
1. Mark a player as locked.
2. Try to nominate that player.
- Expected:
1. Normal flow blocks the nomination unless the product explicitly supports override handling.

#### PICK-08 Unavailable player cannot be drafted normally
- Steps:
1. Mark a player unavailable.
2. Try to nominate that player.
- Expected:
1. Normal flow blocks the nomination unless override mode is enabled.

#### PICK-09 Override validation mode
- Steps:
1. Turn on override validation.
2. Attempt a pick that would otherwise violate roster constraints.
- Expected:
1. Pick can proceed only when override mode is enabled.
2. Behavior is audit-trailed and clearly visible.

#### PICK-10 Complete the draft
- Steps:
1. Continue until all required slots are filled or explicitly end the draft.
- Expected:
1. Draft reaches `COMPLETED`.
2. Fixtures and tournament-run navigation unlock.

### 11. Auction Spotlight and Live Sync

#### LIVE-01 Spotlight restricts visible nomination pool
- Steps:
1. Set an auction spotlight category in admin.
2. Open owner board.
- Expected:
1. Owner nomination surface reflects the spotlighted category only.
2. Board labels clearly match the active spotlight.

#### LIVE-02 Clear spotlight reopens all categories
- Steps:
1. Clear spotlight back to open mode.
- Expected:
1. Owners can see all eligible categories again.

#### LIVE-03 Polling refresh updates the board
- Steps:
1. Open admin board and owner board in separate tabs.
2. Confirm a pick in admin.
- Expected:
1. Owner and admin boards refresh within the expected polling window.
2. Last confirmed pick and counts update without manual reload.

#### LIVE-04 Public TV board reflects live state
- Steps:
1. Open `/tournament/{slug}/tv`.
2. Confirm several picks and change spotlight.
- Expected:
1. Board updates as draft state changes.
2. No auth wall appears.

### 12. My Team Experience

#### MYTEAM-01 Owner with assigned team sees roster cards
- Steps:
1. Log in as an owner with an assigned team.
2. Open `/tournament/{slug}/owner`.
- Expected:
1. Page renders owner-linked rows plus confirmed picks.
2. Photo and fallback avatar states render correctly.

#### MYTEAM-02 Owner without assigned team sees empty state
- Steps:
1. Log in as an owner not assigned to a team in this tournament.
2. Open `/tournament/{slug}/owner`.
- Expected:
1. Friendly empty state is shown.
2. No crash occurs.

### 13. Fixtures

#### FIX-01 Fixtures stay locked before draft completion
- Steps:
1. Open `/tournament/{slug}/fixtures` before draft is completed.
- Expected:
1. Page explains that fixtures unlock after draft completion.

#### FIX-02 Generate round-robin ties after draft completion
- Steps:
1. Complete the draft.
2. Generate round-robin ties with `matchesPerTie = 5`.
- Expected:
1. Ties are created successfully.
2. For four teams, pairings are complete and reasonable.

#### FIX-03 Manual tie creation
- Steps:
1. Create a fixture tie manually.
- Expected:
1. Tie appears in the fixtures board.
2. Correct teams and round metadata are shown.

#### FIX-04 Manual singles match creation
- Steps:
1. Create a standalone singles match if the format and UI allow.
- Expected:
1. Match appears in the standalone section.
2. Participants are correct.

#### FIX-05 Owner can view fixtures but cannot mutate them
- Steps:
1. Log in as owner.
2. Open `/tournament/{slug}/fixtures`.
- Expected:
1. Ties and matches are visible.
2. Admin fixture controls are hidden.

#### FIX-06 Owner-linked players participate in doubles auto-assignment
- Steps:
1. Ensure a team has an owner-linked row.
2. Generate doubles fixtures.
- Expected:
1. Owner-linked row remains eligible for team participant rotation.
2. It is not silently dropped from eligible roster math.

### 14. Run Tournament

#### RUN-01 Admin can open run page after completion
- Steps:
1. Open `/tournament/{slug}/run` as admin.
- Expected:
1. Page renders match operations and elimination controls.

#### RUN-02 Owner is blocked from run page
- Steps:
1. Open `/tournament/{slug}/run` as owner.
- Expected:
1. Admin-only restriction message is shown.

#### RUN-03 Start a match manually
- Steps:
1. Set one match to `IN_PROGRESS`.
- Expected:
1. Match status updates and persists.

#### RUN-04 Submit final score
- Steps:
1. Enter side-one and side-two scores.
2. Submit.
- Expected:
1. Match becomes `COMPLETED`.
2. Winner side is derived correctly.

#### RUN-05 Reset a completed match
- Steps:
1. Reset one completed match to `SCHEDULED`.
- Expected:
1. Winner and scores clear.
2. Standings no longer count that result.

#### RUN-06 Cancel a match
- Steps:
1. Cancel a match.
- Expected:
1. Match moves to `CANCELLED`.
2. Completed-score logic is not retained.

#### RUN-07 Toggle elimination state
- Steps:
1. Mark one entity eliminated.
2. Reinstate it.
- Expected:
1. Elimination badge/state updates correctly.
2. Change persists after refresh.

### 15. Leaderboard and Results Integrity

#### LEAD-01 Standings math is correct
- Steps:
1. Complete several matches with known outcomes.
2. Open leaderboard.
- Expected:
1. Matches played, wins, losses, points scored, points conceded, and point difference are correct.

#### LEAD-02 Admin and owner see the same standings data
- Steps:
1. Open leaderboard as admin.
2. Open leaderboard as owner.
- Expected:
1. Rankings and values match.

#### LEAD-03 Match edits recalculate standings
- Steps:
1. Change the score of an already completed match.
2. Reload leaderboard.
- Expected:
1. Standings update correctly.
2. No double count remains.

### 16. Uploads and Visual Assets

#### MEDIA-01 Tournament logo upload or URL workflow
- Steps:
1. Update tournament branding with logo URL or upload if enabled.
- Expected:
1. Logo appears in tournament surfaces that use branding.
2. No broken image or layout regression appears.

#### MEDIA-02 Team visual metadata displays consistently
- Steps:
1. Set team short name, color, and logo.
2. Open teams, draft, and TV surfaces.
- Expected:
1. Visual metadata is rendered consistently where supported.

#### MEDIA-03 Player photo renders in players and My Team
- Steps:
1. Add a player photo.
2. Open players and owner roster views.
- Expected:
1. Photo renders cleanly.
2. Fallback state still works for players without photos.

### 17. Responsive and UX Regression

#### UX-01 Mobile-width admin pages remain usable
- Steps:
1. Test dashboard, teams, players, rules, and admin pages at mobile width.
- Expected:
1. Controls stay reachable.
2. No horizontal overflow blocks primary actions.

#### UX-02 Mobile-width owner pages remain usable
- Steps:
1. Test owner dashboard, draft board, My Team, and fixtures at mobile width.
- Expected:
1. Core owner actions remain understandable and usable.
2. No critical controls disappear off-screen.

#### UX-03 Table overflow handling
- Steps:
1. Add long names and long owner display values.
2. Open teams and players tables.
- Expected:
1. Layout remains readable.
2. Overflow handling does not break actions.

#### UX-04 Empty states
- Steps:
1. Visit pages with no teams, no players, no categories, and no picks.
- Expected:
1. Each page shows a clear empty state.
2. Empty states point to the next logical action when appropriate.

### 18. Regression Smoke Pass

#### SMOKE-01 Commissioner end-to-end path
- Steps:
1. Create tournament.
2. Add categories, teams, owners, and players.
3. Set rules.
4. Run draft.
5. Generate fixtures.
6. Record match scores.
- Expected:
1. Entire commissioner flow completes without blockers.

#### SMOKE-02 Owner end-to-end path
- Steps:
1. Log in as owner.
2. Open assigned tournament.
3. View teams, players, and rules.
4. Participate when draft is live and turn is active.
5. View My Team after picks.
6. View fixtures and leaderboard after completion.
- Expected:
1. Entire owner flow works without access leakage or missing essential views.

## Suggested Test Run Order
1. Authentication and dashboard
2. Tournament creation and navigation
3. Roster groups, teams, and players
4. Rules and owner provisioning
5. Draft lifecycle and live sync
6. My Team and TV board
7. Fixtures, run tournament, and leaderboard
8. Responsive and regression smoke pass

## Result Template
Use this lightweight format when executing the checklist later:

| Test ID | Status | Notes |
|---|---|---|
| `AUTH-01` | `Pass / Fail / Blocked` | Short evidence or issue summary |
| `...` | `...` | `...` |
