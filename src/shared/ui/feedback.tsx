import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "border-border bg-secondary text-secondary-foreground",
      success: "border-success/30 bg-success/10 text-success",
      warning: "border-warning/30 bg-warning/10 text-warning",
      error: "border-error/30 bg-error/10 text-error",
      info: "border-info/30 bg-info/10 text-info",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export type StatusProps = BadgeProps;

export function Status(props: StatusProps) {
  return <Badge {...props} />;
}

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Alert({ tone = "neutral", className, ...props }: AlertProps) {
  return <div className={cn("rounded-lg border p-3 text-sm", badgeVariants({ tone }), className)} role="status" {...props} />;
}

export type ToastProps = AlertProps;

export function Toast({ className, ...props }: ToastProps) {
  return <Alert className={cn("shadow-lg", className)} {...props} />;
}

export type ProgressProps = React.ProgressHTMLAttributes<HTMLProgressElement>;

export function Progress({ className, ...props }: ProgressProps) {
  return <progress className={cn("h-2 w-full overflow-hidden rounded-full accent-primary", className)} {...props} />;
}

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden="true" {...props} />;
}

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement>;

export function EmptyState({ className, ...props }: EmptyStateProps) {
  return <div className={cn("flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-6 text-center text-text-muted", className)} {...props} />;
}

export type LoadingProps = React.HTMLAttributes<HTMLDivElement>;

export function Loading({ className, children = "Загрузка", ...props }: LoadingProps) {
  return <div className={cn("flex items-center gap-2 text-sm text-text-muted", className)} aria-live="polite" {...props}>{children}</div>;
}

export type ErrorStateProps = React.HTMLAttributes<HTMLDivElement>;

export function ErrorState({ className, ...props }: ErrorStateProps) {
  return <div className={cn("rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error", className)} role="alert" {...props} />;
}

