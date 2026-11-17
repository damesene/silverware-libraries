// A cell's markdown read line by line as markdown's parser reads it (shared/markdown/parse.ts `markedLines`), once
// for the same text: each drawing of a grid asks for its every cell, and each point found in a cell after (a press, a
// drop) for that cell: the lines read lately kept by their text (the cache the pure core has none of).
import { type MarkedLine, markedLines } from "../../../../shared/markdown/parse.ts";

// The cells' markdown read lately, by its text, the latest last: a grid drawn anew asks again for its cells unchanged
const READ = new Map<string, readonly MarkedLine[]>();
// How many are kept (the oldest dropped)
const READ_KEPT = 64;

/** A cell's markdown read line by line, read again only for a text not read lately */
export function cellLines(content: string): readonly MarkedLine[] {
  const read = READ.get(content);
  if (read) {
    READ.delete(content);
    READ.set(content, read);
    return read;
  }
  const lines = markedLines(content);
  READ.set(content, lines);
  if (READ.size > READ_KEPT) READ.delete(READ.keys().next().value!);
  return lines;
}
