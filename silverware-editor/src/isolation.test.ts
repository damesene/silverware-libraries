// What Silverware Editor imports: of shared/ the editor's contract (shared/editor.ts) alone; no other plugin's code.
// CodeMirror only in vendor.ts at run time, which nothing imports (it is a file of its own, loaded when idle); its types
// elsewhere (`import type`, erased).
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

/** What a file imports at run time (type imports left out), as written (a package) or from the repository's root */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^(?:import|export)(?! type)[^"']*from ["']([^"']+)["']/gm)].map(([, spec]) => {
    if (!spec!.startsWith(".")) return spec!;
    const path = relative(SRC, join(file, "..", spec!)).replace(/\\/g, "/");
    return path.startsWith("../../") ? path.slice("../../".length) : path;
  });
}

describe("isolation", () => {
  it("imports of shared/ the editor's contract alone, no other plugin's code", () => {
    for (const file of files(SRC)) {
      const outside = imports(file).filter((path) => path.startsWith("shared/") || path.startsWith("silverware-") || path.startsWith(".."));
      expect(outside.filter((path) => path !== "shared/editor.ts"), relative(SRC, file)).toEqual([]);
    }
  });

  it("has CodeMirror at run time in vendor.ts alone, which nothing imports", () => {
    for (const file of files(SRC).filter((one) => !one.endsWith("vendor.ts"))) {
      expect(imports(file).filter((path) => path.startsWith("@codemirror") || path.startsWith("@lezer") || path === "vendor.ts"), relative(SRC, file)).toEqual([]);
    }
  });
});
