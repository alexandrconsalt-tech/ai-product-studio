import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <div className={cn("rounded-lg border border-border bg-surface p-4 shadow-sm", className)} {...props} />;
}

export type AccordionProps = React.DetailsHTMLAttributes<HTMLDetailsElement>;

export function Accordion({ className, ...props }: AccordionProps) {
  return <details className={cn("rounded-lg border border-border bg-surface p-3", className)} {...props} />;
}

export type DialogProps = React.HTMLAttributes<HTMLDivElement>;

export function Dialog({ className, ...props }: DialogProps) {
  return <div className={cn("rounded-lg border border-border bg-surface-elevated p-4 shadow-lg", className)} role="dialog" {...props} />;
}

export type DrawerProps = React.HTMLAttributes<HTMLDivElement>;

export function Drawer({ className, ...props }: DrawerProps) {
  return <div className={cn("border-l border-border bg-surface-elevated shadow-lg", className)} role="dialog" {...props} />;
}

export type PopoverProps = React.HTMLAttributes<HTMLDivElement>;

export function Popover({ className, ...props }: PopoverProps) {
  return <div className={cn("rounded-md border border-border bg-surface-elevated p-2 shadow-md", className)} {...props} />;
}

export type TooltipProps = React.HTMLAttributes<HTMLDivElement>;

export function Tooltip({ className, ...props }: TooltipProps) {
  return <div className={cn("rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-sm", className)} role="tooltip" {...props} />;
}

export type SheetProps = DrawerProps;

export function Sheet(props: SheetProps) {
  return <Drawer {...props} />;
}

