// Files & media (docs/silverware-database-files.md): files of the space and of the web, kept in a list, each a wiki
// link to a file of the space (`[[Databases/db-ab12/files/sunset.jpg]]`) or an address of the web as written
// (`https://example.com/cat.png`). Wiki links, so the space keeps them as links: the file lists the item among its
// links, and a rename of the file, or of the database's folder, is written into the value by the space (SilverBullet
// 2.12.1, probed 2026-11-18). One written by hand as a single link or address, not in a list, reads too. Read as a
// reference is (domain/types/reference.ts) where it is a link; a file's name holds none of what a link cannot name.
import { readReference, writeReference } from "./reference.ts";

/** A file of a value: what it names (a path of the space, an address of the web), which, and how it was written */
export type FileEntry = { readonly target: string; readonly web: boolean; readonly written: string };

// An address of the web: a scheme, `//`, nothing blank in it
const WEB_RE = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

/** A text read as one file (a wiki link, an address of the web), or undefined where it is none */
export function readFile(text: string): FileEntry | undefined {
  const written = text.trim();
  if (WEB_RE.test(written)) return { target: written, web: true, written };
  const link = readReference(written);
  // (A link's text after a bar is kept as written; what it names is the file)
  return link ? { target: link.target, web: false, written } : undefined;
}

/**
 * A value's files, in their order (none: an empty list), or undefined where it is not a list of files (nor one alone):
 * no value of the type
 */
export function readFiles(value: unknown): readonly FileEntry[] | undefined {
  if (value === null || value === undefined || value === "") return [];
  const parts = Array.isArray(value) ? value : typeof value === "string" ? [value] : undefined;
  if (!parts) return undefined;
  const read = parts.map((one) => (typeof one === "string" ? readFile(one) : undefined));
  return read.every((one): one is FileEntry => one !== undefined) ? read : undefined;
}

/** A file as kept: a wiki link to a path of the space, an address of the web as it is */
export function writeFile(target: string): string {
  const written = target.trim();
  return WEB_RE.test(written) ? written : writeReference(written);
}

/**
 * Why a path of the space cannot be a file of a value, undefined where it can: what SilverBullet cannot link (its
 * reference grammar: `@ # | < > $`, a bracket) is no link to the file, nor followed as it is renamed
 */
export function validateFileTarget(path: string): string | undefined {
  const name = path.trim();
  if (!name) return "no file named";
  if (WEB_RE.test(name)) return undefined;
  const bad = /[@#|<>$[\]]/.exec(name);
  return bad ? `"${name}" cannot be linked: no "${bad[0]}" in a file's name` : undefined;
}

/**
 * Whether a link's target names a file, not a page: an address of the web, or a path whose name has an extension
 * other than `.md` (what follows `#`, `@`, `$`, `?` or `|` left out), as SilverBullet tells a file's link from a page's
 */
export function namesFile(target: string): boolean {
  const written = target.trim();
  if (WEB_RE.test(written)) return true;
  const ext = FILE_EXT_RE.exec(written.split(/[?#@$|]/, 1)[0]!)?.[1]?.toLowerCase();
  return !!ext && ext !== "md";
}

// A path's extension, as SilverBullet reads one (letters and digits, a few)
const FILE_EXT_RE = /\.([a-z0-9]{1,8})$/i;

/**
 * Whether values are files: each a list of files (one alone too), each a file, a link to one of the space among them
 * (addresses alone are a URL's, or a select's)
 */
export function areFiles(values: readonly unknown[]): boolean {
  const read = values.map(readFiles);
  return read.length > 0 && read.every((one) => !!one?.length && one.every((file) => file.web || namesFile(file.target))) && read.some((one) => one!.some((file) => !file.web));
}

/** What a file is called where it is shown: its name, its folders left out (an address of the web: its last part, else itself) */
export function fileName(entry: Pick<FileEntry, "target" | "web">): string {
  if (!entry.web) return entry.target.slice(entry.target.lastIndexOf("/") + 1) || entry.target;
  const path = entry.target.split(/[?#]/, 1)[0]!;
  const last = path.slice(path.lastIndexOf("/") + 1);
  return last && !path.endsWith("//" + last) ? decodeURIComponentSafe(last) : entry.target;
}

const decodeURIComponentSafe = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

// A part of text typed: a wiki link whole, else what is between spaces and commas
const TYPED_PART = /\[\[[^\]]*\]\]|[^\s,]+/g;

/**
 * Text typed made files, in their order: each wiki link and address of the web in it as written, a file named twice
 * once. Anything else typed is its `problem`: a path is named by a link (a name may hold a comma or a space, so no
 * plain name is read)
 */
export function typedFiles(typed: string): { readonly written: readonly string[] } | { readonly problem: string } {
  const written: string[] = [];
  const seen = new Set<string>();
  // (Each part a wiki link, which may hold a space or a comma, else a run of what is neither)
  for (const [part] of typed.matchAll(TYPED_PART)) {
    const file = readFile(part);
    if (!file) return { problem: `"${part}" is no file: name one as a link ([[folder/name.png]]) or an address of the web` };
    const problem = file.web ? undefined : validateFileTarget(file.target);
    if (problem) return { problem };
    if (seen.has(file.target)) continue;
    seen.add(file.target);
    written.push(file.written);
  }
  return { written };
}
