import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Silverware Core from its source (in SilverBullet the plugins' bundles import its bundle beside theirs)
  resolve: { alias: { "silverware-core": fileURLToPath(new URL("./silverware-core/src/api.ts", import.meta.url)) } },
  test: {
    include: ["*/src/**/*.test.ts", "shared/**/*.test.ts", "playground/*.test.ts", "scripts/*.test.ts"],
  },
});
