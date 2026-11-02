// A row's cell against a criterion as spreadsheets write the conditions of
// their -IFS functions (and Silverware Table's formulas do): "> 100", "<= 5",
// "<>done", "done" or "= done" (equal, any case), "app*" and "?at" (wildcards,
// "~*" a star itself), "" or "=" (empty), "<>" (not empty). Numbers compare as
// numbers where both sides are. Pure.
import { plainNumberOf } from "./values.ts";

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
  // (Numbers where both are: a code with digits in it is a text, A1 no 1)
  const a = plainNumberOf(text);
  const b = plainNumberOf(value);
  // (A value with a wildcard is a text to match, whatever digits it holds)
  const numbers = a !== null && b !== null && !/[*?]/.test(value);
  if (op === "=" || op === "<>") {
    const equal = numbers ? a === b : wildcard(value).test(text);
    return op === "=" ? equal : !equal;
  }
  // Order: numbers as numbers, else texts as texts (any case); a number to compare with no text's (as Excel's: >5 takes numbers)
  if (!numbers && b !== null && !/[*?]/.test(value)) return false;
  const order = numbers ? a - b : text.localeCompare(value, undefined, { sensitivity: "accent" });
  if (!numbers && text === "") return false;
  return op === ">" ? order > 0 : op === ">=" ? order >= 0 : op === "<" ? order < 0 : order <= 0;
}
