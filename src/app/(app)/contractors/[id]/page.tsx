import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getContractor, listDocuments, listInvoices, today } from "@/lib/data";
import { deleteContractor, deleteDocument, updateDocumentDates } from "@/lib/actions";
import { expiryState, fmtBytes, fmtDate, money } from "@/lib/format";
import { DOC_TYPES, RATE_LABEL } from "@/lib/types";
import { Badge, Card, ContractorStatusBadge, DetailRow, Empty, ExpiryBadge, InvoiceStatusBadge, PageHeader, Skeleton } from "@/components/ui";
import { ConfirmForm, SubmitButton } from "@/components/form-bits";
import { DocumentUpload } from "@/components/document-upload";

export default function ContractorPage({ params }: PageProps<"/contractors/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: Pick<PageProps<"/contractors/[id]">, "params">) {
  const id = Number((await params).id);
  const [k, docs, invoices] = await Promise.all([getContractor(id), listDocuments(id), listInvoices({ contractorId: id })]);
  if (!k) notFound();
  const t = today();
  const hasContract = docs.some((d) => d.doc_type === "Contract");

  return (
    <>
      <PageHeader
        back={{ href: "/contractors", label: "Contractors" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {k.full_name} <ContractorStatusBadge status={k.status} />
          </span>
        }
        subtitle={[k.job_title, k.client_name, k.country].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Link href={`/invoices/new?contractor=${k.id}`} className="btn-primary">
              Create invoice
            </Link>
            <Link href={`/contractors/${k.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Contact" className="lg:col-span-1">
          <dl className="divide-y divide-line px-5 py-2">
            <DetailRow label="Email">{k.email && <a className="hover:text-accent" href={`mailto:${k.email}`}>{k.email}</a>}</DetailRow>
            <DetailRow label="Phone">{k.phone}</DetailRow>
            <DetailRow label="Country">{k.country}</DetailRow>
            <DetailRow label="Address">{k.address}</DetailRow>
            <DetailRow label="Tax ID">{k.tax_id}</DetailRow>
          </dl>
        </Card>
        <Card title="Engagement">
          <dl className="divide-y divide-line px-5 py-2">
            <DetailRow label="Client">{k.client_name}</DetailRow>
            <DetailRow label="Start">{fmtDate(k.start_date)}</DetailRow>
            <DetailRow label="End">{k.end_date ? fmtDate(k.end_date) : "Ongoing"}</DetailRow>
            <DetailRow label="Rate">{k.rate_cents ? `${money(k.rate_cents, k.currency)} ${RATE_LABEL[k.rate_type]}` : ""}</DetailRow>
          </dl>
        </Card>
        <Card title="Payment">
          <dl className="divide-y divide-line px-5 py-2">
            <DetailRow label="Bank">{k.bank_name}</DetailRow>
            <DetailRow label="Account">{k.bank_account}</DetailRow>
            <DetailRow label="SWIFT / code">{k.bank_swift}</DetailRow>
          </dl>
        </Card>
      </div>

      {k.notes && (
        <Card title="Notes" className="mt-6">
          <p className="px-5 py-4 text-sm whitespace-pre-line">{k.notes}</p>
        </Card>
      )}

      <Card
        className="mt-6"
        title={
          <span className="flex items-center gap-2">
            Documents <span className="font-normal text-muted">{docs.length}</span>
            {!hasContract && k.status !== "offboarded" && <Badge tone="amber">No contract on file</Badge>}
          </span>
        }
      >
        <DocumentUpload contractorId={k.id} />
        {docs.length === 0 ? (
          <div className="border-t border-line">
            <Empty title="No documents yet.">Upload the contract, ID, tax forms and anything else you need on file.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {docs.map((d) => (
              <li key={d.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`/api/documents/${d.id}`} target="_blank" className="font-medium hover:text-accent">
                        {d.title}
                      </a>
                      <Badge>{d.doc_type}</Badge>
                      <ExpiryBadge state={expiryState(d.expiry_date, t)} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {d.file_name} · {fmtBytes(d.size_bytes)} · uploaded {fmtDate(d.uploaded_on)}
                      {d.issued_date && <> · issued {fmtDate(d.issued_date)}</>}
                      {d.expiry_date && <> · expires {fmtDate(d.expiry_date)}</>}
                    </div>
                  </div>
                  <a href={`/api/documents/${d.id}?download`} className="btn-ghost">
                    Download
                  </a>
                  <details className="group open:order-last open:basis-full">
                    <summary className="btn-ghost cursor-pointer list-none">Edit</summary>
                    <form action={updateDocumentDates} className="mt-3 grid w-full gap-2 sm:grid-cols-5">
                      <input type="hidden" name="id" value={d.id} />
                      <input name="title" defaultValue={d.title} className="input sm:col-span-2" aria-label="Title" />
                      <select name="doc_type" defaultValue={d.doc_type} className="input" aria-label="Type">
                        {DOC_TYPES.map((dt) => (
                          <option key={dt}>{dt}</option>
                        ))}
                      </select>
                      <input name="issued_date" type="date" defaultValue={d.issued_date ?? ""} className="input" aria-label="Issued" />
                      <input name="expiry_date" type="date" defaultValue={d.expiry_date ?? ""} className="input" aria-label="Expires" />
                      <input type="hidden" name="notes" value={d.notes} />
                      <div className="sm:col-span-5">
                        <SubmitButton className="btn-secondary">Save</SubmitButton>
                      </div>
                    </form>
                  </details>
                  <ConfirmForm action={deleteDocument} fields={{ id: d.id }} message={`Delete "${d.title}"? The file will be removed.`} className="btn-ghost text-red-700">
                    Delete
                  </ConfirmForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        className="mt-6"
        title="Invoices"
        actions={
          <Link href={`/invoices/new?contractor=${k.id}`} className="text-sm font-medium text-accent hover:underline">
            + New invoice
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <Empty title="Not on any invoices yet." />
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="td">
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:text-accent">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="td text-muted">{inv.client_name}</td>
                  <td className="td text-muted">{fmtDate(inv.issue_date)}</td>
                  <td className="td text-right tabular-nums">{money(inv.total, inv.currency)}</td>
                  <td className="td text-right">
                    <InvoiceStatusBadge status={inv.status} overdue={inv.due_date < t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-10 flex justify-end border-t border-line pt-6">
        <ConfirmForm
          action={deleteContractor}
          fields={{ id: k.id }}
          message={`Permanently delete ${k.full_name} and all ${docs.length} of their documents? Invoices are kept. This can't be undone.`}
        >
          Delete contractor
        </ConfirmForm>
      </div>
    </>
  );
}
