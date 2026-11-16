// A grid's lines (docs/silverware-layout-grid.md, *Borders*): its `border` attribute, as HTML's table has it
// (`border="1"`: lines round it and between its cells), or `border="inner"`: the lines between its cells alone (its
// columns and its rows), no ring round it. Pure.

/** How a grid's lines are drawn: none, between its cells alone, or all of them (round it and between its cells) */
export type BorderStyle = "none" | "inner" | "all";

// The values that mean none, as written by hand
const OFF = new Set(["0", "false", "no", "none", "off"]);
// The value of the lines between the cells alone
const INNER = "inner";

/** How a grid's attributes ask for its lines: `inner`, any other value but one meaning none all (`<grid border>` too) */
export function borderOf(attributes: Readonly<Record<string, string>>): BorderStyle {
  const value = attributes.border?.trim().toLowerCase();
  if (value === undefined || OFF.has(value)) return "none";
  return value === INNER ? "inner" : "all";
}

/** The `border` attribute to write for a style of lines (none: taken off) */
export function borderAttribute(style: BorderStyle): string | null {
  return style === "none" ? null : style === "inner" ? INNER : "1";
}
