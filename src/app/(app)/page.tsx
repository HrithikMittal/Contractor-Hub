import Link from "next/link";
import { Suspense } from "react";
import { getOverview, listExpiringDocuments, listInvoices } from "@/lib/data";
import { expiryState, fmtDate, money } from "@/lib/format";
import { Card, Empty, ExpiryBadge, InvoiceStatusBadge, PageHeader, Skeleton } from "@/components/ui";
import { SubmitButton } from "@/components/form-bits";
import { loadSampleData } from "@/lib/actions";

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="What needs your attention today."
        actions={
          <>
            <Link href="/contractors/new" className="btn-secondary">
              Add contractor
            </Link>
            <Link href="/invoices/new" className="btn-primary">
              New invoice
            </Link>
          </>
        }
      />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} rows={2} />
            ))}
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </>
  );
}

function Stat({ label, value, note, href, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; href: string; tone?: "warn" | "bad" }) {
  return (
    <Link href={href} className="card block p-5 transition hover:border-zinc-300">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : ""}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </Link>
  );
}

async function Dashboard() {
  const [o, expiring, recent] = await Promise.all([getOverview(), listExpiringDocuments(), listInvoices()]);
  if (o.isEmpty) return <Welcome />;
  const outstanding = Object.entries(o.invoices.outstandingByCurrency);
  const docIssues = o.docs.expired + o.docs.expiring;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active contractors"
          value={o.contractors.active}
          note={`${o.contractors.onboarding} onboarding · ${o.contractors.clients} clients`}
          href="/contractors?status=active"
        />
        <Stat
          label="Document alerts"
          value={docIssues}
          tone={o.docs.expired ? "bad" : docIssues ? "warn" : undefined}
          note={`${o.docs.expired} expired · ${o.docs.expiring} expiring in 30 days`}
          href="/contractors"
        />
        <Stat
          label="Outstanding"
          value={
            outstanding.length === 0 ? (
              money(0, "USD")
            ) : (
              <span className="flex flex-col">
                {outstanding.map(([cur, amt]) => (
                  <span key={cur}>{money(amt, cur)}</span>
                ))}
              </span>
            )
          }
          note={`${o.invoices.openCount} open invoice${o.invoices.openCount === 1 ? "" : "s"}`}
          href="/invoices?status=sent"
        />
        <Stat
          label="Overdue invoices"
          value={o.invoices.overdue}
          tone={o.invoices.overdue ? "bad" : undefined}
          note={`${o.invoices.drafts} draft${o.invoices.drafts === 1 ? "" : "s"} not yet sent`}
          href="/invoices?status=sent"
        />
      </div>

      {o.docs.missingContract > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {o.docs.missingContract} current contractor{o.docs.missingContract === 1 ? " has" : "s have"} no contract uploaded.{" "}
          <Link href="/contractors" className="font-medium underline">
            Review contractors
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Documents expiring or expired">
          {expiring.length === 0 ? (
            <Empty title="Nothing expiring in the next 30 days." />
          ) : (
            <ul className="divide-y divide-line">
              {expiring.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/contractors/${d.contractor_id}`} className="font-medium hover:text-accent">
                      {d.contractor_name}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      {d.doc_type} · {d.title}
                    </div>
                  </div>
                  <div className="text-right">
                    <ExpiryBadge state={expiryState(d.expiry_date, o.today)} />
                    <div className="mt-0.5 text-xs text-muted">{fmtDate(d.expiry_date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent invoices"
          actions={
            <Link href="/invoices" className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          }
        >
          {recent.length === 0 ? (
            <Empty title="No invoices yet." />
          ) : (
            <ul className="divide-y divide-line">
              {recent.slice(0, 6).map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-accent">
                      {inv.number}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      {inv.client_name} · due {fmtDate(inv.due_date)}
                    </div>
                  </div>
                  <span className="tabular-nums">{money(inv.total, inv.currency)}</span>
                  <InvoiceStatusBadge status={inv.status} overdue={inv.due_date < o.today} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <Card>
      <div className="px-6 py-14 text-center">
        <p className="text-lg font-semibold tracking-tight">Welcome to Contractor Hub</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Start by adding a client and your first contractor, or look around with made-up sample data first. You can remove
          it anytime in Settings.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/clients/new" className="btn-secondary">
            Add a client
          </Link>
          <Link href="/contractors/new" className="btn-primary">
            Add a contractor
          </Link>
          <form action={loadSampleData}>
            <SubmitButton className="btn-ghost" pendingText="Adding…">
              Explore with sample data
            </SubmitButton>
          </form>
        </div>
      </div>
    </Card>
  );
}
