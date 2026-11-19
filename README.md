# Contractor Hub

A dashboard for managing contractors, their documents, and invoicing their work to clients. Each person who signs in has their own private data.

## Features

| Area | What you can do |
| --- | --- |
| **Sign in** | A 6-digit code emailed through [Resend](https://resend.com), or Google (through Supabase Auth). Either way, the same email reaches the same account. |
| **Overview** | Active contractors, document alerts (expired / expiring within 30 days), outstanding and overdue invoices, contractors with no contract on file. New accounts can explore with sample data. |
| **Contractors** | Contact details, tax ID, client, status (onboarding → active → offboarded), dates, rate (hourly / daily / monthly / fixed, with currency), bank details, notes. Search and filter. |
| **Documents** | Upload files to a contractor (15 MB max) with type, issue date and expiry date. View, download, edit dates, delete. Expiry is flagged. |
| **Clients** | The companies you bill: billing address, tax ID, invoice currency. |
| **Invoices** | Build invoices from contractor rates (one, several, or every active contractor for a client) plus custom lines. Includes tax %, service period and notes, with automatic numbering per account. Draft → sent → paid (or void); unpaid invoices past their due date show as overdue. Print or save as PDF. |
| **Settings** | Company and bank details for invoices, number prefix, default currency and payment terms. Delete all data. |

## Stack

Storage and sign-in follow the same pattern as the money app.

| Part | Tech |
| --- | --- |
| App | Next.js 16 (App Router, Server Actions, Cache Components), Tailwind CSS |
| Database | Supabase Postgres, in its own `eor` schema (`supabase/migrations/`) |
| Files | A private Supabase Storage bucket, read and written only by the server |
| Auth | Emailed code via Resend, or Google via Supabase Auth. The app then issues its own session cookie |
| Local dev | PGlite (Postgres in WASM) in `.data/pglite` and files in `.data/uploads`, so no accounts are needed |

```
supabase/migrations/   Schema (run in order in Supabase's SQL Editor; PGlite runs them automatically)
src/lib/db.ts          postgres.js in production, PGlite locally
src/lib/env.ts         Reads env vars (also accepts Vercel's Supabase integration names)
src/lib/auth.ts        Session tokens; verifies Supabase tokens from Google sign-in
src/lib/auth-actions.ts  Request/verify sign-in codes, Google hand-off, sign out
src/lib/session.ts     requireProfile(): who is signed in; every query is scoped to it
src/lib/storage.ts     Document files: Supabase Storage or local disk
src/lib/data.ts        Reads           src/lib/actions.ts   Writes
src/lib/sample.ts      Made-up sample data
src/proxy.ts           Sends signed-out visitors to /login
```

Money is stored as integer cents. Dates are plain `YYYY-MM-DD` dates, so they never shift with time zones.

## Run locally (no accounts needed)

```bash
npm install
npm run dev      # http://localhost:3000
```

Requires Node 20+. Without any settings the app runs in **local mode**: sign in with any email, the code is shown on screen, and data is stored in `.data/` (gitignored). Delete `.data/` to start over.

## Deploy: Supabase + Vercel

### 1. Supabase (a new project)

1. **SQL Editor**: run `supabase/migrations/0001_init.sql`.
2. **Storage**: create a bucket named `eor-documents` and leave **Public** off. The app reaches it with the service role key, so no storage policies are needed.
3. **Authentication → Sign In / Providers**: turn on **Google** and add an OAuth client ID and secret. Email codes are sent by the app itself through Resend, so Supabase's email settings don't matter.
4. **Authentication → URL Configuration**: set the Site URL to your Vercel URL. Add `https://<your-site>/auth/callback` and `http://localhost:3000/auth/callback` to the Redirect URLs.
5. Note the **Project URL**, the **anon / publishable key**, the **service role / secret key**, and the **Transaction pooler** connection string (port 6543).

### 2. Vercel

Import the repo (it's detected as Next.js) and add these environment variables (see `.env.example`):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Transaction-pooler connection string (port 6543) |
| `SUPABASE_URL` | Supabase Project URL (used to verify Google sign-ins and reach Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role / secret key. **Server only**, never prefix it with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` | Same Project URL (the browser uses it to start Google sign-in) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `AUTH_SECRET` | Long random string that signs sessions: `openssl rand -base64 48`. Changing it signs everyone out |
| `RESEND_API_KEY` | A Resend API key with sending access |
| `MAIL_FROM` | Sender on a domain verified in Resend, e.g. `Contractor Hub <noreply@eor.adhikansh.com>` |
| `SUPABASE_JWT_SECRET` | *Only* if your project still uses the legacy JWT secret |
| `DOCUMENTS_BUCKET` | *Optional.* Bucket name if not `eor-documents` |

Set the function region close to your database (Project → Settings → Functions; the money app uses `sin1`).

### Sign-in rules

Same as the money app:
- Codes expire after 10 minutes and allow 5 tries.
- A new code can be requested every 30 seconds, up to 5 an hour per email.
- Only a keyed hash of each code is stored.
- Sessions last 60 days, in an httpOnly cookie.

Locally without `RESEND_API_KEY`, the code is shown on the sign-in screen instead of emailed. Google sign-in is hidden until the `NEXT_PUBLIC_SUPABASE_*` variables are set.

## Assumptions (change any of these)

- Invoices go from you to **clients** for contractor work. Each contractor is a line priced from their rate.
- Monthly and fixed fees default to a quantity of 1. Hours and days are left blank to fill in. The service period defaults to last month, and the due date is the issue date plus payment terms.
- No currency conversion. The invoice builder warns when a contractor's rate currency differs from the invoice's.
- "Expiring soon" means within 30 days (`EXPIRY_WARNING_DAYS` in `src/lib/format.ts`).
- PDFs come from the browser's print dialog.
