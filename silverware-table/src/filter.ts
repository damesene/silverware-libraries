// A filter's Excel form (the excel and conditions modules'): the syntax itself
// is shared (shared/filter.ts), Excel is Silverware Table's.
import { asNumber, COMPARISON_RE, REGEX_RE } from "../../shared/filter.ts";

/**
 * A filter as an Excel formula true for the cells it matches, `ref` the cell
 * (B2), by the same rules as parseFilter (smart): words found anywhere (SEARCH,
 * case ignored; diacritics are not, as Excel compares them), `=a|b` whole cells,
 * `>10` numbers, `!…` not, `a|b` either, `/pattern/flags` a regular expression
 * (REGEXTEST, Microsoft 365's: `_xlfn.` as the file writes a newer function;
 * case ignored unless the flags have `c`; `s` and `m` as the pattern's own
 * `(?s)` `(?m)`). Undefined: nothing to match yet (as parseFilter: still typed)
 */
export function filterExcelFormula(filter: string, ref: string): string | undefined {
  const text = filter.trim();
  if (text === "") return undefined;
  const quoted = (s: string) => `"${s.replace(/"/g, '""')}"`;
  if (text.startsWith("!")) {
    const inner = filterExcelFormula(text.slice(1), ref);
    return inner === undefined ? undefined : `NOT(${inner})`;
  }
  if (text.startsWith("=")) {
    const rest = text.slice(1);
    if (rest.trim() === "") return undefined;
    const wholes = rest.split("|").map((part) => part.trim());
    const tests = wholes.map((w) => (w === "" ? `LEN(TRIM(${ref}))=0` : `TRIM(${ref})=${quoted(w)}`));
    return tests.length === 1 ? tests[0] : `OR(${tests.join(",")})`;
  }
  const regex = REGEX_RE.exec(text);
  if (regex) {
    const [, pattern, flags] = regex as unknown as [string, string, string];
    if (pattern === "") return undefined;
    const inline = `${flags.includes("s") ? "(?s)" : ""}${flags.includes("m") ? "(?m)" : ""}`;
    return `_xlfn.REGEXTEST(${ref},${quoted(inline + pattern)},${flags.includes("c") ? 0 : 1})`;
  }
  if (text.startsWith("/")) return undefined;
  if (text.includes("|")) {
    const parts = text.split("|").flatMap((part) => {
      const made = filterExcelFormula(part, ref);
      return made === undefined ? [] : [made];
    });
    return parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : `OR(${parts.join(",")})`;
  }
  const comparison = COMPARISON_RE.exec(text);
  if (comparison) {
    const [, operator, rest] = comparison as unknown as [string, string, string];
    if (rest.trim() === "") return undefined;
    const limit = asNumber(rest);
    if (limit !== undefined) return `AND(ISNUMBER(${ref}),${ref}${operator}${limit})`;
  }
  // Its wildcards (* ? ~) taken as themselves, as the filter finds text
  return `ISNUMBER(SEARCH(${quoted(text.replace(/[~*?]/g, (c) => `~${c}`))},${ref}))`;
}
