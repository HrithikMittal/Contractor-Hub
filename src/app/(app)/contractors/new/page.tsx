import { Suspense } from "react";
import { getSettings, listClients } from "@/lib/data";
import { ContractorForm } from "@/components/contractor-form";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Add contractor" };

export default function NewContractorPage() {
  return (
    <>
      <PageHeader title="Add contractor" back={{ href: "/contractors", label: "Contractors" }} />
      <Suspense fallback={<Skeleton rows={8} />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const [clients, settings] = await Promise.all([listClients(), getSettings()]);
  return <ContractorForm clients={clients.map(({ id, name }) => ({ id, name }))} defaultCurrency={settings.default_currency} />;
}
