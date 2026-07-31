import { NextResponse } from "next/server";
import { resolveTranscriptionSummaryV3RuntimeConfig } from "./runtime-config";

export function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId");
  return NextResponse.json(resolveTranscriptionSummaryV3RuntimeConfig(productId));
}
