// A fenced code block around the lines selected, and back: no format of one
// line can be it (its fences are lines of their own, its lines no format's:
// lines.ts), so it is a change of its own, offered among Turn into's choices.
// Lines selected outside a code block are put between ``` fences (at the
// first line's indentation, a list's item's), the cursor after the opening
// one for its language; nothing selected on an empty line: the cursor between
// them. Lines within one code block (its fences too): its fences taken off,
// its lines left as they are.
import type { Change, Context } from "../core/action.ts";
import { cursor } from "../core/cursor.ts";

// A fence: its character and how many; indented any amount (as lines.ts reads them)
const FENCE_RE = /^\s*(`{3,}|~{3,})/;

/** A line's fence, if it is one (a backtick fence has no backtick after it) */
function fenceOf(text: string): string | undefined {
  const fence = FENCE_RE.exec(text)?.[1];
  if (!fence || (fence[0] === "`" && text.slice(text.indexOf(fence) + fence.length).includes("`"))) return undefined;
  return fence;
}

type Block = { readonly open: number; readonly close: number; readonly closed: boolean };

/** The code blocks of a page's text: their opening and closing lines (by index; an unclosed one ends with the text) */
function blocksOf(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let open: { index: number; fence: string } | undefined;
  lines.forEach((text, i) => {
    const fence = fenceOf(text);
    if (!fence) return;
    if (!open) open = { index: i, fence };
    else if (fence[0] === open.fence[0] && fence.length >= open.fence.length && text.trim() === fence) {
      blocks.push({ open: open.index, close: i, closed: true });
      open = undefined;
    }
  });
  if (open) blocks.push({ open: open.index, close: lines.length - 1, closed: false });
  return blocks;
}

/** Where each line of the page's text starts */
function starts(lines: readonly string[]): number[] {
  let at = 0;
  return lines.map((line) => {
    const start = at;
    at += line.length + 1;
    return start;
  });
}

/** The page's lines, where each starts, and the indexes of the first and last line selected */
function selectedLines(context: Context): { readonly lines: readonly string[]; readonly at: readonly number[]; readonly first: number; readonly last: number } {
  const lines = context.text.split("\n");
  const at = starts(lines);
  const lineAt = (pos: number) => {
    let i = 0;
    while (i + 1 < at.length && at[i + 1]! <= pos) i++;
    return i;
  };
  return { lines, at, first: lineAt(context.lines[0]?.from ?? context.from), last: lineAt(context.lines.at(-1)?.from ?? context.to) };
}

/** The code block the lines selected are all in (its fences counting), if they are */
function blockAround(context: Context): (Block & { readonly lines: readonly string[]; readonly at: readonly number[] }) | undefined {
  const { lines, at, first, last } = selectedLines(context);
  const block = blocksOf(lines).find((b) => b.open <= first && last <= b.close);
  return block ? { ...block, lines, at } : undefined;
}

/** Whether the lines selected are in a code block */
export function inCodeBlock(context: Context): boolean {
  return !!blockAround(context);
}

/** Whether a code block can be made of the lines selected or taken off them: none of them in a code block but one holding them all */
export function canCodeBlock(context: Context): boolean {
  if (blockAround(context)) return true;
  const { lines, first, last } = selectedLines(context);
  return !blocksOf(lines).some((b) => b.open <= last && first <= b.close);
}

/** The lines selected put in a code block, or the code block they are in taken off them */
export function toggleCodeBlock(context: Context): Change | undefined {
  const around = blockAround(context);
  if (around) {
    const { open, close, closed, lines, at } = around;
    // An unclosed block has no closing fence to take off
    const inner = lines.slice(open + 1, closed ? close : close + 1);
    const from = at[open]!;
    const to = at[close]! + lines[close]!.length;
    return { from, to, insert: cursor(inner.join("\n")) };
  }
  if (!canCodeBlock(context) || !context.lines.length) return undefined;
  const first = context.lines[0]!;
  const last = context.lines.at(-1)!;
  const indent = /^\s*/.exec(first.text)![0];
  const text = context.lines.map((line) => line.text).join("\n");
  const body = text.trim() ? text : indent + cursor();
  return { from: first.from, to: last.to, insert: `${indent}\`\`\`${text.trim() ? cursor() : ""}\n${body}\n${indent}\`\`\`` };
}
