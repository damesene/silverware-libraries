// Each plugin's version and its changelog (CLAUDE.md, *Versions and changelogs*): the library page's frontmatter has
// `version: X.Y.Z`, and the plugin's CHANGELOG.md has that version's entry first. Run by scripts/build.mjs, in a build
// and in --check alike: nothing is written, a problem is told and fails the run.
import { readFile } from "node:fs/promises";

const VERSION = /^\d+\.\d+\.\d+$/;

/** The value of a top-level key in a page's frontmatter, or undefined */
function frontmatterValue(text, key) {
  const front = /^---\n([\s\S]*?)\n---(\n|$)/.exec(text)?.[1];
  const line = front?.split("\n").find((l) => l.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

/** Why a library's version or changelog does not hold, as text, or undefined where they do */
export function validateVersion(library, page, changelog) {
  const version = frontmatterValue(page, "version");
  if (version === undefined) return `${library}/${library}.md has no version in its frontmatter`;
  if (!VERSION.test(version)) return `${library}/${library}.md: version ${version} is not X.Y.Z`;
  if (changelog === undefined) return `${library}/CHANGELOG.md is missing`;
  const latest = /^## (\S+) \((\d{4}-\d{2}-\d{2})\)$/m.exec(changelog);
  if (!latest) return `${library}/CHANGELOG.md has no entry "## X.Y.Z (YYYY-MM-DD)"`;
  if (latest[1] !== version) return `${library}/CHANGELOG.md: its latest entry is ${latest[1]}, the library page says ${version}`;
  // (A space does not install the changelog: it is the repository's)
  if (/^- CHANGELOG\.md$/m.test(page)) return `${library}/${library}.md installs CHANGELOG.md: take it out of files:`;
  return undefined;
}

/** Tells each library whose version or changelog does not hold; how many */
export async function checkVersions(libraries) {
  let problems = 0;
  for (const library of libraries) {
    const page = (await readFile(`${library}/${library}.md`, "utf8")).replaceAll("\r\n", "\n");
    const changelog = (await readFile(`${library}/CHANGELOG.md`, "utf8").catch(() => undefined))?.replaceAll("\r\n", "\n");
    const problem = validateVersion(library, page, changelog);
    if (problem) {
      console.error(problem);
      problems++;
    }
  }
  return problems;
}
