// The layout playground: Silverware Layout's widget layout and handle over an editor as SilverBullet's, its widgets
// those of a provider of the playground's (a table as SilverBullet's table widget, a block in a line of its own as a
// code widget). The provider keeps each widget's entries in memory and, written, draws the widget anew (a new element,
// as SilverBullet does after an edit); "Refuse writes" makes it refuse them, as a table with its metadata setting off.
// Its style page's CSS applied as SilverBullet would.
import { applyLayers } from "../shared/layers.ts";
import stylePage from "../silverware-layout/silverware-layout-style.md";
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../shared/layout.ts";
import { layoutOf } from "../shared/layout.ts";
import { writeAttributes } from "../shared/markdown/attributes.ts";
import { readGrids } from "../shared/markdown/grid.ts";
import { Registry } from "../silverware-layout/src/core/registry.ts";
import { Grids } from "../silverware-layout/src/grid/grids.ts";
import { gridProvider } from "../silverware-layout/src/grid/provider.ts";
import { markNarrow, paneWidth, showPaneWidth } from "../silverware-layout/src/host/marks.ts";
import { silverBulletPage } from "../silverware-layout/src/host/silverbullet/dom.ts";
import { DEFAULT_MIN_PANE_WIDTH, DEFAULT_GUIDES, type Guide } from "../silverware-layout/src/model/settings.ts";
import { layOutWidgets } from "../silverware-layout/src/widgetlayout.ts";
import { flash, setUpTheme } from "./common.ts";

setUpTheme();
// The layers its style page lays its elements in, as Silverware Layout's init sets them
applyLayers(document);
const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(stylePage)?.[1] ?? "";
document.head.append(style);

const content = document.querySelector<HTMLElement>(".cm-content")!;
const refuse = document.querySelector<HTMLInputElement>("#refuse")!;
const shown = document.querySelector<HTMLElement>("#entries")!;
const LOREM = "Quisque placerat sollicitudin leo, quis sollicitudin dui pretium in. Donec vulputate a turpis at convallis. Sed non convallis massa, eu varius purus. Vivamus nec consequat augue.";

// What the provider keeps of each widget, by its key (as a plugin keeps it in the widget's markdown)
const kept = new Map<string, Record<string, string>>();
const showKept = () => (shown.textContent = JSON.stringify(Object.fromEntries(kept), null, 1));

/** A widget drawn as its plugin draws it: a new element each time */
function widgetElement(key: string): HTMLElement {
  const widget = document.createElement("div");
  widget.className = "pg-widget";
  widget.dataset.key = key;
  if (key.startsWith("table")) {
    widget.innerHTML = `<table><thead><tr><th>Name</th><th>Amount</th><th>Note</th></tr></thead><tbody><tr><td>a</td><td>1</td><td>first row with some longer text in it</td></tr><tr><td>b</td><td>2</td><td>second</td></tr></tbody></table>`;
  } else widget.innerHTML = `<div class="pg-chart" aria-label="A chart"></div>`;
  return widget;
}

/** A line of text */
const line = (text: string) => Object.assign(document.createElement("div"), { className: "cm-line", textContent: text });

// The page: text, a table widget (a child of the content, as SilverBullet's), text, a code widget (in a line of its own)
content.append(line(LOREM), widgetElement("table-1"), line(LOREM));
const chartLine = line("");
chartLine.append(widgetElement("chart-1"));
content.append(chartLine, line(LOREM), widgetElement("table-2"), line(LOREM));

const provider: LayoutProvider = {
  name: "playground",
  selector: ".pg-widget",
  read: (element): LayoutEntries => kept.get((element as HTMLElement).dataset.key ?? "") ?? {},
  write: async (element, changes: LayoutChanges) => {
    if (refuse.checked) return "the playground refuses writes";
    const key = (element as HTMLElement).dataset.key ?? "";
    const entries = { ...kept.get(key) };
    for (const [name, value] of Object.entries(changes)) {
      if (value === null) delete entries[name];
      else entries[name] = value;
    }
    if (Object.keys(entries).length) kept.set(key, entries);
    else kept.delete(key);
    showKept();
    // Drawn anew a moment later, as SilverBullet renders a widget after an edit of its markdown
    setTimeout(() => element.replaceWith(widgetElement(key)), 30);
    return undefined;
  },
};

const registry = new Registry((message) => flash(message, "error"));
// The page as SilverBullet's (the playground's editor imitates it)
const page = silverBulletPage(document);
const enabled = () => paneWidth(page) >= DEFAULT_MIN_PANE_WIDTH;
// The pane's width and whether it is narrow, as the app gives them to the style page
const paneShown = () => {
  showPaneWidth(document, paneWidth(page));
  markNarrow(document, !enabled());
};
paneShown();
window.addEventListener("resize", paneShown);
// The guides: the default, or the page's ?guides=780,800,50%,full (guides near each other, their names in rows)
const asked = new URLSearchParams(location.search).get("guides");
const guides: readonly Guide[] = asked ? asked.split(",").map((guide): Guide => (guide === "full" ? "full" : guide.endsWith("%") ? (guide as Guide) : Number(guide))) : DEFAULT_GUIDES;
layOutWidgets(document, page, registry, { guides: () => guides, enabled, problem: (message) => flash(message, "error") });
// Registered as a widget plugin does, through the API its init page hands over
layoutOf(registry.api()).register(provider);
showKept();

// A grid (docs/silverware-layout-grid.md) as SilverBullet draws one: its body handed to the renderer, its cells'
// markdown rendered by the host (here a few of markdown's forms, each element marked with its offset as SilverBullet's
// renderer marks it), its columns read from the page's text
const GRID_BODY = "<column>\n\n**Left** column, with a [[Link]].\n\nA second paragraph.\n\n</column>\n<column>\n\nThe **right** column.\n\n</column>";
let gridPage = `${LOREM}\n\n<grid columns="1fr 2fr">\n${GRID_BODY}\n</grid>\n`;
// (The frame as SilverBullet's, given the class the init page gives it: the widget Silverware Layout lays out)
const gridFrame = Object.assign(document.createElement("div"), { className: "pg-grid-frame swl-grid-widget" });
/** The grid drawn anew of the page's text, as SilverBullet draws it after its body changed */
const drawGrid = () => void grids.render(readGrids(gridPage)[0]!.body).then((grid) => gridFrame.replaceChildren(grid));
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const grids = new Grids(document, {
  renderMarkdown: async (markdown) => {
    let at = 0;
    return markdown
      .split(/\n{2,}/)
      .map((paragraph) => {
        const pos = markdown.indexOf(paragraph, at);
        at = pos + paragraph.length;
        const inline = escape(paragraph)
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\[\[(.+?)\]\]/g, '<a class="wiki-link" href="#">$1</a>');
        return `<span class="p" data-pos="${pos}">${inline}</span>`;
      })
      .join("");
  },
  pageText: async () => gridPage,
  // As the page writer writes a cell, then the grid drawn anew a moment later
  writeCell: async (write) => {
    const grid = readGrids(gridPage).filter((one) => one.body === write.body)[write.occurrence];
    const cell = grid?.cells[write.cell];
    if (!cell) return "its grid changed since it was read: left alone";
    gridPage = gridPage.slice(0, cell.innerFrom) + `\n${write.content}\n\n` + gridPage.slice(cell.innerTo);
    setTimeout(drawGrid, 30);
    return undefined;
  },
  writeAttributes: async (write) => {
    const grid = readGrids(gridPage).filter((one) => one.body === write.body)[write.occurrence];
    if (!grid) return "its grid changed since it was read: left alone";
    const attributes: Record<string, string> = { ...grid.attributes };
    for (const [name, value] of Object.entries(write.attributes)) {
      if (value === null) delete attributes[name];
      else attributes[name] = value;
    }
    const lineEnd = gridPage.indexOf("\n", grid.from);
    gridPage = gridPage.slice(0, grid.from) + `<grid${writeAttributes(attributes)}>` + gridPage.slice(lineEnd);
    return undefined;
  },
  moveCursor: (at) => flash(`The raw text shown, the cursor at ${at}: “${gridPage.slice(at, at + 20)}…”`, "info"),
  problem: (message) => flash(message, "error"),
});
grids.start();
layoutOf(registry.api()).register(gridProvider(grids));
content.append(gridFrame, line(LOREM));
drawGrid();

// The first table shown over the window (as Silverware Table's full screen marks it): Silverware Layout stands back
document.querySelector("#over-window")!.addEventListener("click", () => {
  const table = content.querySelector<HTMLElement>('.pg-widget[data-key="table-1"]');
  table?.toggleAttribute("data-silverware-over-window");
});
