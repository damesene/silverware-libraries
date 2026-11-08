// The layers, by what each folder imports (docs/silverware-database.md,
// *Layers*): each imports only from itself and the layers above it in LAYERS,
// so the model knows no store, the core no page, and nothing outside
// host/silverbullet/ names SilverBullet. Views and modules sit above the core
// but are written against its API: they may import its types, never its code.
// Checked from the first commit, folders not made yet included: what is added
// later falls under the rule as it comes.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

// Top down: a layer imports from itself and the layers before it only; files at src/'s root (the entry) are the host's
const LAYERS = ["model", "domain", "views", "modules", "core", "store", "host"] as const;
type Layer = (typeof LAYERS)[number] | "root";

// Where an import goes: a package (npm), a file outside src/ (by its path from the repository's root), a file of src/
type Import = { readonly path: string; readonly typeOnly: boolean; readonly kind: "package" | "outside" | "src" };

function files(dir: string, deep = true): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return deep ? files(path) : [];
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** What a file imports or re-exports (and loads by `import()`): a path from src/ (outside src/: from the repository's root), or a package as written */
function imports(file: string): Import[] {
  const text = readFileSync(file, "utf8");
  const found = [
    ...[...text.matchAll(/^(import|export)\s+(type\s+)?[^"';]*?\bfrom\s+["']([^"']+)["']/gm)].map((m) => ({ spec: m[3]!, typeOnly: !!m[2] })),
    ...[...text.matchAll(/^import\s+["']([^"']+)["']/gm)].map((m) => ({ spec: m[1]!, typeOnly: false })),
    ...[...text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => ({ spec: m[1]!, typeOnly: false })),
  ];
  return found.map(({ spec, typeOnly }): Import => {
    if (!spec.startsWith(".")) return { path: spec, typeOnly, kind: "package" };
    const path = relative(SRC, join(file, "..", spec)).replace(/\\/g, "/");
    if (!path.startsWith("..")) return { path, typeOnly, kind: "src" };
    return { path: relative(join(SRC, "..", ".."), join(file, "..", spec)).replace(/\\/g, "/"), typeOnly, kind: "outside" };
  });
}

const layerIndex = (layer: Layer) => (layer === "root" ? LAYERS.length : LAYERS.indexOf(layer));

/** Why an import breaks the layering, undefined where it does not */
function wrong(layer: Layer, file: string, one: Import): string | undefined {
  // A package (npm): the layer's own choice
  if (one.kind === "package") return undefined;
  if (one.kind === "outside" && !one.path.startsWith("shared/")) return `${one.path}: nothing outside src/ but shared/`;
  if (one.path.startsWith("shared/")) {
    if (/^shared\/(filter|compare)\.ts$/.test(one.path)) return undefined;
    if (one.path.startsWith("shared/pages/")) return file.startsWith("store/pages/") || layer === "host" || layer === "root" ? undefined : `${one.path}: the page writer is the pages store's and the host's`;
    if (one.path === "shared/platform.ts") return ["core", "store", "host", "root"].includes(layer) ? undefined : `${one.path}: the platform is the core's, the stores' and the host's`;
    return ["views", "modules", "core", "host", "root"].includes(layer) ? undefined : `${one.path}: shared UI is for what draws`;
  }
  const other = one.path.split("/")[0] as Layer;
  const at = LAYERS.indexOf(other as (typeof LAYERS)[number]);
  if (at < 0) return `${one.path}: no layer`;
  if (at <= layerIndex(layer)) return undefined;
  // Only `import type { … }` counts as types: `import { type A }` reads as a value import, the stricter side
  if ((layer === "views" || layer === "modules") && other === "core" && one.typeOnly) return undefined;
  return `${one.path}: a layer below`;
}

const scanned = (): [Layer, string][] => [
  ...LAYERS.flatMap((layer) => files(join(SRC, layer)).map((file): [Layer, string] => [layer, file])),
  ...files(SRC, false).map((file): [Layer, string] => ["root", file]),
];

describe("isolation", () => {
  it("reads the imports it checks (an empty check passes nothing)", () => {
    expect(imports(join(SRC, "store", "memory.ts")).map((one) => one.path)).toContain("core/store.ts");
    expect(scanned().length).toBeGreaterThan(5);
  });

  it("keeps each layer to itself and the layers above it", () => {
    for (const [layer, file] of scanned()) {
      const name = relative(SRC, file).replace(/\\/g, "/");
      expect(imports(file).flatMap((one) => wrong(layer, name, one) ?? []), name).toEqual([]);
    }
  });

  it("leaves SilverBullet's names of its index and pages to its binding: the stores ask the platform", () => {
    for (const file of files(join(SRC, "store")).filter((one) => !/(\.test|testing)\.ts$/.test(one))) {
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code.match(/\b(lastModified|itags|displayName|pageDecoration|isValidName|PAGE_KEYS)\b|["']task["']/g) ?? [], relative(SRC, file)).toEqual([]);
    }
  });

  it("leaves pages, frontmatter and SilverBullet out of the model, the domain, the views, the modules and the core", () => {
    for (const layer of ["model", "domain", "views", "modules", "core"]) {
      for (const file of files(join(SRC, layer))) {
        const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        expect(/shared\/pages\//.test(code), relative(SRC, file)).toBe(false);
        expect(/\b(frontmatter|silverbullet)\b/i.test(code), relative(SRC, file)).toBe(false);
      }
    }
  });
});
