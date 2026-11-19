"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { FormState } from "@/lib/actions";

export function SubmitButton({ children, pendingText, className = "btn-primary" }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

/** A one-button form that asks for confirmation before running a destructive action. */
export function ConfirmForm({
  action,
  fields,
  message,
  children,
  className = "btn-danger",
}: {
  action: (fd: FormData) => void | Promise<void>;
  fields: Record<string, string | number>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className} pendingText="Working…">
        {children}
      </SubmitButton>
    </form>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>;
  return null;
}
