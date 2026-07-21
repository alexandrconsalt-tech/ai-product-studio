import { NextResponse } from "next/server";

/**
 * Stateless relay for public/pipeline-lab-v3.html's real Nexara STT call
 * (public/pipeline-lab-v3.html's audio-upload flow in the "Вход" card).
 *
 * Endpoint, auth scheme, and multipart field names below are sourced from
 * Nexara's public documentation (docs.nexara.ru, fetched 2026-07-21):
 * POST https://api.nexara.ru/api/v1/audio/transcriptions,
 * "Authorization: Bearer <key>", multipart/form-data with a `file` field
 * plus optional `response_format`/`task`/`num_speakers`/`language`. This
 * has NOT been exercised against a live Nexara account in this environment
 * (no API key available here) -- if a live response's field names differ
 * from what parseNexaraTranscript() in pipeline-lab-v3.html expects
 * (segment.speaker/.speaker_id/.speaker_label, segment.text), the client
 * falls back to the flat `.text` field alone rather than guessing further.
 *
 * Routed server-side for the same reason as /api/openai-proxy: the
 * browser-held API key never needs a CORS allowance from a third-party
 * vendor, and this route has no state and does not log or store the key
 * or the audio -- both exist only for the duration of this one request,
 * proxied through unmodified except for re-attaching the Authorization
 * header server-side.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: { message: "Expected multipart/form-data body." } }, { status: 400 });
  }

  const apiKey = incoming.get("apiKey");
  const file = incoming.get("file");
  if (typeof apiKey !== "string" || !apiKey.trim() || !(file instanceof Blob)) {
    return NextResponse.json({ error: { message: "Expected multipart fields: apiKey (string), file (Blob)." } }, { status: 400 });
  }

  const upstreamBody = new FormData();
  upstreamBody.append("file", file, (file as File).name || "audio");
  for (const field of ["response_format", "task", "num_speakers", "language"]) {
    const value = incoming.get(field);
    if (typeof value === "string" && value.trim()) upstreamBody.append(field, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.nexara.ru/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamBody,
    });
  } catch (error) {
    return NextResponse.json({ error: { message: `Nexara request failed: ${error instanceof Error ? error.message : String(error)}` } }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  }
  const text = await upstream.text().catch(() => "");
  if (!upstream.ok) return NextResponse.json({ error: { message: text || `Nexara API ${upstream.status}` } }, { status: upstream.status });
  return NextResponse.json({ text }, { status: 200 });
}
