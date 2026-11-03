// What every condition and format gets (HELPERS): the built-in ones as the
// user's. Pure: colors are CSS text (a palette's names resolved to the style
// page's variables, mixed by the browser's color-mix), nothing is parsed.
import type { Cell, Color, Context, Scope, Style } from "./api.ts";
import { filterMatcher, normalizeForFilter } from "../filter.ts";
import { now } from "../formulas/dates.ts";

/** The palette's colors, by name: each a tint, a text shade and a strong shade, light and dark (the style page's --swt-cf-<name>-…) */
export const PALETTE_NAMES = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "gray"] as const;
export type PaletteName = (typeof PALETTE_NAMES)[number];

const PALETTE_SET: ReadonlySet<string> = new Set(PALETTE_NAMES);

/** Whether a color is one of the palette's, by its name */
export function isPaletteName(color: string): color is PaletteName {
  return PALETTE_SET.has(color);
}

/** Where a color is used: a palette's name stands for its tint as a fill, its dark shade as text, its strong shade for bars and icons */
export type ColorUse = "fill" | "text" | "solid";

/** A color as CSS for one look (light, dark), a palette's name as its variable for that use */
export function cssColor(color: Color, use: ColorUse, look: "light" | "dark"): string {
  const text = typeof color === "string" ? color : color[look];
  return isPaletteName(text) ? `var(--swt-cf-${text}-${use})` : text;
}

/** The palette's names, as `palette.red` (a name is a color: `{ fill: palette.red }`) */
const palette = Object.fromEntries(PALETTE_NAMES.map((name) => [name, name])) as { readonly [N in PaletteName]: N };

/**
 * The color at `t` (0 to 1) along two or more colors (as fills: a palette's
 * name its tint); colors left undefined are skipped (an optional middle one)
 */
function mix(colors: readonly (Color | undefined)[], t: number): Color {
  const given = colors.filter((c): c is Color => c !== undefined && c !== "");
  if (given.length === 0) return "transparent";
  if (given.length === 1) return given[0]!;
  const along = (look: "light" | "dark") => {
    const steps = given.length - 1;
    const at = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * steps;
    const i = Math.min(steps - 1, Math.floor(at));
    const part = at - i;
    const a = cssColor(given[i]!, "fill", look);
    const b = cssColor(given[i + 1]!, "fill", look);
    if (part <= 0) return a;
    if (part >= 1) return b;
    return `color-mix(in oklab, ${a} ${Math.round((1 - part) * 1000) / 10}%, ${b})`;
  };
  const light = along("light");
  const dark = along("dark");
  return light === dark ? light : { light, dark };
}

/** `n` colors from the first to the last of `colors`, evenly along them (as `mix`) */
function gradient(colors: readonly (Color | undefined)[], n: number): Color[] {
  const count = Math.max(1, Math.round(n));
  return Array.from({ length: count }, (_, i) => mix(colors, count === 1 ? 0 : i / (count - 1)));
}

/**
 * How `levels` splits the cells: "equal" ranges between the minimum and the
 * maximum, "quantiles" (as many cells in each), the numbers where each level
 * after the first starts (`[1.5, 2.5]`), those in percent of the range
 * (`{ percent: [33, 67] }`), or a function of the scope giving the numbers
 */
export type Split = "equal" | "quantiles" | readonly number[] | { readonly percent: readonly number[] } | ((scope: Scope) => readonly number[]);

/** The level (0 to levels - 1) a cell is at, by a split; undefined: no number */
export function levelOf(cell: Cell, scope: Scope, split: Split, levels: number): number | undefined {
  const n = cell.number;
  if (n === undefined || levels < 1) return undefined;
  const last = levels - 1;
  const clamp = (i: number) => Math.min(last, Math.max(0, i));
  if (split === "equal") {
    const t = scope.position(cell);
    return t === undefined ? undefined : clamp(Math.floor(t * levels));
  }
  if (split === "quantiles") {
    const q = scope.quantile(cell);
    return q === undefined ? undefined : clamp(Math.floor(q * levels));
  }
  if (typeof split === "function") return clamp(split(scope).filter((x) => n >= x).length);
  if (Array.isArray(split)) return clamp((split as readonly number[]).filter((x) => n >= x).length);
  const t = scope.position(cell);
  return t === undefined ? undefined : clamp((split as { readonly percent: readonly number[] }).percent.filter((p) => t * 100 >= p).length);
}

/** A `look` grading the cells into as many levels as styles (the first the lowest), by `split` */
function levels(styles: readonly Style[], split: Split = "equal"): (cell: Cell, context: Context) => Style | undefined {
  return (cell, { scope }) => {
    const level = levelOf(cell, scope, split, styles.length);
    return level === undefined ? undefined : styles[level];
  };
}

/** A test of text in the filter row's syntax: plain words found anywhere (case and diacritics ignored), /regex/flags, =a|b, >10, !… */
// Patterns read once each: a look calls matches for every cell (By keywords: every row of it), a filter's reading is not free
const MATCHERS = new Map<string, (text: string) => boolean>();
const MATCHERS_KEPT = 500;
function matches(pattern: string): (text: string) => boolean {
  let match = MATCHERS.get(pattern);
  if (!match) {
    match = filterMatcher(pattern) ?? (() => false);
    if (MATCHERS.size >= MATCHERS_KEPT) MATCHERS.clear();
    MATCHERS.set(pattern, match);
  }
  return match;
}

/** Text as compared ignoring case and diacritics (Český is cesky), trimmed */
function normalize(text: string): string {
  return normalizeForFilter(String(text)).trim();
}

/** Today, as a cell's `date` is: milliseconds of its midnight on a clock without time zone */
function today(): number {
  return now(false).ms;
}

/** A text as a string of Excel's formulas: in quotes, its quotes doubled */
function excelText(text: unknown): string {
  return `"${String(text ?? "").replace(/"/g, '""')}"`;
}

/** Whether a filter's pattern is plain words (found anywhere), as Excel's "contains" can have it */
function plainPattern(pattern: unknown): boolean {
  return typeof pattern === "string" && pattern.trim() !== "" && !/^[=!<>/]|\|/.test(pattern.trim());
}

/** A day's length in milliseconds, for dates' arithmetic */
const DAY = 86_400_000;

/** Short texts for icons (Style.icon) */
const icons = {
  up: "▲",
  down: "▼",
  right: "▶",
  left: "◀",
  upRight: "◥",
  downRight: "◢",
  dot: "●",
  circle: "○",
  check: "✔",
  cross: "✖",
  flag: "⚑",
  star: "★",
  starEmpty: "☆",
  exclamation: "!",
} as const;

export const HELPERS = { palette, mix, gradient, levels, matches, normalize, today, DAY, icons, excelText, plainPattern } as const;
