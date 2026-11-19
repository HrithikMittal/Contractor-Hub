import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { getProfile } from "@/lib/session";
import { signOut } from "@/lib/auth-actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        account={
          <Suspense fallback={null}>
            <Account />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

async function Account() {
  const me = await getProfile();
  if (!me) return null;
  return (
    <form action={signOut} className="border-t border-line p-3">
      <div className="hidden truncate px-2 pb-2 text-xs text-muted md:block" title={me.email ?? ""}>
        {me.name || me.email}
      </div>
      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-zinc-50 hover:text-ink" title="Sign out">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        <span className="hidden md:inline">Sign out</span>
      </button>
    </form>
  );
}
