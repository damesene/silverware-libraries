// A line's block as SilverBullet's parser reads it, the line alone: its kind,
// indentation, marker and text (`readLine`, what Silverware Toolbar's Turn into
// reads, line by line). Standard markdown only: kinds of a plugin's own (the
// toolbar's formats of its user) are the plugin's. Pure, on the line; what holds
// over lines (a list, a quote, code) is blocks.ts'.
import { readTaskLine } from "./task.ts";

type LineCommon = {
  // What the line is indented by
  readonly indent: string;
  // What stands between the indentation and the text (`## `, `- `, `1. `, `- [x] `, `> `; none for a paragraph)
  readonly marker: string;
  // The text after the marker, and where it starts in the line
  readonly content: string;
  readonly contentFrom: number;
  // The line as a list's item, where it starts with a list's marker whatever its kind (a task's, a bullet's, a rule's
  // `- - -` too): what reads a list's items by their marker alone, as markdown's lists are, is given it
  readonly item?: LineItem;
};

/** A line's list marker: its kind, the marker (`- `, `1. `), the text after it (a task's `[x] …` included) */
export type LineItem = { readonly kind: "bullet" | "numbered"; readonly marker: string; readonly content: string };

/** A line read as a block's: its kind, and what the kind has of its own */
export type BlockLine =
  | (LineCommon & { readonly kind: "blank" | "paragraph" | "bullet" | "quote" | "table" | "rule" })
  | (LineCommon & { readonly kind: "heading"; readonly level: number })
  | (LineCommon & { readonly kind: "numbered"; readonly number: number })
  // A list's item with a state in brackets (`[ ]`, `[x]`, one of its own); its `item` the list's marker
  | (LineCommon & { readonly kind: "task"; readonly state: string; readonly done: boolean; readonly item: LineItem });

export type LineKind = BlockLine["kind"];

const HEADING_RE = /^(#{1,6})(?:[ \t]+|$)/;
// A horizontal rule (`---`, `***`, `- - -`): read before a bullet, which `- - -` would otherwise be
const RULE_RE = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BULLET_RE = /^[-*+](?:[ \t]+|$)/;
const NUMBERED_RE = /^(\d{1,9})[.)](?:[ \t]+|$)/;
const QUOTE_RE = /^>[ \t]?/;

/**
 * A line as a block's, read as SilverBullet reads it (a fenced code block's lines are `lines.ts`' to tell). The line
 * as given, its text kept whole: a caller rewriting it finds its content in it (Silverware Toolbar), so a line break
 * (`\r` of a CRLF) is the caller's to take off
 */
export function readLine(line: string): BlockLine {
  const indent = /^[ \t]*/.exec(line)![0];
  const rest = line.slice(indent.length);
  const bullet = BULLET_RE.exec(rest);
  const numbered = bullet ? null : NUMBERED_RE.exec(rest);
  const listMarker = bullet ?? numbered;
  const item: LineItem | undefined = listMarker ? { kind: bullet ? "bullet" : "numbered", marker: listMarker[0], content: rest.slice(listMarker[0].length) } : undefined;
  // What every kind has: the indentation, its marker and the text after it, the line as a list's item where it is one
  const common = (marker: string) => ({ indent, marker, content: rest.slice(marker.length), contentFrom: indent.length + marker.length, ...(item ? { item } : {}) });
  if (!rest.trim()) return { kind: "blank", ...common("") };
  const heading = HEADING_RE.exec(rest);
  if (heading) return { kind: "heading", level: heading[1]!.length, ...common(heading[0]) };
  if (RULE_RE.test(rest)) return { kind: "rule", ...common("") };
  const task = readTaskLine(line);
  if (task && item) return { kind: "task", state: task.state, done: task.done, ...common(line.slice(indent.length, task.textFrom)), item };
  if (bullet) return { kind: "bullet", ...common(bullet[0]) };
  if (numbered) return { kind: "numbered", number: Number(numbered[1]), ...common(numbered[0]) };
  const quote = QUOTE_RE.exec(rest);
  if (quote) return { kind: "quote", ...common(quote[0]) };
  if (rest.startsWith("|")) return { kind: "table", ...common("") };
  return { kind: "paragraph", ...common("") };
}
