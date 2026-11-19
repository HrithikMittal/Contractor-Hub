// Read-side queries. Every function resolves the signed-in profile first (redirecting to
// /login if there is none) and scopes every query to it, so one person never sees
// another's data. requireProfile() reads cookies, which also marks the render as
// request-time for Cache Components.
import { getDb, one, type Param } from "./db";
import { requireProfile } from "./session";
import { addDays, isoDay, EXPIRY_WARNING_DAYS } from "./format";
import type {
  Client,
  Contractor,
  ContractorRow,
  DocumentRecord,
  Invoice,
  InvoiceItem,
  InvoiceRow,
  Profile,
  Settings,
} from "./types";

export function today(): string {
  return isoDay(new Date());
}

async function q<T>(sql: string, params: Param[] = []): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function getSettings(): Promise<Settings & Pick<Profile, "email" | "name">> {
  return requireProfile();
}

// ---------- Clients ----------

export async function listClients(): Promise<(Client & { contractor_count: number; invoiced: number })[]> {
  const me = await requireProfile();
  return q(
    `select c.id, c.name, c.contact_name, c.email, c.address, c.tax_id, c.currency,
       (select count(*) from eor.contractors k where k.client_id = c.id and k.status <> 'offboarded') as contractor_count,
       (select count(*) from eor.invoices i where i.client_id = c.id) as invoiced
     from eor.clients c where c.user_id = $1 order by lower(c.name)`,
    [me.id],
  );
}

export async function getClient(id: number): Promise<Client | undefined> {
  const me = await requireProfile();
  return one(
    await q<Client>(
      "select id, name, contact_name, email, address, tax_id, currency from eor.clients where id = $1 and user_id = $2",
      [id, me.id],
    ),
  );
}

// ---------- Contractors ----------

const CONTRACTOR_COLS = `k.id, k.full_name, k.email, k.phone, k.country, k.address, k.job_title, k.client_id, k.status,
  k.start_date, k.end_date, k.rate_type, k.rate_cents, k.currency, k.tax_id, k.bank_name, k.bank_account, k.bank_swift, k.notes`;

export async function listContractors(filters: { q?: string; status?: string } = {}): Promise<ContractorRow[]> {
  const me = await requireProfile();
  const t = today();
  const params: Param[] = [me.id, t, addDays(t, EXPIRY_WARNING_DAYS)];
  const where = ["k.user_id = $1"];
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const n = `$${params.length}`;
    where.push(`(k.full_name ilike ${n} or k.email ilike ${n} or k.country ilike ${n} or k.job_title ilike ${n} or c.name ilike ${n})`);
  }
  if (filters.status && ["onboarding", "active", "offboarded"].includes(filters.status)) {
    params.push(filters.status);
    where.push(`k.status = $${params.length}`);
  }
  return q<ContractorRow>(
    `select ${CONTRACTOR_COLS}, c.name as client_name,
       (select count(*) from eor.documents d where d.contractor_id = k.id) as doc_count,
       (select count(*) from eor.documents d where d.contractor_id = k.id and d.expiry_date < $2::date) as docs_expired,
       (select count(*) from eor.documents d where d.contractor_id = k.id and d.expiry_date between $2::date and $3::date) as docs_expiring
     from eor.contractors k left join eor.clients c on c.id = k.client_id
     where ${where.join(" and ")}
     order by case k.status when 'active' then 0 when 'onboarding' then 1 else 2 end, lower(k.full_name)`,
    params,
  );
}

export async function getContractor(id: number): Promise<(Contractor & { client_name: string | null }) | undefined> {
  const me = await requireProfile();
  return one(
    await q<Contractor & { client_name: string | null }>(
      `select ${CONTRACTOR_COLS}, c.name as client_name
       from eor.contractors k left join eor.clients c on c.id = k.client_id
       where k.id = $1 and k.user_id = $2`,
      [id, me.id],
    ),
  );
}

/** Lightweight list for pickers (invoice builder). */
export async function listContractorOptions(): Promise<
  Pick<Contractor, "id" | "full_name" | "job_title" | "client_id" | "rate_type" | "rate_cents" | "currency" | "status">[]
> {
  const me = await requireProfile();
  return q(
    `select id, full_name, job_title, client_id, rate_type, rate_cents, currency, status from eor.contractors
     where user_id = $1 and status <> 'offboarded' order by lower(full_name)`,
    [me.id],
  );
}

// ---------- Documents ----------

const DOC_COLS = `d.id, d.contractor_id, d.doc_type, d.title, d.file_name, d.storage_path, d.mime_type, d.size_bytes,
  d.issued_date, d.expiry_date, d.notes, d.uploaded_at::date as uploaded_on`;

export async function listDocuments(contractorId: number): Promise<DocumentRecord[]> {
  const me = await requireProfile();
  return q<DocumentRecord>(
    `select ${DOC_COLS} from eor.documents d where d.contractor_id = $1 and d.user_id = $2 order by d.uploaded_at desc, d.id desc`,
    [contractorId, me.id],
  );
}

export async function listExpiringDocuments(limit = 8): Promise<(DocumentRecord & { contractor_name: string })[]> {
  const me = await requireProfile();
  return q(
    `select ${DOC_COLS}, k.full_name as contractor_name from eor.documents d
     join eor.contractors k on k.id = d.contractor_id
     where d.user_id = $1 and d.expiry_date <= $2::date and k.status <> 'offboarded'
     order by d.expiry_date asc limit $3`,
    [me.id, addDays(today(), EXPIRY_WARNING_DAYS), limit],
  );
}

// ---------- Invoices ----------

const INVOICE_COLS = `i.id, i.number, i.client_id, i.status, i.issue_date, i.due_date, i.period_start, i.period_end,
  i.currency, i.tax_rate, i.notes`;
const SUBTOTAL = `coalesce((select sum(round(it.quantity * it.unit_price_cents))::bigint
  from eor.invoice_items it where it.invoice_id = i.id), 0) as subtotal`;

function withTotal(r: Omit<InvoiceRow, "total">): InvoiceRow {
  return { ...r, total: r.subtotal + Math.round((r.subtotal * r.tax_rate) / 100) };
}

export async function listInvoices(filters: { status?: string; clientId?: number; contractorId?: number } = {}): Promise<InvoiceRow[]> {
  const me = await requireProfile();
  const params: Param[] = [me.id];
  const where = ["i.user_id = $1"];
  if (filters.status && ["draft", "sent", "paid", "void"].includes(filters.status)) {
    params.push(filters.status);
    where.push(`i.status = $${params.length}`);
  }
  if (filters.clientId) {
    params.push(filters.clientId);
    where.push(`i.client_id = $${params.length}`);
  }
  if (filters.contractorId) {
    params.push(filters.contractorId);
    where.push(`exists (select 1 from eor.invoice_items it where it.invoice_id = i.id and it.contractor_id = $${params.length})`);
  }
  const rows = await q<Omit<InvoiceRow, "total">>(
    `select ${INVOICE_COLS}, c.name as client_name, ${SUBTOTAL}
     from eor.invoices i left join eor.clients c on c.id = i.client_id
     where ${where.join(" and ")} order by i.issue_date desc, i.id desc`,
    params,
  );
  return rows.map(withTotal);
}

export async function getInvoice(id: number): Promise<
  | { invoice: Invoice & { client_name: string | null }; client: Client | undefined; items: (InvoiceItem & { contractor_name: string | null })[] }
  | undefined
> {
  const me = await requireProfile();
  const invoice = one(
    await q<Invoice & { client_name: string | null }>(
      `select ${INVOICE_COLS}, c.name as client_name from eor.invoices i left join eor.clients c on c.id = i.client_id
       where i.id = $1 and i.user_id = $2`,
      [id, me.id],
    ),
  );
  if (!invoice) return undefined;
  const [client, items] = await Promise.all([
    invoice.client_id
      ? q<Client>("select id, name, contact_name, email, address, tax_id, currency from eor.clients where id = $1 and user_id = $2", [
          invoice.client_id,
          me.id,
        ]).then(one)
      : Promise.resolve(undefined),
    q<InvoiceItem & { contractor_name: string | null }>(
      `select it.id, it.invoice_id, it.contractor_id, it.description, it.quantity, it.unit_price_cents, it.position,
         k.full_name as contractor_name
       from eor.invoice_items it left join eor.contractors k on k.id = it.contractor_id
       where it.invoice_id = $1 order by it.position, it.id`,
      [id],
    ),
  ]);
  return { invoice, client, items };
}

// ---------- Overview ----------

export async function getOverview() {
  const me = await requireProfile();
  const t = today();
  const soon = addDays(t, EXPIRY_WARNING_DAYS);
  // One round trip for all the counts.
  const stats = one(
    await q<{
      active: number;
      onboarding: number;
      clients: number;
      expired: number;
      expiring: number;
      missing_contract: number;
      drafts: number;
      total: number;
    }>(
      `select
         (select count(*) from eor.contractors where user_id = $1 and status = 'active') as active,
         (select count(*) from eor.contractors where user_id = $1 and status = 'onboarding') as onboarding,
         (select count(*) from eor.clients where user_id = $1) as clients,
         (select count(*) from eor.documents d join eor.contractors k on k.id = d.contractor_id
            where d.user_id = $1 and k.status <> 'offboarded' and d.expiry_date < $2::date) as expired,
         (select count(*) from eor.documents d join eor.contractors k on k.id = d.contractor_id
            where d.user_id = $1 and k.status <> 'offboarded' and d.expiry_date between $2::date and $3::date) as expiring,
         (select count(*) from eor.contractors k where k.user_id = $1 and k.status <> 'offboarded'
            and not exists (select 1 from eor.documents d where d.contractor_id = k.id and d.doc_type = 'Contract')) as missing_contract,
         (select count(*) from eor.invoices where user_id = $1 and status = 'draft') as drafts,
         (select count(*) from eor.contractors where user_id = $1) + (select count(*) from eor.clients where user_id = $1) as total`,
      [me.id, t, soon],
    ),
  )!;

  const open = (
    await q<Omit<InvoiceRow, "total">>(
      `select ${INVOICE_COLS}, null as client_name, ${SUBTOTAL} from eor.invoices i where i.user_id = $1 and i.status = 'sent'`,
      [me.id],
    )
  ).map(withTotal);
  const outstandingByCurrency: Record<string, number> = {};
  let overdue = 0;
  for (const inv of open) {
    outstandingByCurrency[inv.currency] = (outstandingByCurrency[inv.currency] ?? 0) + inv.total;
    if (inv.due_date < t) overdue++;
  }

  return {
    today: t,
    isEmpty: stats.total === 0,
    contractors: { active: stats.active, onboarding: stats.onboarding, clients: stats.clients },
    docs: { expired: stats.expired, expiring: stats.expiring, missingContract: stats.missing_contract },
    invoices: { outstandingByCurrency, openCount: open.length, overdue, drafts: stats.drafts },
  };
}
