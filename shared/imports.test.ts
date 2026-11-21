// What shared/ may import (docs/silverware-formulas-shared.md, *Decided* 3): it is bundled into each plugin, so it
// imports no plugin's code; the table model imports nothing of the formulas, and the formulas only the model and the
// filter's number reading beside their own files.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const shared = join(root, "shared");

/** shared/'s files (tests aside), each with the files its imports name, as paths of the repository */
function importsOf(dir: string): { readonly file: string; readonly imports: readonly string[] }[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return importsOf(path);
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) return [];
    const text = readFileSync(path, "utf8");
    const imports = Array.from(text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+"(\.[^"]+)"/g), (m) =>
      relative(root, resolve(dirname(path), m[1]!.replace(/\?raw$/, ""))).split(sep).join("/"),
    );
    return [{ file: relative(root, path).split(sep).join("/"), imports }];
  });
}

const files = importsOf(shared);
const offending = (from: string, allowed: (target: string) => boolean) =>
  files.filter((f) => f.file.startsWith(from)).flatMap((f) => f.imports.filter((target) => !allowed(target)).map((target) => `${f.file} -> ${target}`));

describe("what shared/ imports", () => {
  it("no plugin's code: shared/ is bundled into each, a plugin uses another only through its public API", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(offending("shared/", (target) => target.startsWith("shared/"))).toEqual([]);
  });

  it("the table model imports nothing of the formulas, nor of the rest of shared/", () => {
    expect(files.some((f) => f.file === "shared/table/model.ts")).toBe(true);
    expect(offending("shared/table/", (target) => target.startsWith("shared/table/"))).toEqual([]);
  });

  it("the formulas import the model and the filter's number reading only, beside their own files", () => {
    expect(files.some((f) => f.file === "shared/formulas/evaluate.ts")).toBe(true);
    expect(offending("shared/formulas/", (target) => target.startsWith("shared/formulas/") || target.startsWith("shared/table/") || target === "shared/filter.ts")).toEqual([]);
  });
});
