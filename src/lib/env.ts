// Reads configuration from the environment. Accepts both the names in the README
// and the names created by Vercel's Supabase integration (POSTGRES_URL, …).
// Same approach as the money app's server/env.js.

// `vercel env pull` writes this instead of values it won't reveal; treat it as unset.
const VERCEL_SENSITIVE = "[SENSITIVE]";
// Supabase's "Connect" dialog shows connection strings with this in place of the password.
const PASSWORD_PLACEHOLDER = "[YOUR-PASSWORD]";

type Env = Record<string, string | undefined>;

const first = (env: Env, names: string[]) =>
  names
    .map((n) => env[n])
    .find((v) => typeof v === "string" && v.trim() !== "" && v.trim() !== VERCEL_SENSITIVE)
    ?.trim();

function withPassword(url: string | undefined, env: Env) {
  if (!url?.includes(PASSWORD_PLACEHOLDER)) return url;
  const password = first(env, ["POSTGRES_PASSWORD"]);
  if (!password) {
    throw new Error(
      `The database URL still contains ${PASSWORD_PLACEHOLDER}: replace it with your Supabase database password, or set POSTGRES_PASSWORD.`,
    );
  }
  return url.replace(PASSWORD_PLACEHOLDER, encodeURIComponent(password));
}

export function resolveEnv(env: Env = process.env) {
  return {
    supabaseUrl: first(env, ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    // Prefer the pooled (port 6543) connection: serverless functions open many short-lived connections.
    get databaseUrl() {
      return withPassword(first(env, ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"]), env);
    },
    jwtSecret: first(env, ["SUPABASE_JWT_SECRET"]),
    // Server-only key for the private documents bucket. Never sent to the browser.
    serviceKey: first(env, ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]),
    storageBucket: first(env, ["DOCUMENTS_BUCKET"]) ?? "eor-documents",
    // Sign-in codes are emailed through Resend. MAIL_FROM must be on a domain verified in Resend.
    resendApiKey: first(env, ["RESEND_API_KEY"]),
    mailFrom: first(env, ["MAIL_FROM"]) ?? "Contractor Hub <noreply@splitwise.adhikansh.com>",
    // Signs Contractor Hub's own session tokens. Any long random string.
    authSecret: first(env, ["AUTH_SECRET"]),
    onVercel: !!env.VERCEL,
  };
}
