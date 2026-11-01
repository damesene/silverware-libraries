// What other plugins write with Silverware Table's writes (silverware.table.onWrite
// on the API page): functions given the page's text as a write leaves it,
// each giving edits of the text outside the tables, written in the same edit
// (one undo step). Silverware Table knows nothing of what they are for (a
// chart's data, Silverware Chart's). An edit that would touch a table, reach
// past the text or overlap another is left out and logged: it never fails the
// table's write.
import { findTables } from "../markdown.ts";

export type TextEdit = { readonly from: number; readonly to: number; readonly text: string };
export type WriteListener = (text: string) => unknown;

let listeners: WriteListener[] = [];
let fresh = true;

/** A function told of every write (replacing those of before on the first after Space Lua loaded again) */
export function addWriteListener(listener: WriteListener): void {
  if (fresh) {
    listeners = [];
    fresh = false;
  }
  listeners.push(listener);
}

/** Space Lua loads (again): the listeners given anew, those of before kept until the first of them */
export function writeListenersAnew(): void {
  fresh = true;
}

/** A list as handed over from Space Lua: an array, or a Lua table as an object with its items under 1, 2, … */
function listOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([key], i) => key === String(i + 1)) ? entries.map(([, item]) => item) : [];
}

function editOf(value: unknown): TextEdit | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { from, to, text } = value as Record<string, unknown>;
  if (!Number.isInteger(from) || !Number.isInteger(to) || typeof text !== "string") return undefined;
  return { from: from as number, to: to as number, text };
}

/**
 * The text a write leaves with the listeners' edits in it: each told the
 * text as the tables were written (in turn, each seeing the edits of those
 * before it), its edits checked against that text and its tables
 */
export async function withWriteListeners(written: string): Promise<string> {
  let text = written;
  for (const listener of listeners) {
    let given: unknown;
    try {
      given = await listener(text);
    } catch (e) {
      console.error("Silverware Table: a write listener failed", e);
      continue;
    }
    const tables = findTables(text);
    const edits: TextEdit[] = [];
    for (const item of listOf(given)) {
      const edit = editOf(item);
      const problem = !edit
        ? "not { from, to, text }"
        : edit.from < 0 || edit.to > text.length || edit.to < edit.from
          ? "outside the text"
          : tables.some((t) => edit.from < t.to && edit.to > t.from)
            ? "in a table"
            : edits.some((e) => edit.from < e.to && edit.to > e.from)
              ? "over another edit"
              : undefined;
      if (problem) console.error(`Silverware Table: a write listener's edit left out (${problem})`, item);
      else edits.push(edit!);
    }
    for (const edit of [...edits].sort((a, b) => b.from - a.from)) text = text.slice(0, edit.from) + edit.text + text.slice(edit.to);
  }
  return text;
}
