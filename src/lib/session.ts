// Who is signed in. Every read and write in the app goes through requireProfile(),
// and every query is scoped to the returned profile id.

import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDb, one } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, verifySession, type Claims } from "./auth";
import type { Profile } from "./types";

/** Finds the profile for a token's subject, or for the same email (signed in another way before), or creates it. */
export async function loadOrCreateProfile(claims: Claims): Promise<Profile> {
  const db = await getDb();
  const existing = one(await db.query<Profile>("select * from eor.profiles where auth_user_id = $1", [claims.sub]));
  if (existing) return existing;
  if (claims.email) {
    const byEmail = one(
      await db.query<Profile>("select * from eor.profiles where lower(email) = lower($1) order by id limit 1", [claims.email]),
    );
    if (byEmail) return byEmail;
  }
  const name = (claims.user_metadata?.full_name || claims.user_metadata?.name || "").slice(0, 60);
  const created = one(
    await db.query<Profile>(
      `insert into eor.profiles (auth_user_id, email, name, company_email) values ($1, $2, $3, $2)
       on conflict (auth_user_id) do nothing returning *`,
      [claims.sub, claims.email ?? null, name],
    ),
  );
  return created ?? one(await db.query<Profile>("select * from eor.profiles where auth_user_id = $1", [claims.sub]))!;
}

/** The signed-in profile, or null. Cached for the duration of one request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Verifying checks the token's expiry against the clock: request time only, never prerender.
  await connection();
  const claims = await verifySession(token);
  if (!claims) return null;
  return loadOrCreateProfile(claims);
});

export async function requireProfile(): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  return p;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
