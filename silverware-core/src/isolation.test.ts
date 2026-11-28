// Silverware Core's layers, by what each file imports (docs/silverware-core.md, *SilverBullet kept apart*): src/ is
// host-free, its binding of SilverBullet in src/host/silverbullet/ alone, imported by the entry (index.ts) only; no
// plugin's code; shared/silverbullet/ by the binding only.
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

/** Each file's imports, as paths from src/ (outside src/: from the repository's root) */
const imports = files(SRC).map((file) => {
  const text = readFileSync(file, "utf8");
  const specs = [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]!);
  return { file: relative(SRC, file).replace(/\\/g, "/"), specs: specs.map((spec) => relative(SRC, join(file, "..", spec)).replace(/\\/g, "/")) };
});

describe("isolation", () => {
  it("has its files read", () => {
    expect(imports.map((i) => i.file)).toContain("api.ts");
  });

  it("keeps src/ off the binding of SilverBullet, but the entry", () => {
    for (const { file, specs } of imports.filter((i) => !i.file.startsWith("host/") && i.file !== "index.ts")) expect(specs.filter((spec) => spec.startsWith("host/")), file).toEqual([]);
  });

  it("imports no plugin's code, and shared/silverbullet/ in the binding only", () => {
    for (const { file, specs } of imports) {
      expect(specs.filter((spec) => /^\.\.\/\.\.\/silverware-/.test(spec)), file).toEqual([]);
      if (!file.startsWith("host/silverbullet/")) expect(specs.filter((spec) => spec.includes("shared/silverbullet/")), file).toEqual([]);
    }
  });
});
