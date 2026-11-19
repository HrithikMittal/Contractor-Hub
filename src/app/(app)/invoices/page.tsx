import Link from "next/link";
import { Suspense } from "react";
import { listClients, listInvoices, today } from "@/lib/data";
import { fmtDate, money } from "@/lib/format";
import { Card, Empty, InvoiceStatusBadge, PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Invoices" };

export default function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Create, send and track invoices for contractor work."
        actions={
          <Link href="/invoices/new" className="btn-primary">
            + New invoice
          </Link>
        }
      />
      <Suspense fallback={<Skeleton rows={6} />}>
        <InvoiceTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const TABS = [
  ["", "All"],
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["paid", "Paid"],
  ["void", "Void"],
] as const;

async function InvoiceTable({ searchParams }: Pick<PageProps<"/invoices">, "searchParams">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const clientId = Number(sp.client) || undefined;
  const [rows, clients] = await Promise.all([listInvoices({ status, clientId }), listClients()]);
  const t = today();
  const client = clients.find((c) => c.id === clientId);
  const qs = (s: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (clientId) p.set("client", String(clientId));
    const str = p.toString();
    return str ? `/invoices?${str}` : "/invoices";
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={qs(value)}
            className={`rounded-md px-3 py-1.5 text-sm ${status === value ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
        {client && (
          <span className="ml-auto flex items-center gap-2 text-sm text-muted">
            Client: <span className="font-medium text-ink">{client.name}</span>
            <Link href={status ? `/invoices?status=${status}` : "/invoices"} className="hover:text-ink" aria-label="Clear client filter">
              ✕
            </Link>
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <Empty
          title="No invoices here."
          action={
            <Link href="/invoices/new" className="btn-primary">
              Create an invoice
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-zinc-50/60">
              <tr>
                <th className="th">Number</th>
                <th className="th">Client</th>
                <th className="th">Issued</th>
                <th className="th">Due</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50/60">
                  <td className="td whitespace-nowrap">
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-accent">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="td text-muted">{inv.client_name ?? "—"}</td>
                  <td className="td text-muted">{fmtDate(inv.issue_date)}</td>
                  <td className={`td ${inv.status === "sent" && inv.due_date < t ? "text-red-700" : "text-muted"}`}>{fmtDate(inv.due_date)}</td>
                  <td className="td text-right font-medium tabular-nums">{money(inv.total, inv.currency)}</td>
                  <td className="td text-right">
                    <InvoiceStatusBadge status={inv.status} overdue={inv.due_date < t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
