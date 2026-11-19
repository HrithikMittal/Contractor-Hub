"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/contractors", label: "Contractors", icon: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.87M16 4.13a3 3 0 010 5.74" },
  { href: "/invoices", label: "Invoices", icon: "M7 3h10l3 3v15l-3-2-2.5 2L12 19l-2.5 2L7 19l-3 2V6zM8 9h8M8 13h8" },
  { href: "/clients", label: "Clients", icon: "M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
];

export function Sidebar({ account }: { account?: ReactNode }) {
  return (
    <aside className="no-print sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-line bg-white md:w-56">
      <div className="flex h-16 items-center gap-2 px-4 md:px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-semibold text-white">C</span>
        <span className="hidden text-[15px] font-semibold tracking-tight md:inline">Contractor Hub</span>
      </div>
      <Suspense fallback={<NavList pathname={null} />}>
        <ActiveNav />
      </Suspense>
      {account}
    </aside>
  );
}

// usePathname() is request data, so it streams in under Suspense (Cache Components requirement).
function ActiveNav() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
        <nav className="flex flex-1 flex-col gap-0.5 px-2 md:px-3">
          {NAV.map((item) => {
            const active = pathname !== null && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-zinc-50 hover:text-ink"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
  );
}
