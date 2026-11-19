"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

/** null when Supabase isn't configured (local dev uses the code sign-in instead). Only used for Google sign-in. */
export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = url && anonKey ? createClient(url, anonKey, {
          // /auth/callback exchanges the code itself, so don't also do it on load.
          auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: false },
        }) : null;
  return client;
}
