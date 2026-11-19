"use server";

// Sign-in, same rules as the money app:
// - 6-digit codes emailed through Resend, expire after 10 minutes, 5 tries each
// - a new code every 30 seconds at most, up to 5 an hour per email
// - only a keyed hash of each code is stored
// - locally without RESEND_API_KEY the code is shown on screen instead of emailed
// - Google sign-in goes through Supabase; its token is verified once and swapped for our session

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { getDb, one } from "./db";
import { authStatus, codeHashKey, issueToken, uuidForEmail, verifySupabaseToken } from "./auth";
import { mailerEnabled, sendLoginCode } from "./mailer";
import { clearSessionCookie, loadOrCreateProfile, setSessionCookie } from "./session";
import { safeNext } from "./safe-next";

const CODE_MINUTES = 10;
const CODE_ATTEMPTS = 5;
const CODES_PER_HOUR = 5;
const RESEND_AFTER_SECONDS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashCode = (email: string, code: string) => crypto.createHmac("sha256", codeHashKey()).update(`${email}:${code}`).digest("hex");

export type CodeResult = { error?: string; sent?: boolean; devCode?: string };

export async function requestCode(rawEmail: string): Promise<CodeResult> {
  const email = String(rawEmail ?? "").trim().toLowerCase().slice(0, 120);
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const { codesEnabled, devMode } = authStatus();
  if (!codesEnabled) return { error: "Sign-in is not set up on the server: set AUTH_SECRET." };
  if (!mailerEnabled() && !devMode) return { error: "Email is not set up on the server: set RESEND_API_KEY." };

  const db = await getDb();
  await db.query("delete from eor.login_codes where email = $1 and created_at < now() - interval '1 day'", [email]);
  const recent = one(
    await db.query<{ last_hour: number; too_soon: boolean }>(
      `select count(*) filter (where created_at > now() - interval '1 hour') as last_hour,
              coalesce(bool_or(created_at > now() - make_interval(secs => $2)), false) as too_soon
       from eor.login_codes where email = $1`,
      [email, RESEND_AFTER_SECONDS],
    ),
  )!;
  if (recent.too_soon) return { error: "A code was just sent. Wait a few seconds before asking for another." };
  if (Number(recent.last_hour) >= CODES_PER_HOUR) return { error: "Too many codes asked for this email. Try again in an hour." };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const row = one(
    await db.query<{ id: number }>(
      "insert into eor.login_codes (email, code_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3)) returning id",
      [email, hashCode(email, code), CODE_MINUTES],
    ),
  )!;
  if (!mailerEnabled()) return { sent: false, devCode: code };
  if (!(await sendLoginCode({ to: email, code }))) {
    await db.query("delete from eor.login_codes where id = $1", [row.id]);
    return { error: "We couldn't send the email. Please try again in a minute." };
  }
  return { sent: true };
}

export async function verifyCode(rawEmail: string, rawCode: string, next = "/"): Promise<{ error?: string }> {
  const email = String(rawEmail ?? "").trim().toLowerCase().slice(0, 120);
  const code = String(rawCode ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email) || code.length !== 6) return { error: "Enter the 6-digit code from the email." };

  const db = await getDb();
  const row = one(
    await db.query<{ id: number; code_hash: string; attempts: number }>(
      "select id, code_hash, attempts from eor.login_codes where email = $1 and expires_at > now() order by created_at desc limit 1",
      [email],
    ),
  );
  if (!row) return { error: "That code has expired. Ask for a new one." };
  if (row.attempts >= CODE_ATTEMPTS) return { error: "Too many wrong tries. Ask for a new code." };
  if (!crypto.timingSafeEqual(Buffer.from(row.code_hash, "hex"), Buffer.from(hashCode(email, code), "hex"))) {
    await db.query("update eor.login_codes set attempts = attempts + 1 where id = $1", [row.id]);
    const left = CODE_ATTEMPTS - row.attempts - 1;
    return { error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code." };
  }
  await db.query("delete from eor.login_codes where email = $1", [email]);

  // Same account whichever way you sign in: reuse the profile for this email if there is one.
  const existing = one(
    await db.query<{ auth_user_id: string }>("select auth_user_id from eor.profiles where lower(email) = $1 order by id limit 1", [email]),
  );
  const sub = existing?.auth_user_id ?? uuidForEmail(email);
  await loadOrCreateProfile({ sub, email });
  await setSessionCookie(await issueToken({ sub, email }));
  redirect(safeNext(next));
}

/** Called by /auth/callback with the Supabase access token after Google sign-in. */
export async function signInWithSupabase(accessToken: string, next = "/"): Promise<{ error?: string }> {
  let claims;
  try {
    claims = await verifySupabaseToken(String(accessToken ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!claims.email) return { error: "Your Google account didn't share an email address." };
  const profile = await loadOrCreateProfile(claims);
  const name = claims.user_metadata?.full_name || claims.user_metadata?.name;
  await setSessionCookie(await issueToken({ sub: profile.auth_user_id, email: claims.email, name }));
  redirect(safeNext(next));
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/login");
}
