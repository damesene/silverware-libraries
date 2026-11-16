// Where in a cell's markdown a point of its rendering is (a click: the cell's field opens with the cursor there; an
// Alt+click shows the raw text with the cursor there; a selection's two ends). The host marks each rendered element
// with its offset in the cell's markdown (`data-pos`: where the element's markdown starts; SilverBullet leaves 0
// out, so none is 0); within it the rendering's text is the markdown's less its marks (`**`, `[[…|`, a list's `- `),
// so the point's offset in the element's text is followed through the markdown from where the element starts: the
// text as it is there where it is found whole (a paragraph without marks: to the character), else character by
// character, a markdown character not in the rendering passed over. Pure.

/** Characters the rendering may show for others of the markdown (a no-break space for a space, a break for a line's end) */
const same = (a: string, b: string) => a === b || (/\s/.test(a) && /\s/.test(b));

/**
 * The offset in a cell's markdown of a point in an element's rendering: `elementPos` where the element's markdown
 * starts, `rendered` the element's text, `into` how far into it the point is. Never past the markdown's end
 */
export function positionInCell(markdown: string, elementPos: number, rendered: string, into: number): number {
  const start = Math.max(0, Math.min(elementPos, markdown.length));
  const offset = Math.max(0, Math.min(into, rendered.length));
  if (!rendered) return start;
  // The rendering's text as written in the markdown, from the element's start: exact
  const whole = markdown.indexOf(rendered, start);
  if (whole >= 0 && (whole === start || !/\S/.test(markdown.slice(start, whole).replace(/[*_~`#>\-+[\]()!|=^:]/g, "")))) return whole + offset;
  // Else character by character: a markdown character the rendering does not show passed over
  let at = start;
  for (let i = 0; i < offset && at < markdown.length; i++) {
    while (at < markdown.length && !same(markdown[at]!, rendered[i]!)) at++;
    if (at < markdown.length) at++;
  }
  // Up to the next character shown, past the marks before it (`**` before a bold word clicked at its start)
  const next = rendered[offset];
  if (next !== undefined) {
    let shown = at;
    while (shown < markdown.length && !same(markdown[shown]!, next)) shown++;
    if (shown < markdown.length) at = shown;
  }
  return Math.min(at, markdown.length);
}
