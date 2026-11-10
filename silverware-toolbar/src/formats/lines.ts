// The lines a selection touches as the formats read them: each line's
// indentation, its block format (the first in the reading order that reads
// it) and the text after its marker. Lines of a fenced code block (its fences
// too) are no format's: markdown's code is not text, and a block spans
// lines, which a format reading one line cannot tell.
import { fenceOpenAt, nextFence } from "../../../shared/markdown/lines.ts";
import type { Context, Line } from "../core/action.ts";
import type { Format } from "./format.ts";
import { blockReadingOrder } from "./registry.ts";

export type TextLine = Line & {
  // Its index among the lines selected
  readonly index: number;
  readonly indent: string;
  // Its block format; undefined: in a fenced code block
  readonly format: Format | undefined;
  // Its text after the marker, and where that starts in the page's text
  readonly content: string;
  readonly start: number;
  // Neither formatted nor turned into another block: code, a format that cannot be written (a table, a rule)
  readonly fixed: boolean;
};

/** A format's read of a line; one that fails reads no line (logged: else every action on the page would fail with it) */
function readSafely(format: Format, text: string, info: { index: number; indent: string }): string | undefined {
  try {
    return format.readBlock?.(text, info);
  } catch (e) {
    console.error(`Silverware Toolbar: ${e instanceof Error ? e.message : String(e)}`);
    return undefined;
  }
}

// Read once per context: every action's state asks for them
const read = new WeakMap<Context, TextLine[]>();

/** The lines of the selection as the block formats read them */
export function textLines(context: Context): TextLine[] {
  let lines = read.get(context);
  if (!lines) read.set(context, (lines = readLines(context)));
  return lines;
}

function readLines(context: Context): TextLine[] {
  const formats = blockReadingOrder();
  let open = fenceOpenAt(context.text, context.lines[0]?.from ?? 0);
  return context.lines.map((line, index) => {
    const wasOpen = open;
    open = nextFence(line.text, open);
    const indent = /^\s*/.exec(line.text)![0];
    if (wasOpen !== undefined || open !== undefined) return { ...line, index, indent, format: undefined, content: line.text.slice(indent.length), start: line.from + indent.length, fixed: true };
    const rest = line.text.slice(indent.length);
    for (const format of formats) {
      const content = readSafely(format, rest, { index, indent });
      if (content === undefined) continue;
      // Where its text starts: it ends the line (a marker before it), else the line's after the indentation
      const start = line.to - (rest.endsWith(content) ? content.length : rest.length);
      return { ...line, index, indent, format, content, start, fixed: !format.writeLine && !format.writeLines };
    }
    // No format read it (the paragraph reads any line, unless replaced by one that does not)
    return { ...line, index, indent, format: undefined, content: rest, start: line.from + indent.length, fixed: true };
  });
}
