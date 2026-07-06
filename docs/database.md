# Database Documentation

## Overview
HuliCourt uses PostgreSQL through Prisma 7. The schema is tournament-centric: nearly every business entity belongs to a `Tournament`, and draft plus fixture workflows are modeled as stateful relations around that root.

Core design choices:
- Soft delete is used for critical user-facing setup entities.
- Enums encode workflow states and eliminate many magic strings.
- Database uniqueness constraints protect draft integrity and ownership mappings.
- Fixtures and standings are derived from normalized match records rather than stored as duplicated summary tables.

## Aggregate Map
- `UserProfile`: authenticated platform identity and role record.
- `Tournament`: aggregate root for setup, draft runtime, and fixture lifecycle.
- `Team`: franchise within a tournament, optionally linked to an owner.
- `Player`: draftable or owner-linked roster row.
- `RosterCategory`: roster-group taxonomy for players and caps.
- `SquadRule`: maximum allowed roster count by category.
- `DraftOrderSlot`: persisted snake-draft order.
- `Pick`: confirmed roster acquisition event.
- `DraftLog`: append-only audit log for draft actions.
- `FixtureTie`: pairing between two teams.
- `FixtureMatch`: concrete match inside or outside a tie.
- `FixtureMatchParticipant`: player-to-match assignment with side metadata.

## Mermaid ER Diagram
```mermaid
erDiagram
  UserProfile {
    uuid id PK
    string email UK
    string displayName
    enum role
    datetime createdAt
    datetime updatedAt
    datetime deletedAt
  }

  Tournament {
    uuid id PK
    string slug UK
    string name
    enum format
    uuid createdById FK
    enum draftPhase
    int picksPerTeam
    int currentSlotIndex
    boolean draftOrderLocked
    uuid pendingPickPlayerId FK
    uuid pendingPickTeamId FK
    string pendingIdempotencyKey
    boolean overrideValidation
    int pickTimerSeconds
    uuid activeAuctionRosterCategoryId FK
    datetime draftStartedAt
    datetime draftEndedAt
    int playerEntryFeeMinorUnits
    string playerEntryFeeCurrencyCode
    datetime createdAt
    datetime updatedAt
    datetime deletedAt
  }

  RosterCategory {
    uuid id PK
    uuid tournamentId FK
    string name
    int displayOrder
    string colorHex
    string stableKey
    datetime archivedAt
    datetime createdAt
    datetime updatedAt
  }

  Team {
    uuid id PK
    uuid tournamentId FK
    string name
    string shortName
    string logoUrl
    string colorHex
    uuid ownerUserId FK
    int displayOrder
    boolean isEliminated
    datetime createdAt
    datetime updatedAt
    datetime deletedAt
  }

  Player {
    uuid id PK
    uuid tournamentId FK
    uuid rosterCategoryId FK
    uuid linkedOwnerUserId FK
    string name
    string photoUrl
    enum gender
    boolean hasPaidEntryFee
    boolean isUnavailable
    boolean isLocked
    boolean isEliminated
    datetime createdAt
    datetime updatedAt
    datetime deletedAt
  }

  SquadRule {
    uuid id PK
    uuid tournamentId FK
    uuid rosterCategoryId FK
    int maxCount
    datetime createdAt
    datetime updatedAt
  }

  DraftOrderSlot {
    uuid id PK
    uuid tournamentId FK
    uuid teamId FK
    int slotIndex
    datetime createdAt
    datetime updatedAt
  }

  Pick {
    uuid id PK
    uuid tournamentId FK
    uuid playerId FK
    uuid teamId FK
    uuid confirmedByUserId FK
    int slotIndex
    enum status
    string idempotencyKey UK
    datetime createdAt
    datetime updatedAt
  }

  DraftLog {
    uuid id PK
    uuid tournamentId FK
    uuid actorUserId FK
    enum action
    string message
    json payload
    datetime createdAt
  }

  FixtureTie {
    uuid id PK
    uuid tournamentId FK
    uuid teamOneId FK
    uuid teamTwoId FK
    string categoryLabel
    int roundNumber
    int sequence
    datetime createdAt
    datetime updatedAt
  }

  FixtureMatch {
    uuid id PK
    uuid tournamentId FK
    uuid tieId FK
    enum matchType
    enum status
    enum winnerSide
    int sequence
    int sideOneScore
    int sideTwoScore
    string categoryLabel
    datetime createdAt
    datetime updatedAt
  }

  FixtureMatchParticipant {
    uuid id PK
    uuid matchId FK
    uuid playerId FK
    uuid teamId FK
    enum side
    datetime createdAt
  }

  UserProfile ||--o{ Tournament : creates
  UserProfile ||--o{ Team : owns
  UserProfile ||--o{ Player : links_owner_row
  UserProfile ||--o{ Pick : confirms
  UserProfile ||--o{ DraftLog : acts_in

  Tournament ||--o{ RosterCategory : has
  Tournament ||--o{ Team : has
  Tournament ||--o{ Player : has
  Tournament ||--o{ SquadRule : constrains
  Tournament ||--o{ DraftOrderSlot : orders
  Tournament ||--o{ Pick : records
  Tournament ||--o{ DraftLog : logs
  Tournament ||--o{ FixtureTie : schedules
  Tournament ||--o{ FixtureMatch : schedules
  Tournament o|--|| RosterCategory : spotlight_category
  Tournament o|--|| Player : pending_pick_player
  Tournament o|--|| Team : pending_pick_team

  RosterCategory ||--o{ Player : classifies
  RosterCategory ||--o{ SquadRule : capped_by

  Team ||--o{ DraftOrderSlot : receives_slot
  Team ||--o{ Pick : drafts
  Team ||--o{ FixtureTie : side_one_or_two
  Team ||--o{ FixtureMatchParticipant : fields_player

  Player ||--o{ Pick : selected
  Player ||--o{ FixtureMatchParticipant : participates

  FixtureTie ||--o{ FixtureMatch : contains
  FixtureMatch ||--o{ FixtureMatchParticipant : assigns
```

## Key Relationships and Invariants

### Tournament as aggregate root
Almost every mutable domain record is scoped by `tournamentId`. This makes tenancy and lifecycle rules straightforward and keeps most queries localized.

### Ownership model
- `Team.ownerUserId` links a franchise owner account to a team.
- `Player.linkedOwnerUserId` links a profile to an owner-backed roster row.
- `@@unique([tournamentId, linkedOwnerUserId])` guarantees at most one owner-linked player row per tournament.

### Draft integrity
- `DraftOrderSlot` enforces one slot per index with `@@unique([tournamentId, slotIndex])`.
- `Pick` enforces one pick per player per tournament with `@@unique([tournamentId, playerId])`.
- `Pick.idempotencyKey` and `Tournament.pendingIdempotencyKey` reduce duplicate nomination and confirmation edge cases.
- `Tournament.pendingPickPlayerId` and `pendingPickTeamId` model the draft’s pending confirmation state without prematurely creating a confirmed `Pick`.

### Squad rules and roster taxonomy
- Every player belongs to exactly one `RosterCategory`.
- Every active category can have one cap row per tournament through `@@unique([tournamentId, rosterCategoryId])` on `SquadRule`.
- Archived categories remain in the database for integrity and history, rather than being hard deleted.

### Fixture model
- `FixtureTie` represents a team-vs-team encounter.
- `FixtureMatch` represents an individual match, either nested under a tie or standalone.
- `FixtureMatchParticipant` assigns players and sides to each match and optionally carries a `teamId` for doubles/team-based views.
- Standings are computed from completed match records, so match rows are the authoritative operational source.

## Soft Delete Policy
Soft deletes are implemented on:
- `UserProfile`
- `Tournament`
- `Team`
- `Player`

This is the right choice for the product because these records participate in historical draft and fixture flows. Deleting them physically would make audit, recovery, and downstream integrity much harder.

## Enum Domains
- Access and admission: `UserRole`
- Player metadata: `Gender`
- Draft state: `DraftPhase`
- Pick state: `PickStatus`
- Audit action: `DraftLogAction`
- Tournament format: `TournamentFormat`
- Match type and state: `FixtureMatchType`, `FixtureStatus`, `FixtureSide`

## Query and Index Notes
The schema already includes sensible indexes for the current workload:
- tournament lookup by creator and phase
- team lookup by tournament and owner
- player lookup by tournament, category, and name
- draft log lookup by tournament and created time
- fixture lookups by tournament and sequence

For the current size of the product, this is a good baseline. If the platform grows materially, the first likely follow-up would be composite indexes tuned to live snapshot assembly and owner-team roster lookups.

## Engineering Assessment
The schema is disciplined and production-friendly. It encodes important business rules directly in the database, keeps draft state explicit, and preserves integrity with soft deletes and unique constraints.

The biggest modeling compromise is that `Tournament` carries several live draft workflow fields directly on the row. That is a practical design for a single live draft per tournament, but if the product ever needs richer event sourcing, resumable draft sessions, or concurrent operational modes, a dedicated draft-session aggregate would be the next evolution.
