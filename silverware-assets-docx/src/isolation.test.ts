// What Silverware Assets DOCX imports: Silverware Assets only through the contract (shared/assets.ts), handed over by the init
// page; shared/'s reader shell and elements; no other plugin's code. docx-preview only in vendor.ts, which nothing imports
// (it is a file of its own, loaded when a document is drawn).
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

/** What a file imports, as written (a package) or as a path from the repository's root where outside src/ */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^(?:import|export)[^"']*from ["']([^"']+)["']/gm)].map(([, spec]) => {
    if (!spec!.startsWith(".")) return spec!;
    const path = relative(SRC, join(file, "..", spec!)).replace(/\\/g, "/");
    return path.startsWith("../../") ? path.slice("../../".length) : path;
  });
}

describe("isolation", () => {
  it("imports of shared/ the assets' contract, the reader's shell and the elements alone, no other plugin's code", () => {
    const allowed = ["shared/assets.ts", "shared/docreader.ts", "shared/reads.ts", "shared/elements.ts"];
    for (const file of files(SRC)) {
      const outside = imports(file).filter((path) => path.startsWith("shared/") || path.startsWith("silverware-") || path.startsWith(".."));
      expect(outside.filter((path) => !allowed.includes(path)), relative(SRC, file)).toEqual([]);
    }
  });

  it("has docx-preview in vendor.ts alone, which nothing imports", () => {
    for (const file of files(SRC).filter((one) => !one.endsWith("vendor.ts"))) {
      const list = imports(file);
      expect(list.filter((path) => path === "docx-preview" || path === "jszip" || path === "vendor.ts"), relative(SRC, file)).toEqual([]);
    }
  });
});
