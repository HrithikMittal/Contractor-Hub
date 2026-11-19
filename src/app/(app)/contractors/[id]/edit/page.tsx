import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getContractor, getSettings, listClients } from "@/lib/data";
import { ContractorForm } from "@/components/contractor-form";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Edit contractor" };

export default function EditContractorPage({ params }: PageProps<"/contractors/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton rows={8} />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/contractors/[id]/edit">, "params">) {
  const { id } = await params;
  const [contractor, clients, settings] = await Promise.all([getContractor(Number(id)), listClients(), getSettings()]);
  if (!contractor) notFound();
  return (
    <>
      <PageHeader title={`Edit ${contractor.full_name}`} back={{ href: `/contractors/${id}`, label: contractor.full_name }} />
      <ContractorForm
        contractor={contractor}
        clients={clients.map(({ id, name }) => ({ id, name }))}
        defaultCurrency={settings.default_currency}
      />
    </>
  );
}
