// Widgets laid out (docs/silverware-layout.md, *How a width is shown*, probes 1 and 3): each element a provider's
// selector matches in the editor's content is given the width its entries keep, as SilverBullet renders it (anew after
// every edit of it). A MutationObserver on `.cm-content` sees it before the browser paints, so it is never shown at the
// text's width first. What is set is the widget's own element (`data-swl-width`, `--swl-width`), never CodeMirror's line
// around it, whose attributes CodeMirror takes back; the style page's rule sizes it. A widget out of the page's flow
// (marked `data-silverware-over-window`, or in an element marked so) is left to its plugin.
import type { LayoutProvider } from "../../../../shared/layout.ts";
import { OVER_WINDOW_ATTRIBUTE } from "../../../../shared/overwindow.ts";
import type { Registry } from "../../core/registry.ts";
import { cssWidgetWidth, keptWidgetWidth, readWidgetWidth, type WidgetWidth } from "../../core/widgetwidth.ts";

const CONTENT_SELECTOR = ".cm-content";
const WIDTH_ATTRIBUTE = "data-swl-width";
const WIDTH_VARIABLE = "--swl-width";

/** A widget of a provider's, as rendered */
export type Widget = { readonly element: HTMLElement; readonly provider: LayoutProvider };

export class Widgets {
  private observer: MutationObserver | undefined;
  private content: Element | undefined;

  constructor(
    private readonly doc: Document,
    private readonly registry: Registry,
    private readonly problem: (message: string) => void,
  ) {}

  /** Laying out from now on: the editor's content watched (once it is there), every widget laid out again as providers change */
  start(): void {
    this.registry.onChanged(() => this.layOutAll());
    this.watch();
  }

  private watch(): void {
    const win = this.doc.defaultView;
    if (!win) return;
    this.observer?.disconnect();
    this.content = this.doc.querySelector(CONTENT_SELECTOR) ?? undefined;
    // (No editor yet: the document watched until one is there)
    const watched = this.content ?? this.doc.body;
    if (!watched) return;
    this.observer = new win.MutationObserver((records) => {
      if (!this.content?.isConnected) return this.watch();
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) this.layOutIn(node as Element);
    });
    this.observer.observe(watched, { childList: true, subtree: true });
    if (this.content) this.layOutAll();
  }

  /** Every widget in the editor's content laid out as its entries keep it */
  layOutAll(): void {
    if (this.content) this.layOutIn(this.content);
  }

  private layOutIn(root: Element): void {
    for (const provider of this.registry.providers) {
      // The widget it is in, or is: SilverBullet puts a widget's element in first and its content after (a table into
      // its widget), so what the widget keeps is read again as its content comes
      const around = root.closest<HTMLElement>(provider.selector);
      if (around && (!this.content || this.content.contains(around))) this.layOut({ element: around, provider });
      for (const element of root.querySelectorAll<HTMLElement>(provider.selector)) this.layOut({ element, provider });
    }
  }

  private layOut(widget: Widget): void {
    this.show(widget.element, this.kept(widget));
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

  /** The widget a node is in (its own outer element, a provider's), where it is in the page's flow */
  widgetAt(node: Element): Widget | undefined {
    if (!this.content?.contains(node)) return undefined;
    for (const provider of this.registry.providers) {
      const element = node.closest<HTMLElement>(provider.selector);
      if (element && this.content.contains(element) && !element.closest(`[${OVER_WINDOW_ATTRIBUTE}]`)) return { element, provider };
    }
    return undefined;
  }

  /** The text's width now (the editor's content less its padding): a widget without a width of its own is as wide */
  textWidth(): number {
    const content = this.content;
    const win = this.doc.defaultView;
    if (!content || !win) return 0;
    const style = win.getComputedStyle(content);
    return content.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0");
  }
}
