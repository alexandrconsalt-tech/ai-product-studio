import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type AppShellProps = React.HTMLAttributes<HTMLDivElement>;

export function AppShell({ className, ...props }: AppShellProps) {
  return <div className={cn("grid min-h-screen grid-cols-[auto_1fr] bg-background text-foreground", className)} {...props} />;
}

export type SidebarProps = React.HTMLAttributes<HTMLElement> & {
  collapsed?: boolean;
};

export function Sidebar({ collapsed, className, ...props }: SidebarProps) {
  return (
    <aside
      className={cn(
        "h-screen shrink-0 border-r border-border bg-surface transition-[width] duration-base",
        collapsed ? "w-[64px]" : "w-[248px]",
        className,
      )}
      {...props}
    />
  );
}

export type HeaderProps = React.HTMLAttributes<HTMLElement>;

export function Header({ className, ...props }: HeaderProps) {
  return <header className={cn("flex h-14 items-center gap-3 border-b border-border bg-background px-4", className)} {...props} />;
}

export type WorkspaceProps = React.HTMLAttributes<HTMLElement>;

export function Workspace({ className, ...props }: WorkspaceProps) {
  return <main className={cn("min-w-0 flex-1 overflow-auto bg-background", className)} {...props} />;
}

export type PageProps = React.HTMLAttributes<HTMLDivElement>;

export function Page({ className, ...props }: PageProps) {
  return <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6 p-6", className)} {...props} />;
}

export type SectionProps = React.HTMLAttributes<HTMLElement>;

export function Section({ className, ...props }: SectionProps) {
  return <section className={cn("flex flex-col gap-3", className)} {...props} />;
}

export type PanelProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: PanelProps) {
  return <div className={cn("rounded-lg border border-border bg-surface text-foreground", className)} {...props} />;
}

export type InspectorProps = React.HTMLAttributes<HTMLElement>;

export function Inspector({ className, ...props }: InspectorProps) {
  return <aside className={cn("w-[360px] shrink-0 border-l border-border bg-surface", className)} {...props} />;
}

export type SplitViewProps = React.HTMLAttributes<HTMLDivElement>;

export function SplitView({ className, ...props }: SplitViewProps) {
  return <div className={cn("grid min-h-0 grid-cols-2 gap-0", className)} {...props} />;
}

export type ResizablePanelProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
};

export function ResizablePanel({ size = "md", className, ...props }: ResizablePanelProps) {
  return (
    <div
      className={cn(
        "resize-x overflow-auto",
        size === "sm" && "min-w-[280px]",
        size === "md" && "min-w-[320px]",
        size === "lg" && "min-w-[420px]",
        className,
      )}
      {...props}
    />
  );
}

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement>;

export function Toolbar({ className, ...props }: ToolbarProps) {
  return <div className={cn("flex h-10 items-center gap-1 border-b border-border bg-surface px-2", className)} {...props} />;
}
