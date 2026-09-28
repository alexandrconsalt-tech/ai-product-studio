import * as React from "react";
import type { FloorPlanScene } from "../domain/schema";

export type FloorPlanTheme = {
  background: string; wall: string; exteriorWall: string; opening: string; window: string; label: string; lowConfidence: string;
};

export const defaultFloorPlanTheme: FloorPlanTheme = {
  background: "#ffffff", wall: "#1e293b", exteriorWall: "#0f172a", opening: "#ffffff", window: "#38bdf8", label: "#334155", lowConfidence: "#f59e0b",
};

const SIZE = 1000;
const px = (value: number) => value * SIZE;

function wallPoint(scene: FloorPlanScene, wallId: string, position: number) {
  const wall = scene.floorPlan.walls.find((item) => item.id === wallId);
  if (!wall) return null;
  return {
    x: px(wall.start.x + (wall.end.x - wall.start.x) * position),
    y: px(wall.start.y + (wall.end.y - wall.start.y) * position),
    angle: Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180 / Math.PI,
  };
}

export function FloorPlanSvg({ scene, theme = defaultFloorPlanTheme, title = "Распознанная планировка" }: { scene: FloorPlanScene; theme?: FloorPlanTheme; title?: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title} className="h-full w-full bg-white">
      <rect width={SIZE} height={SIZE} fill={theme.background} />
      {scene.floorPlan.balconies.map((item) => <polygon key={item.id} points={item.polygon.map((p) => `${px(p.x)},${px(p.y)}`).join(" ")} fill="#e2e8f0" stroke={theme.wall} strokeWidth="4" strokeDasharray={item.type === "loggia" ? "12 8" : undefined} />)}
      {scene.floorPlan.rooms.map((room) => <polygon key={room.id} points={room.polygon.map((p) => `${px(p.x)},${px(p.y)}`).join(" ")} fill="#f8fafc" stroke="none" />)}
      {scene.floorPlan.walls.map((wall) => <line key={wall.id} x1={px(wall.start.x)} y1={px(wall.start.y)} x2={px(wall.end.x)} y2={px(wall.end.y)} stroke={wall.confidence < 0.7 ? theme.lowConfidence : wall.type === "exterior" ? theme.exteriorWall : theme.wall} strokeWidth={Math.max(5, px(wall.thickness))} strokeLinecap="square" />)}
      {[...scene.floorPlan.doors, ...scene.floorPlan.openings].map((opening) => {
        const point = wallPoint(scene, opening.wallId, opening.position); if (!point) return null;
        return <line key={opening.id} x1={-px(opening.width) / 2} y1="0" x2={px(opening.width) / 2} y2="0" stroke={theme.opening} strokeWidth="22" transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`} />;
      })}
      {scene.floorPlan.windows.map((window) => {
        const point = wallPoint(scene, window.wallId, window.position); if (!point) return null;
        return <g key={window.id} transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}><line x1={-px(window.width) / 2} x2={px(window.width) / 2} stroke={theme.window} strokeWidth="12" /><line x1={-px(window.width) / 2} x2={px(window.width) / 2} y1="-7" y2="-7" stroke="#e0f2fe" strokeWidth="3" /></g>;
      })}
      {scene.floorPlan.doors.map((door) => {
        const point = wallPoint(scene, door.wallId, door.position); if (!point) return null;
        const flip = door.swing.includes("left") ? -1 : 1;
        return <g key={`${door.id}-swing`} transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}><line x2={flip * px(door.width)} y2={-px(door.width)} stroke={theme.wall} strokeWidth="4" /><path d={`M 0 0 A ${px(door.width)} ${px(door.width)} 0 0 ${flip > 0 ? 0 : 1} ${flip * px(door.width)} ${-px(door.width)}`} fill="none" stroke="#94a3b8" strokeWidth="3" strokeDasharray="6 4" /></g>;
      })}
      {scene.floorPlan.rooms.map((room) => {
        const center = room.polygon.reduce((acc, point) => ({ x: acc.x + point.x / room.polygon.length, y: acc.y + point.y / room.polygon.length }), { x: 0, y: 0 });
        return <text key={`${room.id}-label`} x={px(center.x)} y={px(center.y)} textAnchor="middle" fill={theme.label} fontSize="24" fontFamily="Arial, sans-serif"><tspan x={px(center.x)}>{room.name ?? room.sourceLabel ?? ""}</tspan>{room.area ? <tspan x={px(center.x)} dy="28">{room.area.value} м²</tspan> : null}</text>;
      })}
      {scene.floorPlan.labels.map((label) => <text key={label.id} x={px(label.position.x)} y={px(label.position.y)} textAnchor="middle" fill={theme.label} fontSize="18">{label.text}</text>)}
      {scene.floorPlan.dimensions.map((dimension) => <g key={dimension.id}><line x1={px(dimension.start.x)} y1={px(dimension.start.y)} x2={px(dimension.end.x)} y2={px(dimension.end.y)} stroke="#64748b" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" /><text x={px((dimension.start.x + dimension.end.x) / 2)} y={px((dimension.start.y + dimension.end.y) / 2) - 8} textAnchor="middle" fill={theme.label} fontSize="16">{dimension.label}</text></g>)}
      {scene.floorPlan.fixtures.map((fixture) => <g key={fixture.id}><rect x={px(fixture.position.x - fixture.width / 2)} y={px(fixture.position.y - fixture.height / 2)} width={px(fixture.width)} height={px(fixture.height)} rx="8" fill="none" stroke="#64748b" strokeWidth="3" /><text x={px(fixture.position.x)} y={px(fixture.position.y) + 5} textAnchor="middle" fontSize="13" fill={theme.label}>{fixture.label ?? fixture.type}</text></g>)}
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>
    </svg>
  );
}

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character);

export function renderFloorPlanSvg(scene: FloorPlanScene, theme = defaultFloorPlanTheme): string {
  const walls = scene.floorPlan.walls.map((wall) => `<line x1="${px(wall.start.x)}" y1="${px(wall.start.y)}" x2="${px(wall.end.x)}" y2="${px(wall.end.y)}" stroke="${wall.confidence < 0.7 ? theme.lowConfidence : wall.type === "exterior" ? theme.exteriorWall : theme.wall}" stroke-width="${Math.max(5, px(wall.thickness))}" stroke-linecap="square"/>`).join("");
  const rooms = scene.floorPlan.rooms.map((room) => {
    const center = room.polygon.reduce((acc, point) => ({ x: acc.x + point.x / room.polygon.length, y: acc.y + point.y / room.polygon.length }), { x: 0, y: 0 });
    const text = [room.name ?? room.sourceLabel, room.area ? `${room.area.value} м²` : null].filter(Boolean).join(" · ");
    return `<polygon points="${room.polygon.map((p) => `${px(p.x)},${px(p.y)}`).join(" ")}" fill="#f8fafc"/><text x="${px(center.x)}" y="${px(center.y)}" text-anchor="middle" fill="${theme.label}" font-size="22" font-family="Arial">${escapeXml(text)}</text>`;
  }).join("");
  const windows = scene.floorPlan.windows.map((window) => { const point = wallPoint(scene, window.wallId, window.position); return point ? `<line x1="${-px(window.width) / 2}" x2="${px(window.width) / 2}" stroke="${theme.window}" stroke-width="12" transform="translate(${point.x} ${point.y}) rotate(${point.angle})"/>` : ""; }).join("");
  const gaps = [...scene.floorPlan.doors, ...scene.floorPlan.openings].map((opening) => { const point = wallPoint(scene, opening.wallId, opening.position); return point ? `<line x1="${-px(opening.width) / 2}" x2="${px(opening.width) / 2}" stroke="${theme.opening}" stroke-width="22" transform="translate(${point.x} ${point.y}) rotate(${point.angle})"/>` : ""; }).join("");
  const doors = scene.floorPlan.doors.map((door) => { const point = wallPoint(scene, door.wallId, door.position); if (!point) return ""; const flip = door.swing.includes("left") ? -1 : 1; return `<g transform="translate(${point.x} ${point.y}) rotate(${point.angle})"><line x2="${flip * px(door.width)}" y2="${-px(door.width)}" stroke="${theme.wall}" stroke-width="4"/><path d="M 0 0 A ${px(door.width)} ${px(door.width)} 0 0 ${flip > 0 ? 0 : 1} ${flip * px(door.width)} ${-px(door.width)}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-dasharray="6 4"/></g>`; }).join("");
  const balconies = scene.floorPlan.balconies.map((item) => `<polygon points="${item.polygon.map((p) => `${px(p.x)},${px(p.y)}`).join(" ")}" fill="#e2e8f0" stroke="${theme.wall}" stroke-width="4"${item.type === "loggia" ? " stroke-dasharray=\"12 8\"" : ""}/>`).join("");
  const fixtures = scene.floorPlan.fixtures.map((fixture) => `<g><rect x="${px(fixture.position.x - fixture.width / 2)}" y="${px(fixture.position.y - fixture.height / 2)}" width="${px(fixture.width)}" height="${px(fixture.height)}" rx="8" fill="none" stroke="#64748b" stroke-width="3"/><text x="${px(fixture.position.x)}" y="${px(fixture.position.y) + 5}" text-anchor="middle" font-size="13" fill="${theme.label}">${escapeXml(fixture.label ?? fixture.type)}</text></g>`).join("");
  const labels = scene.floorPlan.labels.map((label) => `<text x="${px(label.position.x)}" y="${px(label.position.y)}" text-anchor="middle" fill="${theme.label}" font-size="18">${escapeXml(label.text)}</text>`).join("");
  const dimensions = scene.floorPlan.dimensions.map((dimension) => `<g><line x1="${px(dimension.start.x)}" y1="${px(dimension.start.y)}" x2="${px(dimension.end.x)}" y2="${px(dimension.end.y)}" stroke="#64748b" stroke-width="2"/><text x="${px((dimension.start.x + dimension.end.x) / 2)}" y="${px((dimension.start.y + dimension.end.y) / 2) - 8}" text-anchor="middle" fill="${theme.label}" font-size="16">${escapeXml(dimension.label)}</text></g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="${theme.background}"/>${balconies}${rooms}${walls}${gaps}${windows}${doors}${fixtures}${labels}${dimensions}</svg>`;
}
