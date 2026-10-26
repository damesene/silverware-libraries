// Where the selection goes after a change, marked in the text written: two
// characters of Unicode's Private Use Area, which a page's text does not have
// and nobody types (a typeable mark such as {{cursor}} is SilverBullet's
// templates'). `cursor()` marks a caret, `cursor(text)` the text selected.

const START = "";
const END = "";

/** A caret here (nothing selected), or `text` written and selected */
export function cursor(text = ""): string {
  return START + text + END;
}

/**
 * The text without its marks, and the selection they mark in it (relative
 * to the text): the last pair counts (a format written on several lines marks
 * each); undefined without marks. Marks not in pairs: an error.
 */
export function marked(text: string): { text: string; select: { from: number; to: number } | undefined } {
  if (!text.includes(START) && !text.includes(END)) return { text, select: undefined };
  let out = "";
  let start = -1;
  let select: { from: number; to: number } | undefined;
  for (const ch of text) {
    if (ch === START) {
      if (start >= 0) throw new Error("a cursor mark starts inside another one");
      start = out.length;
    } else if (ch === END) {
      if (start < 0) throw new Error("a cursor mark ends without its start");
      select = { from: start, to: out.length };
      start = -1;
    } else out += ch;
  }
  if (start >= 0) throw new Error("a cursor mark is not ended");
  return { text: out, select };
}
