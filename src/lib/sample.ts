// Made-up sample data, so a new account can be explored before real contractors are added.
// Sample documents get a database record but no stored file (downloads say the file is missing).
import type { Queryable } from "./db";
import { addDays, isoDay } from "./format";

export async function insertSampleData(t: Queryable, userId: number) {
  const today = isoDay(new Date());
  const day = (n: number) => addDays(today, n);
  const id = async (sql: string, params: (string | number | null)[]) =>
    (await t.query<{ id: number }>(`${sql} returning id`, params))[0].id;

  await t.query(
    `update eor.profiles set
       company_name = case when company_name = '' then 'Your Company Ltd' else company_name end,
       company_address = case when company_address = '' then E'221 Market Street\\nSan Francisco, CA 94105\\nUnited States' else company_address end
     where id = $1`,
    [userId],
  );

  const client = (name: string, contact: string, email: string, address: string, cur: string) =>
    id("insert into eor.clients (user_id, name, contact_name, email, address, currency) values ($1,$2,$3,$4,$5,$6)", [userId, name, contact, email, address, cur]);
  const acme = await client("Acme Analytics (sample)", "Jordan Lee", "ap@acme.example", "500 Howard St\nSan Francisco, CA", "USD");
  const nord = await client("Nordlicht GmbH (sample)", "Sam Weber", "finance@nordlicht.example", "Torstraße 12\n10119 Berlin, Germany", "EUR");

  const contractor = (name: string, email: string, country: string, title: string, clientId: number, status: string, start: string, rateType: string, rateCents: number, cur: string, bank: string) =>
    id(
      `insert into eor.contractors (user_id, full_name, email, country, job_title, client_id, status, start_date, rate_type, rate_cents, currency, bank_name)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [userId, name, email, country, title, clientId, status, start, rateType, rateCents, cur, bank],
    );
  const k1 = await contractor("Priya Raman", "priya@example.com", "India", "Senior Frontend Engineer", acme, "active", day(-240), "monthly", 650000, "USD", "HDFC Bank");
  const k2 = await contractor("Mateo Alvarez", "mateo@example.com", "Argentina", "Data Engineer", acme, "active", day(-120), "hourly", 5500, "USD", "Banco Galicia");
  const k3 = await contractor("Ana Kowalska", "ana@example.com", "Poland", "Product Designer", nord, "active", day(-60), "daily", 42000, "EUR", "mBank");
  await contractor("Kofi Mensah", "kofi@example.com", "Ghana", "QA Engineer", nord, "onboarding", day(7), "monthly", 320000, "EUR", "");

  const doc = (cid: number, type: string, title: string, issued: string | null, expiry: string | null) =>
    t.query(
      `insert into eor.documents (user_id, contractor_id, doc_type, title, file_name, storage_path, mime_type, size_bytes, issued_date, expiry_date, notes)
       values ($1,$2,$3,$4,$5,$6,'application/pdf',0,$7,$8,'Sample record (no file attached)')`,
      [userId, cid, type, title, `${title}.pdf`, `sample/${userId}-${cid}-${type}`, issued, expiry],
    );
  await doc(k1, "Contract", "Independent Contractor Agreement", day(-240), day(125));
  await doc(k1, "Tax form", "W-8BEN", day(-240), day(12));
  await doc(k2, "Contract", "Contractor Agreement", day(-120), day(245));
  await doc(k2, "ID / Passport", "Passport", day(-900), day(-5));
  await doc(k3, "Contract", "Service Agreement", day(-60), day(305));
  await doc(k3, "Work permit / Visa", "EU Residence Permit", day(-400), day(25));

  const p = (await t.query<{ invoice_prefix: string; next_invoice_number: number }>(
    "select invoice_prefix, next_invoice_number from eor.profiles where id = $1 for update",
    [userId],
  ))[0];
  let n = p.next_invoice_number;
  const invoice = async (clientId: number, status: string, issue: number, cur: string, tax: number, items: [number, string, number, number][]) => {
    const inv = await id(
      `insert into eor.invoices (user_id, number, client_id, status, issue_date, due_date, period_start, period_end, currency, tax_rate)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [userId, `${p.invoice_prefix}S${n++}`, clientId, status, day(issue), day(issue + 30), day(issue - 30), day(issue - 1), cur, tax],
    );
    for (const [i, [cid, desc, qty, cents]] of items.entries()) {
      await t.query(
        "insert into eor.invoice_items (invoice_id, contractor_id, description, quantity, unit_price_cents, position) values ($1,$2,$3,$4,$5,$6)",
        [inv, cid, desc, qty, cents, i],
      );
    }
  };
  await invoice(acme, "paid", -45, "USD", 0, [[k1, "Priya Raman — Senior Frontend Engineer", 1, 650000], [k2, "Mateo Alvarez — Data Engineer", 160, 5500]]);
  await invoice(acme, "sent", -14, "USD", 0, [[k1, "Priya Raman — Senior Frontend Engineer", 1, 650000], [k2, "Mateo Alvarez — Data Engineer", 152, 5500]]);
  await invoice(nord, "sent", -40, "EUR", 19, [[k3, "Ana Kowalska — Product Designer", 20, 42000]]);
}
