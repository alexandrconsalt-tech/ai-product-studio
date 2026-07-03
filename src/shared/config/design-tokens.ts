export const spacingTokens = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const;

export const radiusTokens = {
  none: "0px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  full: "9999px",
} as const;

export const motionTokens = {
  duration: {
    fast: 120,
    base: 180,
    slow: 240,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    entrance: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

export const typographyTokens = {
  headingXl: "text-4xl font-semibold leading-tight",
  headingL: "text-3xl font-semibold leading-tight",
  headingM: "text-2xl font-semibold leading-snug",
  headingS: "text-xl font-semibold leading-snug",
  bodyL: "text-base leading-7",
  bodyM: "text-sm leading-6",
  bodyS: "text-xs leading-5",
  caption: "text-xs leading-4 text-text-muted",
  code: "font-mono text-sm leading-6",
  label: "text-sm font-medium leading-none",
} as const;
