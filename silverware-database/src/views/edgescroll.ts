// A box scrolled sideways while something is dragged near its left or right
// edge, the faster the nearer the edge, as long as it is held there: what a
// drag says (its pointer's place) the view's own, a board's HTML drag or a
// timeline's pointer captured. Away from the edges, `stop`, or the box gone, it
// stops. Either way alike.

// How near an edge it scrolls (px; a sixth of a narrow box at most), and how fast at the edge itself (px a second, whatever
// the screen's frame rate)
const EDGE = 72;
const EDGE_SPEED = 1300;

export type EdgeScrollOptions = {
  /** What covers the box's edges (a column held at its left: the timeline's names), px: the edge is past it */
  readonly inset?: () => { readonly left: number; readonly right: number };
  /** A drag's place older than this stops it (an HTML drag may end without telling; a pointer captured always tells) */
  readonly quietMs?: number;
  /** Told after each step it scrolled (what the drag points at moved under it) */
  readonly scrolled?: () => void;
};

export type EdgeScroll = {
  /** The drag's pointer at `x` (the window's): scrolling where it is near an edge, held there until told otherwise */
  at(x: number): void;
  /** The drag left the box or ended */
  stop(): void;
};

export function edgeScroll(box: HTMLElement, options: EdgeScrollOptions = {}): EdgeScroll {
  const state = { x: 0, when: 0, running: false, on: false, last: 0 };
  const view = box.ownerDocument.defaultView;
  const step = (now: number) => {
    const quiet = options.quietMs !== undefined && performance.now() - state.when > options.quietMs;
    if (!state.on || quiet || !box.isConnected) return void (state.running = false);
    const seconds = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    const rect = box.getBoundingClientRect();
    const inset = options.inset?.() ?? { left: 0, right: 0 };
    const edge = Math.min(EDGE, (rect.width - inset.left - inset.right) / 6);
    const left = state.x - rect.left - inset.left;
    const right = rect.right - inset.right - state.x;
    const by = (distance: number) => Math.ceil(((edge - Math.max(0, distance)) / edge) * EDGE_SPEED * seconds);
    const was = box.scrollLeft;
    // (No room for an edge: the insets take the box's width; nothing to scroll by, the step's division would give NaN)
    if (edge <= 0) return void view?.requestAnimationFrame(step);
    if (left < edge && box.scrollLeft > 0) box.scrollLeft -= by(left);
    else if (right < edge && box.scrollLeft < box.scrollWidth - box.clientWidth) box.scrollLeft += by(right);
    if (box.scrollLeft !== was) options.scrolled?.();
    view?.requestAnimationFrame(step);
  };
  return {
    at(x) {
      state.x = x;
      state.when = performance.now();
      state.on = true;
      if (state.running || !view) return;
      state.running = true;
      state.last = performance.now();
      view.requestAnimationFrame(step);
    },
    stop() {
      state.on = false;
    },
  };
}
