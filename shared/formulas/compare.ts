// Two values compared as the comparison operators compare them (=, <, …) and as SWITCH matches its cases: as dates
// where both are dates, as numbers where both read as numbers, else as text ignoring case
import { parseDate } from "./dates.ts";
import { isError, type Scalar, toNumber, toText } from "./values.ts";

/** Below 0: `a` first; 0: the same; above 0: `b` first */
export function compareValues(a: Scalar, b: Scalar): number {
  // 2025-11-06 is 2025-11-06 00:00, and 2025-11-06T08:00 is before 2025-11-06 09:00
  const da = typeof a === "string" ? parseDate(a) : undefined;
  const db = da && typeof b === "string" ? parseDate(b) : undefined;
  if (da && db) return da.ms - db.ms;
  const na = a === null ? 0 : toNumber(a);
  const nb = b === null ? 0 : toNumber(b);
  if (!isError(na) && !isError(nb) && typeof a !== "boolean" && typeof b !== "boolean") return na - nb;
  const ta = (toText(a) as string).toLowerCase();
  const tb = (toText(b) as string).toLowerCase();
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}
