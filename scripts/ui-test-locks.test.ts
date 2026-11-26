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

/** The interaction tests' files: each folder's `ui-tests/` (a plugin's, cross-plugin/), its area folders too */
function uiTestFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith(".ts") ? [path] : [];
    });
  return readdirSync(ROOT, { withFileTypes: true })
    // (Every folder holding one, as the CI's groups take them: scripts/ui-test-groups.mjs; a folder without one, as
    // .git or test-results, gives nothing, node_modules not even looked into)
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
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

// A test that holds a known bug (step S of docs/silverware-core-work.md): the behaviour wanted asserted, marked
// `test.fail(true, "Known (YYYY-MM-DD): …")` after what sets it up and `expectNoPageErrorsYet(page)` on the line above
// (the fixtures check the page's errors after the test, by then taken for the known bug), so the report shows it
// expected to fail and a fix
// shows as "unexpectedly passed". Each is found by its mark: its reason dated and its file listed in the runbook's
// *Known* entries, so none is forgotten (step K fixes what is left); a bare `test.fail()` (any failure taken for the
// known one) is none. A mark is read on its line: written over several lines it is refused.
const KNOWN = /\btest\.fail\((.*)/g;
const KNOWN_REASON = /^true,\s*"Known \(\d{4}-\d{2}-\d{2}\): \S/;

/**
 * Where a file marks a test failing without a dated reason, or without the page's errors checked on the line above
 * (`expectNoPageErrorsYet(page)`: else an error of the page before it is taken for the known bug): `file:line`, the line
 */
export function knownUnexplained(file: string, text: string): string[] {
  const lines = text.split("\n");
  return lines.flatMap((line, index) =>
    [...line.replace(/\/\/.*$/, "").matchAll(KNOWN)]
      .filter((one) => !KNOWN_REASON.test(one[1]!) || !/\bexpectNoPageErrorsYet\(page\);/.test(lines[index - 1] ?? ""))
      .map(() => `${file}:${index + 1}: ${line.trim()}`),
  );
}

describe("interaction tests holding a known bug", () => {
  it("each has a dated reason, and its file is in the runbook's Known entries", () => {
    const runbook = readFileSync(join(ROOT, "docs", "silverware-core-work.md"), "utf8");
    const files = uiTestFiles().map((file) => [relative(ROOT, file).replace(/\\/g, "/"), readFileSync(file, "utf8")] as const);
    expect(files.flatMap(([file, text]) => knownUnexplained(file, text))).toEqual([]);
    const marked = files.filter(([, text]) => /\btest\.fail\(/.test(text.replace(/\/\/.*$/gm, ""))).map(([file]) => file);
    expect(marked.filter((file) => !runbook.includes(file))).toEqual([]);
  });

  it("takes a dated reason after the page's errors checked, refuses a bare mark, one without its date or without the check", () => {
    const checked = "  expectNoPageErrorsYet(page);\n";
    expect(knownUnexplained("a.spec.ts", `${checked}  test.fail(true, "Known (2026-11-26): one Esc closes both");\n`)).toEqual([]);
    expect(knownUnexplained("a.spec.ts", `  test.fail(true, "Known (2026-11-26): one Esc closes both");\n`)).toHaveLength(1);
    expect(knownUnexplained("a.spec.ts", `${checked}  test.fail();\n`)).toHaveLength(1);
    expect(knownUnexplained("a.spec.ts", `${checked}  test.fail(true, "one Esc closes both");\n`)).toHaveLength(1);
    expect(knownUnexplained("a.spec.ts", `  // test.fail() in a comment\n`)).toEqual([]);
    // (Over several lines: refused, its reason not on the mark's line)
    expect(knownUnexplained("a.spec.ts", `${checked}  test.fail(\n    true,\n    "Known (2026-11-26): one Esc closes both",\n  );\n`)).toHaveLength(1);
  });
});
