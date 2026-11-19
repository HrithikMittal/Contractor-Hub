"use client";

import { useState, useTransition } from "react";
import { requestCode, verifyCode } from "@/lib/auth-actions";
import { supabaseBrowser } from "@/lib/supabase-browser";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6H1.3a12 12 0 000 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

export function LoginForm({ next, devMode }: { next: string; devMode: boolean }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const supabase = supabaseBrowser();

  const send = () =>
    start(async () => {
      setError(null);
      const r = await requestCode(email);
      if (r.error) return setError(r.error);
      setStep("code");
      setCode(r.devCode ?? "");
      setInfo(r.devCode ? `Local mode: no email is sent. Your code is ${r.devCode}.` : `We sent a 6-digit code to ${email.trim()}.`);
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const r = await verifyCode(email, code, next);
      if (r?.error) setError(r.error);
    });

  const google = () =>
    start(async () => {
      setError(null);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: err } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (err) setError(err.message);
    });

  return (
    <div className="space-y-4">
      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="label">Work email</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input text-base"
              placeholder="you@company.com"
            />
          </label>
          <button className="btn-primary w-full py-2.5" disabled={pending}>
            {pending ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-3"
        >
          {info && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{info}</p>}
          <label className="block">
            <span className="label">6-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="input text-center font-mono text-xl tracking-[0.5em]"
              placeholder="••••••"
            />
          </label>
          <button className="btn-primary w-full py-2.5" disabled={pending || code.length !== 6}>
            {pending ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-muted hover:text-ink" onClick={() => (setStep("email"), setError(null), setInfo(null))}>
              ← Different email
            </button>
            <button type="button" className="text-accent hover:underline" onClick={send} disabled={pending}>
              Send a new code
            </button>
          </div>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {supabase && step === "email" && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={google} disabled={pending} className="btn-secondary w-full py-2.5">
            <GoogleLogo /> Continue with Google
          </button>
        </>
      )}

      {devMode && step === "email" && (
        <p className="text-center text-xs text-muted">Local mode: any email works and the code is shown on screen.</p>
      )}
    </div>
  );
}
