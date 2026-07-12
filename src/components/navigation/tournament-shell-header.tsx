"use client";

import { ArrowLeftIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { AccountHeaderActions } from "@/components/auth/account-header-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/app";
import { DRAFT_PHASE_LABEL } from "@/constants/draft-phase-labels";
import { SPORT_META } from "@/constants/sport-meta";
import type { DraftPhase, Sport } from "@/generated/prisma/enums";
import type { TournamentChromeNavGroup } from "@/lib/navigation/tournament-nav-links";
import { cn } from "@/lib/utils";

interface TournamentShellHeaderProps {
  slug: string;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  tournamentColorHex: string | null;
  sport: Sport;
  draftPhase: DraftPhase;
  navGroups: TournamentChromeNavGroup[];
}

function segmentForHref(slug: string, href: string): string | null {
  const tournamentRoot = ROUTES.tournament(slug);
  if (href === tournamentRoot) {
    return null;
  }

  const remainder = href.slice(`${tournamentRoot}/`.length);
  return remainder.length > 0 ? (remainder.split("/")[0] ?? null) : null;
}

export function TournamentShellHeader({
  slug,
  tournamentName,
  tournamentLogoUrl,
  tournamentColorHex,
  sport,
  draftPhase,
  navGroups,
}: TournamentShellHeaderProps) {
  const activeSegment = useSelectedLayoutSegment();

  const activeGroup =
    navGroups.find((group) =>
      group.links.some((link) => segmentForHref(slug, link.href) === activeSegment),
    ) ?? navGroups[0];

  if (!activeGroup) {
    return null;
  }

  return (
    <header className="border-b border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      {tournamentColorHex ? (
        <div className="h-1 w-full" style={{ backgroundColor: tournamentColorHex }} aria-hidden />
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-card to-muted/20 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
                  <Link
                    href={ROUTES.dashboard}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                  >
                    <ArrowLeftIcon className="size-3.5" aria-hidden />
                    All tournaments
                  </Link>
                </div>

                <div className="mt-4 flex min-w-0 items-start gap-4">
                  {tournamentLogoUrl ? (
                    <Image
                      src={tournamentLogoUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-border/80"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-muted/45 text-lg font-semibold text-foreground/75">
                      {tournamentName.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
                        {tournamentName}
                      </h1>
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-brand-accent uppercase"
                      >
                        {SPORT_META[sport].emoji} {SPORT_META[sport].label}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-foreground/80 uppercase"
                      >
                        {DRAFT_PHASE_LABEL[draftPhase]}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">/{slug}</p>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                      A focused control surface for tournament operations, auction flow, and
                      post-event reporting.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-wrap justify-stretch gap-2 sm:justify-end xl:w-auto">
                <Link
                  href={ROUTES.dashboard}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "min-h-10 flex-1 justify-center rounded-full border-border/80 bg-background/80 px-4 shadow-none sm:min-w-[11rem] sm:flex-none",
                  )}
                >
                  All tournaments
                </Link>
                <AccountHeaderActions signOutButtonClassName="flex-1 sm:flex-none sm:min-w-[8rem]" />
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="rounded-2xl border border-border/65 bg-muted/25 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <nav
                aria-label="Tournament sections"
                className="grid grid-cols-1 gap-2 md:grid-cols-3"
              >
                {navGroups.map((group) => {
                  const isActiveGroup = group.id === activeGroup.id;
                  const groupHref =
                    group.links.find((link) => segmentForHref(slug, link.href) === activeSegment)
                      ?.href ??
                    group.links[0]?.href ??
                    ROUTES.tournament(slug);

                  return (
                    <Link
                      key={group.id}
                      href={groupHref}
                      className={cn(
                        "rounded-[18px] border px-4 py-3 text-left transition-all",
                        isActiveGroup
                          ? "border-border/80 bg-background text-foreground shadow-sm"
                          : "border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase">
                        {group.label}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed">
                        {group.links.map((link) => link.label).join(" · ")}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <nav
              aria-label={`${activeGroup.label} links`}
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              {activeGroup.links.map((link) => {
                const isActiveLink = segmentForHref(slug, link.href) === activeSegment;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActiveLink ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      isActiveLink
                        ? "border-brand/40 bg-brand/10 text-foreground shadow-sm"
                        : "border-border/70 bg-background/80 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
