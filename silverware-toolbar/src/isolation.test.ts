// What Silverware Toolbar may import of the other plugins: nothing (a guard against a slip, as the other plugins'
// isolation tests are). Silverware Icons is reached through its API, which the init page hands over and
// shared/icons.ts reads (its stand-in without it), never through its code.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("isolation", () => {
  it("imports no other plugin's code: Silverware Icons' API only through shared/icons.ts", () => {
    for (const file of files(SRC)) {
      const specs = [...readFileSync(file, "utf8").matchAll(/^import[^"']*["']([^"']+)["']/gm)].map(([, spec]) => spec!);
      expect(specs.filter((spec) => /silverware-(?!toolbar)[a-z]+\//.test(spec)), relative(SRC, file)).toEqual([]);
    }
  });
});
