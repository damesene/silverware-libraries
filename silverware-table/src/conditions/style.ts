// A Style checked (what a definition gives is the user's code), combined with
// the styles of rules before it, and turned into what the core sets on a cell:
// marks (classes swt-cf…) and CSS custom properties (--swt-cf-…), which the
// one rule of the style page reads. No CSS per format.
import type { Color, Style } from "./api.ts";
import { type ColorUse, cssColor } from "./helpers.ts";

const FLAGS = ["bold", "italic", "underline", "strike"] as const;
const COLORS = ["fill", "color", "iconColor"] as const;
const KEYS: ReadonlySet<string> = new Set([...FLAGS, ...COLORS, "bar", "icon"]);

// What would end a declaration or a rule: never part of a color
const UNSAFE_RE = /[;{}<>]/;

/** Why a value is no color; undefined: it is one */
export function validateColor(value: unknown): string | undefined {
  const one = (v: unknown) => (typeof v !== "string" || v.trim() === "" ? "is no color text" : UNSAFE_RE.test(v) ? `"${v}" is no color` : undefined);
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const { light, dark } = value as Record<string, unknown>;
    return one(light) ?? one(dark);
  }
  return one(value);
}

/** A style checked: the style, or why it is none */
export function checkStyle(value: unknown): Style | string {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "a style is an object ({ fill, color, bold, … })";
  const style = value as Record<string, unknown>;
  for (const key of Object.keys(style)) {
    if (style[key] === undefined) continue;
    if (!KEYS.has(key)) return `a style has no "${key}" (fill, color, bold, italic, underline, strike, bar, icon, iconColor)`;
  }
  for (const flag of FLAGS) if (style[flag] !== undefined && typeof style[flag] !== "boolean") return `a style's ${flag} is true or false`;
  for (const key of COLORS) {
    if (style[key] === undefined) continue;
    const problem = validateColor(style[key]);
    if (problem) return `a style's ${key} ${problem}`;
  }
  if (style.icon !== undefined && (typeof style.icon !== "string" || [...style.icon].length > 4)) return "a style's icon is a short text (at most 4 characters)";
  if (style.bar !== undefined) {
    const bar = style.bar as Record<string, unknown> | null;
    if (typeof bar !== "object" || bar === null || typeof bar.share !== "number" || !Number.isFinite(bar.share)) return "a style's bar is { share, color } with share from 0 to 1";
    if (bar.color !== undefined && validateColor(bar.color)) return `a style's bar color ${validateColor(bar.color)}`;
  }
  return style as Style;
}

/** A cell's style with another rule's after it: what the earlier set stays (as in a spreadsheet), the later fills in the rest */
export function combineStyles(earlier: Style, later: Style): Style {
  const out: Record<string, unknown> = { ...later };
  for (const [key, value] of Object.entries(earlier)) if (value !== undefined) out[key] = value;
  return out as Style;
}

/** Whether a style sets nothing */
export function emptyStyle(style: Style): boolean {
  return Object.values(style).every((v) => v === undefined || v === false);
}

/** A CSS string's text: the icon in `content` */
const cssString = (text: string) => `"${text.replace(/[\\"]/g, (c) => `\\${c}`).replace(/\n/g, " ")}"`;

/** What the core sets on the cell for a style: marks (classes swt-<mark>) and --swt-cf-… custom properties, a color's light and dark */
export function styleLook(style: Style): { readonly marks: string[]; readonly vars: Record<string, string> } {
  const marks = ["cf"];
  const vars: Record<string, string> = {};
  const color = (name: string, value: Color, use: ColorUse) => {
    vars[`--swt-cf-${name}`] = cssColor(value, use, "light");
    vars[`--swt-cf-${name}-dark`] = cssColor(value, use, "dark");
  };
  if (style.fill !== undefined) {
    marks.push("cf-fill");
    color("fill", style.fill, "fill");
  }
  if (style.color !== undefined) {
    marks.push("cf-color");
    color("color", style.color, "text");
  }
  if (style.bold) vars["--swt-cf-weight"] = "bold";
  if (style.italic) vars["--swt-cf-style"] = "italic";
  const lines = [style.underline ? "underline" : "", style.strike ? "line-through" : ""].filter(Boolean);
  if (lines.length) vars["--swt-cf-line"] = lines.join(" ");
  if (style.bold || style.italic || lines.length) marks.push("cf-text");
  if (style.bar) {
    marks.push("cf-bar");
    vars["--swt-cf-bar"] = `${Math.round(Math.min(1, Math.max(0, style.bar.share)) * 1000) / 10}%`;
    color("bar-color", style.bar.color ?? "blue", "solid");
  }
  if (style.icon) {
    marks.push("cf-icon");
    vars["--swt-cf-icon"] = cssString(style.icon);
    color("icon-color", style.iconColor ?? style.color ?? "currentColor", style.iconColor ? "solid" : "text");
  }
  return { marks, vars };
}
