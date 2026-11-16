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
  it("names its classes, attributes and variables under its own prefix, swa-pdf- (Silverware Assets' swa- before it: none of Assets' names nor another type's)", () => {
    const style = readFileSync(join(SRC, "..", "silverware-assets-pdf-style.md"), "utf8");
    // (A shared reader's block, shared/docreader.css, written in its style page is its own: under its base, swa-pdf)
    for (const [name, text] of [...files(SRC).map((file) => [relative(SRC, file), readFileSync(file, "utf8")] as const), ["style page", style] as const]) {
      const names = [...text.replace(/^\s*\/\/.*$/gm, "").matchAll(/(?<![A-Za-z0-9-])-{0,2}(?:data-)?swa-[a-z]+/g)].map(([found]) => found.replace(/^-+|^data-/g, ""));
      expect(names.filter((found) => found !== "swa-pdf"), name).toEqual([]);
    }
  });
});
