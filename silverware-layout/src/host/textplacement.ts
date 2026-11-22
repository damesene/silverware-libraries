// Where the page's text stands, as Silverware Layout places it (docs/silverware-layout-text-align.md): at the pane's left
// or centred by a margin of its own, which the style page gives the content (SilverBullet centres it by auto margins,
// which no transition moves), moved from one to the other (the root marked moving a moment as the alignment changes,
// never as the pane is resized); the host's elements placed by the text moved with it; where its lines start in the pane
// (the widgets wider than the text grow from there with it at the left). Any host's page: its marks are Layout's own.
import type { PageHost } from "./page.ts";

const TEXT_ALIGN_ATTRIBUTE = "data-swl-text-align";
const TEXT_MOVING_ATTRIBUTE = "data-swl-text-moving";
const ALONG_TEXT_ATTRIBUTE = "data-swl-along-text";
const TEXT_MARGIN = "--swl-text-margin";
const TEXT_SHIFT = "--swl-text-shift";
const TEXT_START = "--swl-text-start";
// How long the text is marked moving after its alignment changed (the style page's transition, a little longer)
const MOVING_MS = 320;

/** Where the text is placed: at the left, centred by a margin of ours (to move from), or none of ours (the host's own) */
export type TextPlace = "left" | "center" | undefined;

/** An element the host places by the text, as it is (its title over the page, its notifications): moved with it */
export function markAlongText(element: Element): void {
  if (!element.hasAttribute(ALONG_TEXT_ATTRIBUTE)) element.setAttribute(ALONG_TEXT_ATTRIBUTE, "");
}

/** The page's text placed, one per window */
export class TextPlacement {
  private place: TextPlace;
  private movingTimer: ReturnType<typeof setTimeout> | undefined;
  // The box the text is centred in, watched: a scrollbar coming or going there changes its room, not the pane's
  private watched: Element | undefined;
  private observer: ResizeObserver | undefined;
  // Its width as the text was last placed in it
  private measured = 0;

  constructor(
    private readonly doc: Document,
    private readonly page: PageHost,
  ) {}

  /**
   * The text placed (none: the host's own place, nothing of ours left): its margin, how far the host's elements placed by
   * the text move with it (`--swl-text-shift`, from where the host centres them), where its lines start in the pane
   * (`--swl-text-start`); moved where it stood placed by us before, at the other side
   */
  show(place: TextPlace): void {
    const root = this.doc.documentElement;
    const content = this.page.content();
    const parent = content?.parentElement;
    if (!place || !content || !parent) {
      if (root.hasAttribute(TEXT_ALIGN_ATTRIBUTE)) root.removeAttribute(TEXT_ALIGN_ATTRIBUTE);
      for (const name of [TEXT_MARGIN, TEXT_SHIFT, TEXT_START]) if (root.style.getPropertyValue(name)) root.style.removeProperty(name);
      this.place = undefined;
      return;
    }
    this.watch(parent);
    const win = this.doc.defaultView;
    const style = win?.getComputedStyle(content);
    const box = content.getBoundingClientRect();
    const around = parent.getBoundingClientRect();
    const margin = parseFloat(style?.marginLeft ?? "") || 0;
    // What stands before the content in its box (a host's gutters), and the room it is centred in
    const before = box.left - margin - around.left - parent.clientLeft;
    this.measured = parent.clientWidth;
    const centred = Math.max(0, (this.measured - before - content.offsetWidth) / 2);
    const shown = place === "left" ? 0 : centred;
    // (From the pane's content box, its padding left out, as its width is given: `paneWidth`)
    const start = around.left + parent.clientLeft + before + shown + (parseFloat(style?.paddingLeft ?? "") || 0) - this.paneLeft();
    const px = (n: number) => `${Math.round(n * 100) / 100}px`;
    const set = (name: string, value: string) => root.style.getPropertyValue(name) !== value && root.style.setProperty(name, value);
    set(TEXT_MARGIN, px(shown));
    set(TEXT_SHIFT, px(shown - centred));
    set(TEXT_START, px(start));
    // (Not as it is first placed, nor as the pane is resized: only from one side to the other)
    if (this.place !== undefined && this.place !== place) {
      root.setAttribute(TEXT_MOVING_ATTRIBUTE, "");
      clearTimeout(this.movingTimer);
      this.movingTimer = setTimeout(() => root.removeAttribute(TEXT_MOVING_ATTRIBUTE), MOVING_MS);
    }
    this.place = place;
    if (root.getAttribute(TEXT_ALIGN_ATTRIBUTE) !== place) root.setAttribute(TEXT_ALIGN_ATTRIBUTE, place);
  }

  /**
   * Where the text starts where it stands at the pane's left (as placed, not where a move has it a moment): x in the
   * window and px from the pane's left edge (its padding left out); none where it is not at the left
   */
  atLeft(): { readonly x: number; readonly start: number } | undefined {
    if (this.place !== "left") return undefined;
    const start = parseFloat(this.doc.documentElement.style.getPropertyValue(TEXT_START));
    return Number.isFinite(start) ? { x: this.paneLeft() + start, start } : undefined;
  }

  /** The pane's content box's left edge (x in the window) */
  private paneLeft(): number {
    const pane = this.page.pane();
    return pane.getBoundingClientRect().left + (parseFloat(this.doc.defaultView?.getComputedStyle(pane).paddingLeft ?? "") || 0);
  }

  /** The box the text is centred in watched (a new one, the host's editor made anew): placed again as its width changes */
  private watch(parent: Element): void {
    const win = this.doc.defaultView;
    if (this.watched === parent || !win?.ResizeObserver) return;
    this.observer?.disconnect();
    this.watched = parent;
    // (Told as it starts watching too: placed again only where its width is not the one the text was placed in, a
    // scrollbar come between)
    this.observer = new win.ResizeObserver(() => {
      if (this.place && parent.clientWidth !== this.measured) this.show(this.place);
    });
    this.observer.observe(parent);
  }
}
