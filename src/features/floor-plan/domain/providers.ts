import type { FloorPlanQa, FloorPlanScene } from "./schema";

export type FloorPlanSource = { bytes: Uint8Array; mimeType: string; filename: string; width: number; height: number; page: number };
export type AiCallMetadata = { model: string; modelVersion: string | null; usage: Record<string, number> | null; costRub: number | null };
export type ImageResult = AiCallMetadata & { dataUrl: string; mimeType: string };
export type RecognitionResult = AiCallMetadata & { scene: FloorPlanScene };
export type QaResult = AiCallMetadata & { qa: FloorPlanQa };

export interface FloorPlanImageProvider {
  readonly name: "ai-tunnel";
  generate(references: FloorPlanSource[], instructions: string): Promise<ImageResult>;
}

export interface FloorPlanVisionProvider {
  readonly name: "ai-tunnel";
  analyze(source: FloorPlanSource, instructions: string): Promise<RecognitionResult>;
  verify(original: FloorPlanSource, generated: FloorPlanSource, instructions: string): Promise<QaResult>;
}
