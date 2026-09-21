import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

// TH-02 / NFR-08: layering is enforced here, not by convention.
// app -> features -> ui, and services -> adapters. Only the ServicesProvider
// may import an adapter.
type Pattern = { group: string[]; message: string };
const restrict = (
  patterns: Pattern[],
): { "no-restricted-imports": ["error", { patterns: Pattern[] }] } => ({
  "no-restricted-imports": ["error", { patterns }],
});

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "app/**",
    "components/**",
    "lib/**",
    "eslint.config.mjs",
    "scripts/*.mjs",
  ]),
  ...nextVitals,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true, allowedStrings: ["/", "·", "%", "—"] },
      ],
      "react/no-danger": "error",
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: { "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["src/ui/**"],
    rules: restrict([
      {
        group: ["@/features/*", "@/app/*", "@/services/*", "@/adapters/*"],
        message: "ui/ is presentational: it may not import features, app, services or adapters.",
      },
    ]),
  },
  {
    files: ["src/features/**"],
    rules: restrict([
      {
        group: ["@/adapters/*", "@/adapters"],
        message: "Features use service interfaces, never adapters or mock data.",
      },
      { group: ["@/app/*"], message: "Features may not import from app/." },
    ]),
  },
  {
    files: ["src/services/**"],
    rules: restrict([
      { group: ["@/features/*", "@/ui/*", "@/app/*"], message: "Services are UI-agnostic." },
    ]),
  },
  {
    files: ["src/app/**", "src/layout/**", "src/lib/**"],
    rules: restrict([
      {
        group: ["@/adapters/*", "@/adapters"],
        message: "Only src/providers may import an adapter.",
      },
    ]),
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "tests/**"],
    rules: { "react/jsx-no-literals": "off", "max-lines": "off" },
  },
  prettier,
]);
