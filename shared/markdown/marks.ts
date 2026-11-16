// The marks an inline format is written with round its text (bold, italic, strikethrough, highlight, code), and a
// range of markdown grown to take in those round it. Pure.

/** The marks an inline format is written with, the longest of those alike first (`**` before `*`) */
export const INLINE_MARKS: readonly string[] = ["**", "__", "~~", "==", "*", "_", "`"];

// A letter or a digit: next to a mark outside it, the mark is no format's (`snake_case`, a word's own `*`)
const WORD = /[\p{L}\p{N}]/u;

/**
 * A range of markdown grown to take in the marks round it, as many as stand the same on both sides and are a format's:
 * the range's text not starting or ending with a space (a mark round text is not round its spaces: in `**x** and **y**`
 * the `** and **` round " and " are two formats' ends, not one's), no letter or digit outside either mark (in
 * `snake_case_name` the `_` round "case" are the name's). A rendered selection of a bold word is its letters alone,
 * which moved out of the text left its `**` behind, empty
 */
export function withMarksAround(text: string, range: { readonly from: number; readonly to: number }): { readonly from: number; readonly to: number } {
  let { from, to } = range;
  for (let grown = true; grown && from < to && !/\s/.test(text[from]!) && !/\s/.test(text[to - 1]!); ) {
    grown = false;
    for (const mark of INLINE_MARKS) {
      const before = from - mark.length;
      const after = to + mark.length;
      if (before < 0 || text.slice(before, from) !== mark || text.slice(to, after) !== mark) continue;
      if (WORD.test(text[before - 1] ?? "") || WORD.test(text[after] ?? "")) continue;
      from = before;
      to = after;
      grown = true;
      break;
    }
  }
  return { from, to };
}
