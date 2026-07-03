import * as React from "react";
import { Search as SearchIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type NavigationItemProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  active?: boolean;
  icon?: React.ReactNode;
};

export function NavigationItem({ active, icon, className, children, ...props }: NavigationItemProps) {
  return (
    <a
      className={cn(
        "flex h-9 items-center gap-2 rounded-md px-2 text-sm text-text-muted outline-none transition-colors duration-fast hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus",
        active && "bg-selected text-foreground",
        className,
      )}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
    </a>
  );
}

export type BreadcrumbProps = React.HTMLAttributes<HTMLElement>;

export function Breadcrumb({ className, ...props }: BreadcrumbProps) {
  return <nav className={cn("flex items-center gap-1 text-sm text-text-muted", className)} aria-label="Breadcrumb" {...props} />;
}

export type TabsProps = React.HTMLAttributes<HTMLDivElement>;

export function Tabs({ className, ...props }: TabsProps) {
  return <div className={cn("flex items-center gap-1 border-b border-border", className)} role="tablist" {...props} />;
}

export type TabProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Tab({ active, className, ...props }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "h-9 border-b-2 border-transparent px-3 text-sm text-text-muted transition-colors duration-fast hover:text-foreground",
        active && "border-primary text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export type SearchProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Search({ className, ...props }: SearchProps) {
  return (
    <label className="relative block">
      <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      <input
        className={cn(
          "h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-text-muted focus:border-focus",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export type CommandPaletteProps = React.HTMLAttributes<HTMLDivElement>;

export function CommandPalette({ className, ...props }: CommandPaletteProps) {
  return <div className={cn("rounded-lg border border-border bg-surface-elevated p-2 shadow-lg", className)} role="dialog" {...props} />;
}

export type ContextMenuProps = React.HTMLAttributes<HTMLDivElement>;

export function ContextMenu({ className, ...props }: ContextMenuProps) {
  return <div className={cn("min-w-40 rounded-md border border-border bg-surface-elevated p-1 shadow-md", className)} role="menu" {...props} />;
}

export type DropdownProps = React.HTMLAttributes<HTMLDivElement>;

export function Dropdown({ className, ...props }: DropdownProps) {
  return <div className={cn("rounded-md border border-border bg-surface-elevated p-1 shadow-md", className)} {...props} />;
}

