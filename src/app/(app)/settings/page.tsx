import { Suspense } from "react";
import { getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { ConfirmForm } from "@/components/form-bits";
import { deleteAllData } from "@/lib/actions";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Company details and invoice defaults." />
      <Suspense fallback={<Skeleton rows={8} />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const s = await getSettings();
  return (
    <>
      <p className="mb-4 text-sm text-muted">Signed in as {s.email}</p>
      <SettingsForm settings={s} />
      <section className="card mt-10 max-w-3xl border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-800">Delete all data</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Removes every contractor, client, invoice and uploaded document in your account (including sample data). Your
          settings are kept.
        </p>
        <ConfirmForm action={deleteAllData} fields={{}} message="Delete all your contractors, clients, invoices and documents? This can't be undone.">
          Delete all data
        </ConfirmForm>
      </section>
    </>
  );
}
