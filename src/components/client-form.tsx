"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveClient, type FormState } from "@/lib/actions";
import { CURRENCIES, type Client } from "@/lib/types";
import { Field } from "./ui";
import { FormMessage, SubmitButton } from "./form-bits";

export function ClientForm({ client, defaultCurrency }: { client?: Client; defaultCurrency: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveClient, {});
  return (
    <form action={action} className="card grid max-w-2xl gap-4 p-5 sm:grid-cols-2">
      {client && <input type="hidden" name="id" value={client.id} />}
      <Field label="Company name *" className="sm:col-span-2">
        <input name="name" required defaultValue={client?.name} className="input" />
      </Field>
      <Field label="Contact person">
        <input name="contact_name" defaultValue={client?.contact_name} className="input" />
      </Field>
      <Field label="Billing email">
        <input name="email" type="email" defaultValue={client?.email} className="input" />
      </Field>
      <Field label="Billing address" className="sm:col-span-2">
        <textarea name="address" rows={3} defaultValue={client?.address} className="input" />
      </Field>
      <Field label="Tax / VAT ID">
        <input name="tax_id" defaultValue={client?.tax_id} className="input" />
      </Field>
      <Field label="Invoice currency">
        <select name="currency" defaultValue={client?.currency ?? defaultCurrency} className="input">
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        <div className="mr-auto">
          <FormMessage state={state} />
        </div>
        <Link href="/clients" className="btn-secondary">
          Cancel
        </Link>
        <SubmitButton>{client ? "Save changes" : "Add client"}</SubmitButton>
      </div>
    </form>
  );
}
