"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { saveInvoice, type FormState } from "@/lib/actions";
import { addDays, fromCents, invoiceTotals, lineTotal, money, toCents } from "@/lib/format";
import { CURRENCIES, RATE_UNIT, type Client, type Contractor, type Invoice, type InvoiceItem } from "@/lib/types";
import { Field } from "./ui";
import { FormMessage, SubmitButton } from "./form-bits";

type ContractorOption = Pick<Contractor, "id" | "full_name" | "job_title" | "client_id" | "rate_type" | "rate_cents" | "currency" | "status">;
type Line = { key: number; description: string; quantity: string; unit_price: string; contractor_id: number | null };

let nextKey = 1;

function lineFor(k: ContractorOption): Line {
  // Monthly and fixed fees default to 1. Hours and days are left blank so they get entered.
  const qty = k.rate_type === "monthly" || k.rate_type === "fixed" ? "1" : "";
  return {
    key: nextKey++,
    description: `${k.full_name}${k.job_title ? ` — ${k.job_title}` : ""}`,
    quantity: qty,
    unit_price: k.rate_cents ? fromCents(k.rate_cents) : "",
    contractor_id: k.id,
  };
}

function previousMonth(today: string): [string, string] {
  const d = new Date(`${today}T00:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 0);
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return [f(start), f(end)];
}

export function InvoiceBuilder({
  clients,
  contractors,
  today,
  paymentTerms,
  defaultCurrency,
  invoice,
  items,
  preselectContractorId,
  preselectClientId,
}: {
  clients: Pick<Client, "id" | "name" | "currency">[];
  contractors: ContractorOption[];
  today: string;
  paymentTerms: number;
  defaultCurrency: string;
  invoice?: Invoice;
  items?: InvoiceItem[];
  preselectContractorId?: number;
  preselectClientId?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveInvoice, {});
  const pre = contractors.find((k) => k.id === preselectContractorId);
  const initialClientId = invoice?.client_id ?? pre?.client_id ?? preselectClientId ?? null;
  const initialClient = clients.find((c) => c.id === initialClientId);
  const [defStart, defEnd] = previousMonth(today);

  const [clientId, setClientId] = useState<string>(initialClientId ? String(initialClientId) : "");
  const [currency, setCurrency] = useState(invoice?.currency ?? pre?.currency ?? initialClient?.currency ?? defaultCurrency);
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? today);
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? addDays(today, paymentTerms));
  const [taxRate, setTaxRate] = useState(String(invoice?.tax_rate ?? 0));
  const [lines, setLines] = useState<Line[]>(() => {
    if (items?.length)
      return items.map((i) => ({
        key: nextKey++,
        description: i.description,
        quantity: String(i.quantity),
        unit_price: fromCents(i.unit_price_cents),
        contractor_id: i.contractor_id,
      }));
    if (pre) return [lineFor(pre)];
    return [{ key: nextKey++, description: "", quantity: "1", unit_price: "", contractor_id: null }];
  });

  // Amounts are typed in major units; everything shown is computed in cents.
  const numeric = lines.map((l) => ({ quantity: Number(l.quantity) || 0, unit_price_cents: toCents(l.unit_price) }));
  const totals = invoiceTotals(numeric, Number(taxRate) || 0);
  const clientContractors = useMemo(() => contractors.filter((k) => String(k.client_id) === clientId), [contractors, clientId]);
  const onInvoice = new Set(lines.map((l) => l.contractor_id).filter(Boolean));
  const mixedCurrency = lines.some((l) => {
    const k = contractors.find((c) => c.id === l.contractor_id);
    return k && k.currency !== currency;
  });

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addContractor(id: number) {
    const k = contractors.find((c) => c.id === id);
    if (!k) return;
    setLines((ls) => {
      const cleaned = ls.filter((l) => l.description || l.unit_price || l.contractor_id);
      return [...cleaned, lineFor(k)];
    });
  }
  function onClientChange(v: string) {
    setClientId(v);
    const c = clients.find((x) => String(x.id) === v);
    if (c && !invoice) setCurrency(c.currency);
  }

  const payload = JSON.stringify(
    lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
      contractor_id: l.contractor_id,
    })),
  );

  return (
    <form action={action} className="space-y-6">
      {invoice && <input type="hidden" name="id" value={invoice.id} />}
      <input type="hidden" name="items" value={payload} />

      <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Bill to *" className="sm:col-span-2">
          <select name="client_id" value={clientId} onChange={(e) => onClientChange(e.target.value)} className="input" required>
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tax rate (%)" hint="VAT/GST. Leave at 0 if none applies.">
          <input name="tax_rate" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="input" />
        </Field>
        <Field label="Issue date *">
          <input
            name="issue_date"
            type="date"
            required
            value={issueDate}
            onChange={(e) => {
              setIssueDate(e.target.value);
              if (!invoice && e.target.value) setDueDate(addDays(e.target.value, paymentTerms));
            }}
            className="input"
          />
        </Field>
        <Field label="Due date *">
          <input name="due_date" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
        </Field>
        <Field label="Service period from">
          <input name="period_start" type="date" defaultValue={invoice ? (invoice.period_start ?? "") : defStart} className="input" />
        </Field>
        <Field label="Service period to">
          <input name="period_end" type="date" defaultValue={invoice ? (invoice.period_end ?? "") : defEnd} className="input" />
        </Field>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">Line items</h2>
          <div className="flex flex-wrap items-center gap-2">
            {clientContractors.some((k) => !onInvoice.has(k.id)) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => clientContractors.filter((k) => !onInvoice.has(k.id) && k.status === "active").forEach((k) => addContractor(k.id))}
              >
                Add all active contractors for this client
              </button>
            )}
            <select
              className="input w-auto"
              value=""
              onChange={(e) => {
                if (e.target.value) addContractor(Number(e.target.value));
              }}
              aria-label="Add contractor line"
            >
              <option value="">+ Add contractor…</option>
              {contractors.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.full_name}
                  {onInvoice.has(k.id) ? " (already added)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-line bg-zinc-50/60">
              <tr>
                <th className="th w-1/2">Description</th>
                <th className="th w-28">Qty</th>
                <th className="th w-36">Unit price</th>
                <th className="th w-32 text-right">Amount</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l, idx) => {
                const k = contractors.find((c) => c.id === l.contractor_id);
                return (
                  <tr key={l.key} className="align-top">
                    <td className="px-4 py-2.5">
                      <input value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} className="input" placeholder="Description" aria-label="Description" />
                      {k && <div className="mt-1 text-xs text-muted">Contractor line · rate {money(k.rate_cents, k.currency)} per {RATE_UNIT[k.rate_type].replace(/s$/, "")}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={l.quantity}
                        onChange={(e) => update(l.key, { quantity: e.target.value })}
                        type="number"
                        step="0.01"
                        min="0"
                        className={`input tabular-nums ${l.quantity === "" ? "border-amber-400" : ""}`}
                        placeholder={k ? RATE_UNIT[k.rate_type] : "Qty"}
                        aria-label="Quantity"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} type="number" step="0.01" min="0" className="input tabular-nums" placeholder="0.00" aria-label="Unit price" />
                    </td>
                    <td className="px-4 py-4 text-right text-sm tabular-nums">{money(lineTotal(numeric[idx].quantity, numeric[idx].unit_price_cents), currency)}</td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="btn-ghost px-2"
                        aria-label="Remove line"
                        disabled={lines.length === 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-6 border-t border-line px-5 py-4">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setLines((ls) => [...ls, { key: nextKey++, description: "", quantity: "1", unit_price: "", contractor_id: null }])}
          >
            + Add custom line
          </button>
          <dl className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{money(totals.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tax ({Number(taxRate) || 0}%)</dt>
              <dd className="tabular-nums">{money(totals.tax, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(totals.total, currency)}</dd>
            </div>
          </dl>
        </div>
        {mixedCurrency && (
          <p className="mx-5 mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Some contractor rates are in a different currency from this invoice ({currency}). Check the unit prices are converted.
          </p>
        )}
      </section>

      <section className="card p-5">
        <Field label="Notes on invoice" hint="Shown to the client, e.g. a PO number or payment instructions.">
          <textarea name="notes" rows={3} defaultValue={invoice?.notes} className="input" />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-1 py-4 backdrop-blur">
        <div className="mr-auto">
          <FormMessage state={state} />
        </div>
        <Link href={invoice ? `/invoices/${invoice.id}` : "/invoices"} className="btn-secondary">
          Cancel
        </Link>
        <SubmitButton>{invoice ? "Save invoice" : "Create invoice"}</SubmitButton>
      </div>
    </form>
  );
}
