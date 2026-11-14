// The widgets laid out and their handle, put together over a host's page (host/page.ts): what the app (app.ts) starts
// once per window, and the playground over its own page. The settings are asked each time (a setting saved applies at
// once).
import type { LayoutAlign } from "../../shared/layout.ts";
import type { Registry } from "./core/registry.ts";
import { paneWidth } from "./host/marks.ts";
import type { PageHost } from "./host/page.ts";
import { type Widget, Widgets } from "./host/widgets.ts";
import type { Guide } from "./model/settings.ts";
import { WidthHandle } from "./ui/handle.ts";

export type WidgetLayoutOptions = {
  readonly guides: () => readonly Guide[];
  // Whether widgets are laid out now (not in a pane narrower than the setting's least)
  readonly enabled: () => boolean;
  // A problem said to the user (a width that could not be saved)
  readonly problem: (message: string) => void;
  // The user's default alignment of each kind of widget (by `<provider>/<kind>`; none set: each kind's own)
  readonly alignments?: () => Readonly<Record<string, LayoutAlign>>;
};

export type WidgetLayout = { readonly widgets: Widgets; readonly handle: WidthHandle<Widget> };

/** The page's widgets laid out from now on, as the registry's providers find them, and their handle */
export function layOutWidgets(doc: Document, page: PageHost, registry: Registry, options: WidgetLayoutOptions): WidgetLayout {
  const widgets = new Widgets(doc, page, registry, options.problem, options.alignments);
  widgets.start();
  const handle = new WidthHandle<Widget>(doc, {
    widgetAt: (node) => widgets.widgetAt(node),
    element: (widget) => widget.element,
    kept: (widget) => widgets.kept(widget),
    show: (element, width) => widgets.show(element, width),
    write: (widget, width) => widgets.write(widget, width),
    textWidth: () => widgets.textWidth(),
    paneWidth: () => paneWidth(page),
    guides: options.guides,
    view: () => page.view(),
    guideLayer: () => page.guideLayer(),
    seen: (widget) => widgets.seen(widget),
    enabled: options.enabled,
    anchor: (widget) => widgets.anchor(widget),
    resizable: (widget) => widgets.resizable(widget),
    unsized: (widget) => widget.provider.unsized ?? "text",
    alignOf: (widget) => widgets.alignOf(widget),
    writeAlign: (widget, align) => widgets.writeAlign(widget, align),
    room: (widget) => {
      const room = widgets.room(widget);
      return room ? room.getBoundingClientRect().width : undefined;
    },
  });
  return { widgets, handle };
}
