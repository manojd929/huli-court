-- Enable Row Level Security (RLS) on every public table.
--
-- Why: Supabase exposes public tables through its PostgREST API to the `anon`
-- and `authenticated` roles, and the anon key is shipped to the browser. With
-- RLS disabled, anyone holding the public anon key could read/write every row
-- via https://<project>.supabase.co/rest/v1/<Table>, bypassing the app.
--
-- Effect: with RLS ENABLED and no policies defined, PostgREST (anon /
-- authenticated) is denied all access. The application is unaffected because it
-- connects with Prisma as the `postgres` role, which both OWNS these tables and
-- has BYPASSRLS — owners/bypass roles are not subject to RLS. We deliberately do
-- NOT use FORCE ROW LEVEL SECURITY, which would also constrain the owner.
--
-- NOTE: New tables added by future migrations must repeat this — RLS is not
-- tracked in schema.prisma, so Prisma will not enable it automatically.

ALTER TABLE public."UserProfile"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrganizationMembership"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."League"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tournament"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RosterCategory"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SquadRule"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Team"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Player"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pick"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DraftOrderSlot"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DraftLog"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuctionLot"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuctionBid"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FixtureTie"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FixtureMatch"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FixtureMatchParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations"      ENABLE ROW LEVEL SECURITY;
