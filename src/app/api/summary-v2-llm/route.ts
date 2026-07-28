import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestBody = {
  provider?: "ai-tunnel" | "openai-direct" | "anthropic-direct";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  prompt?: string;
  schemaName?: string;
  jsonSchema?: Record<string, unknown>;
};

function safeTunnelBaseUrl(value: string | undefined): string {
  const url = new URL(value || "https://api.aitunnel.ru/v1");
  if (url.protocol !== "https:" || url.hostname !== "api.aitunnel.ru") throw new Error("unsupported_ai_tunnel_url");
  return url.toString().replace(/\/+$/, "");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!body.provider || !body.apiKey || !body.model || !body.prompt || !body.schemaName || !body.jsonSchema) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    if (body.provider === "anthropic-direct") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": body.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: body.model.replace("claude-sonnet-4.5", "claude-sonnet-4-5"),
          max_tokens: 6000,
          messages: [{ role: "user", content: body.prompt }],
          tools: [{ name: body.schemaName, description: "Return validated structured output", input_schema: body.jsonSchema }],
          tool_choice: { type: "tool", name: body.schemaName },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json({ error: data?.error?.message ?? `anthropic_${response.status}` }, { status: response.status });
      const tool = Array.isArray(data.content) ? data.content.find((item: { type?: string; name?: string }) => item.type === "tool_use" && item.name === body.schemaName) : null;
      if (!tool?.input) return NextResponse.json({ error: "empty_structured_output" }, { status: 502 });
      return NextResponse.json({ output: tool.input, model: data.model ?? body.model });
    }

    const baseUrl = body.provider === "ai-tunnel" ? safeTunnelBaseUrl(body.baseUrl) : "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${body.apiKey}` },
      body: JSON.stringify({
        model: body.model,
        messages: [{ role: "user", content: body.prompt }],
        response_format: {
          type: "json_schema",
          json_schema: { name: body.schemaName, strict: true, schema: body.jsonSchema },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.error?.message ?? `provider_${response.status}` }, { status: response.status });
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "empty_structured_output" }, { status: 502 });
    return NextResponse.json({ output: JSON.parse(content), model: data.model ?? body.model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "internal_error" }, { status: 500 });
  }
}
