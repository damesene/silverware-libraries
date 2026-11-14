// Markdown shown as SilverBullet's editor shows it (its behaviour, written here: docs/silverware-editor.md): a task's
// `[ ]` a checkbox toggling it, a done task struck through, a bullet list's `-` a bullet, the marks of emphasis, code,
// headings, links and `[[wiki links]]` hidden, each shown again where the selection touches what it marks. A read-only
// editor shows none: nothing to edit there. Built over the CodeMirror module loaded beside the bundle (its types alone
// here), as src/codemirror.ts is.
import type { Range } from "@codemirror/state";
import type { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownConfig } from "@lezer/markdown";
import type { CodeMirror } from "./codemirror.ts";

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

// The marks hidden in what they mark, by the node marked
const MARKED = new Set(["Emphasis", "StrongEmphasis", "Strikethrough", "InlineCode"]);
const MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark"]);

/** A task's checkbox flipped in the text: its `[ ]` or `[x]` at `at` */
function toggleTask(view: EditorView, at: number): void {
  const marker = view.state.sliceDoc(at, at + 3);
  if (view.state.readOnly || !/^\[[ xX]\]$/.test(marker)) return;
  view.dispatch({ changes: { from: at + 1, to: at + 2, insert: marker[1] === " " ? "x" : " " }, userEvent: "input" });
}

/** The live preview: decorations of the text, made again on each change of it or of the selection */
export function livePreview(cm: CodeMirror) {
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
        toggleTask(view, view.posAtDOM(box));
      });
      return box;
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

  const hidden = cm.Decoration.replace({});
  const bullet = cm.Decoration.replace({ widget: new Bullet() });
  const done = cm.Decoration.mark({ class: "swe-task-done" });
  const listLine = cm.Decoration.line({ class: "swe-list-line" });
  const link = cm.Decoration.mark({ class: "swe-link" });
  const wikiLink = cm.Decoration.mark({ class: "swe-wiki-link" });

  function decorations(state: EditorView["state"]): DecorationSet {
    const out: Range<Decoration>[] = [];
    // (Shown where the selection touches it, its ends too: a caret beside a mark shows it, as it is about to be typed in)
    const shown = (from: number, to: number) => !state.readOnly && state.selection.ranges.some((range) => range.from <= to && from <= range.to);
    const hide = (from: number, to: number) => from < to && out.push(hidden.range(from, to));
    const children = (node: SyntaxNode) => {
      const all: SyntaxNode[] = [];
      for (let child = node.firstChild; child; child = child.nextSibling) all.push(child);
      return all;
    };
    cm.syntaxTree(state).iterate({
      enter: ({ name, from, to, node }) => {
        if (MARKED.has(name)) {
          if (!shown(from, to)) for (const child of children(node)) if (MARKS.has(child.name)) hide(child.from, child.to);
        } else if (/^ATXHeading\d$/.test(name)) {
          const mark = node.firstChild;
          // (The `#`s and the space after them; a heading of no text keeps them, else nothing is left of it)
          if (mark?.name === "HeaderMark" && mark.to < to && !shown(from, to)) hide(mark.from, Math.min(to, mark.to + 1));
        } else if (name === "ListMark") {
          // (A list's line indented as a rendered list is, its source shown or not: the line does not move as the caret
          // comes to it)
          out.push(listLine.range(state.doc.lineAt(from).from));
          if (/^[-+*]$/.test(state.sliceDoc(from, to)) && !shown(from, to)) out.push(bullet.range(from, to));
        } else if (name === "TaskMarker") {
          const checked = /x/i.test(state.sliceDoc(from, to));
          if (!shown(from, to)) out.push(cm.Decoration.replace({ widget: new Checkbox(checked, state.readOnly) }).range(from, to));
          const task = node.parent;
          if (checked && task) {
            let start = to;
            while (start < task.to && /[ \t]/.test(state.sliceDoc(start, start + 1))) start++;
            if (start < task.to) out.push(done.range(start, task.to));
          }
        } else if (name === "Link") {
          // An inline link with text alone, `[text](url)`: its text shown, the rest hidden (a reference link left as written)
          const parts = children(node);
          const close = parts.find((part, index) => part.name === "LinkMark" && index > 0 && state.sliceDoc(part.from, part.to) === "]");
          if (!close || close.from === from + 1 || !parts.some((part) => part.name === "URL") || shown(from, to)) return;
          hide(from, from + 1);
          out.push(link.range(from + 1, close.from));
          hide(close.from, to);
        } else if (name === "WikiLink") {
          if (shown(from, to)) return;
          // (Its alias where it has one, else the page's name)
          const pipe = state.sliceDoc(from + 2, to - 2).indexOf("|");
          const start = pipe < 0 ? from + 2 : from + 2 + pipe + 1;
          if (start >= to - 2) return;
          hide(from, start);
          out.push(wikiLink.range(start, to - 2));
          hide(to - 2, to);
        }
      },
    });
    return cm.Decoration.set(out, true);
  }

  return cm.StateField.define<DecorationSet>({
    create: decorations,
    // (Made again on every transaction: the text, the selection, read-only and the tree's parse all change it; the
    // editors are small, a cell, an item's content)
    update: (_value, transaction) => decorations(transaction.state),
    provide: (field) => cm.EditorView.decorations.from(field),
  });
}

/** What the live preview's elements look like: SilverBullet's CSS variables where it has them */
export const PREVIEW_THEME = {
  ".swe-checkbox": { margin: "0 0.3em 0 0", verticalAlign: "middle", accentColor: "var(--ui-accent-color, #464cfc)", cursor: "pointer" },
  ".swe-checkbox:disabled": { cursor: "default" },
  ".swe-task-done": { textDecoration: "line-through" },
  // (Its text where a rendered list's is, the browser's 40px in, after the mark and a space)
  "& .cm-line.swe-list-line": { paddingLeft: "max(0px, calc(40px - 2ch))" },
  ".swe-bullet": { color: "var(--editor-list-bullet-color, inherit)" },
  ".swe-link": { color: "var(--editor-link-color, var(--link-color, #0969da))", textDecoration: "underline" },
  ".swe-wiki-link": { color: "var(--editor-wiki-link-page-color, var(--link-color, #0969da))" },
};
