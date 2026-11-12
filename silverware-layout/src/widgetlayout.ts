// The widgets laid out and their handle, put together over a document: what SilverBullet's index.ts starts once per
// window, and the playground over its own page. The settings are asked each time (a setting saved applies at once).
import type { Registry } from "./core/registry.ts";
import { guideLayer, pageView, paneWidth } from "./host/silverbullet/dom.ts";
import { type Widget, Widgets } from "./host/silverbullet/widgets.ts";
import type { Guide } from "./model/settings.ts";
import { WidthHandle } from "./ui/handle.ts";

export type WidgetLayoutOptions = {
  readonly guides: () => readonly Guide[];
  // Whether widgets are laid out now (not in a pane narrower than the setting's least)
  readonly enabled: () => boolean;
  // A problem said to the user (a width that could not be saved)
  readonly problem: (message: string) => void;
};

export type WidgetLayout = { readonly widgets: Widgets; readonly handle: WidthHandle<Widget> };

/** The document's widgets laid out from now on, as the registry's providers find them, and their handle */
export function layOutWidgets(doc: Document, registry: Registry, options: WidgetLayoutOptions): WidgetLayout {
  const widgets = new Widgets(doc, registry, options.problem);
  widgets.start();
  const handle = new WidthHandle<Widget>(doc, {
    widgetAt: (node) => widgets.widgetAt(node),
    element: (widget) => widget.element,
    kept: (widget) => widgets.kept(widget),
    show: (element, width) => widgets.show(element, width),
    write: (widget, width) => widgets.write(widget, width),
    textWidth: () => widgets.textWidth(),
    paneWidth: () => paneWidth(doc),
    guides: options.guides,
    view: () => pageView(doc),
    guideLayer: () => guideLayer(doc),
    seen: (widget) => widgets.seen(widget),
    enabled: options.enabled,
  });
  return { widgets, handle };
}
