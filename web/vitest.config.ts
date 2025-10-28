import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Avoid Vite React plugin to prevent ESM/CJS issues during config bundling for Vitest.
  // Vitest uses esbuild and supports JSX transform with the settings below.
  esbuild: {
    jsx: "automatic",
    jsxDev: true,
  },
  test: {
    // Use happy-dom to avoid ESM/CJS interop issues with jsdom@27
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Focus whitebox coverage on the UI frontend only
      include: ["pages/**/*.ts", "pages/**/*.tsx", "!pages/api/**"],
      exclude: [
        "node_modules/",
        ".next/",
        "out/",
        "vitest.config.ts",
        "vitest.setup.ts",
        "**/*.d.ts",
        "next.config.js",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
