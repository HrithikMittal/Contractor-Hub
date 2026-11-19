import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { authStatus } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-semibold text-white">C</span>
          <span className="text-lg font-semibold tracking-tight">Contractor Hub</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Your contractors, documents and invoices are private to your account.</p>
        <div className="card p-5">
          <Suspense fallback={<div className="h-32" />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getProfile()) redirect(next);
  return <LoginForm next={next} devMode={authStatus().devMode} />;
}
