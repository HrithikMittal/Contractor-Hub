-- Contractor Hub: contractors, their documents, clients and invoices.
-- Everything lives in its own "eor" schema so it never clashes with other apps.
-- Each person's data is private: every table hangs off eor.profiles and every
-- query in the app is scoped to the signed-in profile.
-- Amounts are stored in cents (bigint). Dates are plain calendar dates.

create schema if not exists eor;

-- One row per person. Also holds their company details and invoice defaults.
create table if not exists eor.profiles (
  id                     bigserial primary key,
  auth_user_id           uuid not null unique,
  email                  text,
  name                   text not null default '',
  company_name           text not null default '',
  company_email          text not null default '',
  company_address        text not null default '',
  company_tax_id         text not null default '',
  bank_details           text not null default '',
  invoice_prefix         text not null default 'INV-',
  next_invoice_number    int not null default 1001 check (next_invoice_number > 0),
  default_currency       text not null default 'USD',
  default_payment_terms  int not null default 30 check (default_payment_terms >= 0),
  invoice_footer         text not null default 'Thank you for your business.',
  created_at             timestamptz not null default now()
);
create index if not exists profiles_email on eor.profiles (lower(email));

-- Sign-in codes sent by email (through Resend). Only a keyed hash of each code is
-- stored; codes expire after 10 minutes and allow a few attempts.
create table if not exists eor.login_codes (
  id          bigserial primary key,
  email       text not null,
  code_hash   text not null,
  attempts    smallint not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists login_codes_email on eor.login_codes (email, created_at desc);

create table if not exists eor.clients (
  id            bigserial primary key,
  user_id       bigint not null references eor.profiles(id) on delete cascade,
  name          text not null check (length(name) between 1 and 200),
  contact_name  text not null default '',
  email         text not null default '',
  address       text not null default '',
  tax_id        text not null default '',
  currency      text not null default 'USD',
  created_at    timestamptz not null default now()
);
create index if not exists clients_user on eor.clients (user_id);

create table if not exists eor.contractors (
  id            bigserial primary key,
  user_id       bigint not null references eor.profiles(id) on delete cascade,
  full_name     text not null check (length(full_name) between 1 and 200),
  email         text not null default '',
  phone         text not null default '',
  country       text not null default '',
  address       text not null default '',
  job_title     text not null default '',
  client_id     bigint references eor.clients(id) on delete set null,
  status        text not null default 'onboarding' check (status in ('onboarding', 'active', 'offboarded')),
  start_date    date,
  end_date      date,
  rate_type     text not null default 'monthly' check (rate_type in ('hourly', 'daily', 'monthly', 'fixed')),
  rate_cents    bigint not null default 0 check (rate_cents >= 0),
  currency      text not null default 'USD',
  tax_id        text not null default '',
  bank_name     text not null default '',
  bank_account  text not null default '',
  bank_swift    text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists contractors_user on eor.contractors (user_id);

-- File bytes live in storage (a private Supabase Storage bucket in production,
-- the local disk in development); this table holds what the file is.
create table if not exists eor.documents (
  id             bigserial primary key,
  user_id        bigint not null references eor.profiles(id) on delete cascade,
  contractor_id  bigint not null references eor.contractors(id) on delete cascade,
  doc_type       text not null,
  title          text not null,
  file_name      text not null,
  storage_path   text not null,
  mime_type      text not null default 'application/octet-stream',
  size_bytes     bigint not null default 0,
  issued_date    date,
  expiry_date    date,
  notes          text not null default '',
  uploaded_at    timestamptz not null default now()
);
create index if not exists documents_contractor on eor.documents (contractor_id);
create index if not exists documents_user_expiry on eor.documents (user_id, expiry_date);

create table if not exists eor.invoices (
  id            bigserial primary key,
  user_id       bigint not null references eor.profiles(id) on delete cascade,
  number        text not null,
  client_id     bigint references eor.clients(id) on delete set null,
  status        text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  issue_date    date not null,
  due_date      date not null,
  period_start  date,
  period_end    date,
  currency      text not null default 'USD',
  tax_rate      double precision not null default 0 check (tax_rate between 0 and 100),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  unique (user_id, number)
);
create index if not exists invoices_user on eor.invoices (user_id, issue_date desc);

create table if not exists eor.invoice_items (
  id                bigserial primary key,
  invoice_id        bigint not null references eor.invoices(id) on delete cascade,
  contractor_id     bigint references eor.contractors(id) on delete set null,
  description       text not null,
  quantity          double precision not null default 1,
  unit_price_cents  bigint not null default 0,
  position          int not null default 0
);
create index if not exists invoice_items_invoice on eor.invoice_items (invoice_id);
create index if not exists invoice_items_contractor on eor.invoice_items (contractor_id);

-- The app talks to Postgres directly with DATABASE_URL. Turning RLS on with no
-- policies means Supabase's public REST API can't read or write these tables.
alter table eor.profiles      enable row level security;
alter table eor.login_codes   enable row level security;
alter table eor.clients       enable row level security;
alter table eor.contractors   enable row level security;
alter table eor.documents     enable row level security;
alter table eor.invoices      enable row level security;
alter table eor.invoice_items enable row level security;
