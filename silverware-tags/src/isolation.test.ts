// The parts kept apart, by what they import (a guard against a slip, as the
// table's isolation test is): the domain imports nothing outside it; the core
// and the dialogs no module; the modules nothing of how SilverBullet is
// reached (the bridge, space/silverbullet.ts); only index.ts makes that Space.
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

/** What a file imports, as paths from src/ (outside src/: as written) */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map(([, spec]) => {
    const path = relative(SRC, join(file, "..", spec!)).replace(/\\/g, "/");
    return path.startsWith("..") ? spec! : path;
  });
}

const of = (folder: string) => files(join(SRC, folder)).map((file) => [relative(SRC, file).replace(/\\/g, "/"), imports(file)] as const);

describe("isolation", () => {
  it("keeps the domain to itself", () => {
    for (const [file, list] of of("tags")) expect(list.filter((path) => !path.startsWith("tags/")), file).toEqual([]);
  });
  it("keeps the core and the dialogs off the modules and SilverBullet", () => {
    for (const [file, list] of [...of("core"), ...of("ui")]) expect(list.filter((path) => path.startsWith("modules") || path === "bridge.ts" || path === "space/silverbullet.ts"), file).toEqual([]);
  });
  it("keeps the modules off each other and SilverBullet", () => {
    for (const [file, list] of of("modules")) expect(list.filter((path) => path.startsWith("modules/") || path === "bridge.ts" || path.startsWith("space/")), file).toEqual([]);
  });
});
