// Sticky header and footer: a table's header (with the rows pinned to the top)
// stays in view while the page scrolls past the table, and the rows pinned to
// the bottom stay at the bottom of the view.
//
// A table that needs no box of its own to scroll in (it fits the width, no
// maximum height) has that box clipped instead (`swt-sticky-native`, the CSS),
// which then captures no sticky positioning: its header and footer are
// `position: sticky` against the page, moved by the browser as it scrolls,
// smooth also on a phone, where scroll events come late and a header moved by
// script lags and shakes. Here they only get `swt-stuck` (their look while
// held). Other tables sit in a box that scrolls (sideways, or inside a maximum
// height), which captures sticky positioning: their header and footer are
// sticky against that box (`swt-sticky-inside`), held by the browser as the box
// scrolls (moved by script after each scroll, a fast scroll in the box showed
// the header jump and flicker); where the page has scrolled the box's top above
// the view's, the script holds the header that much lower, at the view's top
// (`--swt-box-top`; no room kept above it for the toolbar, which goes over the
// header's end then: a box drawn as a card showed its sides beside that room),
// the bottom rows that much higher (`--swt-box-bottom`). A table whose box is
// laid over the window (position: fixed: full screen) scrolls in that box only,
// the page never moves it: its header and footer are sticky against the box
// (`swt-sticky-box`), moved by the browser too.
//
// A table in a box of its own whose header the page holds (the page scrolled into the table: the header at the view's
// top, the box's top above it, under SilverBullet's top bar) is marked `swt-held-by-page`: its box's scrollbar runs up
// past the header there, and the CSS makes it clear until the box's top is in view again (its width kept: the table
// does not move).
import type { AdapterFeature, TableHost } from "../../feature.ts";
import { STICKY_GAP } from "../../layout.ts";
import { renderedTable, WIDGET_SELECTOR } from "../../../dom.ts";

// A box's table whose header the page holds, above the box's top: its scrollbar hidden (the CSS)
const HELD_BY_PAGE = "swt-held-by-page";
// A table scrolling in a box of its own: its header and bottom rows sticky against the box (the CSS), held lower or
// higher by where the page has the box (`--swt-box-top`, `--swt-box-bottom`)
const STICKY_INSIDE = "swt-sticky-inside";

export class Sticky implements AdapterFeature {
  constructor(private readonly host: TableHost) {}

  layoutChanged(): void {
    const { doc } = this.host;
    for (const widget of Array.from(doc.querySelectorAll<HTMLElement>(`${WIDGET_SELECTOR}.swt-table`))) {
      const info = this.host.infoOf(widget);
      const head = info?.table.tHead;
      if (!info || !head || renderedTable(widget) !== info.table) continue;
      // Held below the top of the page's view (with room for the toolbar), or,
      // in a table scrolled inside its own box, at the top of that box. The
      // view (viewBounds) is the window for a table laid over it (full screen).
      const scroller = this.host.viewBounds(widget);
      const inside = this.host.scrollsInside(widget);
      const foot = info.table.tFoot;
      const overWindow = doc.defaultView!.getComputedStyle(widget).position === "fixed";
      // Not laid out (in tests): by script
      const native = !overWindow && !inside && widget.clientWidth > 0 && info.table.offsetWidth <= widget.clientWidth + 1;
      widget.classList.toggle("swt-sticky-native", native);
      widget.classList.toggle("swt-sticky-box", overWindow);
      if (native || overWindow) widget.classList.remove(HELD_BY_PAGE, STICKY_INSIDE);
      // Held below the view's top by the room for the toolbar (STICKY_GAP), but never lower than the table lies in the
      // page: a table nearer the page's top had its header pushed down over its first rows, the page not even scrolled
      const gap = overWindow ? STICKY_GAP : this.gapFor(widget, info.table, scroller.top);
      if (native) {
        const top = `${gap}px`;
        if (widget.style.getPropertyValue("--swt-sticky-top") !== top) widget.style.setProperty("--swt-sticky-top", top);
        // The rows pinned to the bottom held at the view's bottom: a sticky element keeps within its scrolling box
        // less the box's padding, and SilverBullet's scroller has one at its bottom (to scroll past the page's end):
        // `bottom: 0` was that far above the view's bottom, and a table wholly in view had them pushed to its top
        const bottom = `${-this.paddingBottom(widget)}px`;
        if (widget.style.getPropertyValue("--swt-sticky-bottom") !== bottom) widget.style.setProperty("--swt-sticky-bottom", bottom);
      }
      if (native || overWindow) {
        const table = info.table.getBoundingClientRect();
        head.style.transform = "";
        const held = head.getBoundingClientRect();
        head.classList.toggle("swt-stuck", held.top > table.top + 0.5);
        if (foot) {
          foot.style.transform = "";
          const rows = foot.getBoundingClientRect();
          foot.classList.toggle("swt-stuck", foot.rows.length > 0 && rows.bottom < table.bottom - 0.5);
          // The browser keeps each within the table, not one off the other: the table's end going up past the view's
          // top takes the bottom rows over the header held there. The header gives way to them, as it does when moved
          // by script (never past the bottom rows)
          const over = foot.rows.length > 0 ? held.bottom - rows.top : 0;
          if (over > 0.5) head.style.transform = `translateY(${-over}px)`;
        }
        continue;
      }
      // A table in a box of its own that scrolls (sideways, or inside a maximum height): its header and its bottom
      // rows sticky against that box, held by the browser as the box scrolls (moved by script after each scroll, a
      // fast scroll in the box showed the header jump and flicker); where the page has scrolled the box's top above the
      // view's, the header held that much lower, at the view's top (no room kept above it: a box drawn as a card
      // showed its sides beside that room), its bottom rows that much higher where the box's bottom is below it
      const box = this.host.innerBox(widget);
      // (Never past the box's other edge: the box gone up past the view's top takes its header with it)
      const top = `${Math.max(0, Math.round(Math.min(scroller.top - box.top, box.bottom - box.top - head.offsetHeight)))}px`;
      const bottom = `${Math.max(0, Math.round(Math.min(box.bottom - scroller.bottom, box.bottom - box.top - (foot?.offsetHeight ?? 0))))}px`;
      widget.classList.add(STICKY_INSIDE);
      if (widget.style.getPropertyValue("--swt-box-top") !== top) widget.style.setProperty("--swt-box-top", top);
      if (widget.style.getPropertyValue("--swt-box-bottom") !== bottom) widget.style.setProperty("--swt-box-bottom", bottom);
      head.style.transform = "";
      const table = info.table.getBoundingClientRect();
      const held = head.getBoundingClientRect().top > table.top + 0.5;
      head.classList.toggle("swt-stuck", held);
      if (foot) {
        foot.style.transform = "";
        foot.classList.toggle("swt-stuck", foot.rows.length > 0 && foot.getBoundingClientRect().bottom < table.bottom - 0.5);
      }
      widget.classList.toggle(HELD_BY_PAGE, held && scroller.top > box.top + 0.5);
    }
  }

  /** The bottom padding of the box the table's sticky rows keep within: its nearest scrolling ancestor */
  private paddingBottom(widget: HTMLElement): number {
    const win = this.host.doc.defaultView!;
    for (let e = widget.parentElement; e; e = e.parentElement) {
      const style = win.getComputedStyle(e);
      if (/(auto|scroll|overlay)/.test(style.overflowY)) return parseFloat(style.paddingBottom) || 0;
    }
    return 0;
  }

  /**
   * STICKY_GAP, or how far below its page's top the table lies, where that is
   * less: from the view's top (`viewTop`), the page's scroll added (none while
   * it is too short to scroll: no scrolling element then, the case it shows in)
   */
  private gapFor(widget: HTMLElement, table: HTMLTableElement, viewTop: number): number {
    const scrolled = this.host.scrollParentOf(widget)?.scrollTop ?? 0;
    const lies = table.getBoundingClientRect().top - viewTop + scrolled;
    return Math.max(0, Math.min(STICKY_GAP, Math.floor(lies)));
  }
}
