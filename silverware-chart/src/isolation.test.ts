// The parts kept apart, by what they import (a guard against a slip, as the
// other plugins' isolation tests are): formats and types know only the core's
// shapes; the core no module, format or type; the modules not each other, nor
// how SilverBullet is reached (the bridge).
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
// The core's shapes a format or a type is written against
const SHAPES = ["core/model.ts", "core/format.ts", "core/type.ts"];

describe("isolation", () => {
  it("keeps formats and types to the core's shapes", () => {
    for (const [file, list] of [...of("formats"), ...of("types")]) expect(list.filter((path) => !SHAPES.includes(path) && path.split("/")[0] !== file.split("/")[0]), file).toEqual([]);
  });
  it("keeps the core off the modules, formats, types and SilverBullet", () => {
    for (const [file, list] of of("core")) expect(list.filter((path) => /^(modules|formats|types)\//.test(path) || path === "bridge.ts" || path === "modules.ts"), file).toEqual([]);
  });
  it("keeps the modules off each other and SilverBullet", () => {
    for (const [file, list] of of("modules")) expect(list.filter((path) => path.startsWith("modules/") || path === "bridge.ts"), file).toEqual([]);
  });
});
