// Documents in folders, as their names say (`Projects/Alpha`: the document
// Alpha in the folder Projects), by the character the place they are kept in
// puts between them (SilverBullet: `/`; the host says which, none: no
// folders). Pure: what a name's folder is, whether a name is in a folder.

/** A document's name read as its folder (none: at the top) and its own name after it */
export type Path = { readonly folder?: string; readonly leaf: string };

/** A name's folder and its own name; all of it its own name where names have no folders (`separator` none) */
export function pathOf(name: string, separator: string | undefined): Path {
  const at = separator ? name.lastIndexOf(separator) : -1;
  return at > 0 ? { folder: name.slice(0, at), leaf: name.slice(at + separator!.length) } : { leaf: name };
}

/**
 * A search read as a folder and words: what it has up to its last separator
 * a folder the names start with (`Projects/`, `My projects/Old/`: spaces in
 * it kept), the rest words each in the name after it; all of it words where
 * it has no separator (or names have no folders)
 */
export function folderSearch(search: string, separator: string | undefined): { readonly folder: string; readonly words: readonly string[] } {
  const at = separator ? search.lastIndexOf(separator) : -1;
  const folder = at >= 0 ? search.slice(0, at + separator!.length).trimStart() : "";
  const rest = at >= 0 ? search.slice(at + separator!.length) : search;
  return { folder, words: rest.toLowerCase().split(/\s+/).filter(Boolean) };
}

/** Whether a name is found by a search read so: in its folder (ignoring case), each word in what follows it */
export function foundBy(name: string, search: { readonly folder: string; readonly words: readonly string[] }): boolean {
  const lower = name.toLowerCase();
  if (!lower.startsWith(search.folder.toLowerCase())) return false;
  const rest = lower.slice(search.folder.length);
  return search.words.every((word) => rest.includes(word));
}
