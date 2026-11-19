// Sends sign-in codes through Resend's HTTP API, the same way the money app does.
// Without RESEND_API_KEY nothing is sent (locally the code is shown on screen instead).

import { resolveEnv } from "./env";

export function loginCodeEmail({ code, minutes = 10 }: { code: string; minutes?: number }) {
  const subject = `${code} is your Contractor Hub sign-in code`;
  const text = [
    `Your Contractor Hub sign-in code is ${code}`,
    "",
    `Enter it to sign in. It expires in ${minutes} minutes.`,
    "",
    "If you didn't try to sign in, you can ignore this email.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#16181d">
  <p style="font-size:15px;margin:0 0 16px">Your Contractor Hub sign-in code is</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 16px;font-variant-numeric:tabular-nums">${code}</p>
  <p style="font-size:14px;color:#6b7079;margin:0 0 24px">Enter it to sign in. It expires in ${minutes} minutes.</p>
  <p style="font-size:12px;color:#9ca3af;margin:0">If you didn't try to sign in, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}

export function mailerEnabled() {
  return !!resolveEnv().resendApiKey;
}

/** Returns true if Resend accepted the email. Never throws. */
export async function sendLoginCode({ to, code }: { to: string; code: string }): Promise<boolean> {
  const { resendApiKey, mailFrom } = resolveEnv();
  if (!resendApiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: mailFrom, to: [to], ...loginCodeEmail({ code }) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`Sign-in email failed: ${res.status} ${await res.text().catch(() => "")}`);
    return res.ok;
  } catch (err) {
    console.error(`Sign-in email failed: ${(err as Error).message}`);
    return false;
  }
}
