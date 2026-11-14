// A grid's lines (docs/silverware-layout-grid.md, *Lines*): its `border` attribute, as HTML's table has it (`border="1"`).
// Pure.

// The values that mean none, as written by hand
const OFF = new Set(["0", "false", "no", "none", "off"]);

/** Whether a grid's attributes ask for its lines: `border` there with any value but one meaning none (`<grid border>` too) */
export function bordered(attributes: Readonly<Record<string, string>>): boolean {
  const value = attributes.border;
  return value !== undefined && !OFF.has(value.trim().toLowerCase());
}

/** The `border` attribute to write for lines shown or not (none: taken off) */
export function borderAttribute(on: boolean): string | null {
  return on ? "1" : null;
}
