// Filters as typed into a filter field: what a field's text matches. Pure,
// no DOM: features/filters.ts types them and hides the rows they do not match.
import { asNumber } from "./view.ts";

// Smart filters (a setting): comparisons, regular expressions, `=` and `!`
export type FilterOptions = { readonly smart: boolean };

export const DEFAULT_FILTER_OPTIONS: FilterOptions = { smart: true };

// Case and diacritics do not matter when filtering: "cesky" finds "Český"
export function normalizeForFilter(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type Match = (value: string) => boolean;

// A parsed filter field: `match` undefined means no filtering; `error` explains
// a filter that cannot be used (an invalid regular expression)
export type ParsedFilter = { readonly match?: Match; readonly error?: string };

// Flags: JavaScript's i, m, s, u, plus c for case-sensitive
const REGEX_RE = /^\/(.*)\/([cimsu]*)$/s;
const COMPARISON_RE = /^(<=|>=|<|>)\s*(.*)$/s;

/**
 * What a filter field accepts. Plain text is found anywhere in a cell, case
 * and diacritics ignored. With smart filters:
 * - `>10`, `<10`, `>=10`, `<=10` compare the cells as numbers (others are hidden)
 * - `/pattern/flags` is a regular expression, case-insensitive unless the flags
 *   include `c`; it is matched against the cell text as shown
 * - `=text` matches whole cells (case and diacritics ignored); `=a|b` cells
 *   that are a or b, `=|a` also empty cells
 * - `a|b` matches cells either alternative matches (each one a filter: `<2|>10`)
 * - `!filter` hides the cells the rest matches
 * A filter still being typed (only an operator, a regular expression without
 * its closing slash and flags) does not filter yet.
 */
export function parseFilter(filter: string, options = DEFAULT_FILTER_OPTIONS): ParsedFilter {
  const text = filter.trim();
  if (text === "") return {};
  if (options.smart) {
    if (text.startsWith("!")) {
      const inner = parseFilter(text.slice(1), options);
      const match = inner.match;
      return match ? { match: (value) => !match(value) } : inner;
    }
    if (text.startsWith("=")) {
      const rest = text.slice(1);
      // Only "=": still being typed. With "|" an alternative may be empty: empty cells
      if (rest.trim() === "") return {};
      const wholes = new Set(rest.split("|").map((part) => normalizeForFilter(part.trim())));
      return { match: (value) => wholes.has(normalizeForFilter(value.trim())) };
    }
    const regex = REGEX_RE.exec(text);
    if (regex) return parseRegex(regex[1]!, regex[2]!);
    // A regular expression still being typed: wait for its closing slash
    if (text.startsWith("/")) return {};
    if (text.includes("|")) return anyOf(text.split("|").map((part) => parseFilter(part, options)));
    const comparison = COMPARISON_RE.exec(text);
    if (comparison) {
      const [, operator, rest] = comparison;
      if (rest!.trim() === "") return {};
      const limit = asNumber(rest!);
      if (limit !== undefined) {
        return {
          match: (value) => {
            const n = asNumber(value);
            if (n === undefined) return false;
            if (operator === ">") return n > limit;
            if (operator === "<") return n < limit;
            if (operator === ">=") return n >= limit;
            return n <= limit;
          },
        };
      }
    }
  }
  const needle = normalizeForFilter(text);
  return { match: (value) => normalizeForFilter(value).includes(needle) };
}

/** Alternatives: a cell any of them matches; those still being typed (empty) are left out */
function anyOf(parts: readonly ParsedFilter[]): ParsedFilter {
  const error = parts.find((part) => part.error)?.error;
  if (error) return { error };
  const matches = parts.flatMap((part) => (part.match ? [part.match] : []));
  return matches.length === 0 ? {} : { match: (value) => matches.some((match) => match(value)) };
}

function parseRegex(pattern: string, flags: string): ParsedFilter {
  if (pattern === "") return {};
  const caseSensitive = flags.includes("c");
  const jsFlags = [...new Set(flags.replace(/[ci]/g, "") + (caseSensitive ? "" : "i"))].join("");
  try {
    const re = new RegExp(pattern, jsFlags);
    return { match: (value) => re.test(value) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function filterMatcher(filter: string, options = DEFAULT_FILTER_OPTIONS): Match | undefined {
  return parseFilter(filter, options).match;
}

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
  return `ISNUMBER(SEARCH(${quoted(text)},${ref}))`;
}
