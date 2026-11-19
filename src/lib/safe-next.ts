/**
 * Where to go after sign-in. Only same-site paths are allowed, so a crafted link like
 * /login?next=//evil.com or ?next=/\evil.com (browsers treat "\" as "/") can't send
 * someone to another site.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const base = "http://internal.invalid";
    const u = new URL(next, base);
    return u.origin === base ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}
