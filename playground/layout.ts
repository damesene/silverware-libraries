// The layout playground: Silverware Layout's widget layout and handle over an editor as SilverBullet's, its widgets
// those of a provider of the playground's (a table as SilverBullet's table widget, a block in a line of its own as a
// code widget). The provider keeps each widget's entries in memory and, written, draws the widget anew (a new element,
// as SilverBullet does after an edit); "Refuse writes" makes it refuse them, as a table with its metadata setting off.
// Its style page's CSS applied as SilverBullet would.
import stylePage from "../silverware-layout/silverware-layout-style.md";
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../shared/layout.ts";
import { layoutOf } from "../shared/layout.ts";
import { Registry } from "../silverware-layout/src/core/registry.ts";
import { markNarrow, paneWidth } from "../silverware-layout/src/host/silverbullet/dom.ts";
import { DEFAULT_MIN_PANE_WIDTH, DEFAULT_PRESETS } from "../silverware-layout/src/model/settings.ts";
import { layOutWidgets } from "../silverware-layout/src/widgetlayout.ts";
import { flash, setUpTheme } from "./common.ts";

setUpTheme();
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
const enabled = () => paneWidth(document) >= DEFAULT_MIN_PANE_WIDTH;
const narrow = () => markNarrow(document, !enabled());
narrow();
window.addEventListener("resize", narrow);
layOutWidgets(document, registry, { presets: () => DEFAULT_PRESETS, enabled, problem: (message) => flash(message, "error") });
// Registered as a widget plugin does, through the API its init page hands over
layoutOf(registry.api()).register(provider);
showKept();

// The first table shown over the window (as Silverware Table's full screen marks it): Silverware Layout stands back
document.querySelector("#over-window")!.addEventListener("click", () => {
  const table = content.querySelector<HTMLElement>('.pg-widget[data-key="table-1"]');
  table?.toggleAttribute("data-silverware-over-window");
});
