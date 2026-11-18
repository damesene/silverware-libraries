// Markdown shown as SilverBullet's editor shows it (its behaviour, written here: docs/silverware-editor.md): a task's
// `[ ]` a checkbox toggling it, a done task struck through, a bullet list's `-` a bullet, the marks of emphasis, code,
// headings, highlights (`==`), super- and subscripts, links and `[[wiki links]]` hidden, a URL of its own a link, a
// quote's `>` hidden and a bar beside it, an indented code block a card, a fenced code block a card (its fences hidden, its language at its
// end), a horizontal rule a line, an escape's backslash hidden, an embed drawn and a link's icon before it
// (by its plugin, as it says: `drawing`), a link followed as it is pressed (by its plugin: `openLink`, docs/silverware-
// editor-links.md), a table drawn as one (read-only: its cells edited in its markdown), each shown again as its
// markdown where the selection touches it. A read-only editor shows none: nothing to edit there. Built over the
// CodeMirror module loaded beside the bundle (its types alone here), as src/codemirror.ts is.
import type { EditorState, Extension, Range } from "@codemirror/state";
import type { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownConfig } from "@lezer/markdown";
import type { EditorEmbed, FieldDrawing, LinkOpening } from "../../shared/editor.ts";
import { isMac } from "../../shared/keys.ts";
import { inlineMarks } from "../../shared/markdown/inline.ts";
import type { CodeMirror } from "./codemirror.ts";
import { keepPageStyles } from "./pagestyles.ts";

/** `[[page]]` and `[[page|alias]]` read as a node of their own (lezer's markdown knows none): a `WikiLink`, its marks */
export const wikiLinks: MarkdownConfig = {
  defineNodes: ["WikiLink", "WikiLinkMark"],
  parseInline: [
    {
      name: "WikiLink",
      before: "Link",
      parse(cx, next, pos) {
        if (next !== 91 || cx.char(pos + 1) !== 91) return -1;
        const link = /^[^[\]\n]+\]\]/.exec(cx.slice(pos + 2, cx.end));
        if (!link) return -1;
        const end = pos + 2 + link[0].length;
        return cx.addElement(cx.elt("WikiLink", pos, end, [cx.elt("WikiLinkMark", pos, pos + 2), cx.elt("WikiLinkMark", end - 2, end)]));
      },
    },
  ],
};

// (One delimiter's type for both ends: lezer pairs them by it)
const HIGHLIGHT = { resolve: "Highlight", mark: "HighlightMark" };

/** `==text==` read as SilverBullet reads it (lezer's markdown knows none): a `Highlight`, its marks */
export const highlights: MarkdownConfig = {
  defineNodes: ["Highlight", "HighlightMark"],
  parseInline: [
    {
      name: "Highlight",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== 61 || cx.char(pos + 1) !== 61) return -1;
        return cx.addDelimiter(HIGHLIGHT, pos, pos + 2, true, true);
      },
    },
  ],
};

// The marks hidden in what they mark, by the node marked
const MARKED = new Set(["Emphasis", "StrongEmphasis", "Strikethrough", "InlineCode", "Highlight", "Superscript", "Subscript"]);
const MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "HighlightMark", "SuperscriptMark", "SubscriptMark"]);
// What is drawn in a look of its own, its marks hidden or not: a highlight, a superscript, a subscript
const LOOKS: Readonly<Record<string, string>> = { Highlight: "swe-highlight", Superscript: "swe-sup", Subscript: "swe-sub" };
// What a URL of its own (`https://…`, `<https://…>`) is not: a part of a link, an image or a link's reference
const URL_OWNERS = new Set(["Link", "Image", "LinkReference"]);

/** A table's cell's content as drawn: its text, and its inline parts in elements of their own */
export type Inline = string | { readonly tag: string; readonly class?: string; readonly parts: readonly Inline[] };
/** A table as drawn: each column's alignment, its rows (the header's first), each cell's content and its start in the table's text */
export type TableShape = {
  readonly align: readonly ("left" | "right" | "center" | undefined)[];
  readonly rows: readonly (readonly { readonly at: number; readonly parts: readonly Inline[] }[])[];
};

// Inline nodes drawn in an element of their own, and the parts of a link left out of its text
const INLINE_TAGS: Readonly<Record<string, { tag: string; class?: string }>> = {
  Emphasis: { tag: "em" },
  StrongEmphasis: { tag: "strong" },
  Strikethrough: { tag: "s" },
  InlineCode: { tag: "code" },
  Link: { tag: "span", class: "swe-link" },
  Highlight: { tag: "span", class: "swe-highlight" },
  Superscript: { tag: "span", class: "swe-sup" },
  Subscript: { tag: "span", class: "swe-sub" },
};
const LEFT_OUT = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark", "HighlightMark", "SuperscriptMark", "SubscriptMark", "LinkMark", "URL", "LinkTitle", "LinkLabel"]);

/** A node's content as drawn, from `from` to `to` of it: the text between its children, its children drawn */
function inlineOf(state: EditorState, node: SyntaxNode, from: number, to: number): Inline[] {
  const parts: Inline[] = [];
  let at = from;
  const text = (end: number) => end > at && parts.push(state.sliceDoc(at, end));
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.to <= from || child.from >= to) continue;
    text(child.from);
    at = child.to;
    // (A URL of its own a link: a link's or an image's left out)
    if (child.name === "URL" && !URL_OWNERS.has(node.name)) {
      parts.push({ tag: "span", class: "swe-link", parts: [state.sliceDoc(child.from, child.to)] });
      continue;
    }
    if (LEFT_OUT.has(child.name)) continue;
    if (child.name === "Escape") parts.push(state.sliceDoc(child.from + 1, child.to));
    else if (child.name === "WikiLink") {
      // (Its alias where it has one, else the page's name)
      const inner = state.sliceDoc(child.from + 2, child.to - 2);
      parts.push({ tag: "span", class: "swe-wiki-link", parts: [inner.slice(inner.indexOf("|") + 1)] });
    } else if (INLINE_TAGS[child.name]) parts.push({ ...INLINE_TAGS[child.name]!, parts: inlineOf(state, child, child.from, child.to) });
    else parts.push(...inlineOf(state, child, child.from, child.to));
  }
  text(to);
  return parts;
}

/**
 * A table's shape from its node (GitHub's tables: a row's cells between its `|`s, the outer ones optional; as many
 * cells in each row as in its header, a short row's filled with empty ones, a long row's cut); each cell's start from
 * `base` (the widget's start: the table's line's, an indent before it)
 */
export function tableShape(state: EditorState, table: SyntaxNode, base = table.from): TableShape {
  let align: TableShape["align"] = [];
  const rows: { at: number; parts: Inline[] }[][] = [];
  for (let row = table.firstChild; row; row = row.nextSibling) {
    if (row.name === "TableDelimiter") {
      align = state
        .sliceDoc(row.from, row.to)
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((one) => {
          const spec = one.trim();
          return spec.startsWith(":") && spec.endsWith(":") ? "center" : spec.endsWith(":") ? "right" : spec.startsWith(":") ? "left" : undefined;
        });
      continue;
    }
    if (row.name !== "TableHeader" && row.name !== "TableRow") continue;
    const pipes: SyntaxNode[] = [];
    const cells: SyntaxNode[] = [];
    for (let child = row.firstChild; child; child = child.nextSibling) (child.name === "TableDelimiter" ? pipes : cells).push(child);
    // (The cells' bounds: the row's ends and its pipes; an outer pipe's empty side none)
    const bounds = [row.from, ...pipes.flatMap((pipe) => [pipe.from, pipe.to]), row.to];
    const spans: [number, number][] = [];
    for (let index = 0; index < bounds.length; index += 2) spans.push([bounds[index]!, bounds[index + 1]!]);
    const blank = (span: [number, number]) => !state.sliceDoc(span[0], span[1]).trim();
    if (pipes.length && spans.length > 1 && blank(spans[0]!)) spans.shift();
    if (pipes.length && spans.length > 1 && blank(spans[spans.length - 1]!)) spans.pop();
    rows.push(
      spans.map(([from, to]) => {
        const cell = cells.find((one) => one.from >= from && one.to <= to);
        return { at: (cell?.from ?? from) - base, parts: cell ? inlineOf(state, cell, cell.from, cell.to) : [] };
      }),
    );
  }
  const width = rows[0]?.length ?? 0;
  return {
    align: Array.from({ length: width }, (_, index) => align[index]),
    rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? { at: row[row.length - 1]?.at ?? 0, parts: [] })),
  };
}

/** A task's checkbox flipped in the text: its `[ ]` or `[x]` at `at` */
function toggleTask(view: EditorView, at: number): void {
  const marker = view.state.sliceDoc(at, at + 3);
  if (view.state.readOnly || !/^\[[ xX]\]$/.test(marker)) return;
  view.dispatch({ changes: { from: at + 1, to: at + 2, insert: marker[1] === " " ? "x" : " " }, userEvent: "input" });
}

// A link as the live preview draws it: what a press on it follows
const LINK_TEXT = ".swe-link, .swe-wiki-link";

/** The link (a markdown link, a wiki link) a place of the text is in: its markdown, none where it is in none */
export function linkAt(state: EditorState, tree: { resolveInner(at: number, side: -1 | 0 | 1): SyntaxNode }, at: number): string | undefined {
  for (let node: SyntaxNode | null = tree.resolveInner(at, 1); node; node = node.parent) {
    if (node.name === "WikiLink" || node.name === "Link") return state.sliceDoc(node.from, node.to);
    // (A URL of its own as the markdown link it stands for: what its user follows a link's markdown by)
    if (node.name === "URL" && !URL_OWNERS.has(node.parent?.name ?? "")) {
      const url = state.sliceDoc(node.from, node.to);
      return `[${url}](${url})`;
    }
  }
  return undefined;
}

/**
 * A list's marks and indent laid out in the page's columns, as SilverBullet's editor does (`--editor-column`, after
 * 2.12.1; else a character's width): each mark the columns its source takes, the space after it among them (a bullet's
 * `- ` 2, a number's `1. ` 3, a task's box `[ ] ` 4), an indent its own; a rendered list's of Silverware Layout's grid
 * the same
 */
export const COLUMN = "var(--editor-column, 1ch)";
export const LIST_COLUMNS = { bullet: 2, task: 4 } as const;

/**
 * The live preview: decorations of the text, made again on each change of it or of the selection; `drawing` what a
 * plugin draws in it, `openLink` what follows a link pressed
 */
export function livePreview(cm: CodeMirror, drawing?: FieldDrawing, openLink?: (markdown: string, how: LinkOpening) => void): Extension {
  class Checkbox extends cm.WidgetType {
    constructor(
      readonly checked: boolean,
      readonly readOnly: boolean,
    ) {
      super();
    }
    override eq(other: Checkbox): boolean {
      return other.checked === this.checked && other.readOnly === this.readOnly;
    }
    toDOM(view: EditorView): HTMLElement {
      const box = view.dom.ownerDocument.createElement("input");
      box.type = "checkbox";
      box.className = "swe-checkbox";
      box.checked = this.checked;
      box.disabled = this.readOnly;
      box.tabIndex = -1;
      // (Its press moves no caret: the task's marks stay hidden; the click is the toggle, the box drawn again from the text)
      box.addEventListener("mousedown", (event) => event.preventDefault());
      box.addEventListener("click", (event) => {
        event.preventDefault();
        toggleTask(view, view.posAtDOM(slot));
      });
      // (In the room the page gives a task's box, the space after it in it: its text where the page's begins)
      const slot = view.dom.ownerDocument.createElement("span");
      slot.className = "swe-task-box";
      slot.append(box);
      return slot;
    }
    override ignoreEvent(): boolean {
      return true;
    }
  }

  class Bullet extends cm.WidgetType {
    override eq(): boolean {
      return true;
    }
    toDOM(view: EditorView): HTMLElement {
      const bullet = view.dom.ownerDocument.createElement("span");
      bullet.className = "swe-bullet";
      bullet.textContent = "•";
      return bullet;
    }
  }

  // A quote's mark not shown: its room kept, the text not moving as the caret comes to it
  class Spacer extends cm.WidgetType {
    constructor(readonly columns: number) {
      super();
    }
    override eq(other: Spacer): boolean {
      return other.columns === this.columns;
    }
    toDOM(view: EditorView): HTMLElement {
      const spacer = view.dom.ownerDocument.createElement("span");
      spacer.className = "swe-quote-mark";
      spacer.style.minWidth = `calc(${this.columns} * ${COLUMN})`;
      return spacer;
    }
    // (A press on it the editor's: the caret put beside it)
    override ignoreEvent(): boolean {
      return false;
    }
  }

  // An embed as its plugin draws it, into an element of the editor's (a click on it puts the caret there: its markdown
  // shown, as a click on an embed in the page does)
  class Embed extends cm.WidgetType {
    // What each element drawn ends with: its drawing, its watchers
    private static readonly ends = new WeakMap<HTMLElement, AbortController>();
    constructor(
      readonly drawn: EditorEmbed,
      readonly markdown: string,
      // Which end of its markdown it is drawn at: an embed's and a link's icon at its start, what follows a link at its end
      readonly at: "start" | "end" = "start",
      // Drawn before a link's text as a part of it (a file's icon): a press on it follows the link, as on its text
      readonly lead = false,
    ) {
      super();
    }
    override eq(other: Embed): boolean {
      return other.drawn.key === this.drawn.key && other.markdown === this.markdown && other.at === this.at && other.lead === this.lead;
    }
    toDOM(view: EditorView): HTMLElement {
      const container = view.dom.ownerDocument.createElement("span");
      container.className = this.lead ? "swe-embed swe-link-lead" : "swe-embed";
      const control = new AbortController();
      Embed.ends.set(container, control);
      // (Its height known as it is drawn, perhaps later: the editor measures its lines again)
      const win = view.dom.ownerDocument.defaultView;
      if (win?.ResizeObserver) {
        const observer = new win.ResizeObserver(() => view.requestMeasure());
        observer.observe(container);
        control.signal.addEventListener("abort", () => observer.disconnect());
      }
      keepPageStyles(container, control.signal);
      try {
        // (Its markdown replaced where it is now: found by its element, checked against the text as it was drawn)
        const markdown = this.markdown;
        const atEnd = this.at === "end";
        const edit = {
          replace: (to: string): boolean => {
            if (view.state.readOnly) return false;
            let from: number;
            try {
              // (Drawn after its markdown: that markdown ends where the widget is)
              from = view.posAtDOM(container) - (atEnd ? markdown.length : 0);
            } catch {
              return false;
            }
            if (from < 0) return false;
            if (view.state.sliceDoc(from, from + markdown.length) !== markdown) return false;
            // (Taken out where it is its line alone: the line with it)
            const line = view.state.doc.lineAt(from);
            const whole = !to && line.from === from && line.to === from + markdown.length;
            const end = whole && line.to < view.state.doc.length ? line.to + 1 : from + markdown.length;
            const start = whole && end === from + markdown.length && line.from > 0 ? line.from - 1 : from;
            view.dispatch({ changes: { from: start, to: end, insert: to } });
            return true;
          },
        };
        this.drawn.draw(container, control.signal, edit);
        // (One that takes its own presses: an Alt+press puts the caret at its start, its markdown shown)
        if (this.drawn.interactive)
          container.addEventListener(
            "mousedown",
            (event) => {
              if (!event.altKey || event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              try {
                view.dispatch({ selection: { anchor: view.posAtDOM(container) } });
                view.focus();
              } catch {
                // (Gone from the editor meanwhile)
              }
            },
            { capture: true, signal: control.signal },
          );
      } catch {
        // (Not drawn: an empty place, its markdown a click away)
      }
      return container;
    }
    override destroy(dom: HTMLElement): void {
      Embed.ends.get(dom)?.abort();
    }
    // (Its press the editor's: the caret put beside it, its markdown shown; one that takes its own presses keeps them,
    // its Alt+press putting the caret at it, above)
    override ignoreEvent(): boolean {
      return !!this.drawn.interactive;
    }
  }

  // A table drawn as the page draws it, read-only: a press in a cell puts the caret at its start, its markdown shown
  class Table extends cm.WidgetType {
    constructor(
      readonly shape: TableShape,
      readonly readOnly: boolean,
    ) {
      super();
    }
    override eq(other: Table): boolean {
      return other.readOnly === this.readOnly && JSON.stringify(other.shape) === JSON.stringify(this.shape);
    }
    toDOM(view: EditorView): HTMLElement {
      const doc = view.dom.ownerDocument;
      const draw = (parts: readonly Inline[], into: HTMLElement) => {
        for (const part of parts) {
          if (typeof part === "string") into.append(part);
          else {
            const element = doc.createElement(part.tag);
            if (part.class) element.className = part.class;
            draw(part.parts, element);
            into.append(element);
          }
        }
      };
      const rowOf = (cells: TableShape["rows"][number], tag: "th" | "td") => {
        const row = doc.createElement("tr");
        cells.forEach((cell, index) => {
          const element = doc.createElement(tag);
          const align = this.shape.align[index];
          if (align) element.style.textAlign = align;
          element.setAttribute("data-swe-at", String(cell.at));
          draw(cell.parts, element);
          row.append(element);
        });
        return row;
      };
      const [header, ...body] = this.shape.rows;
      const head = doc.createElement("thead");
      if (header) head.append(rowOf(header, "th"));
      const rows = doc.createElement("tbody");
      for (const cells of body) rows.append(rowOf(cells, "td"));
      const table = doc.createElement("table");
      table.append(head, rows);
      const frame = doc.createElement("div");
      frame.className = "swe-table";
      frame.append(table);
      frame.addEventListener("mousedown", (event) => {
        if (this.readOnly || event.button !== 0) return;
        event.preventDefault();
        // (The table's start where it is now: text above may have changed since it was drawn, its offsets not)
        const cell = event.target instanceof Element ? event.target.closest("[data-swe-at]") : null;
        const at = view.posAtDOM(frame) + Number(cell?.getAttribute("data-swe-at") ?? 0);
        view.dispatch({ selection: { anchor: Math.min(at, view.state.doc.length) }, userEvent: "select.pointer" });
        view.focus();
      });
      return frame;
    }
    // (Its presses its own: the caret put in the cell pressed; a wide table's scroll its own)
    override ignoreEvent(): boolean {
      return true;
    }
  }

  const hidden = cm.Decoration.replace({});
  // A list's marks in the room the page gives them, the space after each in it (its text where the page's begins, the
  // mark drawn or shown as written): a bullet, a number, a task's box
  const bullet = cm.Decoration.replace({ widget: new Bullet() });
  const bulletMark = cm.Decoration.mark({ class: "swe-list-mark" });
  const taskMark = cm.Decoration.mark({ class: "swe-task-mark" });
  // (A number's and an indent's room by their columns: as many as the source has)
  const slots = new Map<string, ReturnType<typeof cm.Decoration.mark>>();
  const slot = (className: string, columns: number) => {
    const key = `${className}/${columns}`;
    let mark = slots.get(key);
    if (!mark) slots.set(key, (mark = cm.Decoration.mark({ class: className, attributes: { style: `min-width: calc(${columns} * ${COLUMN})` } })));
    return mark;
  };
  const done = cm.Decoration.mark({ class: "swe-task-done" });
  // A list's line by the columns before its text (its indent, its marks): its next lines hang that far in
  // (`--swe-list-hang`)
  const listLines = new Map<number, ReturnType<typeof cm.Decoration.line>>();
  const listLine = (columns: number) => {
    let line = listLines.get(columns);
    if (!line) listLines.set(columns, (line = cm.Decoration.line({ class: "swe-list-line", attributes: { style: `--swe-list-hang: calc(${columns} * ${COLUMN})` } })));
    return line;
  };
  // (A line's columns before a place, a tab to its stop)
  const columnsBefore = (state: EditorView["state"], from: number, at: number) => {
    let columns = 0;
    for (const char of state.sliceDoc(from, at)) columns = char === "\t" ? columns + state.tabSize - (columns % state.tabSize) : columns + 1;
    return columns;
  };
  const link = cm.Decoration.mark({ class: "swe-link" });
  const wikiLink = cm.Decoration.mark({ class: "swe-wiki-link" });
  const hashtag = cm.Decoration.mark({ class: "swe-hashtag" });
  // A fenced code block's lines as the page draws them: one card, its first and last line its corners; its fences'
  // lines (their backticks, its language) shown as written only where the selection touches the block, else its
  // language alone, at the line's end
  const codeLines = new Map<string, ReturnType<typeof cm.Decoration.line>>();
  const codeLine = (first: boolean, last: boolean, fence: boolean) => {
    const className = ["swe-code-line", first && "swe-code-first", last && "swe-code-last", fence && "swe-code-fence"].filter(Boolean).join(" ");
    let line = codeLines.get(className);
    if (!line) codeLines.set(className, (line = cm.Decoration.line({ class: className })));
    return line;
  };
  const codeInfo = cm.Decoration.mark({ class: "swe-code-info" });
  // A quote's lines: its bar, its colours
  const quoteLine = cm.Decoration.line({ class: "swe-quote" });
  // What is drawn in a look of its own (`LOOKS`) and a URL of its own drawn as a link
  const looks = new Map(Object.entries(LOOKS).map(([name, className]) => [name, cm.Decoration.mark({ class: className })]));
  // A horizontal rule's line: a line across it, its `---` hidden
  const ruleLine = cm.Decoration.line({ class: "swe-hr" });
  // What holds no hashtag: code (fenced, indented), HTML
  const NO_TAGS = new Set(["FencedCode", "CodeBlock", "HTMLBlock", "CommentBlock"]);

  function decorations(state: EditorView["state"]): DecorationSet {
    const out: Range<Decoration>[] = [];
    // (Shown where the selection touches it, its ends too: a caret beside a mark shows it, as it is about to be typed in)
    const shown = (from: number, to: number) => !state.readOnly && state.selection.ranges.some((range) => range.from <= to && from <= range.to);
    const hide = (from: number, to: number) => from < to && out.push(hidden.range(from, to));
    // What the plugin draws before a link's text and after it, where it draws something (a file's icon, its menu's
    // arrow), its markdown the link's
    const linkIcon = (from: number, to: number) => {
      const markdown = state.sliceDoc(from, to);
      const before = drawing?.linkIcon?.(markdown);
      if (before) out.push(cm.Decoration.widget({ widget: new Embed(before, markdown, "start", true), side: -1 }).range(from));
      const after = drawing?.linkAfter?.(markdown);
      if (after) out.push(cm.Decoration.widget({ widget: new Embed(after, markdown, "end"), side: 1 }).range(to));
    };
    const children = (node: SyntaxNode) => {
      const all: SyntaxNode[] = [];
      for (let child = node.firstChild; child; child = child.nextSibling) all.push(child);
      return all;
    };
    cm.syntaxTree(state).iterate({
      enter: ({ name, from, to, node }) => {
        if (MARKED.has(name)) {
          const look = looks.get(name);
          if (look) out.push(look.range(from, to));
          if (!shown(from, to)) for (const child of children(node)) if (MARKS.has(child.name)) hide(child.from, child.to);
        } else if (name === "URL" && !URL_OWNERS.has(node.parent?.name ?? "")) {
          // `https://…` and `<https://…>`: a link, its `<` `>` hidden
          out.push(link.range(from, to));
          const auto = node.parent?.name === "Autolink" ? node.parent : undefined;
          if (auto && !shown(auto.from, auto.to)) for (const child of children(auto)) if (child.name === "LinkMark") hide(child.from, child.to);
        } else if (name === "Blockquote") {
          // Its lines a quote's (a nested one's the same)
          const last = state.doc.lineAt(to).number;
          for (let n = state.doc.lineAt(from).number; n <= last; n++) out.push(quoteLine.range(state.doc.line(n).from));
        } else if (name === "QuoteMark") {
          // (`> ` in its room, shown as written or not: the text does not move as the caret comes to it)
          const end = state.sliceDoc(to, to + 1) === " " ? to + 1 : to;
          out.push((shown(from, to) ? slot("swe-quote-mark", end - from) : cm.Decoration.replace({ widget: new Spacer(end - from) })).range(from, end));
        } else if (name === "CodeBlock") {
          // An indented code block: a card, as a fenced one
          const first = state.doc.lineAt(from).number;
          const last = state.doc.lineAt(to).number;
          for (let n = first; n <= last; n++) out.push(codeLine(n === first, n === last, false).range(state.doc.line(n).from));
          return false;
        } else if (/^ATXHeading\d$/.test(name)) {
          const mark = node.firstChild;
          // (The `#`s and the space after them; a heading of no text keeps them, else nothing is left of it)
          if (mark?.name === "HeaderMark" && mark.to < to && !shown(from, to)) hide(mark.from, Math.min(to, mark.to + 1));
        } else if (name === "ListMark") {
          // (A list's line as the page draws one, its marks shown as written or not: the text does not move as the caret
          // comes to them; its next lines hang after its marks)
          const line = state.doc.lineAt(from);
          const after = state.sliceDoc(to, line.to);
          const end = after.startsWith(" ") ? to + 1 : to;
          const ordered = !/^[-+*]$/.test(state.sliceDoc(from, to));
          const task = /^ \[[ xX]\](?= |$)/.test(after);
          const indent = columnsBefore(state, line.from, from);
          const mark = ordered ? to - from + 1 : LIST_COLUMNS.bullet;
          out.push(listLine(indent + mark + (task ? LIST_COLUMNS.task : 0)).range(line.from));
          // (An indent of spaces alone in its columns, as the page's: a nested item's mark where the page has it)
          if (indent && /^[ \t]+$/.test(state.sliceDoc(line.from, from))) out.push(slot("swe-list-indent", indent).range(line.from, from));
          if (ordered) out.push(slot("swe-list-mark swe-list-number", mark).range(from, end));
          else out.push((shown(from, to) ? bulletMark : bullet).range(from, end));
        } else if (name === "TaskMarker") {
          const checked = /x/i.test(state.sliceDoc(from, to));
          const end = state.sliceDoc(to, to + 1) === " " ? to + 1 : to;
          out.push((shown(from, to) ? taskMark : cm.Decoration.replace({ widget: new Checkbox(checked, state.readOnly) })).range(from, end));
          const task = node.parent;
          if (checked && task) {
            let start = to;
            while (start < task.to && /[ \t]/.test(state.sliceDoc(start, start + 1))) start++;
            if (start < task.to) out.push(done.range(start, task.to));
          }
        } else if (name === "FencedCode") {
          // (Its fences' lines: those its marks are on, the closing one missing where the block runs to the text's end)
          const fences = new Set(children(node).flatMap((child) => (child.name === "CodeMark" ? [state.doc.lineAt(child.from).number] : [])));
          const covered = !shown(from, to);
          const first = state.doc.lineAt(from).number;
          const last = state.doc.lineAt(to).number;
          for (let n = first; n <= last; n++) out.push(codeLine(n === first, n === last, covered && fences.has(n)).range(state.doc.line(n).from));
          if (covered) for (const child of children(node)) if (child.name === "CodeInfo") out.push(codeInfo.range(child.from, child.to));
          // (Its language's nodes not read as markdown's)
          return false;
        } else if (name === "HorizontalRule") {
          if (shown(from, to)) return;
          hide(from, to);
          out.push(ruleLine.range(state.doc.lineAt(from).from));
        } else if (name === "Table") {
          // A table drawn, its whole lines replaced (one indented in a list from its line's start), unless the selection
          // touches it; its inline nodes not decorated again within it
          const start = state.doc.lineAt(from).from;
          const end = state.doc.lineAt(to).to;
          if (state.sliceDoc(start, from).trim() || shown(start, end)) return;
          out.push(cm.Decoration.replace({ widget: new Table(tableShape(state, node, start), state.readOnly), block: true }).range(start, end));
          return false;
        } else if (name === "Image") {
          // `![Alt](url)`: drawn where the plugin draws it
          const drawn = shown(from, to) ? undefined : drawing?.embed?.(state.sliceDoc(from, to));
          if (drawn) out.push(cm.Decoration.replace({ widget: new Embed(drawn, state.sliceDoc(from, to)) }).range(from, to));
        } else if (name === "Link") {
          // An inline link with text alone, `[text](url)`: its text shown, the rest hidden (a reference link left as written)
          const parts = children(node);
          const close = parts.find((part, index) => part.name === "LinkMark" && index > 0 && state.sliceDoc(part.from, part.to) === "]");
          if (!close || close.from === from + 1 || !parts.some((part) => part.name === "URL") || shown(from, to)) return;
          linkIcon(from, to);
          hide(from, from + 1);
          out.push(link.range(from + 1, close.from));
          hide(close.from, to);
        } else if (name === "WikiLink") {
          // `![[…]]`: an embed, drawn where the plugin draws it, else its markdown as written (not a link's)
          if (from > 0 && state.sliceDoc(from - 1, from) === "!") {
            const drawn = shown(from - 1, to) ? undefined : drawing?.embed?.(state.sliceDoc(from - 1, to));
            if (drawn) out.push(cm.Decoration.replace({ widget: new Embed(drawn, state.sliceDoc(from - 1, to)) }).range(from - 1, to));
            return;
          }
          if (shown(from, to)) return;
          // (Its alias where it has one, else the page's name)
          const pipe = state.sliceDoc(from + 2, to - 2).indexOf("|");
          const start = pipe < 0 ? from + 2 : from + 2 + pipe + 1;
          if (start >= to - 2) return;
          linkIcon(from, to);
          hide(from, start);
          out.push(wikiLink.range(start, to - 2));
          hide(to - 2, to);
        } else if (name === "Escape") {
          // `\[`: the character alone, as the page draws it
          if (!shown(from, to)) hide(from, from + 1);
        }
      },
    });
    // Hashtags, as SilverBullet reads them in a line (shared/markdown/inline.ts: not in inline code, a URL, a link's
    // target), its look (a pill, its theme's colours); none in code. Never hidden: a tag is shown as written
    const tree = cm.syntaxTree(state);
    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n);
      if (!line.text.includes("#")) continue;
      let inCode = false;
      for (let node: SyntaxNode | null = tree.resolveInner(line.from, 1); node; node = node.parent) if (NO_TAGS.has(node.name)) inCode = true;
      if (inCode) continue;
      for (const mark of inlineMarks(line.text)) if (mark.kind === "tag") out.push(hashtag.range(line.from + mark.from, line.from + mark.to));
    }
    return cm.Decoration.set(out, true);
  }

  const field = cm.StateField.define<DecorationSet>({
    create: decorations,
    // (Made again on every transaction: the text, the selection, read-only and the tree's parse all change it; the
    // editors are small, a cell, an item's content)
    update: (_value, transaction) => decorations(transaction.state),
    provide: (field) => cm.EditorView.decorations.from(field),
  });
  if (!openLink) return field;
  // A link drawn as a link (its markdown not shown) pressed: followed by the editor's user, the caret not moved; in a
  // new tab by the middle button, Ctrl (Cmd on a Mac, where Ctrl+press is the context menu's); an Alt+press the
  // editor's (the caret there, its markdown shown). Followed once: a double press's second press none
  const mac = isMac();
  const follow = cm.EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (event.altKey || (event.button !== 0 && event.button !== 1) || (mac && event.ctrlKey)) return false;
      // (Its text, or what is drawn before it as a part of it: a file's icon, as in the page)
      const text = event.target instanceof Element ? event.target.closest(`${LINK_TEXT}, .swe-link-lead`) : null;
      const markdown = text && view.contentDOM.contains(text) ? linkAt(view.state, cm.syntaxTree(view.state), view.posAtDOM(text)) : undefined;
      if (!markdown) return false;
      event.preventDefault();
      if (event.detail <= 1) openLink(markdown, { newTab: event.button === 1 || (mac ? event.metaKey : event.ctrlKey) });
      return true;
    },
  });
  return [field, follow];
}

/** What the live preview's elements look like: SilverBullet's CSS variables where it has them */
export const PREVIEW_THEME = {
  ".swe-checkbox": { margin: "0 0.15em 0 0", verticalAlign: "0.02em", accentColor: "var(--ui-accent-color, #464cfc)", cursor: "pointer" },
  ".swe-checkbox:disabled": { cursor: "default" },
  ".swe-task-done": { textDecoration: "line-through" },
  ".swe-embed": { display: "inline-block", maxWidth: "100%", verticalAlign: "bottom" },
  ".swe-embed img": { maxWidth: "100%" },
  // (A table as SilverBullet draws one, its variables where it has them: a card where its theme draws one (its line, its
  // corners, its shadow), its cells as the page's (the look given, else these); its own scroll where it is wider)
  ".swe-table": {
    overflowX: "auto",
    margin: "0.25em 0",
    cursor: "text",
    // (Its line only where the theme gives cards corners: SilverBullet 2.12.1 has the line's colour for other things,
    // and no card)
    border: "clamp(0px, var(--ui-radius-xl, 0px) * 1000, 1px) solid var(--ui-surface-border-color, transparent)",
    borderRadius: "var(--ui-radius-xl, 0)",
    boxShadow: "var(--ui-shadow-card, none)",
    background: "var(--root-background-color, transparent)",
  },
  ".swe-table table": { borderCollapse: "collapse", width: "100%", fontSize: "0.9em" },
  ".swe-table tbody tr:last-child td": { borderBottom: "none" },
  ".swe-table th, .swe-table td": {
    padding: "6px 10px",
    textAlign: "left",
    verticalAlign: "top",
    borderBottom: "1px solid var(--ui-surface-border-color, color-mix(in srgb, currentColor 20%, transparent))",
  },
  ".swe-table th": { background: "var(--editor-table-head-background-color, transparent)", color: "var(--editor-table-head-color, inherit)", fontWeight: "600" },
  ".swe-table tbody tr:nth-child(even) td": { background: "var(--editor-table-even-background-color, transparent)" },
  // (A list's line from the editor's edge, as the page's; its next lines after its marks, `--swe-list-hang`)
  "& .cm-line.swe-list-line": { paddingLeft: "var(--swe-list-hang, 0px)", textIndent: "calc(-1 * var(--swe-list-hang, 0px))" },
  // (Each mark in its room, the space after it in it; its colour the page's bullets', a number's too)
  ".swe-bullet, .swe-list-mark, .swe-list-indent": { display: "inline-block", minWidth: `calc(${LIST_COLUMNS.bullet} * ${COLUMN})`, textIndent: "0", whiteSpace: "pre" },
  // (A number's text the mark's colour, not its syntax's)
  ".swe-bullet, .swe-list-number, .swe-list-number *": { color: "var(--editor-list-bullet-color, inherit)" },
  // (A number right in its room, the space after it held, as an ordered list's mark is)
  ".swe-list-number": { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  ".swe-task-box, .swe-task-mark": { display: "inline-block", minWidth: `calc(${LIST_COLUMNS.task} * ${COLUMN})`, textIndent: "0", whiteSpace: "pre" },
  // (The box in the middle of the columns of its `[ ]`, the space's after them, on a line of its own height, as the page's)
  ".swe-task-box": { boxSizing: "content-box", minWidth: `calc(${LIST_COLUMNS.task - 1} * ${COLUMN})`, paddingRight: COLUMN, textAlign: "center", lineHeight: "1" },
  // (A fenced code block as the page's: one card of the code's background, its text inset, in the code's font; its
  // fences' backticks unseen and its language at the line's end, where the selection is not in it)
  "& .cm-line.swe-code-line": {
    fontFamily: "var(--editor-monospace-font, monospace)",
    fontSizeAdjust: "var(--editor-font-x-height, none)",
    backgroundColor: "var(--editor-code-background-color, color-mix(in srgb, currentColor 6%, transparent))",
    paddingLeft: "16px",
    paddingRight: "16px",
  },
  // (Its code's own background none: the card's alone)
  "& .cm-line.swe-code-line *": { backgroundColor: "transparent" },
  "& .cm-line.swe-code-first": { borderTopLeftRadius: "var(--ui-radius-lg, 6px)", borderTopRightRadius: "var(--ui-radius-lg, 6px)" },
  "& .cm-line.swe-code-last": { borderBottomLeftRadius: "var(--ui-radius-lg, 6px)", borderBottomRightRadius: "var(--ui-radius-lg, 6px)" },
  "& .cm-line.swe-code-fence, & .cm-line.swe-code-fence *": { color: "transparent" },
  "& .cm-line.swe-code-fence .swe-code-info, & .cm-line.swe-code-fence .swe-code-info *": { color: "var(--editor-code-info-color, color-mix(in srgb, currentColor 55%, transparent))", float: "right", fontSize: "90%" },
  // (A horizontal rule as the page's: a line across the middle of its own)
  "& .cm-line.swe-hr": {
    backgroundImage: "linear-gradient(var(--editor-ruler-color, var(--ui-surface-border-color, color-mix(in srgb, currentColor 25%, transparent))), var(--editor-ruler-color, var(--ui-surface-border-color, color-mix(in srgb, currentColor 25%, transparent))))",
    backgroundSize: "100% 1px",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  // (A quote as the page's: a bar at its left, its colours)
  "& .cm-line.swe-quote": {
    color: "var(--editor-blockquote-color, color-mix(in srgb, currentColor 70%, transparent))",
    backgroundColor: "var(--editor-blockquote-background-color, transparent)",
    backgroundImage: "linear-gradient(to right, var(--editor-blockquote-border-color, color-mix(in srgb, currentColor 30%, transparent)) 0 3px, transparent 3px)",
    backgroundRepeat: "no-repeat",
  },
  ".swe-quote-mark": { display: "inline-block", textIndent: "0", whiteSpace: "pre" },
  ".swe-highlight": { backgroundColor: "var(--editor-highlight-background-color, var(--highlight-color, #fff3a3))", borderRadius: "3px", padding: "0 2px" },
  ".swe-sup": { verticalAlign: "super", fontSize: "smaller" },
  ".swe-sub": { verticalAlign: "sub", fontSize: "smaller" },
  ".swe-link": { color: "var(--editor-link-color, var(--link-color, #0969da))", textDecoration: "underline" },
  ".swe-wiki-link": { color: "var(--editor-wiki-link-page-color, var(--link-color, #0969da))" },
  // (A hashtag as SilverBullet 2.12.1 draws one rendered, a grid's cell's too: its theme's colours and corners, the
  // text's place as there, so it does not move as the cell is edited)
  ".swe-hashtag": {
    color: "var(--editor-hashtag-color, inherit)",
    backgroundColor: "var(--editor-hashtag-background-color, color-mix(in srgb, currentColor 10%, transparent))",
    border: "1px solid var(--editor-hashtag-border-color, transparent)",
    borderRadius: "var(--editor-hashtag-border-radius, 6px)",
    fontSize: "0.9em",
    padding: "0 3px",
    margin: "0 1px 0 0",
  },
};
