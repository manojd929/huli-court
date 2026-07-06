# Architecture Documentation

## System Summary
HuliCourt is a Next.js App Router application with server-first rendering, Supabase-backed authentication, and Prisma-managed PostgreSQL persistence. The architecture follows a practical layered design:
- `src/app`: route composition and page-level authorization.
- `src/features`: server actions plus feature-scoped UI.
- `src/services`: domain workflows and transactional business rules.
- `src/lib`: infrastructure and shared helpers.
- `src/validations`: Zod schemas for action inputs.
- `prisma/schema.prisma`: relational source of truth.

This is not a pure clean-architecture implementation, but the codebase does respect key separations: validation is mostly outside services, page files stay thin, and business decisions are centralized in service modules instead of spread across controllers.

## Request Flow
```mermaid
flowchart LR
  User[Browser User] --> Page[App Router Page or Client Component]
  Page --> Action[Server Action or Route Handler]
  Action --> Auth[Session Check]
  Action --> Validate[Zod Validation]
  Validate --> Service[Domain Service]
  Service --> Prisma[Prisma Client]
  Prisma --> Postgres[(PostgreSQL)]
  Service --> Revalidate[Next Cache Revalidation]
  Page --> Snapshot[/api/tournaments/[slug]/snapshot/]
  Snapshot --> DraftService[Draft Snapshot Assembly]
  DraftService --> Prisma
```

## Runtime Layers

### 1. Presentation layer
The UI is split between server-rendered route files and client components for interactive surfaces.
- Server pages fetch initial state and enforce coarse access rules.
- Client components power draft polling, forms, dialogs, and operator controls.
- Shared UI primitives live in `src/components/ui`.

Key examples:
- `src/app/tournament/[slug]/admin/page.tsx` loads a draft snapshot and hands control to `AdminControlRoomClient`.
- `src/app/tournament/[slug]/draft/page.tsx` loads the same snapshot shape for owner participation.
- `src/app/tournament/[slug]/fixtures/page.tsx` and `/run/page.tsx` reuse shared fixture and tournament-run services.

### 2. Action layer
Server actions are the application boundary for writes.
- They parse `unknown` inputs with Zod.
- They require authenticated session users.
- They delegate business rules to services.
- They revalidate route segments after mutation.

This keeps the write path relatively clean and consistent. `src/features/tournaments/actions.ts`, `src/features/draft/actions.ts`, `src/features/fixtures/actions.ts`, and `src/features/tournament-run/actions.ts` are the primary action entry points.

### 3. Domain service layer
The service layer contains the real behavior of the system.

Primary services:
- `draft-service.ts`: draft state transitions, pending pick orchestration, snapshot assembly, logging, and live control logic.
- `tournament-service.ts`: tournament setup, teams, players, soft delete, squad rules, and owner-player synchronization.
- `roster-category-service.ts`: roster group lifecycle and ordering.
- `league-account-service.ts`: Supabase Admin API provisioning for owners.
- `fixtures-service.ts`: fixture generation, participant assignment, and doubles roster derivation.
- `tournament-run-service.ts`: score entry, standings derivation, and elimination controls.

The strongest architectural pattern in the repo is that business rules are concentrated here instead of leaking into route files or React components.

### 4. Infrastructure layer
Infrastructure concerns sit in `src/lib`.
- `prisma.ts` provides the database client.
- `supabase/*` encapsulates browser, server, route-handler, and middleware auth setup.
- `navigation/*` centralizes route and nav construction.
- `data/*` contains focused query helpers and access-related selectors.
- `uploads/*` handles optional Blob-backed image behavior.

## Authentication and Authorization
Authentication is managed through Supabase SSR cookies and middleware session refresh.

Authorization is enforced in multiple layers:
- Middleware protects most routes from unauthenticated access.
- Page components redirect or `notFound()` when the user lacks route-level access.
- Server actions require an authenticated user before any mutation.
- Services enforce commissioner-only operations by comparing the tournament creator to the acting user.

This defense-in-depth approach is a strong design choice for a multi-role application.

## Data and State Model
HuliCourt has one dominant aggregate root: `Tournament`.
Everything else is scoped to it or derived from it.

Important patterns:
- Setup entities such as teams, players, roster categories, and squad rules are tournament-scoped.
- Draft runtime state is partly materialized on `Tournament` itself and partly persisted in `Pick`, `DraftOrderSlot`, and `DraftLog`.
- Post-draft competition state is modeled through fixture ties, matches, and participants.
- Live UIs consume a denormalized snapshot DTO instead of issuing many client-side joins.

This snapshot pattern is one of the better decisions in the repo because it keeps the live auction clients simple and avoids duplicating business logic in the browser.

## Route and UI Composition
The app follows a feature-oriented route model.
- Tournament pages are nested under `src/app/tournament/[slug]`.
- Shared tournament chrome is composed in the route layout.
- Feature modules under `src/features` package UI and actions by domain instead of by technical type.

That said, there is still some mixed layering in the UI package structure.
- `src/components` contains both generic primitives and feature-specific draft clients.
- `src/features` also contains feature UI.

A tighter FAANG-style boundary would move all feature-specific components under their domain modules and keep `src/components` purely shared.

## Quality Against Senior Standards

### What is already strong
- Thin route handlers and pages.
- Consistent Zod validation at application boundaries.
- Enum-backed state instead of stringly typed logic.
- Soft delete for critical entities.
- Role checks are repeated intentionally across layers.
- Relational constraints encode key invariants in the database.

### Current architectural pressure points
- `draft-service.ts` and `tournament-service.ts` are doing too much. They combine orchestration, query composition, write coordination, and read-model mapping.
- The repository pattern requested in the engineering rules is only partially present. Prisma is still called directly from services rather than through dedicated repository modules.
- Query helpers are split between `services` and `lib/data`, which is workable but not fully uniform.
- Feature-specific interactive components are split between `src/components/draft` and `src/features/*`, making ownership boundaries softer than ideal.

## Recommended Next Refactors
1. Introduce repository modules per aggregate boundary such as tournament, draft, fixtures, and roster categories.
2. Split `draft-service.ts` into command, query, and snapshot-mapping modules.
3. Consolidate feature-specific UI under `src/features/*/components` and reserve `src/components` for shared primitives and layout.
4. Move more query-specific selectors out of services and into typed read-model modules.
5. Expand automated coverage around draft transitions, fixture generation, and owner-linked player behavior, which are the most domain-sensitive workflows.

## Repo Shape Snapshot
- `183` files under `src/`.
- Major top-level slices: `features`, `components`, `app`, `lib`, `services`, `validations`, `utils`, and generated Prisma types.
- The repo is still small enough for disciplined refactoring without a large migration program.
