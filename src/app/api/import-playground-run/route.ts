import { NextResponse } from "next/server";
import { normalizePlaygroundRun } from "@/features/summary-review/importer";

function encodePayload(data: unknown) {
  return Buffer.from(unescape(encodeURIComponent(JSON.stringify(data))), "binary").toString("base64");
}

export async function POST(request: Request) {
  const body = await request.json();
  const run = normalizePlaygroundRun(body);
  const payload = encodePayload(body);

  return NextResponse.json({
    ok: true,
    review_url: `/review/${encodeURIComponent(run.id)}?payload=${encodeURIComponent(payload)}`,
  });
}

