import type { FloorPlanGenerationOptions, FloorPlanScene, FloorPlanStyle } from "../domain/schema";

export const FLOOR_PLAN_QA_PROMPT_VERSION = "floor-plan-qa-v2";

export const FLOOR_PLAN_QA_PROMPT = `Compare image 1 (ORIGINAL) with image 2 (GENERATED). Return only the required QA JSON.

Check room count, topology and relative layout, walls, windows, doors, door swings, balconies or loggias, labels, areas, dimensions, fixtures and every other factual element. Hallucination checking is strict: any factual element or number introduced without support from the original or JSON is an error. Cosmetic style differences are allowed only when geometry and facts are unchanged.

Set passed=false for any geometry/topology change, missing or added opening/window/door/room, changed door swing, invented factual label/number, or other critical discrepancy. Use score from 0 to 1 and explain every failed check concisely without proposing unsupported geometry.`;

export function buildFloorPlanQaPrompt(scene: FloorPlanScene, prompt = FLOOR_PLAN_QA_PROMPT, style: FloorPlanStyle = "standard", options?: FloorPlanGenerationOptions): string {
  return `${prompt.trim()}

NON-NEGOTIABLE QA RESPONSE RULES:
- Write errors, warnings and every checks.*.details value only in Russian.
- errors must contain only actual defects. Never put a successful observation such as "no discrepancy detected" into errors.
- warnings must contain only issues requiring attention. Do not list successful matches or harmless cleanup as warnings.
- If geometry and factual content match and only allowed cosmetic styling differs, passed must be true and score must be at least 0.9.
- Any unreadable, uncertain or question-mark annotation copied into the generated image is a hallucination error. State clearly in Russian which unsupported label must be removed.
- Numeric sourceLabel values are room indexes, not semantic room names. Their presence in the generated image is an error even when room names are enabled.
- Enforce the rendering switches below: content marked "hide" must be completely absent from the generated image.

Selected style: ${style}
Rendering switches:
- semantic room names: ${options?.roomNames ? "show only confirmed room.name values" : "hide"}
- room areas: ${options?.roomAreas ? "show only confirmed room.area values" : "hide"}
- wall dimensions: ${options?.wallDimensions ? "show only confirmed dimensions" : "hide"}
- cardinal directions: ${options?.cardinalDirections ? "show only when explicitly confirmed" : "hide"}
- furniture: ${options?.furniture ? "show only confirmed furniture" : "hide"}

FloorPlan JSON:
${JSON.stringify(scene)}`;
}
