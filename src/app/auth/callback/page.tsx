"use client";

// Google sign-in lands here. supabase-js finishes the PKCE exchange from the URL, then the
// Supabase access token is sent once to the server, which verifies it and sets our own session.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { signInWithSupabase } from "@/lib/auth-actions";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") ?? "/";
    (async () => {
      const supabase = supabaseBrowser();
      if (!supabase) return setError("Google sign-in isn't configured.");
      const code = params.get("code");
      const { data, error: err } = code ? await supabase.auth.exchangeCodeForSession(code) : await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (err || !token) return setError(err?.message ?? params.get("error_description") ?? "Google sign-in didn't complete.");
      const r = await signInWithSupabase(token, next);
      // Our session is set; the Supabase one isn't needed any more.
      await supabase.auth.signOut({ scope: "local" });
      if (r?.error) setError(r.error);
    })();
  }, []);

  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      {error ? (
        <div>
          <p className="text-sm text-red-700">{error}</p>
          <Link href="/login" className="btn-secondary mt-4">
            Back to sign in
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted">Signing you in…</p>
      )}
    </div>
  );
}
