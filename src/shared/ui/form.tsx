import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-focus",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-hover",
        ghost: "text-foreground hover:bg-hover",
        danger: "bg-error text-primary-foreground hover:opacity-90",
      },
      size: {
        sm: "h-8 px-2 text-xs",
        md: "h-9 px-3",
        lg: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export type IconButtonProps = ButtonProps & {
  "aria-label": string;
};

export function IconButton({ className, size = "md", ...props }: IconButtonProps) {
  return <Button className={cn("aspect-square px-0", className)} size={size} {...props} />;
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn("h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-text-muted focus:border-focus disabled:opacity-50", className)} {...props} />;
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn("min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-text-muted focus:border-focus disabled:opacity-50", className)} {...props} />;
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn("h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-focus disabled:opacity-50", className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("size-4 rounded border-border accent-primary", className)} {...props} />;
}

export function Radio({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="radio" className={cn("size-4 border-border accent-primary", className)} {...props} />;
}

export function Switch({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" role="switch" className={cn("h-5 w-9 rounded-full accent-primary", className)} {...props} />;
}

export type SegmentedControlProps = React.HTMLAttributes<HTMLDivElement>;

export function SegmentedControl({ className, ...props }: SegmentedControlProps) {
  return <div className={cn("inline-flex rounded-md border border-border bg-surface p-0.5", className)} role="group" {...props} />;
}

export type SliderProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Slider({ className, ...props }: SliderProps) {
  return <input type="range" className={cn("w-full accent-primary", className)} {...props} />;
}

