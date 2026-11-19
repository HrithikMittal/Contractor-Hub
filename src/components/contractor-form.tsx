"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveContractor, type FormState } from "@/lib/actions";
import { CURRENCIES, type Client, type Contractor } from "@/lib/types";
import { fromCents } from "@/lib/format";
import { Field } from "./ui";
import { FormMessage, SubmitButton } from "./form-bits";

export function ContractorForm({
  contractor,
  clients,
  defaultCurrency,
}: {
  contractor?: Contractor;
  clients: Pick<Client, "id" | "name">[];
  defaultCurrency: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveContractor, {});
  const c = contractor;
  return (
    <form action={action} className="space-y-6">
      {c && <input type="hidden" name="id" value={c.id} />}

      <Section title="Personal details" desc="Who they are and how to reach them.">
        <Field label="Full name *" className="sm:col-span-2">
          <input name="full_name" required defaultValue={c?.full_name} className="input" placeholder="e.g. Priya Raman" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={c?.email} className="input" />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={c?.phone} className="input" />
        </Field>
        <Field label="Country">
          <input name="country" defaultValue={c?.country} className="input" placeholder="Country of residence" />
        </Field>
        <Field label="Tax ID">
          <input name="tax_id" defaultValue={c?.tax_id} className="input" placeholder="PAN, NIF, SSN…" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <textarea name="address" rows={2} defaultValue={c?.address} className="input" />
        </Field>
      </Section>

      <Section title="Engagement" desc="The role, who they work for, and their status.">
        <Field label="Job title">
          <input name="job_title" defaultValue={c?.job_title} className="input" />
        </Field>
        <Field label="Client" hint={clients.length === 0 ? "No clients yet. Add one under Clients." : undefined}>
          <select name="client_id" defaultValue={c?.client_id ?? ""} className="input">
            <option value="">— None —</option>
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={c?.status ?? "onboarding"} className="input">
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="offboarded">Offboarded</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input name="start_date" type="date" defaultValue={c?.start_date ?? ""} className="input" />
          </Field>
          <Field label="End date">
            <input name="end_date" type="date" defaultValue={c?.end_date ?? ""} className="input" />
          </Field>
        </div>
      </Section>

      <Section title="Rate" desc="Used to pre-fill invoice lines.">
        <Field label="Rate type">
          <select name="rate_type" defaultValue={c?.rate_type ?? "monthly"} className="input">
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="fixed">Fixed fee</option>
          </select>
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Rate">
            <input name="rate" type="number" min="0" step="0.01" defaultValue={c ? fromCents(c.rate_cents) : ""} className="input" />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={c?.currency ?? defaultCurrency} className="input">
              {CURRENCIES.map((cur) => (
                <option key={cur}>{cur}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Payment details" desc="Where you pay them.">
        <Field label="Bank name">
          <input name="bank_name" defaultValue={c?.bank_name} className="input" />
        </Field>
        <Field label="Account number / IBAN">
          <input name="bank_account" defaultValue={c?.bank_account} className="input" />
        </Field>
        <Field label="SWIFT / IFSC / routing">
          <input name="bank_swift" defaultValue={c?.bank_swift} className="input" />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" className="sm:col-span-2">
          <textarea name="notes" rows={3} defaultValue={c?.notes} className="input" />
        </Field>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-1 py-4 backdrop-blur">
        <div className="mr-auto">
          <FormMessage state={state} />
        </div>
        <Link href={c ? `/contractors/${c.id}` : "/contractors"} className="btn-secondary">
          Cancel
        </Link>
        <SubmitButton>{c ? "Save changes" : "Add contractor"}</SubmitButton>
      </div>
    </form>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-6 p-5 md:grid-cols-[14rem_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-xs text-muted">{desc}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
