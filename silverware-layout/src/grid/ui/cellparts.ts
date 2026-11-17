// What a grid's cell draws besides the blocks of its markdown, known in one place: the space between them (the host's
// line breaks, the blank lines put back: ui/view.ts `keepBlankLines`) and what the grid puts in it (each cell's grip:
// ui/columngrips.ts); so the blocks a cell draws, and what is drawn before one, inline or a block. A control added to
// a cell is added here.

// Elements the host draws as blocks: after one, no line break ends a line first
const BLOCKS = new Set(["UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "TABLE", "BLOCKQUOTE", "HR", "DIV", "P", "DL", "FIGURE", "DETAILS"]);

/** A blank line of a cell's markdown its rendering left out, put back: its class */
export const BLANK = "swl-grid-blank";
// What a cell's rendering draws as space, not content: the host's line breaks (`br`) and the blank lines put back
const SPACERS = `br, .${BLANK}`;
/** A cell's grip: its class */
export const CELL_GRIP = "swl-grid-cell-grip";
/** What a grid puts in its cells besides their rendering: each cell's grip */
export const CELL_CONTROLS = `.${CELL_GRIP}`;
// What a cell draws that is no block of its markdown
const NOT_BLOCKS = `${SPACERS}, ${CELL_CONTROLS}`;

/** The blocks a cell draws of its markdown, in order: its children but the space between them and what the grid puts in it */
export const drawnBlocks = (cell: Element): Element[] => [...cell.children].filter((child) => !child.matches(NOT_BLOCKS));

/** The space drawn right before an element of a cell's rendering, and what is drawn before that */
export type SpaceBefore = {
  /**
   * The blank lines the host drew: its line breaks, the first of them only ending the line of what is inline before
   * them (a paragraph, text), each a blank line after a block or where nothing is
   */
  readonly drawn: number;
  /** The blank lines put back */
  readonly blanks: number;
  /** What is drawn before them in what holds the element: an element, or text the host left unwrapped (an item's text); none where the element is the first there */
  readonly before: Element | Text | undefined;
};

/** The space drawn right before an element of a cell's rendering, and what is before it (text of white space alone, the HTML's own, none) */
export function spaceBefore(element: Element): SpaceBefore {
  let breaks = 0;
  let blanks = 0;
  const after = (before: Element | Text | undefined, inline: boolean): SpaceBefore => ({ drawn: inline ? Math.max(0, breaks - 1) : breaks, blanks, before });
  for (let node = element.previousSibling; node; node = node.previousSibling) {
    if (node instanceof Element) {
      if (!node.matches(SPACERS)) return after(node, !BLOCKS.has(node.tagName.toUpperCase()));
      if (node.classList.contains(BLANK)) blanks++;
      else breaks++;
    } else if (node.nodeType === node.TEXT_NODE && /[^ \t\r\n]/.test(node.textContent ?? "")) return after(node as Text, true);
  }
  return after(undefined, false);
}
