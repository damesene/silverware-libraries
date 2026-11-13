// The layers kept apart, by what they import (a guard against a slip, as the other plugins' isolation tests are):
// `model/` (widths, settings) imports nothing outside it; `core/` (the providers' registry, which width applies) the
// model and the contract (shared/layout.ts) alone; `ui/` (the dialog, the handle, the zoom) the model and shared UI,
// never the host nor the bridge; `host/` (the page as any host has it: page.ts, marks.ts, widgets.ts) and the app
// (app.ts, widgetlayout.ts) know no SilverBullet; `host/silverbullet/` alone knows SilverBullet's page, and only
// index.ts, SilverBullet's binding, uses it and the bridge. No plugin's code but its own (another plugin only through
// its API, handed over by the init page). And no name of SilverBullet's page (its elements, its theme's variable) in
// the code or the style page's rules but host/silverbullet/'s: Silverware Layout could be carried to another host.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function files(dir: string): string[] {
  // (A folder not made yet, an area planned: no files)
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** What a file imports, as paths from src/ (outside src/: from the repository's root, `shared/…`, or as written) */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map(([, spec]) => {
    const path = relative(SRC, join(file, "..", spec!)).replace(/\\/g, "/");
    return path.startsWith("../../") ? path.slice("../../".length) : path.startsWith("..") ? spec! : path;
  });
}

const of = (folder: string) => files(join(SRC, folder)).map((file) => [relative(SRC, file).replace(/\\/g, "/"), imports(file)] as const);

describe("isolation", () => {
  it("keeps the model to itself", () => {
    for (const [file, list] of of("model")) expect(list.filter((path) => !path.startsWith("model/")), file).toEqual([]);
  });
  it("keeps the core to the model and the contract", () => {
    for (const [file, list] of of("core")) expect(list.filter((path) => !path.startsWith("model/") && !path.startsWith("core/") && path !== "shared/layout.ts"), file).toEqual([]);
  });
  it("keeps the dialog off the host and the bridge", () => {
    for (const [file, list] of of("ui")) expect(list.filter((path) => path.startsWith("host/") || path === "bridge.ts" || path.startsWith("shared/pages/")), file).toEqual([]);
  });
  it("leaves SilverBullet to the host and the root, a page's text to the page writer", () => {
    for (const [file, list] of [...of("model"), ...of("core"), ...of("ui")]) expect(list.filter((path) => path === "bridge.ts" || path.startsWith("shared/pages/") || path === "shared/platform.ts"), file).toEqual([]);
  });
  it("keeps SilverBullet to its host and its binding: the host's other parts, the app and the widgets' layout know none", () => {
    const generic = [...of("host").filter(([file]) => !file.startsWith("host/silverbullet/")), ...of(".").filter(([file]) => file === "app.ts" || file === "widgetlayout.ts")];
    expect(generic.length).toBeGreaterThan(3);
    for (const [file, list] of generic) expect(list.filter((path) => path.startsWith("host/silverbullet/") || path === "bridge.ts" || path.startsWith("shared/pages/") || path === "shared/platform.ts"), file).toEqual([]);
    // (SilverBullet's host used by its binding alone)
    for (const [file, list] of of(".").filter(([file]) => !file.startsWith("host/silverbullet/") && file !== "index.ts")) expect(list.filter((path) => path.startsWith("host/silverbullet/")), file).toEqual([]);
  });

  it("names SilverBullet's page (its elements, its theme's variables) only in its host", () => {
    // Code less its comments; the style page's rules less theirs (its colors are the themes' variables every plugin reads)
    const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const sbNames = /\.cm-[a-z]|#sb-|--editor-(width|font-size)/;
    for (const [file] of of(".").filter(([file]) => !file.startsWith("host/silverbullet/"))) expect(code(readFileSync(join(SRC, file), "utf8")).match(sbNames)?.[0], file).toBeUndefined();
    const style = readFileSync(join(SRC, "..", "silverware-layout-style.md"), "utf8");
    const rules = /```space-style\r?\n([\s\S]*?)```/.exec(style)?.[1] ?? "";
    expect(code(rules).match(sbNames)?.[0], "silverware-layout-style.md").toBeUndefined();
  });

  // Areas (docs/silverware-layout-grid.md, docs/silverware-layout-assets.md): a part of Silverware Layout with
  // Layout's layers inside, under the same rules; Layout's own layers know no area, and no area knows another
  const AREAS = ["grid", "assets"];
  it("keeps an area's model to itself, and Layout's layers off every area", () => {
    for (const area of AREAS) {
      for (const [file, list] of of(`${area}/model`)) expect(list.filter((path) => !path.startsWith(`${area}/model/`)), file).toEqual([]);
    }
    for (const [file, list] of [...of("model"), ...of("core"), ...of("ui"), ...of("host")]) {
      expect(list.filter((path) => AREAS.some((area) => path.startsWith(`${area}/`))), file).toEqual([]);
    }
  });

  it("keeps the areas apart", () => {
    for (const area of AREAS) {
      for (const [file, list] of of(area)) expect(list.filter((path) => AREAS.some((other) => other !== area && path.startsWith(`${other}/`))), file).toEqual([]);
    }
  });

  it("imports no other plugin's code", () => {
    for (const [file, list] of of(".")) expect(list.filter((path) => /^silverware-(?!layout\/)/.test(path)), file).toEqual([]);
  });
});
