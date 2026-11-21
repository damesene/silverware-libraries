// Names the core keeps in cells, in one hidden tag after the cell's text:
// `core.n` names the line the cell heads, `core.cn` the cell itself. In a
// header cell, `core.n` is the column's fixed name
// (`| Unit price <meta core.n='price'> |`), by which formulas and the stored
// sorting name the column whatever its header says; in a body cell, the row's
// name (`| Pear <meta core.n='pear'> |`: `pear[price]` is the row's Price
// cell). `core.cn` names a body cell for formulas
// (`| 0.21 <meta core.cn='vat'> |`); a cell holding both has one tag,
// `<meta core.n='pear' core.cn='first'>`. SilverBullet does not show the tag,
// and leaves it out of the column's key in its index (verified), so queries
// see the header as before. Modules read and write names through the host.
// The model's names are shared/table/names.ts; this is how the markdown keeps them.
import { CELL_NAME_KEY, LINE_NAME_KEY } from "../../shared/table/names.ts";
import { metaAttribute, unescapeMetaValue } from "./markdown.ts";
import { attributeName, CORE, escapedForRegExp } from "./metanames.ts";

// The names' attributes as the markdown writes them (meta.ts makes their names)
export const LINE_NAME = attributeName(CORE, LINE_NAME_KEY);
export const CELL_NAME = attributeName(CORE, CELL_NAME_KEY);

const NAME_ATTRIBUTES = `(?:${escapedForRegExp(LINE_NAME)}|${escapedForRegExp(CELL_NAME)})`;
// A tag of names only: both, in any order (a formula's tag is another)
const NAMES_TAG_RE = new RegExp(String.raw`\s*<meta((?:\s+${NAME_ATTRIBUTES}\s*=\s*(?:"[^"]*"|'[^']*'))+)\s*\/?>`, "gi");
const NAMES_ATTRIBUTE_RE = new RegExp(String.raw`(${NAME_ATTRIBUTES})\s*=\s*(?:"([^"]*)"|'([^']*)')`, "gi");

type Names = { readonly n?: string; readonly cn?: string };

function namesOf(cell: string): Names {
  // The last tag Silverware Table writes counts, an attribute's last value in it
  const tag = Array.from(cell.matchAll(NAMES_TAG_RE)).pop();
  const names: { n?: string; cn?: string } = {};
  for (const match of tag?.[1]?.matchAll(NAMES_ATTRIBUTE_RE) ?? []) {
    const value = unescapeMetaValue(match[2] ?? match[3] ?? "").trim();
    names[match[1]!.toLowerCase() === CELL_NAME.toLowerCase() ? "cn" : "n"] = value || undefined;
  }
  return names;
}

/** The name of the line a cell heads: in a header the column's fixed name, in a body cell its row's name */
export function nameOf(cell: string): string | undefined {
  return namesOf(cell).n;
}

/** A body cell's own name, if any */
export function cellNameOf(cell: string): string | undefined {
  return namesOf(cell).cn;
}

/** The cell without its names */
export function withoutName(cell: string): string {
  return cell.replace(NAMES_TAG_RE, "").trim();
}

/** The cell's text with these names after it, in one tag */
function named(text: string, { n, cn }: Names): string {
  const attributes = [...(n ? [metaAttribute(LINE_NAME, n)] : []), ...(cn ? [metaAttribute(CELL_NAME, cn)] : [])];
  return [text, ...(attributes.length ? [`<meta ${attributes.join(" ")}>`] : [])].filter((part) => part !== "").join(" ");
}

/** The cell with the line name `name` (undefined: none), its text and own name kept */
export function withName(cell: string, name: string | undefined): string {
  return named(withoutName(cell), { n: name, cn: cellNameOf(cell) });
}

/** The cell named `name` (undefined: without a name), its text and line name kept */
export function withCellName(cell: string, name: string | undefined): string {
  return named(withoutName(cell), { n: nameOf(cell), cn: name });
}

/**
 * A row's name and the column of the cell holding it. Written in the first
 * cell, but a column inserted before it or the column moved takes the tag
 * along, so any cell of the row counts (the first one holding a name).
 */
export function rowNameIn(cells: readonly string[]): { readonly name: string; readonly column: number } | undefined {
  for (let column = 0; column < cells.length; column++) {
    const name = nameOf(cells[column]!);
    if (name) return { name, column };
  }
  return undefined;
}
