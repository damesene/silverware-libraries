// Presses beside a table, which SilverBullet takes as presses into it: right of
// its widget, in the scroller beside the page's text (it lands at the table's
// start), and at the top of the empty line under it (dom.ts, `widgetOfLineBelow`)
// put the cursor into the table, which then shows its markdown. Such a press
// puts the cursor on the line after the table instead, as if pressed there.
// Presses on the widget are the controller's, left of it the +'s band; with a
// modifier (Shift extending the selection, Alt showing the markdown) SilverBullet's.
import type { AdapterFeature, TableHost } from "../../../core/feature.ts";
import { EDITOR_SELECTOR, SCROLLER_SELECTOR, WIDGET_SELECTOR, widgetOfLineBelow } from "../../../dom.ts";
import type { TableKey } from "../../../core/tables.ts";
import type { MarkdownStore } from "../../../store/markdown/store.ts";

export class BesideTables implements AdapterFeature {
  constructor(
    private readonly host: TableHost,
    // Where a table is in the page's text now (the cursor goes after it)
    private readonly store: MarkdownStore,
  ) {}

  mouseDown(e: MouseEvent): boolean {
    if (e.button !== 0 || e.altKey || e.shiftKey || e.ctrlKey || e.metaKey || !(e.target instanceof Element)) return false;
    const widget = this.widgetBeside(e.target, e.clientX, e.clientY);
    const info = widget && this.host.infoOf(widget);
    if (!info) return false;
    e.preventDefault();
    e.stopPropagation();
    void this.cursorAfter(info.key);
    return true;
  }

  /** The table widget a press is beside: on a line below it, or right of it in the scroller */
  private widgetBeside(target: Element, x: number, y: number): HTMLElement | undefined {
    const ofLine = widgetOfLineBelow(target);
    if (ofLine) return ofLine;
    if (!target.matches(SCROLLER_SELECTOR) || target.closest(EDITOR_SELECTOR)) return undefined;
    // Within its content box: its scrollbars are the scroller's too (a press there drags them)
    const scroller = target.getBoundingClientRect();
    if (x >= scroller.left + target.clientLeft + target.clientWidth || y >= scroller.top + target.clientTop + target.clientHeight) return undefined;
    for (const widget of target.querySelectorAll<HTMLElement>(WIDGET_SELECTOR)) {
      const box = widget.getBoundingClientRect();
      if (x >= box.right && y >= box.top && y < box.bottom) return widget;
    }
    return undefined;
  }

  private async cursorAfter(key: TableKey): Promise<void> {
    const { editor } = this.host.platform;
    const found = await this.store.rangeNow(await editor.documentName(), key);
    // A table at the page's end has no line after it: the cursor stays where it was
    if (!found || found.range.to >= found.text.length) return;
    await editor.moveCursor?.(found.range.to + 1);
  }
}
