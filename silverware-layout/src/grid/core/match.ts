// Which of a page's grids a grid drawn is. SilverBullet hands the renderer a grid's body alone (no `<grid …>` line, so
// no attributes, no place), and draws it anew only as its body changes: the grid is found in the page's text by its
// body, the one of those alike by its place in the text (grids.ts `found`). Pure.
import { type Grid, readGrids } from "../../../../shared/markdown/grid.ts";

/** A body as compared: its line breaks LF, no line break at its end */
const same = (body: string) => body.replace(/\r\n/g, "\n").replace(/\n+$/, "");

/** The page's grids of this body, in the page's order */
export function gridsOfBody(text: string, body: string): Grid[] {
  const wanted = same(body);
  return readGrids(text).filter((grid) => same(grid.body) === wanted);
}
