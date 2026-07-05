import * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Hand-rolled inline-SVG line chart -- no charting dependency added
 * (repo's dependency set is deliberately small, CLAUDE.md RI-2), and a
 * single value-over-time line is simple enough to not need one. Used by
 * Dashboard for Accuracy/Cost/Speed/Confidence-over-time (CLAUDE.md
 * addendum "Product -> Playground -> Dashboard").
 */
export type LineChartPoint = Readonly<{ label: string; value: number }>;

export type LineChartProps = Readonly<{
  points: readonly LineChartPoint[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
  formatValue?: (value: number) => string;
}>;

export function LineChart({ points, width = 320, height = 96, stroke = "hsl(var(--primary))", className, formatValue }: LineChartProps) {
  if (points.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-xs text-text-muted", className)} style={{ width, height }}>
        Нет данных
      </div>
    );
  }

  const padding = 8;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const toY = (value: number) => height - padding - ((value - min) / range) * (height - padding * 2);
  const coords = points.map((point, index) => ({ x: padding + index * stepX, y: toY(point.value) }));
  const path = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className={className} role="img" aria-label={`${last.label}: ${formatValue ? formatValue(last.value) : last.value}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((coord, index) => (
        <circle key={points[index].label + index} cx={coord.x} cy={coord.y} r={2.5} fill={stroke} />
      ))}
    </svg>
  );
}

export type SparklineProps = Readonly<{
  values: readonly number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
}>;

export function Sparkline({ values, width = 120, height = 32, stroke = "hsl(var(--primary))", className }: SparklineProps) {
  return <LineChart points={values.map((value, index) => ({ label: String(index), value }))} width={width} height={height} stroke={stroke} className={className} />;
}
