import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
