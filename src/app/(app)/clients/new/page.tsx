import { Suspense } from "react";
import { getSettings } from "@/lib/data";
import { ClientForm } from "@/components/client-form";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Add client" back={{ href: "/clients", label: "Clients" }} />
      <Suspense fallback={<Skeleton />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const s = await getSettings();
  return <ClientForm defaultCurrency={s.default_currency} />;
}
