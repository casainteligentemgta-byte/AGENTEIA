import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/__tests__/**/*.test.ts",
      "chaos-test/**/*.test.ts",
    ],
    env: {
      OTEL_ENABLED: "0",
      LOG_LEVEL: "error",
      HEALTH_MONITOR: "0",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/__tests__/**",
        "src/dev-server.ts",
        "src/index.ts",
      ],
    },
  },
});
