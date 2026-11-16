// What Silverware Assets PDF imports: Silverware Assets only through the contract (shared/assets.ts), handed over by the init
// page; shared/'s elements and the content's scale (its sizes following it); no other plugin's code.
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

/** What a file imports, as paths from the repository's root where outside src/ */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map(([, spec]) => {
    const path = relative(SRC, join(file, "..", spec!)).replace(/\\/g, "/");
    return path.startsWith("../../") ? path.slice("../../".length) : path;
  });
}

describe("isolation", () => {
  it("imports of shared/ the assets' contract, the reads and the elements alone, no other plugin's code", () => {
    const allowed = ["shared/assets.ts", "shared/reads.ts", "shared/elements.ts", "shared/contentscale.ts"];
    for (const file of files(SRC)) {
      const outside = imports(file).filter((path) => path.startsWith("shared/") || path.startsWith("silverware-") || path.startsWith(".."));
      expect(outside.filter((path) => !allowed.includes(path)), relative(SRC, file)).toEqual([]);
    }
  });
});
