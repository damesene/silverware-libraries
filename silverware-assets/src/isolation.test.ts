// What Silverware Assets imports (a guard against a slip, as the other plugins' isolation tests are): its layers kept
// apart. `model/` (the settings) imports nothing outside it; `core/` (the registry, which type, view and action apply,
// an embed found in the text) the model and shared/'s pure parts; `builtin/` (the types and actions of its own)
// registers through the contract alone (shared/assets.ts), as anyone's; `ui/` (the card, the menus, the Media tab)
// never the host, the bridge or the page writer; `host/silverbullet/` alone knows SilverBullet, used by index.ts, its
// binding. No other plugin's code: Silverware Layout only through its API, handed over by the init page, by the
// contracts in shared/ (shared/layout.ts, shared/rendered.ts). And no name of SilverBullet's page in the code but
// host/silverbullet/'s.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function files(dir: string): string[] {
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
const SILVERBULLET = (path: string) => path === "bridge.ts" || path.startsWith("host/") || path.startsWith("shared/pages/") || path === "shared/platform.ts";

describe("isolation", () => {
  it("keeps the model to itself", () => {
    expect(of("model").length).toBeGreaterThan(0);
    for (const [file, list] of of("model")) expect(list.filter((path) => !path.startsWith("model/")), file).toEqual([]);
  });

  it("keeps the core to the model and shared/'s pure parts", () => {
    for (const [file, list] of of("core")) expect(list.filter((path) => !path.startsWith("model/") && !path.startsWith("core/") && path !== "shared/assets.ts" && !path.startsWith("shared/markdown/")), file).toEqual([]);
  });

  it("registers the built-in types and actions through the contract alone, as anyone's", () => {
    for (const [file, list] of of("builtin")) expect(list.filter((path) => !path.startsWith("builtin/") && path !== "shared/assets.ts" && path !== "shared/elements.ts"), file).toEqual([]);
  });

  it("keeps SilverBullet to its host and its binding", () => {
    for (const [file, list] of [...of("model"), ...of("core"), ...of("builtin"), ...of("ui")]) expect(list.filter(SILVERBULLET), file).toEqual([]);
    for (const [file, list] of of(".").filter(([file]) => !file.startsWith("host/silverbullet/") && file !== "index.ts")) expect(list.filter((path) => path.startsWith("host/silverbullet/") || path === "bridge.ts"), file).toEqual([]);
  });

  it("names SilverBullet's page only in its host", () => {
    const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const sbNames = /\.cm-[a-z]|#sb-|\.sb-[a-z]|--editor-(width|font-size)/;
    for (const [file] of of(".").filter(([file]) => !file.startsWith("host/silverbullet/"))) expect(code(readFileSync(join(SRC, file), "utf8")).match(sbNames)?.[0], file).toBeUndefined();
    const style = readFileSync(join(SRC, "..", "silverware-assets-style.md"), "utf8");
    const rules = /```space-style\r?\n([\s\S]*?)```/.exec(style)?.[1] ?? "";
    expect(code(rules).match(sbNames)?.[0], "silverware-assets-style.md").toBeUndefined();
  });

  it("reads of Silverware Layout's marks only the width it lays a frame out at (shared/layout.ts), none of its classes", () => {
    const style = readFileSync(join(SRC, "..", "silverware-assets-style.md"), "utf8");
    const rules = (/```space-style\r?\n([\s\S]*?)```/.exec(style)?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules.match(/\.swl-[a-z-]+|data-swl-(?!width\b)[a-z-]+|--swl-[a-z-]+/g) ?? []).toEqual([]);
    for (const [file] of of(".")) expect(readFileSync(join(SRC, file), "utf8").replace(/^\s*\/\/.*$/gm, "").match(/swl-(?!embed\b)[a-z-]+/g) ?? [], file).toEqual([]);
  });

  it("imports no other plugin's code", () => {
    for (const [file, list] of of(".")) expect(list.filter((path) => /^silverware-(?!assets\/)/.test(path)), file).toEqual([]);
  });
});
