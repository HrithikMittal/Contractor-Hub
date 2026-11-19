import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getInvoice, getSettings, today } from "@/lib/data";
import { deleteInvoice, setInvoiceStatus } from "@/lib/actions";
import { fmtDate, invoiceTotals, lineTotal, money } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";
import { InvoiceStatusBadge, PageHeader, Skeleton } from "@/components/ui";
import { ConfirmForm, SubmitButton } from "@/components/form-bits";
import { PrintButton } from "@/components/print-button";

export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <InvoiceView params={params} />
    </Suspense>
  );
}

const NEXT_STEPS: Record<InvoiceStatus, { status: InvoiceStatus; label: string; primary?: boolean }[]> = {
  draft: [{ status: "sent", label: "Mark as sent", primary: true }],
  sent: [
    { status: "paid", label: "Mark as paid", primary: true },
    { status: "draft", label: "Back to draft" },
  ],
  paid: [{ status: "sent", label: "Mark as unpaid" }],
  void: [{ status: "draft", label: "Restore as draft" }],
};

async function InvoiceView({ params }: Pick<PageProps<"/invoices/[id]">, "params">) {
  const id = Number((await params).id);
  const [data, s] = await Promise.all([getInvoice(id), getSettings()]);
  if (!data) notFound();
  const { invoice: inv, client, items } = data;
  const totals = invoiceTotals(items, inv.tax_rate);
  const overdue = inv.status === "sent" && inv.due_date < today();

  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {inv.number} <InvoiceStatusBadge status={inv.status} overdue={overdue} />
          </span>
        }
        subtitle={`${inv.client_name ?? "No client"} · ${money(totals.total, inv.currency)} · due ${fmtDate(inv.due_date)}`}
        actions={
          <>
            {NEXT_STEPS[inv.status].map((step) => (
              <form key={step.status} action={setInvoiceStatus}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value={step.status} />
                <SubmitButton className={step.primary ? "btn-primary" : "btn-secondary"} pendingText="Updating…">
                  {step.label}
                </SubmitButton>
              </form>
            ))}
            <PrintButton />
            <Link href={`/invoices/${inv.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          </>
        }
      />

      {/* The invoice document itself: this is what prints. */}
      <article className="card print-plain mx-auto max-w-4xl p-8 md:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xl font-semibold tracking-tight">{s.company_name}</div>
            <div className="mt-1 text-sm whitespace-pre-line text-muted">{s.company_address}</div>
            {s.company_email && <div className="text-sm text-muted">{s.company_email}</div>}
            {s.company_tax_id && <div className="text-sm text-muted">{s.company_tax_id}</div>}
          </div>
          <div className="text-right">
            <div className="text-3xl font-light tracking-tight text-accent">INVOICE</div>
            <div className="mt-1 font-mono text-sm">{inv.number}</div>
          </div>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium tracking-wide text-muted uppercase">Bill to</div>
            <div className="mt-1 font-medium">{client?.name ?? inv.client_name ?? "—"}</div>
            {client?.contact_name && <div className="text-sm">Attn: {client.contact_name}</div>}
            {client?.address && <div className="text-sm whitespace-pre-line text-muted">{client.address}</div>}
            {client?.email && <div className="text-sm text-muted">{client.email}</div>}
            {client?.tax_id && <div className="text-sm text-muted">Tax ID: {client.tax_id}</div>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:justify-self-end">
            <dt className="text-muted">Issue date</dt>
            <dd className="text-right">{fmtDate(inv.issue_date)}</dd>
            <dt className="text-muted">Due date</dt>
            <dd className="text-right">{fmtDate(inv.due_date)}</dd>
            {(inv.period_start || inv.period_end) && (
              <>
                <dt className="text-muted">Service period</dt>
                <dd className="text-right">
                  {fmtDate(inv.period_start)} – {fmtDate(inv.period_end)}
                </dd>
              </>
            )}
          </dl>
        </div>

        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((it) => (
              <tr key={it.id}>
                <td className="py-3 pr-4">{it.description}</td>
                <td className="py-3 text-right tabular-nums">{it.quantity}</td>
                <td className="py-3 text-right tabular-nums">{money(it.unit_price_cents, inv.currency)}</td>
                <td className="py-3 text-right tabular-nums">{money(lineTotal(it.quantity, it.unit_price_cents), inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{money(totals.subtotal, inv.currency)}</dd>
            </div>
            {inv.tax_rate > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Tax ({inv.tax_rate}%)</dt>
                <dd className="tabular-nums">{money(totals.tax, inv.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-semibold">
              <dt>Total due</dt>
              <dd className="tabular-nums">{money(totals.total, inv.currency)}</dd>
            </div>
          </dl>
        </div>

        {(inv.notes || s.bank_details) && (
          <div className="mt-12 grid gap-6 border-t border-line pt-6 text-sm sm:grid-cols-2">
            {s.bank_details && (
              <div>
                <div className="text-xs font-medium tracking-wide text-muted uppercase">Payment details</div>
                <div className="mt-1 whitespace-pre-line">{s.bank_details}</div>
              </div>
            )}
            {inv.notes && (
              <div>
                <div className="text-xs font-medium tracking-wide text-muted uppercase">Notes</div>
                <div className="mt-1 whitespace-pre-line">{inv.notes}</div>
              </div>
            )}
          </div>
        )}
        {s.invoice_footer && <p className="mt-10 text-center text-xs text-muted">{s.invoice_footer}</p>}
      </article>

      <div className="no-print mx-auto mt-8 flex max-w-4xl flex-wrap justify-end gap-2">
        {inv.status !== "void" && (
          <form action={setInvoiceStatus}>
            <input type="hidden" name="id" value={inv.id} />
            <input type="hidden" name="status" value="void" />
            <SubmitButton className="btn-ghost">Void invoice</SubmitButton>
          </form>
        )}
        <ConfirmForm action={deleteInvoice} fields={{ id: inv.id }} message={`Delete ${inv.number}? This can't be undone.`}>
          Delete
        </ConfirmForm>
      </div>
    </>
  );
}
