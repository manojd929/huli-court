import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME, ROUTES } from "@/constants/app";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/hulicourt-lockup.webp";
const LOGO_RATIO = { width: 173, height: 150 };

export default function LandingPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.9_0.13_92/0.5),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.95_0.06_96/0.55),transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.83_0.16_86/0.2),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.8_0.13_82/0.08),transparent_42%)]"
        aria-hidden
      />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8 md:px-16 md:py-6">
        <Image
          src={LOGO_SRC}
          alt={APP_NAME}
          width={LOGO_RATIO.width}
          height={LOGO_RATIO.height}
          className="h-11 w-auto shrink-0 rounded-xl sm:h-12"
          priority
        />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href={ROUTES.login} className={cn(buttonVariants({ variant: "ghost" }), "min-h-10")}>
            Sign in
          </Link>
          <Link href={ROUTES.dashboard} className={cn(buttonVariants(), "min-h-10")}>
            My tournaments
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-16 pt-6 sm:px-8 md:px-16 md:pb-24 md:pt-10">
        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-brand-accent sm:text-xs">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Draft. Auction. Play. Win.
        </p>
        <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:mt-8 sm:text-5xl md:text-6xl lg:text-7xl dark:text-white">
          Run your club&apos;s draft or auction like the big leagues.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg md:text-xl dark:text-white/75">
          Pick how squads are formed — snake draft, instant random, or a live IPL-style
          auction with team purses. Owners join from their phones; the room watches on the
          big screen. Built for racquet sports — badminton, pickleball, tennis, table tennis.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:gap-4">
          <Link
            href={ROUTES.tournamentNew}
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-12 w-full bg-brand text-brand-foreground hover:bg-brand/90 focus-visible:ring-brand/50 sm:w-auto",
            )}
          >
            Start a tournament
          </Link>
          <Link
            href={ROUTES.login}
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "min-h-12 w-full sm:w-auto")}
          >
            I already have an account
          </Link>
        </div>

        <dl className="mt-12 grid gap-4 sm:mt-20 sm:gap-6 md:grid-cols-3">
          {[
            {
              title: "Three ways to pick",
              body: "Snake draft, one-tap random assignment, or a live auction with team purses and phone bidding — your call per tournament.",
            },
            {
              title: "Built for the room",
              body: "A live projector board shows squads, the player under the hammer, purses, and every SOLD moment as it happens.",
            },
            {
              title: "Then run the tournament",
              body: "Auctioned squads flow straight into fixtures, scoring, and standings — all the way to the final.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm backdrop-blur-md sm:p-6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-none"
            >
              <dt className="text-sm font-semibold text-brand-accent">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-white/70">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
