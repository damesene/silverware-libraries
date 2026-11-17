// Code kept only for SilverBullet 2.12.1 and older, beside what its edge (3.0) needs, carries the mark SB-2.12-COMPAT
// in a comment, and each file holding one is named in the Cleanup section of docs/silverware-sb-edge.md: once the old
// versions are dropped, that list and `git grep SB-2.12-COMPAT` are the whole cleanup, nothing left behind unlisted.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const PLAN = "docs/silverware-sb-edge.md";
const MARK = "SB-2.12-COMPAT";

/** The files holding the mark, as git knows them (tracked or not yet added), outside the plan and this test */
function markedFiles(): string[] {
  let out = "";
  try {
    out = execFileSync("git", ["grep", "-l", "--untracked", "-F", MARK, "--", ".", ":!*.js"], { cwd: ROOT, encoding: "utf8" });
  } catch {
    // git grep exits with 1 where nothing matches
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter((file) => file && file !== PLAN && file !== "scripts/sb-compat.test.ts");
}

/** The plan's Cleanup section: from its heading to the next of its level */
export function cleanupSection(plan: string): string {
  const start = plan.indexOf("\n## Cleanup");
  if (start < 0) return "";
  const end = plan.indexOf("\n## ", start + 1);
  return plan.slice(start, end < 0 ? undefined : end);
}

describe(`code kept for SilverBullet 2.12.1 (${MARK})`, () => {
  it("has a Cleanup section in its plan", () => {
    expect(cleanupSection(readFileSync(join(ROOT, PLAN), "utf8"))).not.toBe("");
  });

  it("is in files each named in the plan's Cleanup section", () => {
    const cleanup = cleanupSection(readFileSync(join(ROOT, PLAN), "utf8"));
    expect(markedFiles().filter((file) => !cleanup.includes(file))).toEqual([]);
  });
});
