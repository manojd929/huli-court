import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME, ROUTES } from "@/constants/app";
import { SignupForm } from "@/features/auth/signup-form";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    redirect(ROUTES.dashboard);
  }

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground dark:bg-neutral-950">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_78%_55%_at_50%_-8%,oklch(0.9_0.13_92/0.4),transparent_62%)] dark:bg-[radial-gradient(ellipse_72%_52%_at_50%_-8%,oklch(0.83_0.16_86/0.17),transparent_60%)]"
        aria-hidden
      />
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 md:px-6 md:py-8 lg:py-10">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/40 pb-3 text-sm md:border-0 md:pb-0">
          <Link
            href={ROUTES.home}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md py-1.5 pr-1.5 text-muted-foreground ring-offset-background transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            ← Back to landing
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col justify-center py-7 sm:py-8 md:py-10">
          <Image
            src="/brand/hulicourt-lockup-full.webp"
            alt={`${APP_NAME}: Draft. Auction. Play. Win.`}
            width={291}
            height={340}
            className="mx-auto mb-6 h-24 w-auto rounded-xl sm:h-28"
            priority
          />
          <SignupForm />
        </main>

        <footer className="shrink-0 border-t border-border/40 px-0.5 pt-5 text-center text-sm leading-snug text-foreground/72 md:border-0 md:pt-6 md:leading-relaxed dark:text-foreground/78">
          You get a free organizer workspace: snake drafts, random team assignment, live projector
          boards, fixtures, and standings. Live auctions with team purses are part of the paid tier.
        </footer>
      </div>
    </div>
  );
}
