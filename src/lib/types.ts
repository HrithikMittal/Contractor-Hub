export type ContractorStatus = "onboarding" | "active" | "offboarded";
export type RateType = "hourly" | "daily" | "monthly" | "fixed";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

/** The signed-in person. Also holds their company details and invoice defaults. */
export interface Profile {
  id: number;
  auth_user_id: string;
  email: string | null;
  name: string;
  company_name: string;
  company_email: string;
  company_address: string;
  company_tax_id: string;
  bank_details: string;
  invoice_prefix: string;
  next_invoice_number: number;
  default_currency: string;
  default_payment_terms: number;
  invoice_footer: string;
}

export type Settings = Pick<
  Profile,
  | "company_name" | "company_email" | "company_address" | "company_tax_id" | "bank_details"
  | "invoice_prefix" | "next_invoice_number" | "default_currency" | "default_payment_terms" | "invoice_footer"
>;

export interface Client {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  address: string;
  tax_id: string;
  currency: string;
  created_at: string;
}

export interface Contractor {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  job_title: string;
  client_id: number | null;
  status: ContractorStatus;
  start_date: string | null;
  end_date: string | null;
  rate_type: RateType;
  /** In cents. */
  rate_cents: number;
  currency: string;
  tax_id: string;
  bank_name: string;
  bank_account: string;
  bank_swift: string;
  notes: string;
  created_at: string;
}

export interface ContractorRow extends Contractor {
  client_name: string | null;
  doc_count: number;
  docs_expired: number;
  docs_expiring: number;
}

export interface DocumentRecord {
  id: number;
  contractor_id: number;
  doc_type: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  issued_date: string | null;
  expiry_date: string | null;
  notes: string;
  /** YYYY-MM-DD */
  uploaded_on: string;
}

export interface Invoice {
  id: number;
  number: string;
  client_id: number | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  tax_rate: number;
  notes: string;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  contractor_id: number | null;
  description: string;
  quantity: number;
  /** In cents. */
  unit_price_cents: number;
  position: number;
}

export interface InvoiceRow extends Invoice {
  client_name: string | null;
  /** In cents. */
  subtotal: number;
  /** In cents. */
  total: number;
}

export const DOC_TYPES = [
  "Contract",
  "NDA",
  "ID / Passport",
  "Tax form",
  "Work permit / Visa",
  "Bank details",
  "Certificate",
  "Other",
] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "AED"] as const;

export const RATE_LABEL: Record<RateType, string> = {
  hourly: "per hour",
  daily: "per day",
  monthly: "per month",
  fixed: "fixed",
};

export const RATE_UNIT: Record<RateType, string> = {
  hourly: "hours",
  daily: "days",
  monthly: "months",
  fixed: "units",
};
