import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Badge, type BadgeProps } from "./feedback";

export type NodeCardProps = React.HTMLAttributes<HTMLDivElement> & {
  selected?: boolean;
};

export function NodeCard({ selected, className, ...props }: NodeCardProps) {
  return <div className={cn("min-w-48 rounded-lg border border-border bg-surface p-3 shadow-sm", selected && "border-focus ring-2 ring-focus/30", className)} {...props} />;
}

export type ConnectionHandleProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "right" | "bottom" | "left";
};

export function ConnectionHandle({ side = "right", className, ...props }: ConnectionHandleProps) {
  return <div className={cn("size-3 rounded-full border border-border bg-background", className)} data-side={side} {...props} />;
}

export type PropertyPanelProps = React.HTMLAttributes<HTMLElement>;

export function PropertyPanel({ className, ...props }: PropertyPanelProps) {
  return <aside className={cn("w-[360px] border-l border-border bg-surface p-4", className)} {...props} />;
}

export type CanvasToolbarProps = React.HTMLAttributes<HTMLDivElement>;

export function CanvasToolbar({ className, ...props }: CanvasToolbarProps) {
  return <div className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-sm", className)} {...props} />;
}

export type MiniMapProps = React.HTMLAttributes<HTMLDivElement>;

export function MiniMap({ className, ...props }: MiniMapProps) {
  return <div className={cn("h-36 w-52 rounded-lg border border-border bg-surface/90 shadow-sm", className)} aria-label="Mini Map" {...props} />;
}

export type ZoomControlsProps = React.HTMLAttributes<HTMLDivElement>;

export function ZoomControls({ className, ...props }: ZoomControlsProps) {
  return <div className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1", className)} {...props} />;
}

export type ExecutionStatusProps = BadgeProps;

export function ExecutionStatus(props: ExecutionStatusProps) {
  return <Badge {...props} />;
}

export type ValidationBadgeProps = BadgeProps;

export function ValidationBadge(props: ValidationBadgeProps) {
  return <Badge {...props} />;
}
