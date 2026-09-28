import type { FloorPlanGenerationOptions, FloorPlanScene, FloorPlanStyle } from "../domain/schema";

export const FLOOR_PLAN_GENERATION_PROMPT_VERSION = "floor-plan-generation-v2";

export const FLOOR_PLAN_GENERATION_PROMPT = `Create a visually improved 2D floor plan of the exact same property shown in the reference image.

CRITICAL: geometry is more important than beauty. Do not move, add, remove, merge or split rooms, walls, openings, windows or doors. Preserve every door swing. Do not invent areas, dimensions, labels, compass directions, fixtures, furniture or other factual data. If a requested item is not supported by the source image or FloorPlan JSON, omit it.`;

const styles: Record<FloorPlanStyle, string> = {
  vladis: "Vladis preset: clean orthographic real-estate floor plan on a pure white background, thick solid dark-graphite walls, thin gray door leaves and swing arcs, precise white window openings, restrained red brand accents and only the logo demonstrated by the supplied style reference.",
  standard: "Standard preset: clean orthographic real-estate floor plan on a pure white background, thick solid dark-graphite walls, thin gray door leaves and swing arcs, precise white window openings, black centered area labels, no logo, no branding, no texture, no perspective and no decorative elements.",
};

export function buildFloorPlanGenerationPrompt(scene: FloorPlanScene, style: FloorPlanStyle, options: FloorPlanGenerationOptions, prompt = FLOOR_PLAN_GENERATION_PROMPT): string {
  return `${prompt.trim()}

${styles[style]}
Additional reference images, when supplied, are authoritative for visual treatment only: wall weight, colors, typography, doors, windows and logo placement. Never copy their apartment geometry, room count, labels or values.

Rendering options:
- room names: ${options.roomNames ? "show only when present in source facts" : "hide"}
- room areas: ${options.roomAreas ? "show only explicit source values" : "hide"}
- wall dimensions: ${options.wallDimensions ? "show only explicit source values" : "hide"}
- cardinal directions: ${options.cardinalDirections ? "show only if explicitly present in the source" : "hide"}
- furniture: ${options.furniture ? "show only furniture visible and recorded in the JSON" : "hide"}

NON-NEGOTIABLE OUTPUT RULES:
- Produce a straight top-down 2D plan filling the canvas with comfortable white margins. No perspective, shadows, gradients, paper texture or photorealism.
- Never reproduce an unreadable OCR fragment or any token containing "?", replacement characters or incomplete text. Omit it completely.
- Numeric room indexes such as 1, 2, 5 or 6 are not room names and must not be rendered when no semantic room name was recognized.
- Render a room area only from room.area with confidence >= 0.85. Use the exact value and the format "12.0 м²"; never estimate or recalculate it.
- Render a room name only when room.name contains a clearly recognized semantic name. Never substitute sourceLabel for room.name.
- Do not add explanatory text, legends, unknown annotations or labels outside the plan.
- Preserve the complete exterior contour, every interior wall, opening, door swing and window exactly as established by the source and JSON.

Authoritative extracted FloorPlan JSON:
${JSON.stringify(scene)}`;
}
