"use server";

import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, one, type Queryable } from "./db";
import { requireProfile } from "./session";
import { deleteFiles, putFile } from "./storage";
import { toCents } from "./format";
import { CURRENCIES, DOC_TYPES } from "./types";
import { insertSampleData } from "./sample";

export type FormState = { error?: string; ok?: string };

// ---------- helpers ----------

function str(fd: FormData, key: string, max = 2000): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function optDate(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function num(fd: FormData, key: string, fallback = 0): number {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? n : fallback;
}
function optId(fd: FormData, key: string): number | null {
  const n = Number(str(fd, key));
  return Number.isInteger(n) && n > 0 ? n : null;
}
function currency(fd: FormData, key = "currency"): string {
  const c = str(fd, key).toUpperCase();
  return (CURRENCIES as readonly string[]).includes(c) ? c : "USD";
}
function oneOf<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
function refresh() {
  // Nothing is cached with `use cache`; this re-renders visited routes after a write.
  revalidatePath("/", "layout");
}
/** null if the client id is empty; throws if it isn't this person's client. */
async function ownedClientId(db: Queryable, userId: number, id: number | null): Promise<number | null> {
  if (!id) return null;
  const row = one(await db.query("select id from eor.clients where id = $1 and user_id = $2", [id, userId]));
  if (!row) throw new Error("That client doesn't exist.");
  return id;
}

// ---------- settings ----------

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireProfile();
  const db = await getDb();
  await db.query(
    `update eor.profiles set company_name=$2, company_email=$3, company_address=$4, company_tax_id=$5, bank_details=$6,
     invoice_prefix=$7, next_invoice_number=$8, default_currency=$9, default_payment_terms=$10, invoice_footer=$11 where id=$1`,
    [
      me.id,
      str(fd, "company_name", 200),
      str(fd, "company_email", 200),
      str(fd, "company_address"),
      str(fd, "company_tax_id", 100),
      str(fd, "bank_details"),
      str(fd, "invoice_prefix", 20),
      Math.max(1, Math.floor(num(fd, "next_invoice_number", 1001))),
      currency(fd, "default_currency"),
      Math.max(0, Math.floor(num(fd, "default_payment_terms", 30))),
      str(fd, "invoice_footer", 300),
    ],
  );
  refresh();
  return { ok: "Settings saved." };
}

/** Adds the made-up sample contractors, clients and invoices to this person's account. */
export async function loadSampleData() {
  const me = await requireProfile();
  const db = await getDb();
  await db.tx((t) => insertSampleData(t, me.id));
  refresh();
}

/** Deletes every contractor, client, invoice and document for this person (keeps settings). */
export async function deleteAllData(): Promise<void> {
  const me = await requireProfile();
  const db = await getDb();
  const docs = await db.query<{ storage_path: string }>("select storage_path from eor.documents where user_id = $1", [me.id]);
  await db.tx(async (t) => {
    await t.query("delete from eor.invoices where user_id = $1", [me.id]);
    await t.query("delete from eor.contractors where user_id = $1", [me.id]);
    await t.query("delete from eor.clients where user_id = $1", [me.id]);
  });
  await deleteFiles(docs.map((d) => d.storage_path));
  refresh();
  redirect("/");
}

// ---------- clients ----------

export async function saveClient(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireProfile();
  const id = optId(fd, "id");
  const name = str(fd, "name", 200);
  if (!name) return { error: "Client name is required." };
  const values = [name, str(fd, "contact_name", 200), str(fd, "email", 200), str(fd, "address"), str(fd, "tax_id", 100), currency(fd)];
  const db = await getDb();
  if (id) {
    const rows = await db.query(
      "update eor.clients set name=$3, contact_name=$4, email=$5, address=$6, tax_id=$7, currency=$8 where id=$1 and user_id=$2 returning id",
      [id, me.id, ...values],
    );
    if (rows.length === 0) return { error: "That client doesn't exist." };
  } else {
    await db.query(
      "insert into eor.clients (user_id, name, contact_name, email, address, tax_id, currency) values ($1,$2,$3,$4,$5,$6,$7)",
      [me.id, ...values],
    );
  }
  refresh();
  redirect("/clients");
}

export async function deleteClient(fd: FormData) {
  const me = await requireProfile();
  const id = optId(fd, "id");
  if (id) await (await getDb()).query("delete from eor.clients where id = $1 and user_id = $2", [id, me.id]);
  refresh();
  redirect("/clients");
}

// ---------- contractors ----------

export async function saveContractor(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireProfile();
  const id = optId(fd, "id");
  const full_name = str(fd, "full_name", 200);
  if (!full_name) return { error: "Full name is required." };
  const email = str(fd, "email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email address doesn't look right." };
  const start = optDate(fd, "start_date");
  const end = optDate(fd, "end_date");
  if (start && end && end < start) return { error: "End date can't be before the start date." };

  const db = await getDb();
  let clientId: number | null;
  try {
    clientId = await ownedClientId(db, me.id, optId(fd, "client_id"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const values = [
    full_name,
    email,
    str(fd, "phone", 50),
    str(fd, "country", 100),
    str(fd, "address"),
    str(fd, "job_title", 200),
    clientId,
    oneOf(str(fd, "status"), ["onboarding", "active", "offboarded"] as const, "onboarding"),
    start,
    end,
    oneOf(str(fd, "rate_type"), ["hourly", "daily", "monthly", "fixed"] as const, "monthly"),
    Math.max(0, toCents(str(fd, "rate"))),
    currency(fd),
    str(fd, "tax_id", 100),
    str(fd, "bank_name", 200),
    str(fd, "bank_account", 100),
    str(fd, "bank_swift", 50),
    str(fd, "notes", 5000),
  ];

  let contractorId = id;
  if (id) {
    const rows = await db.query(
      `update eor.contractors set full_name=$3, email=$4, phone=$5, country=$6, address=$7, job_title=$8, client_id=$9, status=$10,
       start_date=$11, end_date=$12, rate_type=$13, rate_cents=$14, currency=$15, tax_id=$16, bank_name=$17, bank_account=$18,
       bank_swift=$19, notes=$20 where id=$1 and user_id=$2 returning id`,
      [id, me.id, ...values],
    );
    if (rows.length === 0) return { error: "That contractor doesn't exist." };
  } else {
    const row = one(
      await db.query<{ id: number }>(
        `insert into eor.contractors (user_id, full_name, email, phone, country, address, job_title, client_id, status, start_date,
         end_date, rate_type, rate_cents, currency, tax_id, bank_name, bank_account, bank_swift, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
        [me.id, ...values],
      ),
    )!;
    contractorId = row.id;
  }
  refresh();
  redirect(`/contractors/${contractorId}`);
}

export async function deleteContractor(fd: FormData) {
  const me = await requireProfile();
  const id = optId(fd, "id");
  if (id) {
    const db = await getDb();
    const docs = await db.query<{ storage_path: string }>(
      "select storage_path from eor.documents where contractor_id = $1 and user_id = $2",
      [id, me.id],
    );
    await db.query("delete from eor.contractors where id = $1 and user_id = $2", [id, me.id]);
    await deleteFiles(docs.map((d) => d.storage_path));
  }
  refresh();
  redirect("/contractors");
}

// ---------- documents ----------

const MAX_UPLOAD = 15 * 1024 * 1024;

export async function uploadDocument(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireProfile();
  const contractorId = optId(fd, "contractor_id");
  if (!contractorId) return { error: "Missing contractor." };
  const db = await getDb();
  const owned = one(await db.query("select id from eor.contractors where id = $1 and user_id = $2", [contractorId, me.id]));
  if (!owned) return { error: "That contractor doesn't exist." };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD) return { error: "Files must be 15 MB or smaller." };

  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const storagePath = `${me.id}/${randomUUID()}${ext}`;
  const mime = file.type || "application/octet-stream";
  try {
    await putFile(storagePath, Buffer.from(await file.arrayBuffer()), mime);
  } catch (e) {
    console.error(e);
    return { error: "Couldn't store the file. Please try again." };
  }

  await db.query(
    `insert into eor.documents (user_id, contractor_id, doc_type, title, file_name, storage_path, mime_type, size_bytes,
     issued_date, expiry_date, notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      me.id,
      contractorId,
      oneOf(str(fd, "doc_type"), DOC_TYPES, "Other"),
      str(fd, "title", 200) || file.name.slice(0, 200),
      file.name.slice(0, 255),
      storagePath,
      mime,
      file.size,
      optDate(fd, "issued_date"),
      optDate(fd, "expiry_date"),
      str(fd, "notes"),
    ],
  );
  refresh();
  return { ok: `Uploaded ${file.name}.` };
}

export async function updateDocumentDates(fd: FormData) {
  const me = await requireProfile();
  const id = optId(fd, "id");
  if (!id) return;
  await (await getDb()).query(
    "update eor.documents set doc_type=$3, title=$4, issued_date=$5, expiry_date=$6, notes=$7 where id=$1 and user_id=$2",
    [id, me.id, oneOf(str(fd, "doc_type"), DOC_TYPES, "Other"), str(fd, "title", 200), optDate(fd, "issued_date"), optDate(fd, "expiry_date"), str(fd, "notes")],
  );
  refresh();
}

export async function deleteDocument(fd: FormData) {
  const me = await requireProfile();
  const id = optId(fd, "id");
  if (!id) return;
  const rows = await (await getDb()).query<{ storage_path: string }>(
    "delete from eor.documents where id = $1 and user_id = $2 returning storage_path",
    [id, me.id],
  );
  await deleteFiles(rows.map((r) => r.storage_path));
  refresh();
}

// ---------- invoices ----------

type ItemInput = { description: string; quantity: number; unit_price_cents: number; contractor_id: number | null };

function parseItems(raw: string): ItemInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .slice(0, 200)
    .map((i) => ({
      description: String(i?.description ?? "").trim().slice(0, 500),
      quantity: Number(i?.quantity) || 0,
      unit_price_cents: toCents(Number(i?.unit_price) || 0),
      contractor_id: Number.isInteger(i?.contractor_id) && i.contractor_id > 0 ? i.contractor_id : null,
    }))
    .filter((i) => i.description || i.quantity || i.unit_price_cents);
}

export async function saveInvoice(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireProfile();
  const id = optId(fd, "id");
  const issue = optDate(fd, "issue_date");
  const due = optDate(fd, "due_date");
  if (!optId(fd, "client_id")) return { error: "Choose who the invoice is billed to." };
  if (!issue || !due) return { error: "Issue date and due date are required." };
  if (due < issue) return { error: "Due date can't be before the issue date." };
  const items = parseItems(str(fd, "items", 200_000));
  if (items.length === 0) return { error: "Add at least one line item." };
  if (items.some((i) => !i.description)) return { error: "Every line item needs a description." };

  const db = await getDb();
  let invoiceId: number;
  try {
    invoiceId = await db.tx(async (t) => {
      const clientId = await ownedClientId(t, me.id, optId(fd, "client_id"));
      // Contractor lines may only point at this person's contractors.
      const ids = [...new Set(items.map((i) => i.contractor_id).filter((x): x is number => x !== null))];
      if (ids.length) {
        const mine = await t.query<{ id: number }>(
          `select id from eor.contractors where user_id = $1 and id = any($2::bigint[])`,
          [me.id, `{${ids.join(",")}}`],
        );
        const ok = new Set(mine.map((r) => r.id));
        for (const it of items) if (it.contractor_id && !ok.has(it.contractor_id)) it.contractor_id = null;
      }
      const header = [clientId, issue, due, optDate(fd, "period_start"), optDate(fd, "period_end"), currency(fd), Math.min(100, Math.max(0, num(fd, "tax_rate"))), str(fd, "notes")];

      let invId = id;
      if (invId) {
        const rows = await t.query(
          `update eor.invoices set client_id=$3, issue_date=$4, due_date=$5, period_start=$6, period_end=$7, currency=$8, tax_rate=$9, notes=$10
           where id=$1 and user_id=$2 returning id`,
          [invId, me.id, ...header],
        );
        if (rows.length === 0) throw new Error("That invoice doesn't exist.");
        await t.query("delete from eor.invoice_items where invoice_id = $1", [invId]);
      } else {
        // Lock this person's profile row so two invoices saved at once can't get the same number.
        const p = one(
          await t.query<{ invoice_prefix: string; next_invoice_number: number }>(
            "select invoice_prefix, next_invoice_number from eor.profiles where id = $1 for update",
            [me.id],
          ),
        )!;
        let n = p.next_invoice_number;
        while (one(await t.query("select 1 from eor.invoices where user_id = $1 and number = $2", [me.id, `${p.invoice_prefix}${n}`]))) n++;
        const row = one(
          await t.query<{ id: number }>(
            `insert into eor.invoices (user_id, number, client_id, issue_date, due_date, period_start, period_end, currency, tax_rate, notes)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
            [me.id, `${p.invoice_prefix}${n}`, ...header],
          ),
        )!;
        await t.query("update eor.profiles set next_invoice_number = $2 where id = $1", [me.id, n + 1]);
        invId = row.id;
      }
      // One insert for all lines.
      const values = items.map((_, i) => `($1, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}, $${i * 5 + 6})`).join(", ");
      await t.query(
        `insert into eor.invoice_items (invoice_id, contractor_id, description, quantity, unit_price_cents, position) values ${values}`,
        [invId, ...items.flatMap((it, idx) => [it.contractor_id, it.description, it.quantity, it.unit_price_cents, idx])],
      );
      return invId;
    });
  } catch (e) {
    return { error: (e as Error).message || "Couldn't save the invoice." };
  }
  refresh();
  redirect(`/invoices/${invoiceId}`);
}

export async function setInvoiceStatus(fd: FormData) {
  const me = await requireProfile();
  const id = optId(fd, "id");
  const status = oneOf(str(fd, "status"), ["draft", "sent", "paid", "void"] as const, "draft");
  if (id) await (await getDb()).query("update eor.invoices set status = $3 where id = $1 and user_id = $2", [id, me.id, status]);
  refresh();
}

export async function deleteInvoice(fd: FormData) {
  const me = await requireProfile();
  const id = optId(fd, "id");
  if (id) await (await getDb()).query("delete from eor.invoices where id = $1 and user_id = $2", [id, me.id]);
  refresh();
  redirect("/invoices");
}
