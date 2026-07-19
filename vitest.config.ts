import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The real `obsidian` package is types-only and has no importable runtime
// entry, so alias it to a lightweight stub for tests.
const obsidianStub = fileURLToPath(new URL("./tests/obsidian-stub.ts", import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      obsidian: obsidianStub,
    },
  },
});
