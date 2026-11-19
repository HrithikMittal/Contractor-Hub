"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadDocument, type FormState } from "@/lib/actions";
import { DOC_TYPES } from "@/lib/types";
import { Field } from "./ui";
import { FormMessage, SubmitButton } from "./form-bits";

export function DocumentUpload({ contractorId }: { contractorId: number }) {
  const [state, action] = useActionState<FormState, FormData>(uploadDocument, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" name="contractor_id" value={contractorId} />
      <Field label="File *" className="sm:col-span-2">
        <input
          name="file"
          type="file"
          required
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-accent"
        />
      </Field>
      <Field label="Type">
        <select name="doc_type" className="input" defaultValue="Contract">
          {DOC_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Title" hint="Defaults to the file name">
        <input name="title" className="input" />
      </Field>
      <Field label="Issued">
        <input name="issued_date" type="date" className="input" />
      </Field>
      <Field label="Expires">
        <input name="expiry_date" type="date" className="input" />
      </Field>
      <div className="flex items-center justify-end gap-3 sm:col-span-2 lg:col-span-6">
        <div className="mr-auto">
          <FormMessage state={state} />
        </div>
        <SubmitButton pendingText="Uploading…">Upload document</SubmitButton>
      </div>
    </form>
  );
}
