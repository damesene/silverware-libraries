// The colors of the database's palette, as a select's options and an item's
// look take them: a color of the palette by its name, or one of the user's own
// as `#rrggbb`. How each shows (light and dark) is the style page's.

/** The palette's colors, by name, in the order an option's place picks one */
export const COLORS = ["gray", "blue", "green", "yellow", "orange", "red", "purple", "pink"] as const;
export type NamedColor = (typeof COLORS)[number];
/** A color: the palette's by name, or the user's own, `#rrggbb` */
export type Color = NamedColor | `#${string}`;

const OWN_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Whether something is a color */
export function isColor(color: unknown): color is Color {
  return typeof color === "string" && ((COLORS as readonly string[]).includes(color) || OWN_COLOR_RE.test(color));
}

/** A color as the views draw it: its place in the palette, or the user's own (lower case) */
export function colorShown(color: Color): number | `#${string}` {
  return color.startsWith("#") ? (color.toLowerCase() as `#${string}`) : COLORS.indexOf(color as NamedColor);
}
