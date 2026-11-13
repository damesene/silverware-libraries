// Widgets laid out (docs/silverware-layout.md, *How a width is shown*, probes 1 and 3): each element a provider's
// selector matches in the page's content (its host's, host/page.ts) is given the width its entries keep, as the host
// renders it (SilverBullet: anew after every edit of it). A MutationObserver on the content sees it before the browser
// paints, so it is never shown at the text's width first. What is set is the widget's own element (`data-swl-width`,
// `--swl-width`), never the host's element around it (CodeMirror takes its lines' attributes back); the style page's
// rule sizes it, in the content marked `data-swl-content`. A widget out of the page's flow (marked
// `data-silverware-over-window`, or in an element marked so) is left to its plugin.
import type { LayoutAnchor, LayoutProvider } from "../../../shared/layout.ts";
import { OVER_WINDOW_ATTRIBUTE } from "../../../shared/overwindow.ts";
import type { Registry } from "../core/registry.ts";
import { cssWidgetWidth, keptWidgetWidth, readWidgetWidth, type WidgetWidth } from "../core/widgetwidth.ts";
import { markContent, textWidthOf } from "./marks.ts";
import type { PageHost } from "./page.ts";

const WIDTH_ATTRIBUTE = "data-swl-width";
const WIDTH_VARIABLE = "--swl-width";
// A widget staying at the text's start as its width changes (the style page lays it out so)
const ANCHOR_ATTRIBUTE = "data-swl-anchor-start";
// A widget laid out in a room of its own, not the page's text (a cell): the style page holds it within that room
const ROOM_ATTRIBUTE = "data-swl-in-room";

/** A widget of a provider's, as rendered */
export type Widget = { readonly element: HTMLElement; readonly provider: LayoutProvider };

export class Widgets {
  private observer: MutationObserver | undefined;
  private content: Element | undefined;

  constructor(
    private readonly doc: Document,
    private readonly page: PageHost,
    private readonly registry: Registry,
    private readonly problem: (message: string) => void,
  ) {}

  /** Laying out from now on: the page's content watched (once it is there), every widget laid out again as providers change */
  start(): void {
    this.registry.onChanged(() => this.layOutAll());
    this.watch();
  }

  private watch(): void {
    const win = this.doc.defaultView;
    if (!win) return;
    this.observer?.disconnect();
    this.content = this.page.content();
    if (this.content) markContent(this.content);
    // (No content yet: the document watched until it is there)
    const watched = this.content ?? this.doc.body;
    if (!watched) return;
    this.observer = new win.MutationObserver((records) => {
      if (!this.content?.isConnected) return this.watch();
      // Each widget once a batch: a view drawn a row at a time adds hundreds of nodes to one widget, and reading what it
      // keeps may parse its block (a database's)
      const found = new Map<HTMLElement, LayoutProvider>();
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) this.widgetsIn(node as Element, found);
      for (const [element, provider] of found) this.layOut({ element, provider });
    });
    this.observer.observe(watched, { childList: true, subtree: true });
    if (this.content) this.layOutAll();
  }

  /** The page's content followed where the host made a new one since (watched, marked, its widgets laid out) */
  followContent(): void {
    const content = this.page.content();
    if (content && content !== this.content) this.watch();
  }

  /** Every widget in the page's content laid out as its entries keep it */
  layOutAll(): void {
    if (this.content) this.layOutIn(this.content);
  }

  private layOutIn(root: Element): void {
    const found = new Map<HTMLElement, LayoutProvider>();
    this.widgetsIn(root, found);
    for (const [element, provider] of found) this.layOut({ element, provider });
  }

  /** The widgets a node is in or holds, added to `found` (a widget once, however many of its nodes came) */
  private widgetsIn(root: Element, found: Map<HTMLElement, LayoutProvider>): void {
    for (const provider of this.registry.providers) {
      // The widget it is in, or is: SilverBullet puts a widget's element in first and its content after (a table into
      // its widget), so what the widget keeps is read again as its content comes
      const around = root.closest<HTMLElement>(provider.selector);
      if (around && !found.has(around) && (!this.content || this.content.contains(around))) found.set(around, provider);
      for (const element of root.querySelectorAll<HTMLElement>(provider.selector)) if (!found.has(element)) found.set(element, provider);
    }
  }

  private layOut(widget: Widget): void {
    // Where it stays as its width changes, its provider's say (none: centred), marked for the style page's rule
    const start = this.anchor(widget) === "start";
    if (widget.element.hasAttribute(ANCHOR_ATTRIBUTE) !== start) widget.element.toggleAttribute(ANCHOR_ATTRIBUTE, start);
    const inRoom = this.room(widget) !== undefined;
    if (widget.element.hasAttribute(ROOM_ATTRIBUTE) !== inRoom) widget.element.toggleAttribute(ROOM_ATTRIBUTE, inRoom);
    this.show(widget.element, this.kept(widget));
  }

  /** Where a widget stays as its width changes: its provider's say, centred where it says none */
  anchor(widget: Widget): LayoutAnchor {
    try {
      return widget.provider.anchor?.(widget.element) === "start" ? "start" : "center";
    } catch {
      return "center";
    }
  }

  /** The box a widget is laid out in, where its provider says it is not the page's text (a cell) */
  room(widget: Widget): Element | undefined {
    try {
      return widget.provider.room?.(widget.element) ?? undefined;
    } catch {
      return undefined;
    }
  }

  /** The part of a widget the user sees, where its plugin says it is not its box */
  seen(widget: Widget): { readonly top: number; readonly bottom: number } | undefined {
    try {
      return widget.provider.seen?.(widget.element);
    } catch {
      return undefined;
    }
  }

  /** The width a widget's entries keep (none: the text's) */
  kept(widget: Widget): WidgetWidth | undefined {
    try {
      return readWidgetWidth(widget.provider.read(widget.element).width);
    } catch (e) {
      console.error(`Silverware Layout: ${widget.provider.name} could not read a widget's layout`, e);
      return undefined;
    }
  }

  /** A widget shown at a width (none: the text's), nothing written: as stored, or a drag's frame */
  show(element: HTMLElement, width: WidgetWidth | undefined): void {
    if (width === undefined) {
      if (element.hasAttribute(WIDTH_ATTRIBUTE)) element.removeAttribute(WIDTH_ATTRIBUTE);
      if (element.style.getPropertyValue(WIDTH_VARIABLE)) element.style.removeProperty(WIDTH_VARIABLE);
      return;
    }
    const kept = keptWidgetWidth(width);
    if (element.getAttribute(WIDTH_ATTRIBUTE) !== kept) element.setAttribute(WIDTH_ATTRIBUTE, kept);
    const css = cssWidgetWidth(width);
    if (element.style.getPropertyValue(WIDTH_VARIABLE) !== css) element.style.setProperty(WIDTH_VARIABLE, css);
  }

  /** A widget's width written by its plugin (none: taken off); why not, said, the width then shown for the view only */
  async write(widget: Widget, width: WidgetWidth | undefined): Promise<void> {
    this.show(widget.element, width);
    let problem: string | undefined;
    try {
      problem = await widget.provider.write(widget.element, { width: width === undefined ? null : keptWidgetWidth(width) });
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
    if (problem) this.problem(`Silverware Layout: the width could not be saved (${problem}); it holds until the widget is drawn again`);
  }

  /** The widget a node is in (its own outer element, a provider's), where it is in the page's flow: the innermost, where one is in another (a medium in a grid) */
  widgetAt(node: Element): Widget | undefined {
    if (!this.content?.contains(node)) return undefined;
    let found: Widget | undefined;
    for (const provider of this.registry.providers) {
      const element = node.closest<HTMLElement>(provider.selector);
      if (!element || !this.content.contains(element) || element.closest(`[${OVER_WINDOW_ATTRIBUTE}]`)) continue;
      if (!found || found.element.contains(element)) found = { element, provider };
    }
    return found;
  }

  /** The text's width now (the page's content less its padding): a widget without a width of its own is as wide */
  textWidth(): number {
    return this.content instanceof HTMLElement ? textWidthOf(this.content) : 0;
  }
}
