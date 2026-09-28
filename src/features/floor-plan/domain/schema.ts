import { z } from "zod";

const unit = z.number().min(0).max(1);
const pointSchema = z.object({ x: unit, y: unit });
const confidenceSchema = z.number().min(0).max(1);
const sourceReferenceSchema = z.object({ page: z.number().int().positive().optional(), note: z.string().optional() }).optional();
const baseElement = z.object({ id: z.string().min(1), confidence: confidenceSchema, sourceReference: sourceReferenceSchema });

export const wallSchema = baseElement.extend({
  type: z.enum(["exterior", "interior"]), start: pointSchema, end: pointSchema, thickness: unit,
});
export const roomSchema = baseElement.extend({
  type: z.literal("room").default("room"), sourceLabel: z.string().optional(), name: z.string().optional(),
  polygon: z.array(pointSchema).min(3), area: z.object({ value: z.number().positive(), confidence: confidenceSchema }).nullable().optional(),
});
export const doorSchema = baseElement.extend({
  type: z.literal("door").default("door"), wallId: z.string(), position: unit, width: unit,
  swing: z.enum(["left_in", "right_in", "left_out", "right_out", "unknown"]),
});
export const windowSchema = baseElement.extend({ type: z.literal("window").default("window"), wallId: z.string(), position: unit, width: unit });
export const openingSchema = baseElement.extend({ type: z.literal("opening").default("opening"), wallId: z.string(), position: unit, width: unit });
export const polygonElementSchema = baseElement.extend({
  type: z.enum(["balcony", "loggia"]), polygon: z.array(pointSchema).min(3), label: z.string().optional(),
});
export const fixtureSchema = baseElement.extend({
  type: z.enum(["toilet", "bath", "shower", "sink", "stove", "kitchen", "other"]),
  position: pointSchema, width: unit, height: unit, label: z.string().optional(),
});
export const dimensionSchema = baseElement.extend({ type: z.literal("dimension").default("dimension"), start: pointSchema, end: pointSchema, label: z.string() });
export const labelSchema = baseElement.extend({ type: z.literal("label").default("label"), position: pointSchema, text: z.string() });
export const furnitureSchema = baseElement.extend({
  type: z.enum(["bed", "sofa", "table", "chair", "wardrobe", "cabinet", "other"]),
  position: pointSchema, width: unit, height: unit, label: z.string().optional(),
});

const measuredAreaSchema = z.object({ value: z.number().positive(), source: z.enum(["ocr", "document", "derived"]), confidence: confidenceSchema }).nullable();
const ambiguitySchema = z.object({
  id: z.string(), message: z.string(), confidence: confidenceSchema,
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2).max(4),
});

export const floorPlanSceneSchema = z.object({
  document: z.object({
    type: z.enum(["bti_plan", "technical_plan", "technical_passport", "architectural_plan", "scan", "photo", "marketing_plan", "hand_drawn", "unknown"]),
    confidence: confidenceSchema,
  }),
  floorPlan: z.object({
    sourceWidth: z.number().positive(), sourceHeight: z.number().positive(),
    walls: z.array(wallSchema), rooms: z.array(roomSchema), doors: z.array(doorSchema), windows: z.array(windowSchema),
    openings: z.array(openingSchema), balconies: z.array(polygonElementSchema), fixtures: z.array(fixtureSchema),
    furniture: z.array(furnitureSchema).default([]), dimensions: z.array(dimensionSchema), labels: z.array(labelSchema),
  }),
  areas: z.object({ total: measuredAreaSchema, living: measuredAreaSchema }),
  sourceFacts: z.array(z.object({ key: z.string(), value: z.string(), confidence: confidenceSchema, sourceReference: sourceReferenceSchema })).default([]),
  warnings: z.array(z.string()).default([]),
  confidence: z.object({ geometry: confidenceSchema, ocr: confidenceSchema, topology: confidenceSchema, overall: confidenceSchema }),
  ambiguities: z.array(ambiguitySchema).default([]),
});

export type FloorPlanScene = z.infer<typeof floorPlanSceneSchema>;
export type FloorPlanAmbiguity = z.infer<typeof ambiguitySchema>;

export type ValidationIssue = { code: string; message: string; elementIds: string[] };
export type FloorPlanValidation = { errors: ValidationIssue[]; warnings: ValidationIssue[] };

const qaCheckSchema = z.object({ passed: z.boolean(), score: confidenceSchema, details: z.string() });
export const floorPlanQaSchema = z.object({
  passed: z.boolean(),
  score: confidenceSchema,
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  checks: z.object({
    roomCount: qaCheckSchema, topology: qaCheckSchema, walls: qaCheckSchema, windows: qaCheckSchema,
    doors: qaCheckSchema, doorSwings: qaCheckSchema, balconies: qaCheckSchema, labels: qaCheckSchema,
    areas: qaCheckSchema, dimensions: qaCheckSchema, fixtures: qaCheckSchema, hallucinations: qaCheckSchema,
  }),
});
export type FloorPlanQa = z.infer<typeof floorPlanQaSchema>;

export type FloorPlanStyle = "vladis" | "standard";
export type FloorPlanGenerationOptions = {
  roomNames: boolean; roomAreas: boolean; wallDimensions: boolean; cardinalDirections: boolean; furniture: boolean;
};
export type FloorPlanPipelineStatus = "uploaded" | "analyzing" | "generating" | "verifying" | "fixing" | "completed" | "failed";
export type FloorPlanPipelineStage = "analysis" | "generation" | "qa" | "fix" | "qa-after-fix";
export type FloorPlanStageTelemetry = {
  stage: FloorPlanPipelineStage; provider: string; model: string; durationMs: number;
  usage: Record<string, number> | null; costRub: number | null; error?: string;
};

export const evaluationChecklist = [
  "walls", "rooms", "windows", "doors", "openings", "areas", "dimensions", "balconies", "fixtures", "noInvented", "publishableWithoutFixes",
] as const;
export type EvaluationCheck = (typeof evaluationChecklist)[number];
export type FloorPlanEvaluation = {
  checklist: Record<EvaluationCheck, boolean>; geometryAccuracy: number; sourceFidelity?: number; visualQuality: number;
  manualCorrections: "0" | "1" | "2" | "3" | "4" | "5+"; publishable: boolean; criticalGeometryError: boolean; comment: string;
};

export type FloorPlanPipeline = "direct" | "structured" | "end-to-end";
export type FloorPlanProvider = "model-a" | "model-b";
export type ExperimentRun = {
  id: string; timestamp: string; source: { name: string; type: string; width: number; height: number; page: number; pages: number };
  sourceHash: string; provider: FloorPlanProvider; model: string; modelVersion: string | null; pipeline: FloorPlanPipeline;
  promptVersion: string; processingTime: number; result: { kind: "image" | "svg"; artifactStored: boolean } | null;
  structuredResult: FloorPlanScene | null; validation: FloorPlanValidation | null; userEvaluation: FloorPlanEvaluation | null;
  estimatedCost: number | null; usage: Record<string, number> | null; error: string | null;
  pipelineId?: string; status?: FloorPlanPipelineStatus; style?: FloorPlanStyle; generationOptions?: FloorPlanGenerationOptions;
  qa?: FloorPlanQa | null; autoFixAttempts?: number; stageTelemetry?: FloorPlanStageTelemetry[]; totalDuration?: number; selectedAsFinal?: boolean;
};
