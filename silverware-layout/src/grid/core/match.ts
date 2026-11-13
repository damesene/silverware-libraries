// Which of a page's grids a grid drawn is. SilverBullet hands the renderer a grid's body alone (no `<grid …>` line, so
// no attributes, no place), and draws it anew only as its body changes: the grid is found in the page's text by its
// body, the one of those alike by its order among the grids drawn of the same body. Pure.
import { type Grid, readGrids } from "../../../../shared/markdown/grid.ts";

/** A body as compared: its line breaks LF, no line break at its end */
const same = (body: string) => body.replace(/\r\n/g, "\n").replace(/\n+$/, "");

/** The page's grids of this body, in the page's order */
export function gridsOfBody(text: string, body: string): Grid[] {
  const wanted = same(body);
  return readGrids(text).filter((grid) => same(grid.body) === wanted);
}

/**
 * The grid of the page a grid drawn is: of those of its body, the `nth` (its order among the grids of that body drawn,
 * counted from 0); fewer in the page than that (a grid scrolled out of view not drawn, so the count is short): the
 * last of them. None of that body (the page changed since it was drawn): none
 */
export function gridOf(text: string, body: string, nth: number): Grid | undefined {
  const alike = gridsOfBody(text, body);
  return alike[Math.min(nth, alike.length - 1)];
}
