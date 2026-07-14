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
      // 純ロジック層(天体計算・幾何生成・天気マッピング・シーン状態)は 100% を維持する。
      // Three.js描画層(src/scene)とDOM層(src/ui)は presentation/runtime 層として対象外。
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
