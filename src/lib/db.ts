// Tiny database adapter so the same SQL runs on:
//  - Supabase Postgres in production (DATABASE_URL, via postgres.js)
//  - PGlite (Postgres compiled to WASM) for local development, stored in .data/pglite.
// Same design as the money app's server/db.js.
//
// Interface: db.query(text, params) -> rows[]; db.tx(async (t) => ...) with t.query.

import fs from "node:fs";
import path from "node:path";
import { resolveEnv } from "./env";

export type Param = string | number | boolean | null;
export type Queryable = { query<T = Record<string, unknown>>(text: string, params?: Param[]): Promise<T[]> };
export type Db = Queryable & { tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T> };

export const DATA_DIR = process.env.EOR_DATA_DIR ?? path.join(process.cwd(), ".data");
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

function migrationSql() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

/**
 * postgres.js forwards unknown URL query params to the server as settings, and
 * Supabase/Vercel connection strings carry extras like `supa=base-pooler.x`.
 * Keep only what postgres.js understands.
 */
export function cleanDatabaseUrl(url: string) {
  const u = new URL(url);
  const keep = new Set(["sslmode", "application_name", "options"]);
  for (const key of [...u.searchParams.keys()]) if (!keep.has(key)) u.searchParams.delete(key);
  return u.toString();
}

function postgresDb(rawUrl: string): Db {
  const url = cleanDatabaseUrl(rawUrl);
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  type Sql = import("postgres").Sql;
  let sqlPromise: Promise<Sql> | undefined;
  const getSql = () =>
    (sqlPromise ??= import("postgres").then(({ default: postgres }) =>
      postgres(url, {
        ssl: isLocal ? false : "require",
        prepare: false, // required for Supabase's transaction pooler (port 6543)
        max: 3,
        idle_timeout: 20,
        types: {
          // int8 (ids, cents, counts) as JS numbers. Values stay far below 2^53.
          bigint: { to: 20, from: [20], serialize: (v: number) => String(v), parse: (v: string) => Number(v) },
          // DATE stays a 'YYYY-MM-DD' string, so it never shifts with time zones.
          date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v },
        },
      }),
    ));
  const run = async <T,>(sql: Sql | import("postgres").TransactionSql, text: string, params: Param[]) =>
    [...(await sql.unsafe(text, params as never[]))] as T[];
  return {
    async query<T>(text: string, params: Param[] = []) {
      return run<T>(await getSql(), text, params);
    },
    async tx<T>(fn: (t: Queryable) => Promise<T>) {
      const sql = await getSql();
      return sql.begin((t) => fn({ query: <R,>(text: string, params: Param[] = []) => run<R>(t, text, params) })) as Promise<T>;
    },
  };
}

async function pgliteDb(dataDir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(dataDir, { parsers: { 20: (v: string) => Number(v), 1082: (v: string) => v } });
  await pg.exec(migrationSql());
  return {
    async query<T>(text: string, params: Param[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    async tx<T>(fn: (t: Queryable) => Promise<T>) {
      return pg.transaction((t) => fn({ query: async <R,>(text: string, params: Param[] = []) => (await t.query<R>(text, params)).rows }));
    },
  };
}

// One database per process; kept on globalThis so dev hot reloads don't open PGlite twice.
const g = globalThis as unknown as { __eorDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (g.__eorDb) return g.__eorDb;
  const { databaseUrl, onVercel } = resolveEnv();
  if (databaseUrl) {
    g.__eorDb = Promise.resolve(postgresDb(databaseUrl));
  } else if (onVercel) {
    throw new Error("Database is not configured: set DATABASE_URL to your Supabase connection string in Vercel.");
  } else {
    g.__eorDb = pgliteDb(process.env.PGLITE_DIR ?? path.join(DATA_DIR, "pglite"));
  }
  return g.__eorDb;
}

export function one<T>(rows: T[]): T | undefined {
  return rows[0];
}
