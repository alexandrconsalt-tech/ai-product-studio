import { z } from "zod";
import type { FloorPlanImageProvider, FloorPlanSource, FloorPlanVisionProvider, ImageResult, QaResult, RecognitionResult } from "../domain/providers";
import { floorPlanQaSchema, floorPlanSceneSchema } from "../domain/schema";
import { normalizeFloorPlanQa } from "../domain/normalize-qa";

function usageNumbers(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) if (typeof item === "number") result[key] = item;
  return Object.keys(result).length ? result : null;
}

function costRub(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  for (const key of ["cost_rub", "costRub", "cost"]) if (typeof usage[key] === "number") return usage[key];
  return null;
}

class AiTunnelHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function checkedJson(response: Response, operation: string): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    throw new AiTunnelHttpError(response.status, `${operation}: ${details ?? `HTTP ${response.status}`}`);
  }
  return payload;
}

type JsonSchema = Record<string, any>;

function strictJsonSchema(value: JsonSchema): JsonSchema {
  const schema = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$schema" && key !== "default"));
  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const originallyRequired = new Set(Array.isArray(schema.required) ? schema.required : []);
    schema.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, property]) => {
      const normalized = strictJsonSchema(property as JsonSchema);
      return [key, originallyRequired.has(key) ? normalized : { anyOf: [normalized, { type: "null" }] }];
    }));
    schema.required = Object.keys(schema.properties);
  }
  if (schema.items && typeof schema.items === "object") schema.items = strictJsonSchema(schema.items);
  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(schema[keyword])) schema[keyword] = schema[keyword].map((item: JsonSchema) => strictJsonSchema(item));
  }
  return schema;
}

function removeSyntheticNulls(value: unknown, schema: JsonSchema): unknown {
  if (Array.isArray(value)) return value.map((item) => removeSyntheticNulls(item, schema.items ?? {}));
  if (!value || typeof value !== "object" || schema.type !== "object" || !schema.properties) return value;
  const originallyRequired = new Set(Array.isArray(schema.required) ? schema.required : []);
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (item === null && !originallyRequired.has(key)) return [];
    return [[key, removeSyntheticNulls(item, schema.properties[key] ?? {})]];
  }));
}

function dataUrl(source: FloorPlanSource): string {
  return `data:${source.mimeType};base64,${Buffer.from(source.bytes).toString("base64")}`;
}

export function normalizeAiTunnelBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  const url = new URL(normalized);
  if (url.protocol !== "https:" || url.hostname !== "api.aitunnel.ru" || url.pathname !== "/v1") {
    throw new Error("Для AI Floor Plan разрешён только официальный Base URL https://api.aitunnel.ru/v1.");
  }
  return url.toString().replace(/\/$/, "");
}

export class AiTunnelFloorPlanImageProvider implements FloorPlanImageProvider {
  readonly name = "ai-tunnel" as const;
  constructor(private readonly apiKey: string, private readonly baseUrl: string, private readonly model: string) {}

  async generate(references: FloorPlanSource[], instructions: string): Promise<ImageResult> {
    if (!references.length) throw new Error("AI Tunnel image: reference image is required.");
    const payload = await checkedJson(await fetch(`${normalizeAiTunnelBaseUrl(this.baseUrl)}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model: this.model,
        prompt: instructions,
        n: 1,
        input_references: references.map((source) => ({ type: "image_url", image_url: { url: dataUrl(source) } })),
      }),
    }), "AI Tunnel image");
    const encoded = payload?.data?.[0]?.b64_json;
    if (typeof encoded !== "string") throw new Error("AI Tunnel image: изображение не возвращено.");
    const mimeType = typeof payload?.data?.[0]?.media_type === "string" ? payload.data[0].media_type : "image/png";
    return { dataUrl: `data:${mimeType};base64,${encoded}`, mimeType, model: this.model, modelVersion: payload?.model ?? null, usage: usageNumbers(payload?.usage), costRub: costRub(payload?.usage) };
  }
}

export class AiTunnelFloorPlanVisionProvider implements FloorPlanVisionProvider {
  readonly name = "ai-tunnel" as const;
  constructor(private readonly apiKey: string, private readonly baseUrl: string, private readonly model: string) {}

  private async structured<T>(sources: FloorPlanSource[], instructions: string, schemaName: string, schema: z.ZodType<T>): Promise<{ value: T; payload: any }> {
    const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
    const request = async (responseFormat: JsonSchema) => checkedJson(await fetch(`${normalizeAiTunnelBaseUrl(this.baseUrl)}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }, signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({ model: this.model,
        messages: [{ role: "user", content: [{ type: "text", text: instructions }, ...sources.map((source) => ({ type: "image_url", image_url: { url: dataUrl(source), detail: "high" } }))] }],
        response_format: responseFormat,
      }),
    }), "AI Tunnel vision");
    let payload: any;
    try {
      payload = await request({ type: "json_schema", json_schema: { name: schemaName, strict: true, schema: strictJsonSchema(jsonSchema) } });
    } catch (error) {
      if (!(error instanceof AiTunnelHttpError) || (error.status !== 400 && error.status !== 422)) throw error;
      payload = await request({ type: "json_object" });
    }
    const content = payload?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.find((part) => typeof part?.text === "string")?.text : null;
    if (!text) throw new Error("AI Tunnel vision: структурированный ответ не возвращён.");
    return { value: schema.parse(removeSyntheticNulls(JSON.parse(text), jsonSchema)), payload };
  }

  async analyze(source: FloorPlanSource, instructions: string): Promise<RecognitionResult> {
    const { value, payload } = await this.structured([source], instructions, "floor_plan_analysis", floorPlanSceneSchema);
    return { scene: value, model: this.model, modelVersion: payload?.model ?? null, usage: usageNumbers(payload?.usage), costRub: costRub(payload?.usage) };
  }

  async verify(original: FloorPlanSource, generated: FloorPlanSource, instructions: string): Promise<QaResult> {
    const { value, payload } = await this.structured([original, generated], instructions, "floor_plan_qa", floorPlanQaSchema);
    const qa = normalizeFloorPlanQa(value);
    return { qa, model: this.model, modelVersion: payload?.model ?? null, usage: usageNumbers(payload?.usage), costRub: costRub(payload?.usage) };
  }
}
