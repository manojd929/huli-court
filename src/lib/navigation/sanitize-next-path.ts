/**
 * Restricts redirects after sign-in to same-origin relative paths (blocks open redirects).
 */
export function sanitizeNextPath(raw: string | null | undefined, fallback: string): string {
  if (raw == null || typeof raw !== "string") {
    return fallback;
  }
  try {
    const path = decodeURIComponent(raw.trim());
    if (
      path === "" ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("://") ||
      path.includes("\\")
    ) {
      return fallback;
    }
    return path;
  } catch {
    return fallback;
  }
}
