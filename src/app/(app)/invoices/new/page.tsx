import Link from "next/link";
import { Suspense } from "react";
import { getSettings, listClients, listContractorOptions, today } from "@/lib/data";
import { InvoiceBuilder } from "@/components/invoice-builder";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "New invoice" };

export default function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  return (
    <>
      <PageHeader title="New invoice" subtitle="The invoice number is assigned when you save." back={{ href: "/invoices", label: "Invoices" }} />
      <Suspense fallback={<Skeleton rows={8} />}>
        <Builder searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Builder({ searchParams }: Pick<PageProps<"/invoices/new">, "searchParams">) {
  const sp = await searchParams;
  const [clients, contractors, settings] = await Promise.all([listClients(), listContractorOptions(), getSettings()]);
  if (clients.length === 0) {
    return (
      <Card>
        <Empty
          title="Add a client first"
          action={
            <Link href="/clients/new" className="btn-primary">
              Add client
            </Link>
          }
        >
          Every invoice is billed to a client.
        </Empty>
      </Card>
    );
  }
  return (
    <InvoiceBuilder
      clients={clients.map(({ id, name, currency }) => ({ id, name, currency }))}
      contractors={contractors}
      today={today()}
      paymentTerms={settings.default_payment_terms}
      defaultCurrency={settings.default_currency}
      preselectContractorId={Number(sp.contractor) || undefined}
      preselectClientId={Number(sp.client) || undefined}
    />
  );
}
