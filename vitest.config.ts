import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/engine/**/__fixtures__/**"],
      reporter: ["text", "json-summary", "html"],
      // Keep the pure logic layer (astronomy, geometry generation, weather mapping, scene state) at 100%.
      // The Three.js rendering layer (src/scene) and the DOM layer (src/ui) are presentation/runtime layers and are excluded.
      thresholds: {
        "src/engine/**/*.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
