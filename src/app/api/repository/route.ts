import { NextResponse } from "next/server";
import { RepositorySnapshotSchema } from "@/shared/repositories/local-storage-repository";
import { isDatabaseConfigured, readSnapshotRow, writeSnapshotRow } from "@/shared/repositories/postgres-store";

/**
 * Durable counterpart to localStorage for the app's single shared
 * RepositorySnapshot -- see postgres-store.ts's doc comment for the scope
 * and the reasoning behind storing the whole snapshot as one JSONB row.
 *
 * Both handlers return `{configured:false}` (200, not an error) when no
 * Postgres connection string is present, so the client-side background
 * sync in repository-store.ts can no-op cleanly rather than treat "no
 * database provisioned yet" as a failure.
 */

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false });
  try {
    const row = await readSnapshotRow();
    if (!row) return NextResponse.json({ configured: true, snapshot: null });
    const parsed = RepositorySnapshotSchema.safeParse(row.data);
    if (!parsed.success) return NextResponse.json({ configured: true, snapshot: null, error: "Stored snapshot failed validation." });
    return NextResponse.json({ configured: true, snapshot: parsed.data, updatedAt: row.updatedAt });
  } catch (error) {
    return NextResponse.json({ configured: true, snapshot: null, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false });
  const body = await request.json().catch(() => null);
  const parsed = RepositorySnapshotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Request body is not a valid RepositorySnapshot.", issues: parsed.error.issues } }, { status: 400 });
  try {
    await writeSnapshotRow(parsed.data);
    return NextResponse.json({ configured: true, saved: true });
  } catch (error) {
    return NextResponse.json({ configured: true, saved: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
