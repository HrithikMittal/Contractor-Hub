"use client";

import { useActionState } from "react";
import { saveSettings, type FormState } from "@/lib/actions";
import { CURRENCIES, type Settings } from "@/lib/types";
import { Field } from "./ui";
import { FormMessage, SubmitButton } from "./form-bits";

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action] = useActionState<FormState, FormData>(saveSettings, {});
  return (
    <form action={action} className="max-w-3xl space-y-6">
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Your company (appears on invoices)</h2>
        <Field label="Company name">
          <input name="company_name" defaultValue={s.company_name} className="input" />
        </Field>
        <Field label="Billing email">
          <input name="company_email" type="email" defaultValue={s.company_email} className="input" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <textarea name="company_address" rows={3} defaultValue={s.company_address} className="input" />
        </Field>
        <Field label="Tax / registration ID">
          <input name="company_tax_id" defaultValue={s.company_tax_id} className="input" />
        </Field>
        <Field label="Payment details" hint="Bank account the client should pay into." className="sm:col-span-2">
          <textarea name="bank_details" rows={4} defaultValue={s.bank_details} className="input font-mono text-xs" />
        </Field>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Invoice defaults</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number prefix">
            <input name="invoice_prefix" defaultValue={s.invoice_prefix} className="input font-mono" />
          </Field>
          <Field label="Next number">
            <input name="next_invoice_number" type="number" min="1" defaultValue={s.next_invoice_number} className="input font-mono" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default currency">
            <select name="default_currency" defaultValue={s.default_currency} className="input">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment terms (days)">
            <input name="default_payment_terms" type="number" min="0" defaultValue={s.default_payment_terms} className="input" />
          </Field>
        </div>
        <Field label="Invoice footer" className="sm:col-span-2">
          <input name="invoice_footer" defaultValue={s.invoice_footer} className="input" />
        </Field>
      </section>

      <div className="flex items-center justify-end gap-3">
        <div className="mr-auto">
          <FormMessage state={state} />
        </div>
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
