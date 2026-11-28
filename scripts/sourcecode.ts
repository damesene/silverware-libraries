// What the repository's guard tests read (scripts/hostisolation.test.ts, pagewrites.test.ts, uiislands.test.ts): the
// plugins' and shared/'s source files, and their code without comments (a comment saying what SilverBullet does is no
// use of it).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export const ROOT = join(import.meta.dirname, "..");

/** The source files (tests, declarations and test helpers aside) under a folder of the repository, as paths from its root */
export function sourceFiles(folder: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "testing" ? [] : walk(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [path] : [];
    });
  return walk(join(ROOT, folder)).map((path) => relative(ROOT, path).replace(/\\/g, "/"));
}

/** Every plugin's src/ and shared/, each file as a path from the repository's root */
export function allSources(): string[] {
  const plugins = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("silverware-"))
    .map((entry) => `${entry.name}/src`);
  return [...plugins, "shared"].flatMap((folder) => {
    try {
      return sourceFiles(folder);
    } catch {
      return [];
    }
  });
}

/**
 * A file's code without its comments, strings and templates kept (each comment's text blanked, its lines kept, so a
 * place still has its line). A regular expression's literal is read as code: a `//` or a quote in one may be misread,
 * where none of the markers read is.
 */
export function codeOf(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) {
        if (text[j] === "\\") j++;
        else if (c !== "`" && text[j] === "\n") break;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

export const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
