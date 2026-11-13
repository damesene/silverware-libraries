// What Silverware Assets imports (a guard against a slip, as the other plugins' isolation tests are): no other
// plugin's code. Silverware Layout only through its API, handed over by the init page, by the contracts in shared/
// (shared/layout.ts, shared/rendered.ts).
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

/** What a file imports, as paths from the repository's root (`shared/…`, `silverware-…/…`) or as written */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map(([, spec]) => {
    const path = relative(join(SRC, "..", ".."), join(file, "..", spec!)).replace(/\\/g, "/");
    return path.startsWith("..") ? spec! : path;
  });
}

describe("isolation", () => {
  it("imports no other plugin's code", () => {
    for (const file of files(SRC)) expect(imports(file).filter((path) => /^silverware-(?!assets\/)/.test(path)), relative(SRC, file)).toEqual([]);
  });
});
