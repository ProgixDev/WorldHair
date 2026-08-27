import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // jest.config.js is CommonJS on purpose — that's how Next's own docs
    // write it, since Jest resolves a plain `require()`-based config more
    // reliably than an ESM one.
    "jest.config.js",
  ]),
]);

export default eslintConfig;
