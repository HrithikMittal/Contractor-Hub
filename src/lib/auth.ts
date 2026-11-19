// Session tokens, same scheme as the money app's server/auth.js:
// - Contractor Hub's own JWTs (issuer "eor"), issued after an emailed code is checked,
//   or after a Google sign-in through Supabase was verified. Signed with AUTH_SECRET
//   (a fixed local secret in development).
// - Supabase access tokens (Google sign-in): verified against the project's public keys
//   (SUPABASE_URL → JWKS), or SUPABASE_JWT_SECRET on projects with the legacy secret.

import crypto from "node:crypto";
import { jwtVerify, createRemoteJWKSet, decodeProtectedHeader, SignJWT, type JWTPayload } from "jose";
import { resolveEnv } from "./env";

const ISSUER = "eor";
export const SESSION_DAYS = 60;
export const SESSION_COOKIE = "eor_session";

export type Claims = JWTPayload & { sub: string; email?: string; user_metadata?: { full_name?: string; name?: string } };

/** A stable user id for an email address (used when it has no account yet). */
export function uuidForEmail(email: string) {
  const h = crypto.createHash("sha256").update(`eor:${email.toLowerCase()}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function config() {
  const { supabaseUrl, jwtSecret, authSecret, onVercel } = resolveEnv();
  const devMode = !onVercel && !authSecret;
  const appSecret = authSecret || (devMode ? "local-dev-secret" : null);
  return {
    devMode,
    appKey: appSecret ? new TextEncoder().encode(appSecret) : null,
    hsKey: jwtSecret ? new TextEncoder().encode(jwtSecret) : null,
    supabaseUrl,
  };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function supabaseJwks(url: string) {
  return (jwks ??= createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", url)));
}

export function authStatus() {
  const c = config();
  return { devMode: c.devMode, codesEnabled: !!c.appKey, googleVerifiable: !!(c.supabaseUrl || c.hsKey) };
}

/** Key used to hash sign-in codes, so a database leak doesn't reveal live codes. */
export function codeHashKey() {
  return resolveEnv().authSecret || "local-dev-secret";
}

export async function issueToken({ sub, email, name }: { sub: string; email: string; name?: string }) {
  const { appKey } = config();
  if (!appKey) throw new Error("Sign-in is not set up on the server: set AUTH_SECRET");
  return new SignJWT({ email, role: "authenticated", user_metadata: name ? { full_name: name } : {} })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(sub)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(appKey);
}

/** Our session cookie. Returns null for anything missing, expired or forged. */
export async function verifySession(token: string | undefined): Promise<Claims | null> {
  const { appKey } = config();
  if (!token || !appKey) return null;
  try {
    const { payload } = await jwtVerify(token, appKey, { issuer: ISSUER, audience: "authenticated" });
    return payload.sub ? (payload as Claims) : null;
  } catch {
    return null;
  }
}

/** A Supabase access token from Google sign-in. Throws a readable error if it can't be trusted. */
export async function verifySupabaseToken(token: string): Promise<Claims> {
  const { hsKey, supabaseUrl } = config();
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new Error("That sign-in link is not valid. Please try again.");
  }
  try {
    // Newer projects sign with asymmetric keys (published as JWKS); older ones with a shared HS256 secret.
    if (alg === "HS256" && hsKey) return (await jwtVerify(token, hsKey, { audience: "authenticated" })).payload as Claims;
    if (alg !== "HS256" && supabaseUrl) return (await jwtVerify(token, supabaseJwks(supabaseUrl), { audience: "authenticated" })).payload as Claims;
  } catch {
    throw new Error("Your Google sign-in expired. Please try again.");
  }
  throw new Error("Google sign-in is not configured on the server: set SUPABASE_URL (or SUPABASE_JWT_SECRET).");
}
