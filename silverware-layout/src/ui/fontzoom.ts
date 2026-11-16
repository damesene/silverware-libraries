// Font zoom (docs/silverware-layout-font-size.md): Ctrl + scroll over the editor makes its font a pixel larger or
// smaller a step, Ctrl+0 (Cmd+0 on a Mac) puts the default back, as the browser zooms the page; the browser's own zoom
// held back there alone. A label at the window's bottom left says the size for a moment, naming the default. Where
// asked (`pinches`), a pinch with two fingers zooms as well (core/pinch.ts): two fingers on the page are then ours, held
// at the document from the host's own gesture of them at the window (SilverBullet's opens its page picker), and a tap of
// two fingers is given back to it (`twoFingerTap`); a move of both together is left as the page's scroll.
import { el } from "../../../shared/elements.ts";
import { WheelSteps, zoomedBy } from "../core/fontsize.ts";
import { pinchedSize, type Point, twoFingers, type TwoFingers, wasTap } from "../core/pinch.ts";
import { FONT_SIZE_LIMITS } from "../model/settings.ts";

const BASE = "swl-zoom";
// How long the label shows after the last step (ms)
const LABEL_MS = 1500;

/** What the zoom asks of whoever shows the font size */
export type FontZoomHost = {
  // Whether Font zoom is on (the setting)
  enabled(): boolean;
  // Whether a node is in the editor, where Ctrl + scroll zooms
  inEditor(node: unknown): boolean;
  // The font size shown now, and the default (the setting's, else the theme's), px
  size(): number;
  defaultSize(): number;
  // Zoomed to a size (none: the default again), shown and kept for this device
  zoom(size: number | undefined): void;
  // Optional: whether a pinch with two fingers zooms (the setting), where it does (the page's text alone, whatever is
  // over it), and the host's own tap with two fingers, run where two fingers tapped while the pinch takes them
  pinches?(): boolean;
  pinchesAt?(node: unknown): boolean;
  twoFingerTap?(): void;
};

/** Two fingers followed from where they touched: their touches, where and when, what they do so far, the size then */
type Fingers = { readonly ids: readonly [number, number]; readonly start: readonly [Point, Point]; readonly at: number; seen: TwoFingers; readonly from: number; size: number };

export class FontZoom {
  private readonly label: HTMLElement;
  private readonly wheel = new WheelSteps();
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private fingers: Fingers | undefined;
  // Whether the moves of fingers are watched (not passive: a pinch holds the page's own gesture back), from the first
  // touch once a pinch zooms: none where it never does, every scroll of a finger otherwise waiting for the page's script
  private watching = false;

  constructor(
    doc: Document,
    private readonly host: FontZoomHost,
  ) {
    this.label = el(doc, "div", { class: `${BASE}-label`, attrs: { role: "status", hidden: "" } });
    doc.body.append(this.label);
    // (Not passive: the browser's zoom held back; captured, ahead of the editor's own)
    doc.addEventListener("wheel", (e) => this.wheeled(e), { capture: true, passive: false });
    doc.addEventListener("keydown", (e) => this.key(e), true);
    // Two fingers: at the document as they bubble (every element of the page has had them), before the window's
    doc.addEventListener("touchstart", (e) => this.touched(e), { passive: true });
    doc.addEventListener("touchend", (e) => this.lifted(e));
    doc.addEventListener("touchcancel", () => (this.fingers = undefined));
    // (Safari's own zoom of the page by two fingers, which it does whatever the page says it may: held back while a
    // pinch is followed)
    for (const type of ["gesturestart", "gesturechange"]) doc.addEventListener(type, (e) => this.fingers && e.cancelable && e.preventDefault(), { passive: false });
  }

  /** The moves of fingers watched from now on, once a pinch zooms (not passive: a pinch holds the page's own gesture back) */
  private watch(doc: Document): void {
    if (this.watching) return;
    this.watching = true;
    doc.addEventListener("touchmove", (e) => this.moved(e), { passive: false });
  }

  /** Two fingers come down over the editor where the pinch zooms: followed, and held from the host's gesture of them */
  private touched(e: TouchEvent): void {
    // (Its moves watched from a pinch's first touch on: the first finger of the two, or any touch before)
    if (this.host.pinches?.()) this.watch((e.currentTarget as Document | null) ?? document);
    if (e.touches.length !== 2) {
      // (A third finger: the host's own gesture of three, ours given up)
      if (e.touches.length > 2) this.fingers = undefined;
      return;
    }
    if (!this.host.pinches?.() || !(this.host.pinchesAt ?? this.host.inEditor)(e.target)) return;
    e.stopPropagation();
    const [a, b] = [e.touches[0]!, e.touches[1]!];
    const from = this.host.size();
    this.fingers = { ids: [a.identifier, b.identifier], start: [pointOf(a), pointOf(b)], at: e.timeStamp, seen: "undecided", from, size: from };
  }

  /** The fingers moved: a pinch zooms as they spread or close; a move of both together is the page's */
  private moved(e: TouchEvent): void {
    const fingers = this.fingers;
    if (!fingers || e.touches.length !== 2) return;
    const now = this.pointsOf(e.touches, fingers.ids);
    if (!now) return;
    // (Asked again as they move: a pan becomes a pinch once they spread; a pinch stays one)
    if (fingers.seen !== "pinch") fingers.seen = twoFingers(fingers.start, now);
    if (fingers.seen !== "pinch") return;
    if (e.cancelable) e.preventDefault();
    const size = pinchedSize(fingers.from, fingers.start, now, FONT_SIZE_LIMITS);
    if (size === fingers.size) return;
    fingers.size = size;
    this.zoomTo(size);
  }

  /** A finger lifted: two that hardly moved and soon were a tap, the host's own then */
  private lifted(e: TouchEvent): void {
    const fingers = this.fingers;
    if (!fingers) return;
    this.fingers = undefined;
    if (wasTap(fingers.seen, e.timeStamp - fingers.at)) this.host.twoFingerTap?.();
  }

  /** The two followed touches' places, in their order; none where one of them is gone */
  private pointsOf(touches: TouchList, ids: readonly [number, number]): [Point, Point] | undefined {
    const list = [...touches];
    const a = list.find((touch) => touch.identifier === ids[0]);
    const b = list.find((touch) => touch.identifier === ids[1]);
    return a && b ? [pointOf(a), pointOf(b)] : undefined;
  }

  private wheeled(e: WheelEvent): void {
    if (!e.ctrlKey || !this.host.enabled() || !this.host.inEditor(e.target)) return;
    e.preventDefault();
    const steps = this.wheel.steps(e.deltaY, e.deltaMode);
    if (steps) this.zoomTo(zoomedBy(this.host.size(), steps));
  }

  private key(e: KeyboardEvent): void {
    if (e.key !== "0" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || !this.host.enabled() || !this.host.inEditor(e.target)) return;
    e.preventDefault();
    this.zoomTo(this.host.defaultSize());
  }

  /** Zoomed to a size (at the default: none kept, as the browser keeps no zoom of 100 %), the label shown */
  private zoomTo(size: number): void {
    const fallback = this.host.defaultSize();
    this.host.zoom(size === fallback ? undefined : size);
    this.label.textContent = size === fallback ? `Font size ${size} px · default` : `Font size ${size} px`;
    this.label.hidden = false;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => (this.label.hidden = true), LABEL_MS);
  }
}

const pointOf = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });
