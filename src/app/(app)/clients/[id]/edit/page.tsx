import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getClient, getSettings } from "@/lib/data";
import { deleteClient } from "@/lib/actions";
import { ClientForm } from "@/components/client-form";
import { ConfirmForm } from "@/components/form-bits";
import { PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Edit client" };

export default function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/clients/[id]/edit">, "params">) {
  const { id } = await params;
  const [client, s] = await Promise.all([getClient(Number(id)), getSettings()]);
  if (!client) notFound();
  return (
    <>
      <PageHeader title={`Edit ${client.name}`} back={{ href: "/clients", label: "Clients" }} />
      <ClientForm client={client} defaultCurrency={s.default_currency} />
      <div className="mt-8 max-w-2xl">
        <ConfirmForm
          action={deleteClient}
          fields={{ id: client.id }}
          message={`Delete ${client.name}? Contractors and invoices linked to it are kept but unlinked.`}
        >
          Delete client
        </ConfirmForm>
      </div>
    </>
  );
}
