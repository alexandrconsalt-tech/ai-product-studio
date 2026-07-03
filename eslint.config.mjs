import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", ".npm-cache/**"],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
