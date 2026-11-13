// Where in a cell's markdown a click on its rendering was (an Alt+click shows the raw text with the cursor there). The
// host marks each rendered element with its offset in the cell's markdown (`data-pos`: where the element's markdown
// starts; SilverBullet leaves 0 out, so none is 0); within it the rendering's text is not the markdown's (its marks
// are gone), so the word clicked is looked for in the markdown from there. Pure.

/** A word's characters: letters and digits of any script */
const WORD = /[\p{L}\p{N}_]/u;

/** The word around `offset` in a text (none: "") */
export function wordAt(text: string, offset: number): string {
  let from = Math.max(0, Math.min(offset, text.length));
  let to = from;
  while (from > 0 && WORD.test(text[from - 1]!)) from--;
  while (to < text.length && WORD.test(text[to]!)) to++;
  return text.slice(from, to);
}

/**
 * The offset in a cell's markdown a click was at: from where the element clicked starts (`elementPos`), the word
 * clicked where it is next found in the markdown, plus how far into the word the click was; the word not found (none
 * clicked, or written otherwise): where the element starts. Never past the markdown's end
 */
export function positionInCell(markdown: string, elementPos: number, word: string, intoWord: number): number {
  const start = Math.max(0, Math.min(elementPos, markdown.length));
  if (!word) return start;
  const at = markdown.indexOf(word, start);
  return at < 0 ? start : Math.min(at + Math.max(0, Math.min(intoWord, word.length)), markdown.length);
}
