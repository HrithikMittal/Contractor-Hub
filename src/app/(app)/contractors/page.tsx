import Link from "next/link";
import { Suspense } from "react";
import { listContractors } from "@/lib/data";
import { money } from "@/lib/format";
import { RATE_LABEL } from "@/lib/types";
import { Badge, Card, ContractorStatusBadge, Empty, PageHeader, Skeleton } from "@/components/ui";

export const metadata = { title: "Contractors" };

export default function ContractorsPage({ searchParams }: PageProps<"/contractors">) {
  return (
    <>
      <PageHeader
        title="Contractors"
        subtitle="Everyone you engage, their status and document health."
        actions={
          <Link href="/contractors/new" className="btn-primary">
            + Add contractor
          </Link>
        }
      />
      <Suspense fallback={<Skeleton rows={6} />}>
        <ContractorTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ContractorTable({ searchParams }: Pick<PageProps<"/contractors">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const rows = await listContractors({ q, status });

  return (
    <Card>
      <form className="flex flex-wrap gap-2 border-b border-line p-3">
        <input name="q" defaultValue={q} placeholder="Search name, email, country, client…" className="input max-w-xs flex-1" />
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="offboarded">Offboarded</option>
        </select>
        <button className="btn-secondary">Filter</button>
        {(q || status) && (
          <Link href="/contractors" className="btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty
          title={q || status ? "No contractors match." : "No contractors yet."}
          action={
            !q && !status && (
              <Link href="/contractors/new" className="btn-primary">
                Add your first contractor
              </Link>
            )
          }
        >
          {!q && !status && "Add a contractor to start tracking their documents and invoicing their work."}
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-zinc-50/60">
              <tr>
                <th className="th">Name</th>
                <th className="th">Client</th>
                <th className="th">Country</th>
                <th className="th">Rate</th>
                <th className="th">Documents</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((k) => (
                <tr key={k.id} className="hover:bg-zinc-50/60">
                  <td className="td">
                    <Link href={`/contractors/${k.id}`} className="font-medium hover:text-accent">
                      {k.full_name}
                    </Link>
                    <div className="text-xs text-muted">{k.job_title || k.email}</div>
                  </td>
                  <td className="td text-muted">{k.client_name ?? "—"}</td>
                  <td className="td text-muted">{k.country || "—"}</td>
                  <td className="td tabular-nums">
                    {k.rate_cents ? (
                      <>
                        {money(k.rate_cents, k.currency)} <span className="text-xs text-muted">{RATE_LABEL[k.rate_type]}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted">{k.doc_count}</span>
                      {k.docs_expired > 0 && <Badge tone="red">{k.docs_expired} expired</Badge>}
                      {k.docs_expiring > 0 && <Badge tone="amber">{k.docs_expiring} expiring</Badge>}
                    </div>
                  </td>
                  <td className="td">
                    <ContractorStatusBadge status={k.status} />
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
