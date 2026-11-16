// What Silverware Editor imports: of shared/ the editor's contract (shared/editor.ts) and the reading of a line's marks
// (shared/markdown/inline.ts: hashtags as SilverBullet reads them, pure) alone; no other plugin's code.
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
  // What of shared/ it may import (the editor's keys matched by shared/keys.ts); each of them importing nothing else at
  // run time but another of them (so nothing more comes in through them)
  const ALLOWED = ["shared/editor.ts", "shared/keys.ts", "shared/markdown/inline.ts"];
  it("imports of shared/ the editor's contract and a line's marks alone, no other plugin's code", () => {
    for (const file of files(SRC)) {
      const outside = imports(file).filter((path) => path.startsWith("shared/") || path.startsWith("silverware-") || path.startsWith(".."));
      expect(outside.filter((path) => !ALLOWED.includes(path)), relative(SRC, file)).toEqual([]);
    }
    for (const allowed of ALLOWED) {
      expect(imports(join(SRC, "..", "..", allowed)).filter((path) => !ALLOWED.includes(path)), allowed).toEqual([]);
    }
  });

  it("has CodeMirror at run time in vendor.ts alone, which nothing imports", () => {
    for (const file of files(SRC).filter((one) => !one.endsWith("vendor.ts"))) {
      expect(imports(file).filter((path) => path.startsWith("@codemirror") || path.startsWith("@lezer") || path === "vendor.ts"), relative(SRC, file)).toEqual([]);
    }
  });
});
