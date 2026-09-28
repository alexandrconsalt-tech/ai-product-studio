import type { FloorPlanGenerationOptions, FloorPlanQa, FloorPlanScene, FloorPlanStyle } from "../domain/schema";

export const FLOOR_PLAN_FIX_PROMPT_VERSION = "floor-plan-fix-v2";

export const FLOOR_PLAN_FIX_PROMPT = `Correct the generated 2D floor plan using image 1 as the ORIGINAL source and image 2 as the GENERATED result.

Fix only the listed QA discrepancies. Preserve every other part of the generated image. Geometry and topology are more important than appearance. Never invent rooms, walls, openings, windows, doors, door swings, labels, numbers, compass directions, fixtures or furniture.`;

export function buildFloorPlanFixPrompt(scene: FloorPlanScene, qa: FloorPlanQa, prompt = FLOOR_PLAN_FIX_PROMPT, style: FloorPlanStyle = "standard", options?: FloorPlanGenerationOptions): string {
  return `${prompt.trim()}

QA errors:
${qa.errors.map((error) => `- ${error}`).join("\n") || "- QA score was below the acceptance threshold; align the result more precisely with the original."}

NON-NEGOTIABLE CORRECTION RULES:
- Completely erase every unsupported, unreadable or uncertain annotation identified by QA, including tokens containing "?". Do not replace it with guessed text.
- Do not render numeric sourceLabel values as room names.
- Keep the clean top-down reference style: pure white background, thick solid dark-graphite walls, thin gray door swing arcs and exact confirmed area labels only.
- Return only the corrected image without comments, legends or new annotations.

Selected style: ${style}
Rendering switches that must remain enforced:
- semantic room names: ${options?.roomNames ? "show only confirmed room.name values" : "hide"}
- room areas: ${options?.roomAreas ? "show only confirmed room.area values" : "hide"}
- wall dimensions: ${options?.wallDimensions ? "show only confirmed dimensions" : "hide"}
- cardinal directions: ${options?.cardinalDirections ? "show only when explicitly confirmed" : "hide"}
- furniture: ${options?.furniture ? "show only confirmed furniture" : "hide"}

Authoritative FloorPlan JSON:
${JSON.stringify(scene)}`;
}
