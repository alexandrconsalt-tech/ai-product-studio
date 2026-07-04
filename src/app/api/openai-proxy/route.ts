import { NextResponse } from "next/server";

/**
 * Stateless relay for public/pipeline-lab-v3.html's OpenAI-model steps.
 *
 * Why this exists: OpenAI's REST API does not send CORS headers for
 * arbitrary browser origins, so `fetch("https://api.openai.com/...")`
 * called directly from that page's client-side JS fails with a
 * network-level "Failed to fetch" before any response body is even
 * readable -- confirmed live, not assumed (Anthropic's API, by
 * contrast, explicitly supports direct-browser calls via its
 * `anthropic-dangerous-direct-browser-access` header, which is why
 * only OpenAI needs this route).
 *
 * The caller's API key travels in the request body for this one
 * request only -- never stored, logged, or persisted here. This route
 * has no state and no dependency on anything else in this app.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.apiKey !== "string" || typeof body.model !== "string" || typeof body.prompt !== "string") {
    return NextResponse.json({ error: { message: "Expected JSON body with apiKey, model, prompt (all strings)." } }, { status: 400 });
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify({ model: body.model, messages: [{ role: "user", content: body.prompt }] }),
  });

  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
