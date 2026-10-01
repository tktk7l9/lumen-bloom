import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Engine tests run in node; DOM-layer tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts", "src/ui/**/*.ts", "src/orchestrator.ts"],
      exclude: ["src/**/*.test.ts", "src/engine/**/__fixtures__/**"],
      reporter: ["text", "json-summary", "html"],
      // Keep the pure logic layer (astronomy, geometry generation, weather mapping, scene state) at 100%.
      // The DOM layer (src/ui, src/orchestrator.ts) is covered by behavioural jsdom tests with
      // the Three.js stage mocked; its gate sits just under the reached level.
      // The Three.js rendering layer (src/scene) needs WebGL and stays out of coverage.
      thresholds: {
        "src/engine/**/*.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "src/ui/**/*.ts": {
          statements: 98,
          branches: 95,
          functions: 98,
          lines: 98,
        },
        "src/orchestrator.ts": {
          statements: 98,
          branches: 95,
          functions: 98,
          lines: 98,
        },
      },
    },
  },
});
