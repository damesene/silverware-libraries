// Interaction tests run in parallel, each with the others (root CLAUDE.md, *Interaction tests run in parallel*). A test
// kept from that, by a `lock` of Playwright's (`-exclusive-`: alone, nothing else running) or a file's serial mode, is
// one the user allowed: said by a comment just above it, `// Lock allowed by the user (YYYY-MM-DD): why`. A test made
// to wait for others hides a race the run would have shown, so none is kept apart without it.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

// What keeps a test from running beside the others: a lock (a test's details, a group's, `describe.configure`), serial mode
const KEPT_APART = /\block\s*:|mode\s*:\s*["']serial["']|\.describe\.serial\b/;
// The user's word, with its date and why
const ALLOWED = /\/\/\s*Lock allowed by the user \(\d{4}-\d{2}-\d{2}\):\s*\S/;
// How far above a line kept apart its comment may be (the comment, a line of the test's name or details between)
const ABOVE = 3;

/** The interaction tests' files: each plugin's `ui-tests/`, its area folders too */
function uiTestFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith(".ts") ? [path] : [];
    });
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("silverware-"))
    .flatMap((entry) => {
      try {
        return walk(join(ROOT, entry.name, "ui-tests"));
      } catch {
        return [];
      }
    });
}

/** Where a file keeps a test from the others without the user's word above it: `file:line`, the line */
export function keptApartUnallowed(file: string, text: string): string[] {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    if (!KEPT_APART.test(line.replace(/\/\/.*$/, ""))) return [];
    const above = lines.slice(Math.max(0, index - ABOVE), index + 1);
    return above.some((one) => ALLOWED.test(one)) ? [] : [`${file}:${index + 1}: ${line.trim()}`];
  });
}

describe("interaction tests kept from running in parallel", () => {
  it("are none but those the user allowed, said by a comment just above each", () => {
    const found = uiTestFiles().flatMap((file) => keptApartUnallowed(relative(ROOT, file).replace(/\\/g, "/"), readFileSync(file, "utf8")));
    expect(found).toEqual([]);
  });

  it("finds a lock, a group's lock and serial mode without the user's word, and takes one with it", () => {
    const test = `test("a", { lock: "-exclusive-" }, async () => {});\ntest.describe.configure({ mode: "serial" });\ntest.describe.serial("b", () => {});\n`;
    expect(keptApartUnallowed("a.spec.ts", test)).toHaveLength(3);
    const allowed = `// Lock allowed by the user (2026-11-16): a double click's timing, which a loaded machine misses\ntest("a", { lock: "-exclusive-" }, async () => {});\n`;
    expect(keptApartUnallowed("a.spec.ts", allowed)).toEqual([]);
    // (A comment of its own, without the date or why, is no word of the user's; a lock named in a comment is none)
    expect(keptApartUnallowed("a.spec.ts", `// Lock allowed by the user\ntest("a", { lock: "x" }, async () => {});\n`)).toHaveLength(1);
    expect(keptApartUnallowed("a.spec.ts", `// no lock: here\nconst a = 1;\n`)).toEqual([]);
  });
});
