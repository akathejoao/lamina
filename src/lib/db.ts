import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { assertParameterized } from "./sql-guard";

const MIGRATION = /^\d{3}_[a-z0-9_]+\.sql$/;

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;

export function hasDatabase(): boolean {
  return databaseUrl !== "";
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  assertParameterized(text);
  if (databaseUrl !== "") {
    return (await remote().query(text, params)).rows as T[];
  }
  return (await (await localDb()).query<T>(text, params)).rows;
}

// Roda os comandos juntos: ou todos gravam, ou nenhum.
export async function sqlAll(steps: { text: string; params: unknown[] }[]): Promise<void> {
  for (const step of steps) assertParameterized(step.text);
  if (databaseUrl !== "") {
    const client = await remote().connect();
    try {
      await client.query("begin");
      for (const step of steps) await client.query(step.text, step.params);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    return;
  }
  const db = await localDb();
  await db.transaction(async (tx) => {
    for (const step of steps) await tx.query(step.text, step.params);
  });
}

function remote(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
  return pool;
}

function localDb(): Promise<PGlite> {
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL é obrigatório na hospedagem. Sem ele as contas não sobrevivem.");
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return local;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => [])).filter((file) => MIGRATION.test(file)).sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
