// The Turn into engine: the lines a selection touches turned into a block
// format, each line's text (as its own format reads it) written by the
// target; lines that are its already, fixed lines (code, a table, a rule) and
// empty lines among others left as they are. Lines all of the target already:
// back to the format read last (the paragraph). A multiline format writes every line changed at once.
// It knows no format: a format's syntax is its own.
import type { Change, Context } from "../core/action.ts";
import { afterOf } from "./after.ts";
import type { Format } from "./format.ts";
import { type TextLine, textLines } from "./lines.ts";
import { blockReadingOrder } from "./registry.ts";

/** The lines a format may change: not fixed, not empty among others */
function changeable(lines: readonly TextLine[]): TextLine[] {
  return lines.filter((line) => !line.fixed && (line.text.trim() !== "" || lines.length === 1));
}

/** Whether any line selected can be turned into another block */
export function canTurn(context: Context): boolean {
  return changeable(textLines(context)).length > 0;
}

/** The block format every line it may change has (undefined: none, or several) */
export function blockFormatOf(context: Context): Format | undefined {
  const formats = new Set(changeable(textLines(context)).map((line) => line.format));
  return formats.size === 1 ? [...formats][0] : undefined;
}

/** The lines turned into a format (the paragraph when they all are it already); undefined: nothing changes */
export function turnInto(context: Context, target: Format): Change | undefined {
  const lines = textLines(context);
  const can = changeable(lines);
  if (!can.length) return undefined;
  const format = can.every((line) => line.format === target) ? plain() : target;
  if (!format) return undefined;
  const written = new Map<TextLine, string>();
  if (format.writeLines) {
    const out = format.writeLines(can.map(({ content, indent, index }) => ({ text: content, indent, index })));
    can.forEach((line, i) => written.set(line, out[i]!));
  } else if (format.writeLine) {
    for (const line of can) if (line.format !== format) written.set(line, format.writeLine(line.content, { index: line.index, indent: line.indent }));
  } else return undefined;
  const first = lines[0]!;
  const last = lines[lines.length - 1]!;
  const insert = lines.map((line) => written.get(line) ?? line.text).join("\n");
  if (insert === context.text.slice(first.from, last.to)) return undefined;
  // The text of the lines selected: from the first line changed's text to the end
  const lead = can[0]!;
  const leadText = written.get(lead) ?? lead.text;
  const offset = lines.slice(0, lines.indexOf(lead)).reduce((n, line) => n + (written.get(line) ?? line.text).length + 1, 0);
  const at = first.from + offset + (leadText.endsWith(lead.content) ? leadText.length - lead.content.length : 0);
  return {
    from: first.from,
    to: last.to,
    insert,
    select: { from: at, to: first.from + insert.length },
    ...afterOf(format, first.from),
  };
}

/** The format lines go back to: the one read last, which reads any line (the paragraph) */
function plain(): Format | undefined {
  return blockReadingOrder().at(-1);
}
