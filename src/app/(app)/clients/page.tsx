import Link from "next/link";
import { Suspense } from "react";
import { listClients } from "@/lib/data";
import { Card, Empty, PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="The companies you invoice for contractor work."
        actions={
          <Link href="/clients/new" className="btn-primary">
            + Add client
          </Link>
        }
      />
      <Suspense fallback={<Skeleton />}>
        <ClientTable />
      </Suspense>
    </>
  );
}

async function ClientTable() {
  const clients = await listClients();
  return (
    <Card>
      {clients.length === 0 ? (
        <Empty
          title="No clients yet."
          action={
            <Link href="/clients/new" className="btn-primary">
              Add a client
            </Link>
          }
        >
          Invoices are billed to a client, so add one before creating your first invoice.
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-zinc-50/60">
              <tr>
                <th className="th">Name</th>
                <th className="th">Contact</th>
                <th className="th">Currency</th>
                <th className="th text-right">Contractors</th>
                <th className="th text-right">Invoices</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/60">
                  <td className="td font-medium">{c.name}</td>
                  <td className="td text-muted">
                    {c.contact_name}
                    {c.email && <div className="text-xs">{c.email}</div>}
                  </td>
                  <td className="td text-muted">{c.currency}</td>
                  <td className="td text-right tabular-nums">{c.contractor_count}</td>
                  <td className="td text-right tabular-nums">
                    <Link href={`/invoices?client=${c.id}`} className="hover:text-accent">
                      {c.invoiced}
                    </Link>
                  </td>
                  <td className="td text-right">
                    <Link href={`/clients/${c.id}/edit`} className="text-sm font-medium text-accent hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
