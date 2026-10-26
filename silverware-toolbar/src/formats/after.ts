// A format's afterWrite as a change's `after`: what it gets is relative to
// the text written, as a format knows nothing of the page.
import type { Change } from "../core/action.ts";
import type { Format } from "./format.ts";

/** The change's `after` calling the format's afterWrite, the text written starting at `from` */
export function afterOf(format: Format, from: number): Pick<Change, "after"> {
  const afterWrite = format.afterWrite;
  if (!afterWrite) return {};
  return { after: (editor, text) => afterWrite({ text }, { select: (a, b) => editor.select(from + a, from + b) }) };
}
