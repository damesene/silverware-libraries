// Number: a number, typed with a decimal point or comma (`2,5`); nothing else
// around it, so `3 kg` is no number rather than a number losing its unit, and
// `1,000` (a thousand, or one with three decimals) is asked to be written plainly.
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

// A comma before exactly three digits and nothing else: a thousands separator or a decimal comma, which cannot be told
const AMBIGUOUS_RE = /^[-+]?\d{1,3},\d{3}$/;

const NUMBER_RE = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?$/;

export const number: PropertyType = {
  name: "number",
  label: "Number",
  validate: (value) => (isEmpty(value) || (typeof value === "number" && Number.isFinite(value)) ? undefined : "no number"),
  text: keptText,
  parse: (typed) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    if (!NUMBER_RE.test(trimmed)) return { problem: `"${trimmed}" is no number` };
    if (AMBIGUOUS_RE.test(trimmed)) return { problem: `"${trimmed}" could be a thousand or a fraction: write 1000, or 1.5` };
    return { value: Number(trimmed.replace(",", ".")) };
  },
};
