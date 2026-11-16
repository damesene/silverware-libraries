// A file's title and name set from its menu (docs/silverware-assets-rename.md): what the Rename dialog checks and makes,
// pure. The title is one embed's alt text (a link's text) on one page; the name is the file's in the space, its folder
// and extension kept as they are.

/** A path cut into what the dialog keeps (its folder, with its slash; its extension, with its dot) and its name between */
export type PathParts = { readonly folder: string; readonly name: string; readonly ext: string };

export function pathParts(path: string): PathParts {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash + 1);
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  // (A name starting with its only dot has no extension: `.env`)
  return dot > 0 ? { folder, name: file.slice(0, dot), ext: file.slice(dot) } : { folder, name: file, ext: "" };
}

// What a file's name may not hold: a path's slashes, what a file system refuses, SilverBullet's link marks
const NOT_IN_NAME = /[\\/:*?"<>|#^[\]@$]/g;

/** Why a file's name (its folder and extension apart) cannot be given, as text; none where it can */
export function validateFileName(name: string): string | undefined {
  if (!name.trim()) return "a file needs a name";
  if (name !== name.trim()) return "a name does not start or end with a space";
  if (name.startsWith(".")) return "a name does not start with a dot (SilverBullet reads no such file)";
  const bad = [...new Set(name.match(NOT_IN_NAME) ?? [])];
  if (bad.length) return `a name holds none of ${bad.join(" ")}`;
  return undefined;
}

/** Why a title (an embed's alt text, a link's text) cannot be written, as text; none where it can */
export function validateTitle(title: string): string | undefined {
  // (They end the alt text or the link where SilverBullet reads them: `|` a segment, `]` the link)
  const bad = [...new Set(title.match(/[|[\]]/g) ?? [])];
  if (bad.length) return `a title holds none of ${bad.join(" ")}`;
  // (One at its end escapes the bracket after it, which ends the alt text or the link)
  return /\\$/.test(title.trim()) ? "a title does not end with \\" : undefined;
}

/** Whether SilverBullet renames a file of this path: its extension letters and digits (none: it would be taken for a page) */
export const renamable = (path: string): boolean => /^\.[A-Za-z0-9]+$/.test(pathParts(path).ext);

/** A file's name made of a title: what a name may not hold left out, its spaces one, at its ends none */
export function fileNameOfTitle(title: string): string {
  return title.replace(NOT_IN_NAME, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").trim();
}

/** Whether a path is another file's (as SilverBullet compares them for a rename: a name differing in case alone is taken too) */
export function takenBy(paths: readonly string[], from: string, to: string): string | undefined {
  const wanted = to.toLowerCase();
  return paths.find((one) => one !== from && one.toLowerCase() === wanted);
}
