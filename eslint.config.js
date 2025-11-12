import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default tseslint.config(
  {
    ignores: [".next"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
  "rules": {
    // -------------------------------------------------------------------
    // 1. DISABLE STRICT 'ANY' CHECKING (The primary source of your errors)
    // -------------------------------------------------------------------
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",

    // -------------------------------------------------------------------
    // 2. DISABLE PROMISE AND ASYNC FLOW RULES (For page.tsx and API routes)
    // -------------------------------------------------------------------
    // Disables errors for unawaited promises (e.g., in useEffect)
    "@typescript-eslint/no-floating-promises": "off", 
    // Disables errors related to passing promise-returning functions incorrectly
    "@typescript-eslint/no-misused-promises": "off",

    // -------------------------------------------------------------------
    // 3. DISABLE CODE STYLE/CLEANUP WARNINGS
    // -------------------------------------------------------------------
    // Disables warnings about 'any' types in variable assignments
    "@typescript-eslint/prefer-nullish-coalescing": "off", 
    // Disables warnings about importing types separately (e.g., `import type { NextRequest }`)
    "@typescript-eslint/consistent-type-imports": "off",

    // -------------------------------------------------------------------
    // 4. DISABLE UNUSED VARS (Targeting your specific warnings)
    // -------------------------------------------------------------------
    // Disables errors for unused variables entirely (like the 'error' variable in your catch block)
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "off" 
  }
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
