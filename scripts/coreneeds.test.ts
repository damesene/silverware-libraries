// A plugin's need of Silverware Core kept true by what it imports, not by memory (docs/silverware-core.md, *Loading and
// the version gate*): every export of the core's public module carries `@since X.Y`, the core's version that first had
// it, and a plugin importing an export newer than its need (scripts/coregate.mjs `NEEDS`) fails here, as a core older
// than that export would pass its gate and break it. A need above every export it imports is allowed (a fix of the
// core's it relies on), never above the core's own version.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { NEEDS } from "./coregate.mjs";

const ROOT = join(import.meta.dirname, "..");
const API = readFileSync(join(ROOT, "silverware-core/src/api.ts"), "utf8");

/** Each export of a module's text with its `@since` (undefined where its doc comment has none) */
export function exportsOf(text: string): Map<string, string | undefined> {
  const found = new Map<string, string | undefined>();
  for (const m of text.matchAll(/(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?^export (?:declare )?(?:const|let|function\*?|async function|class|type|interface|enum) (\w+)/gm))
    found.set(m[2]!, /@since (\d+\.\d+)\b/.exec(m[1] ?? "")?.[1]);
  for (const m of text.matchAll(/^export \{([^}]*)\}/gm)) for (const name of m[1]!.split(",").map((n) => n.trim().split(/\s+as\s+/).at(-1)!).filter(Boolean)) found.set(name, undefined);
  return found;
}

/** What a text imports (or exports again) of `silverware-core`, by name; `*` for the whole module (a default import, `* as`, `import()`) */
export function coreImportsOf(text: string): string[] {
  const named = [...text.matchAll(/^(?:import|export)\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s+from\s+["']silverware-core["']/gm)].flatMap(([, names]) =>
    names!
      .split(",")
      .map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!)
      .filter(Boolean),
  );
  const whole =
    /^(?:import|export)\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)\s+from\s+["']silverware-core["']/m.test(text) || /\bimport\(\s*["']silverware-core["']\s*\)/.test(text) ? ["*"] : [];
  return [...named, ...whole];
}

const before = (a: string, b: string) => {
  const [am, an] = a.split(".").map(Number);
  const [bm, bn] = b.split(".").map(Number);
  return am! < bm! || (am === bm && an! < bn!);
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("the core's exports", () => {
  const exported = exportsOf(API);
  const core = /^export const VERSION = "(\d+\.\d+)\.\d+";$/m.exec(API)![1]!;

  it("each carries `@since`, none newer than the core", () => {
    expect(exported.size).toBeGreaterThan(0);
    for (const [name, since] of exported) {
      expect(since, `${name} has no @since X.Y`).toBeDefined();
      expect(before(core, since!), `${name} is @since ${since}, the core is ${core}`).toBe(false);
    }
  });

  it("each plugin's need is the core's or older", () => {
    for (const [library, need] of Object.entries(NEEDS)) expect(before(core, need), `${library} needs ${need}, the core is ${core}`).toBe(false);
  });

  it("the plugins and shared/ import the core as `silverware-core` alone (its src/api.ts), never a file of it", () => {
    for (const dir of [...Object.keys(NEEDS).map((library) => join(library, "src")), "shared"])
      for (const file of files(join(ROOT, dir)))
        expect(
          [...readFileSync(file, "utf8").matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]!).filter((spec) => /silverware-core\//.test(spec)),
          relative(ROOT, file),
        ).toEqual([]);
  });

  // (The whole module, `*`, as its newest export)
  const newest = [...exported.values()].reduce<string>((a, b) => (b && before(a, b) ? b : a), "0.0");
  const sinceOf = (name: string) => (name === "*" ? newest : exported.get(name)!);
  const check = (dir: string, need: string, needed: string) => {
    for (const file of files(join(ROOT, dir)))
      for (const name of coreImportsOf(readFileSync(file, "utf8"))) {
        const where = relative(ROOT, file).replace(/\\/g, "/");
        expect(name === "*" || exported.has(name), `${where} imports ${name}, which silverware-core/src/api.ts does not export`).toBe(true);
        expect(before(need, sinceOf(name)), `${where} imports ${name} (@since ${sinceOf(name)}): ${needed} ${need}`).toBe(false);
      }
  };

  it("no plugin imports an export newer than its need", () => {
    for (const [library, need] of Object.entries(NEEDS)) check(join(library, "src"), need, `${library} needs`);
  });

  it("shared/ imports none newer than the oldest need (it is bundled into every plugin)", () => {
    const oldest = Object.values(NEEDS).reduce((a, b) => (before(b, a) ? b : a));
    check("shared", oldest, "the oldest need is");
  });
});

describe("reading", () => {
  it("an export's @since, from its doc comment alone", () => {
    const read = exportsOf('/**\n * A.\n * @since 1.2\n */\nexport const A = 1;\n\n/** B */\nexport function b() {}\n/** @since 2.0 */\nexport type C = 1;\n');
    expect([...read]).toEqual([
      ["A", "1.2"],
      ["b", undefined],
      ["C", "2.0"],
    ]);
  });

  it("the names imported of the core", () => {
    expect(coreImportsOf('import { A, type B, c as d } from "silverware-core";\nimport type { E } from "silverware-core";\nimport { F } from "./x.ts";\nexport { G } from "silverware-core";\n')).toEqual(["A", "B", "c", "E", "G"]);
    expect(coreImportsOf('import * as core from "silverware-core";\n')).toEqual(["*"]);
    expect(coreImportsOf('import core, { A } from "silverware-core";\n')).toEqual(["A", "*"]);
    expect(coreImportsOf('const core = await import("silverware-core");\n')).toEqual(["*"]);
  });
});
