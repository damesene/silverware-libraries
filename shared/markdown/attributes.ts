// HTML's attributes as a tag in markdown holds them (`<grid columns="1fr 2fr" gap=16>`): read into a map of text
// values and written back. Pure. HTML's own syntax, so nothing is invented: a value in double or single quotes, or
// unquoted up to a space; a name alone is an attribute of an empty value. SilverBullet's smart quotes turn a typed
// `"` into “ and ”, so those are read as double quotes too (never written).

/** A tag's attributes by name, their values as text; the order they were written in */
export type Attributes = Readonly<Record<string, string>>;

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const QUOTES: Readonly<Record<string, string>> = { '"': '"', "'": "'", "“": "”", "”": "”", "„": "“" };

/** The attributes in a tag's text after its name (`columns="2" gap=8 wide`); a name given twice: its first value */
export function readAttributes(text: string): Attributes {
  const attributes: Record<string, string> = {};
  let at = 0;
  for (;;) {
    while (at < text.length && /\s/.test(text[at]!)) at++;
    if (at >= text.length) break;
    NAME.lastIndex = at;
    const name = NAME.exec(text);
    // Anything else is skipped to the next space (a stray `/` of a self-closing tag, a broken value)
    if (!name) {
      while (at < text.length && !/\s/.test(text[at]!)) at++;
      continue;
    }
    at = NAME.lastIndex;
    let value = "";
    let i = at;
    while (i < text.length && /[ \t]/.test(text[i]!)) i++;
    if (text[i] === "=") {
      i++;
      while (i < text.length && /[ \t]/.test(text[i]!)) i++;
      const close = QUOTES[text[i] ?? ""];
      if (close) {
        // (A smart quote's closing one may be either of its kind as SilverBullet typed it)
        const end = findClose(text, i + 1, close);
        value = text.slice(i + 1, end);
        at = Math.min(end + 1, text.length);
      } else {
        const start = i;
        while (i < text.length && !/\s/.test(text[i]!)) i++;
        value = text.slice(start, i);
        at = i;
      }
      value = unescape(value);
    }
    const key = name[0].toLowerCase();
    if (!(key in attributes)) attributes[key] = value;
  }
  return attributes;
}

/** Where a quoted value ends: its closing quote (a smart double quote closes by either of its kinds), else the text's end */
function findClose(text: string, from: number, close: string): number {
  for (let i = from; i < text.length; i++) {
    const c = text[i]!;
    if (c === close || ((close === "”" || close === "“") && (c === "”" || c === "“"))) return i;
  }
  return text.length;
}

/** The entities a value written by `writeAttributes` holds, back to their characters */
const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Attributes written as a tag holds them, each ` name="value"` (a value's `"` and `&` as entities); none: "" */
export function writeAttributes(attributes: Attributes): string {
  return Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join("");
}

/** Why a name cannot be an attribute's (empty, or of other characters), as text; undefined where it can */
export function validateAttributeName(name: string): string | undefined {
  if (!name) return "an attribute's name is empty";
  NAME.lastIndex = 0;
  const m = NAME.exec(name);
  return m && m[0].length === name.length ? undefined : `"${name}" is no attribute's name (letters, digits, -, _, : and . only, not first a digit)`;
}
