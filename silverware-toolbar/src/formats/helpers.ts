// What formats and actions get to write themselves with: the built-in ones
// and the user's alike (a definition is a function given HELPERS).
import { cursor } from "../core/cursor.ts";
import { ICONS } from "../icons.ts";
import type { BlockInfo } from "./format.ts";

const URL_RE = /^[a-z][a-z\d+.-]*:\/\/\S+$/i;

/** Whether a text is a URL (a scheme and ://) */
function isUrl(text: string): boolean {
  return URL_RE.test(text.trim());
}

/**
 * A number for each line of a numbered list, from 1 at each depth (its
 * indentation's length): a deeper item counted anew, a shallower one ending
 * the deeper counts
 */
function numberByIndent(items: readonly Pick<BlockInfo, "indent">[]): number[] {
  const counts = new Map<number, number>();
  return items.map(({ indent }) => {
    for (const depth of counts.keys()) if (depth > indent.length) counts.delete(depth);
    const n = (counts.get(indent.length) ?? 0) + 1;
    counts.set(indent.length, n);
    return n;
  });
}

export const HELPERS = {
  cursor,
  isUrl,
  numberByIndent,
  icons: ICONS,
} as const;

export type Helpers = typeof HELPERS;
