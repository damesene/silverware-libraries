// A view's result as a calculated table: each column named after the source
// column it came from (else its letter, as Show result names them), with an id
// by which a header the user renamed is kept through every recalculation;
// cells as texts, a column right-aligned where its values are all numbers.
import { columnLetters, type Grid, scalarText } from "../formulas/index.ts";
import type { Calculated, Renames } from "./table.ts";

/**
 * A grid of a view's formula as a calculated table. Its columns' ids: a
 * source column's `name:<column>` (a second of the same name `name:<column>:2`),
 * a column of no origin `at:<place>` (from 1).
 */
export function viewCalculated(grid: Grid): Calculated {
  const seen = new Map<string, number>();
  const columns = Array.from({ length: grid.width }, (_, c) => {
    const name = grid.names[c]?.trim();
    const values = grid.column(c).filter((value) => value !== null && value !== "");
    const numeric = values.length > 0 && values.every((value) => typeof value === "number");
    if (!name) return { id: `at:${c + 1}`, header: columnLetters(c), numeric };
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), n);
    return { id: n > 1 ? `name:${name}:${n}` : `name:${name}`, header: name, numeric };
  });
  return { columns, body: grid.rows().map((row) => row.map(scalarText)), totalRow: false, totalColumns: 0 };
}

/**
 * The renamed headers with their columns' ids as they are now, the source's
 * columns renamed (old name → new, compared ignoring case): `name:Assignee`
 * is `name:Owner` once Assignee was renamed Owner
 */
export function renamedViewIds(renames: Renames, renamed: ReadonlyMap<string, string>): Renames {
  if (renamed.size === 0) return renames;
  const lower = new Map([...renamed].map(([from, to]) => [from.toLowerCase(), to]));
  return Object.fromEntries(
    Object.entries(renames).map(([id, name]) => {
      const m = /^name:(.*?)(:\d+)?$/.exec(id);
      const to = m && lower.get(m[1]!.toLowerCase());
      return [to ? `name:${to}${m[2] ?? ""}` : id, name];
    }),
  );
}
