import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getInvoice, getSettings, listClients, listContractorOptions, today } from "@/lib/data";
import { InvoiceBuilder } from "@/components/invoice-builder";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Edit invoice" };

export default function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton rows={8} />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/invoices/[id]/edit">, "params">) {
  const id = Number((await params).id);
  const [data, clients, contractors, settings] = await Promise.all([getInvoice(id), listClients(), listContractorOptions(), getSettings()]);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Edit ${data.invoice.number}`} back={{ href: `/invoices/${id}`, label: data.invoice.number }} />
      <InvoiceBuilder
        clients={clients.map(({ id, name, currency }) => ({ id, name, currency }))}
        contractors={contractors}
        today={today()}
        paymentTerms={settings.default_payment_terms}
        defaultCurrency={settings.default_currency}
        invoice={data.invoice}
        items={data.items}
      />
    </>
  );
}
