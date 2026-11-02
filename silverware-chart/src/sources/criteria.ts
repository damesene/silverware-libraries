// A row's cell against a criterion as spreadsheets write the conditions of
// their -IFS functions (and Silverware Table's formulas do): "> 100", "<= 5",
// "<>done", "done" or "= done" (equal, any case), "app*" and "?at" (wildcards,
// "~*" a star itself), "" or "=" (empty), "<>" (not empty). Numbers compare as
// numbers where both sides are. Pure.
import { numberOf } from "./values.ts";

const OPS = ["<>", ">=", "<=", "=", ">", "<"] as const;
type Op = (typeof OPS)[number];

/** A criterion's operator and value (none written: equal) */
export function criterionOf(text: string): { op: Op; value: string } {
  const t = text.trim();
  const op = OPS.find((o) => t.startsWith(o)) ?? "=";
  return { op, value: (t.startsWith(op) ? t.slice(op.length) : t).trim() };
}

/** A value with wildcards as a pattern of the whole cell, any case */
function wildcard(value: string): RegExp {
  let pattern = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i]!;
    if (c === "~" && i + 1 < value.length) pattern += value[++i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "*") pattern += ".*";
    else if (c === "?") pattern += ".";
    else pattern += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${pattern}$`, "i");
}

/** Whether a cell's text meets a criterion */
export function meets(cell: string, criterion: string): boolean {
  const { op, value } = criterionOf(criterion);
  const text = cell.trim();
  if (value === "") return op === "<>" ? text !== "" : op === "=" ? text === "" : false;
  const a = numberOf(text);
  const b = numberOf(value);
  // (A value with a wildcard is a text to match, whatever digits it holds)
  const numbers = a !== null && b !== null && !/[*?]/.test(value);
  if (op === "=" || op === "<>") {
    const equal = numbers ? a === b : wildcard(value).test(text);
    return op === "=" ? equal : !equal;
  }
  // Order: numbers as numbers, else texts as texts (any case)
  const order = numbers ? a - b : text.localeCompare(value, undefined, { sensitivity: "accent" });
  if (!numbers && text === "") return false;
  return op === ">" ? order > 0 : op === ">=" ? order >= 0 : op === "<" ? order < 0 : order <= 0;
}
