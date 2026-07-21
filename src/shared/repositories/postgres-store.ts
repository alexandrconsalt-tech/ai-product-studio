import { createPool, type VercelPool } from "@vercel/postgres";
import type { RepositorySnapshot } from "./types";

/**
 * Durable, server-side counterpart to LocalStorageProjectRepository
 * (CLAUDE.md §8.7's canonical decision: a real backend implements the same
 * ProjectRepository shape/data, additively, not a parallel contract).
 *
 * Scope, stated plainly (CLAUDE.md AD-6 -- no overclaiming): this is a
 * single shared workspace, not a per-user backend. There is no auth layer
 * in this application (§10 SB-1) -- every visitor to the deployed URL who
 * hits /api/repository reads/writes the same row. It exists to survive
 * what localStorage cannot (a cleared browser, a different device, a
 * browser profile reset), not to add multi-tenancy. Building real
 * multi-user isolation is a distinct, larger initiative (auth + per-user
 * rows), out of scope here.
 *
 * The whole RepositorySnapshot is stored as one JSONB document rather than
 * exploded into per-entity tables (CLAUDE.md §48's target design). This is
 * a deliberate simplification, not a shortcut: the interface this backs
 * (ProjectRepository.load/save) already only ever reads/writes the entire
 * snapshot -- CLAUDE.md §8.7 confirms zero production code calls the
 * per-entity upsert* methods -- so a relational schema for entities nothing
 * queries individually would be complexity with no present benefit (§2
 * principle 6). If a future need requires querying a single entity across
 * many workspaces, split into real tables then, against that concrete need.
 *
 * @vercel/postgres's own `sql` export only reads POSTGRES_URL. The Neon
 * marketplace integration (installed via `vercel integration add neon`) is
 * documented to set DATABASE_URL; whether it also mirrors POSTGRES_URL for
 * @vercel/postgres compatibility was not independently confirmed against a
 * live installation in this environment, so the connection string is
 * resolved from either name here rather than assumed.
 *
 * Server-only: imports @vercel/postgres and reads process.env directly.
 * Only import this from a Route Handler (src/app/api/*), never from a
 * "use client" component -- Next.js's App Router never bundles a Route
 * Handler's imports into the client, so this is safe as written, but it
 * would leak connection details if imported client-side by mistake.
 */

const CONNECTION_ENV_VARS = ["POSTGRES_URL", "DATABASE_URL", "POSTGRES_URL_NON_POOLING"] as const;
const SNAPSHOT_ROW_ID = "singleton";

function resolveConnectionString(): string | null {
  for (const name of CONNECTION_ENV_VARS) {
    const value = process.env[name];
    if (value && value.trim()) return value;
  }
  return null;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(resolveConnectionString());
}

let pool: VercelPool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): VercelPool {
  if (pool) return pool;
  const connectionString = resolveConnectionString();
  if (!connectionString) throw new Error("No Postgres connection string configured (checked POSTGRES_URL, DATABASE_URL, POSTGRES_URL_NON_POOLING).");
  pool = createPool({ connectionString });
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .sql`CREATE TABLE IF NOT EXISTS repository_snapshot (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export async function readSnapshotRow(): Promise<{ data: unknown; updatedAt: string } | null> {
  await ensureSchema();
  const result = await getPool().sql<{ data: unknown; updated_at: string }>`SELECT data, updated_at FROM repository_snapshot WHERE id = ${SNAPSHOT_ROW_ID}`;
  const row = result.rows[0];
  if (!row) return null;
  return { data: row.data, updatedAt: row.updated_at };
}

export async function writeSnapshotRow(snapshot: RepositorySnapshot): Promise<void> {
  await ensureSchema();
  const payload = JSON.stringify(snapshot);
  await getPool().sql`
    INSERT INTO repository_snapshot (id, data, updated_at)
    VALUES (${SNAPSHOT_ROW_ID}, ${payload}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET data = ${payload}::jsonb, updated_at = now()
  `;
}
