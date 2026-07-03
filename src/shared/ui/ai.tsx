import * as React from "react";
import { BrainCircuit } from "lucide-react";
import { Badge, type BadgeProps } from "./feedback";
import { cn } from "@/shared/lib/utils";

export type AIMessageProps = React.HTMLAttributes<HTMLDivElement> & {
  role?: "assistant" | "user" | "system";
};

export function AIMessage({ role = "assistant", className, ...props }: AIMessageProps) {
  return <div className={cn("rounded-lg border border-border bg-surface p-3 text-sm", role === "assistant" && "border-info/30", className)} data-role={role} {...props} />;
}

export type AIResponseProps = React.HTMLAttributes<HTMLDivElement>;

export function AIResponse({ className, ...props }: AIResponseProps) {
  return <div className={cn("prose prose-sm max-w-none text-foreground dark:prose-invert", className)} {...props} />;
}

export type AIThinkingProps = React.HTMLAttributes<HTMLDivElement>;

export function AIThinking({ className, children = "AI анализирует", ...props }: AIThinkingProps) {
  return <div className={cn("inline-flex items-center gap-2 text-sm text-text-muted", className)} aria-live="polite" {...props}><BrainCircuit className="size-4" aria-hidden="true" />{children}</div>;
}

export type AIStatusProps = BadgeProps;

export function AIStatus(props: AIStatusProps) {
  return <Badge tone="info" {...props} />;
}

export type AIRecommendationProps = React.HTMLAttributes<HTMLDivElement>;

export function AIRecommendation({ className, ...props }: AIRecommendationProps) {
  return <div className={cn("rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-foreground", className)} {...props} />;
}

export type AIExplanationProps = React.HTMLAttributes<HTMLDetailsElement>;

export function AIExplanation({ className, ...props }: AIExplanationProps) {
  return <details className={cn("rounded-lg border border-border bg-surface p-3 text-sm", className)} {...props} />;
}

export type AIConfidenceProps = BadgeProps & {
  value?: number;
};

export function AIConfidence({ value, children, ...props }: AIConfidenceProps) {
  return <Badge tone={value !== undefined && value < 0.6 ? "warning" : "success"} {...props}>{children ?? (value !== undefined ? `${Math.round(value * 100)}%` : "Confidence")}</Badge>;
}

export function FrameworkBadge(props: BadgeProps) {
  return <Badge tone="neutral" {...props} />;
}

export function KnowledgeBadge(props: BadgeProps) {
  return <Badge tone="info" {...props} />;
}

