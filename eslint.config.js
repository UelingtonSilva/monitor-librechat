import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/build/**", "**/node_modules/**", "**/coverage/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Only the two classic, stable rules (hook-order violations, missing deps) — not the
    // full v7 "recommended" preset, which bundles React Compiler-era static analysis (purity,
    // set-state-in-effect, immutability...) this project hasn't opted into (React 18, no
    // Compiler). Adopting those would mean refactoring already-tested, working hooks to
    // satisfy rules aimed at a different React runtime, not fixing an actual bug.
    files: ["apps/monitor-portal/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  prettier
);
