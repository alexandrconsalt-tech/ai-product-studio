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

function errorResponse(input: {
  status: number;
  errorCode: string;
  errorMessage: string;
  provider: string | null;
  model: string | null;
  rawResponseAvailable: boolean;
}) {
  return NextResponse.json({
    error_code: input.errorCode,
    error_message: input.errorMessage,
    provider: input.provider,
    model: input.model,
    raw_response_available: input.rawResponseAvailable,
  }, { status: input.status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!body.provider || !body.apiKey || !body.model || !body.prompt || !body.schemaName || !body.jsonSchema) {
      return errorResponse({ status: 400, errorCode: "invalid_request", errorMessage: "Не заполнены обязательные параметры запроса.", provider: body.provider ?? null, model: body.model ?? null, rawResponseAvailable: false });
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
      if (!response.ok) {
        return errorResponse({
          status: response.status,
          errorCode: String(data?.error?.type ?? `anthropic_http_${response.status}`),
          errorMessage: String(data?.error?.message ?? `Anthropic вернул HTTP ${response.status}.`),
          provider: body.provider,
          model: body.model,
          rawResponseAvailable: true,
        });
      }
      const tool = Array.isArray(data.content) ? data.content.find((item: { type?: string; name?: string }) => item.type === "tool_use" && item.name === body.schemaName) : null;
      if (!tool?.input) {
        return errorResponse({ status: 502, errorCode: "empty_structured_output", errorMessage: "Anthropic не вернул обязательный структурированный результат.", provider: body.provider, model: String(data.model ?? body.model), rawResponseAvailable: true });
      }
      return NextResponse.json({ output: tool.input, model: data.model ?? body.model, provider: body.provider, raw_response_available: true });
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
    if (!response.ok) {
      return errorResponse({
        status: response.status,
        errorCode: String(data?.error?.code ?? data?.error?.type ?? `provider_http_${response.status}`),
        errorMessage: String(data?.error?.message ?? `Провайдер вернул HTTP ${response.status}.`),
        provider: body.provider,
        model: body.model,
        rawResponseAvailable: true,
      });
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return errorResponse({ status: 502, errorCode: "empty_structured_output", errorMessage: "Провайдер не вернул структурированный результат.", provider: body.provider, model: String(data.model ?? body.model), rawResponseAvailable: true });
    }
    try {
      return NextResponse.json({ output: JSON.parse(content), model: data.model ?? body.model, provider: body.provider, raw_response_available: true });
    } catch {
      return errorResponse({ status: 502, errorCode: "invalid_json", errorMessage: "Провайдер вернул некорректный JSON.", provider: body.provider, model: String(data.model ?? body.model), rawResponseAvailable: true });
    }
  } catch (error) {
    return errorResponse({
      status: 500,
      errorCode: "internal_error",
      errorMessage: error instanceof Error ? error.message : "Внутренняя ошибка API.",
      provider: null,
      model: null,
      rawResponseAvailable: false,
    });
  }
}
