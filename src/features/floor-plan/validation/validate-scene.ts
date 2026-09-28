import type { FloorPlanScene, FloorPlanValidation, ValidationIssue } from "../domain/schema";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const intersects = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) =>
  Math.sign(cross(a, b, c)) !== Math.sign(cross(a, b, d)) && Math.sign(cross(c, d, a)) !== Math.sign(cross(c, d, b));

function issue(code: string, message: string, ...elementIds: string[]): ValidationIssue {
  return { code, message, elementIds };
}

export function validateFloorPlanScene(scene: FloorPlanScene): FloorPlanValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const walls = new Map(scene.floorPlan.walls.map((wall) => [wall.id, wall]));

  for (const wall of scene.floorPlan.walls) {
    if (distance(wall.start, wall.end) < 0.008) warnings.push(issue("short_wall", "Очень короткий сегмент стены.", wall.id));
  }
  for (const room of scene.floorPlan.rooms) {
    const points = room.polygon;
    for (let index = 0; index < points.length; index += 1) {
      for (let other = index + 2; other < points.length; other += 1) {
        if (index === 0 && other === points.length - 1) continue;
        if (intersects(points[index], points[(index + 1) % points.length], points[other], points[(other + 1) % points.length])) {
          errors.push(issue("self_intersection", "Полигон помещения имеет самопересечение.", room.id));
        }
      }
    }
  }
  for (const element of [...scene.floorPlan.doors, ...scene.floorPlan.windows, ...scene.floorPlan.openings]) {
    if (!walls.has(element.wallId)) errors.push(issue("missing_wall_reference", "Элемент не привязан к существующей стене.", element.id, element.wallId));
  }
  const ids = new Set<string>();
  const all = [
    ...scene.floorPlan.walls, ...scene.floorPlan.rooms, ...scene.floorPlan.doors, ...scene.floorPlan.windows,
    ...scene.floorPlan.openings, ...scene.floorPlan.balconies, ...scene.floorPlan.fixtures, ...scene.floorPlan.dimensions, ...scene.floorPlan.labels,
  ];
  for (const element of all) {
    if (ids.has(element.id)) errors.push(issue("duplicate_id", "Обнаружен дублирующийся идентификатор элемента.", element.id));
    ids.add(element.id);
    if (element.confidence < 0.7) warnings.push(issue("low_confidence", "Элемент требует ручной проверки.", element.id));
  }
  const wallPairs = new Set<string>();
  for (const wall of scene.floorPlan.walls) {
    const key = [wall.start.x, wall.start.y, wall.end.x, wall.end.y].map((value) => value.toFixed(4)).join(":");
    const reverse = [wall.end.x, wall.end.y, wall.start.x, wall.start.y].map((value) => value.toFixed(4)).join(":");
    if (wallPairs.has(key) || wallPairs.has(reverse)) warnings.push(issue("duplicate_wall", "Возможный дубликат стены.", wall.id));
    wallPairs.add(key);
  }
  return { errors, warnings };
}
