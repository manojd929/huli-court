import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ROUTES } from "@/constants/app";
import { sanitizeNextPath } from "@/lib/navigation/sanitize-next-path";

const PRIVATE_NO_STORE = "private, no-store, max-age=0";

/** Supabase rotates cookies during `getUser()`; redirects must reuse them or the browser keeps stale tokens. */
function redirectPreservingSessionCookies(sessionResponse: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  redirect.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return redirect;
}

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return false;
  }

  if (/^\/tournament\/[^/]+\/tv/u.test(pathname)) {
    return false;
  }

  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/tournament/")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    user != null ||
    pathname.startsWith(ROUTES.login) ||
    pathname.startsWith("/auth") ||
    isProtectedPath(pathname)
  ) {
    supabaseResponse.headers.set("Cache-Control", PRIVATE_NO_STORE);
  }

  if (user && (pathname === ROUTES.login || pathname === ROUTES.home)) {
    const destination =
      pathname === ROUTES.login
        ? sanitizeNextPath(request.nextUrl.searchParams.get("next"), ROUTES.dashboard)
        : ROUTES.dashboard;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination;
    redirectUrl.search = "";
    return redirectPreservingSessionCookies(supabaseResponse, redirectUrl);
  }

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return redirectPreservingSessionCookies(supabaseResponse, redirectUrl);
  }

  return supabaseResponse;
}
