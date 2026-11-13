// The grids of a host's page (docs/silverware-layout-grid.md): each drawn as the host asks for it (SilverBullet: its
// custom syntax's renderer, given the grid's body), its cells' markdown rendered by the host, its columns as its
// `<grid>` line's attributes say. The host hands the renderer no attributes and draws a grid anew only as its body
// changes, so the attributes are read from the page's text, and set again on the grids drawn as the page changes
// (`refresh`): a `columns` edited shows without a new drawing.
import { readGridBody } from "../../../shared/markdown/grid.ts";
import { gridOf } from "./core/match.ts";
import { columnTemplate } from "./model/columns.ts";
import { drawGrid, plainCell, showColumns } from "./ui/view.ts";

/** What the grids ask of the host whose page they are in */
export type GridHost = {
  /** A cell's markdown rendered as the host renders a page (its elements marked with `data-pos`, their offsets in it) */
  renderMarkdown(text: string): Promise<string>;
  /** The page's text now */
  pageText(): Promise<string>;
  /** A grid's element handed to the host, which draws it in a frame of its own: the frame made bare once it is in the page (its menu, its border) */
  settle?(element: HTMLElement): void;
};

// How long after a grid is drawn its attributes are read again (it is in the page by then, its order among its alike known)
const SETTLE_MS = 50;

export class Grids {
  // Each grid drawn, its body (what it is found in the page by)
  private readonly bodies = new WeakMap<HTMLElement, string>();
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly doc: Document,
    private readonly host: GridHost,
  ) {}

  /** A grid drawn of its body: its cells rendered by the host, its columns as the first grid of that body in the page has them */
  async render(body: string): Promise<HTMLElement> {
    const cells = readGridBody(body);
    const [html, text] = await Promise.all([
      Promise.all(cells.map((cell) => this.host.renderMarkdown(cell.content).catch(() => plainCell(this.doc, cell.content)))),
      this.host.pageText().catch(() => ""),
    ]);
    const element = drawGrid(this.doc, columnTemplate(gridOf(text, body, 0)?.attributes.columns, cells.length), html);
    this.bodies.set(element, body);
    this.host.settle?.(element);
    // In the page, its order among the grids of its body is known: its own attributes then
    this.refreshSoon();
    return element;
  }

  /** The grids drawn given their attributes again, as the page's text has them now (a `<grid>` line edited) */
  async refresh(): Promise<void> {
    const drawn = [...this.doc.querySelectorAll<HTMLElement>(".swl-grid")].filter((element) => this.bodies.has(element));
    if (!drawn.length) return;
    const text = await this.host.pageText().catch(() => undefined);
    if (text === undefined) return;
    const seen = new Map<string, number>();
    for (const element of drawn) {
      const body = this.bodies.get(element)!;
      const nth = seen.get(body) ?? 0;
      seen.set(body, nth + 1);
      const grid = gridOf(text, body, nth);
      if (grid) showColumns(element, columnTemplate(grid.attributes.columns, element.querySelectorAll(":scope > .swl-grid-cell").length));
    }
  }

  /** `refresh` a moment later, once (several asked at once: one) */
  refreshSoon(): void {
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, SETTLE_MS);
  }
}
