import Image from "next/image";
import Link from "next/link";

import { APP_NAME } from "@/constants/app";

/**
 * Root not-found UI. Renders inside the root layout, so it inherits the app
 * theme (dark/light) and background. Handles both `notFound()` calls from
 * route segments (e.g. a tournament slug the viewer can't access) and any
 * unmatched URL.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Image
        src="/brand/hulicourt-lockup-full.webp"
        alt={`${APP_NAME} — Draft. Auction. Play. Win.`}
        width={291}
        height={340}
        className="h-24 w-auto rounded-xl sm:h-28"
      />
      <div className="flex items-center gap-4">
        <span className="text-5xl font-bold tabular-nums text-foreground">
          404
        </span>
        <span aria-hidden className="h-12 w-px bg-border" />
        <h1 className="max-w-xs text-left text-base text-muted-foreground">
          We couldn&rsquo;t find that page. It may have moved, or you may not
          have access to it.
        </h1>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
