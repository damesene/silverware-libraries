// Font zoom (docs/silverware-layout-font-size.md): Ctrl + scroll over the editor makes its font a pixel larger or
// smaller a step, Ctrl+0 (Cmd+0 on a Mac) puts the default back, as the browser zooms the page; the browser's own zoom
// held back there alone. A label at the window's bottom left says the size for a moment, naming the default.
import { el } from "../../../shared/elements.ts";
import { WheelSteps, zoomedBy } from "../core/fontsize.ts";

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
};

export class FontZoom {
  private readonly label: HTMLElement;
  private readonly wheel = new WheelSteps();
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    doc: Document,
    private readonly host: FontZoomHost,
  ) {
    this.label = el(doc, "div", { class: `${BASE}-label`, attrs: { role: "status", hidden: "" } });
    doc.body.append(this.label);
    // (Not passive: the browser's zoom held back; captured, ahead of the editor's own)
    doc.addEventListener("wheel", (e) => this.wheeled(e), { capture: true, passive: false });
    doc.addEventListener("keydown", (e) => this.key(e), true);
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
