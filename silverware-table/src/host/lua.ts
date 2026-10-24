// The host's side of formulas written in SilverBullet's Space Lua, apart from
// the rest of Silverware Table, which knows nothing of Lua: a formula given to
// a function in a page's text (silverware.table.evaluate, an alias of it) as
// one string literal, in quotes or apostrophes: name("=…") or name('=…'). The
// library's init page registers the finder made here with the names it calls
// (formulas/places.ts). A literal with an escape or a line break in it is left
// out: its text in the page is not the formula, so it could not be written back.
import type { FormulaPlace, FormulaPlaces } from "../formulas/places.ts";

/** A text to find as it is in a regular expression */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A finder of the formulas given to functions of these names (each whole: te
 * is not found in paste) as their first argument, one string literal
 */
export function luaCallPlaces(...names: unknown[]): FormulaPlaces {
  const valid = names.filter((name): name is string => typeof name === "string" && /^[A-Za-z_][\w.]*$/.test(name));
  if (valid.length === 0) return () => [];
  const call = new RegExp(`(?<![\\w.])(?:${valid.map(escaped).join("|")})\\(\\s*(?:"([^"\\\\\\n]*)"|'([^'\\\\\\n]*)')`, "g");
  return (text: string): FormulaPlace[] =>
    Array.from(String(text).matchAll(call), (match) => {
      const formula = match[1] ?? match[2] ?? "";
      // The literal is the end of the match, its closing quote last
      const to = match.index + match[0].length - 1;
      return { from: to - formula.length, to };
    });
}
