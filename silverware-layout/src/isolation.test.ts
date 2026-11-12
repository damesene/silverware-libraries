// The layers kept apart, by what they import (a guard against a slip, as the other plugins' isolation tests are):
// `model/` (widths, settings) imports nothing outside it; `core/` (the providers' registry, which width applies) the
// model and the contract (shared/layout.ts) alone; `ui/` (the dialog) the model and shared UI, never the host nor the
// bridge; `host/silverbullet/` alone knows SilverBullet's page and writes through the page writer; only index.ts ties
// them, and no plugin's code but its own (another plugin only through its API, handed over by the init page).
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
  it("imports no other plugin's code", () => {
    for (const [file, list] of of(".")) expect(list.filter((path) => /^silverware-(?!layout\/)/.test(path)), file).toEqual([]);
  });
});
