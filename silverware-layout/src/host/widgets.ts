// Widgets laid out (docs/silverware-layout.md, *How a width is shown*, probes 1 and 3): each element a provider's
// selector matches in the page's content (its host's, host/page.ts) is given the width its entries keep, as the host
// renders it (SilverBullet: anew after every edit of it). A MutationObserver on the content sees it before the browser
// paints, so it is never shown at the text's width first. What is set is the widget's own element (`data-swl-width`,
// `--swl-width`), never the host's element around it (CodeMirror takes its lines' attributes back); the style page's
// rule sizes it, in the content marked `data-swl-content`. A widget out of the page's flow (marked
// `data-silverware-over-window`, or in an element marked so) is left to its plugin.
import type { LayoutAlign, LayoutEntries, LayoutKind, LayoutMenuEntry, LayoutProvider } from "../../../shared/layout.ts";
import { OVER_WINDOW_ATTRIBUTE } from "../../../shared/overwindow.ts";
import type { Registry } from "../core/registry.ts";
import { anchorOf, cssWidgetWidth, keptWidgetWidth, type LayoutAnchor, readAlign, readWidgetWidth, type WidgetWidth } from "../core/widgetwidth.ts";
import { markContent, textWidthOf } from "./marks.ts";
import type { PageHost } from "./page.ts";

const WIDTH_ATTRIBUTE = "data-swl-width";
const WIDTH_VARIABLE = "--swl-width";
// Where a widget stands (start, center, end: its alignment, docs/silverware-layout-align.md), marked for the style
// page's rules; none where nothing says (a provider without kinds, no entry: drawn as it is, a width centred)
const ANCHOR_ATTRIBUTE = "data-swl-anchor";
// The inline box the host draws a widget centred or at the end in (SilverBullet's inline block round its widget, which
// shrinks to it): a line's width then, so the widget has room to stand in. Marked here, its parent alone and only an
// inline one (a list's item, a table's cell keep their own display)
const HOLDER_ATTRIBUTE = "data-swl-anchor-holder";
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
    // The user's default alignment of each kind of widget (by `<provider>/<kind>`), as set now
    private readonly defaults: () => Readonly<Record<string, LayoutAlign>> = () => ({}),
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
    // An element laid out before that no provider takes any more (a medium shown another way by its plugin, which its
    // provider's selector leaves out): its width taken off, it is no widget now
    for (const element of root.querySelectorAll<HTMLElement>(`[${WIDTH_ATTRIBUTE}], [${ANCHOR_ATTRIBUTE}], [${ROOM_ATTRIBUTE}]`)) {
      if (found.has(element)) continue;
      this.show(element, undefined);
      element.removeAttribute(ANCHOR_ATTRIBUTE);
      element.parentElement?.removeAttribute(HOLDER_ATTRIBUTE);
      element.removeAttribute(ROOM_ATTRIBUTE);
    }
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
    // (Its entries read once: a database's may be parsed from its block)
    const entries = this.entries(widget);
    this.place(widget, this.placed(widget, entries));
    this.show(widget.element, this.kept(widget, entries));
  }

  /** What a widget's entries keep, as its provider reads them (none read: none) */
  private entries(widget: Widget): LayoutEntries {
    try {
      return widget.provider.read(widget.element);
    } catch (e) {
      console.error(`Silverware Layout: ${widget.provider.name} could not read a widget's layout`, e);
      return {};
    }
  }

  /** A widget placed: where it stands marked (none: no mark, as it is drawn), its box marked where it stands in a line */
  private place(widget: Widget, align: LayoutAlign | undefined): void {
    const anchor = align === undefined ? undefined : anchorOf(align);
    if (anchor === undefined) widget.element.removeAttribute(ANCHOR_ATTRIBUTE);
    else if (widget.element.getAttribute(ANCHOR_ATTRIBUTE) !== anchor) widget.element.setAttribute(ANCHOR_ATTRIBUTE, anchor);
    const inRoom = this.room(widget) !== undefined;
    if (widget.element.hasAttribute(ROOM_ATTRIBUTE) !== inRoom) widget.element.toggleAttribute(ROOM_ATTRIBUTE, inRoom);
    this.markHolder(widget.element, (anchor === "center" || anchor === "end") && !inRoom);
  }

  /** A widget's kind, as its provider says (none said: its first); none where it names none */
  kind(widget: Widget): LayoutKind | undefined {
    const kinds = widget.provider.kinds;
    if (!kinds?.length) return undefined;
    try {
      const id = widget.provider.kindOf?.(widget.element);
      return kinds.find((kind) => kind.id === id) ?? kinds[0];
    } catch {
      return kinds[0];
    }
  }

  /**
   * Where a widget stands: its own (its entry `align`), and its default (the user's for its kind, else its kind's,
   * else centred; none where its provider names no kinds)
   */
  alignOf(widget: Widget, entries: LayoutEntries = this.entries(widget)): { readonly own: LayoutAlign | undefined; readonly default: LayoutAlign | undefined } {
    const own = readAlign(entries.align);
    const kind = this.kind(widget);
    return { own, default: kind ? (this.defaults()[`${widget.provider.name}/${kind.id}`] ?? kind.align ?? "center") : undefined };
  }

  /** Where a widget stands now: its own, else its default (none: as it is drawn) */
  private placed(widget: Widget, entries?: LayoutEntries): LayoutAlign | undefined {
    const align = this.alignOf(widget, entries);
    return align.own ?? align.default;
  }

  /**
   * Where a widget stays as its width changes: as it stands, centred where nothing says. Read from the mark its placing
   * set (as it is drawn, as its alignment is written): asked on every move of the pointer and frame of a drag, where a
   * provider's read may parse a block
   */
  anchor(widget: Widget): LayoutAnchor {
    const marked = widget.element.getAttribute(ANCHOR_ATTRIBUTE);
    return marked === "start" || marked === "end" ? marked : "center";
  }

  /** What a widget's plugin adds to its handle's menu (none where it adds nothing, or fails to say) */
  menu(widget: Widget): readonly (readonly LayoutMenuEntry[])[] {
    try {
      return widget.provider.menu?.(widget.element) ?? [];
    } catch {
      return [];
    }
  }

  /** The name of a widget's kind, its handle's menu's title (none: it names no kind) */
  title(widget: Widget): string | undefined {
    return this.kind(widget)?.name;
  }

  /** A widget's alignment written by its plugin (its default, or none: taken off, its default then), shown at once; why not, said */
  async writeAlign(widget: Widget, align: LayoutAlign | undefined): Promise<void> {
    const { default: kept } = this.alignOf(widget);
    const own = align === kept ? undefined : align;
    this.place(widget, own ?? kept);
    let problem: string | undefined;
    try {
      problem = await widget.provider.write(widget.element, { align: own ?? null });
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
    if (problem) this.problem(`Silverware Layout: where it stands could not be saved (${problem}); it holds until the widget is drawn again`);
  }

  /** A widget's parent marked as the box it stands in (a line's width), where it stands centred or at the end and its parent is an inline box of the content */
  private markHolder(element: HTMLElement, aligned: boolean): void {
    const parent = element.parentElement;
    if (!parent || parent === this.content || !this.content?.contains(parent)) return;
    // (Marked already: a block by the mark now, so its own display is not asked again; asked once per parent, as every
    // widget is laid out again with each change of the page)
    const holds = aligned && (parent.hasAttribute(HOLDER_ATTRIBUTE) || this.inline(parent));
    if (parent.hasAttribute(HOLDER_ATTRIBUTE) !== holds) parent.toggleAttribute(HOLDER_ATTRIBUTE, holds);
  }

  private readonly inlines = new WeakMap<HTMLElement, boolean>();

  /** Whether an element is drawn inline (asked once: a widget's host does not change its own display) */
  private inline(element: HTMLElement): boolean {
    let inline = this.inlines.get(element);
    if (inline === undefined) {
      inline = (element.ownerDocument.defaultView?.getComputedStyle(element).display ?? "").startsWith("inline");
      this.inlines.set(element, inline);
    }
    return inline;
  }

  /** Whether a widget's width is dragged by the handle: its provider's say, yes where it says none */
  resizable(widget: Widget): boolean {
    try {
      return widget.provider.resizable?.(widget.element) ?? true;
    } catch {
      return true;
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
  kept(widget: Widget, entries: LayoutEntries = this.entries(widget)): WidgetWidth | undefined {
    return readWidgetWidth(entries.width);
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

  /** Where the text's middle is (x in the window): the page's text's edges about it (a grid's columns snap to them) */
  textMiddle(): number | undefined {
    if (!(this.content instanceof HTMLElement)) return undefined;
    const rect = this.content.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }

  /** The text's width now (the page's content less its padding): a widget without a width of its own is as wide */
  textWidth(): number {
    return this.content instanceof HTMLElement ? textWidthOf(this.content) : 0;
  }
}
