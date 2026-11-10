// Reordering by dragging, live, for any plugin's lists (the toolbar's
// settings' favourites, items within and across rows and the rows themselves;
// the values of Silverware Table's Choices dialog): once the pointer has moved a little,
// the element dragged moves in the document to where it would go, so it holds
// its place (dimmed) and the others slide aside (each animated from where it
// was: FLIP), while a copy of it follows the pointer. Where it goes is the gap
// nearest the pointer in the container under it (or the nearest container),
// not only over another element; a container that scrolls scrolls near its
// top or bottom. Esc cancels. Let go, the caller is told the
// container and the index it ended at, and draws the list anew from its values.
// An element dragged by itself, not by a handle (`hold`), is taken by a finger
// only once held still a moment, so a finger's move over the list scrolls it
// (as a database board's card and a timeline's bar are taken).

export type Reorder = {
  // The element dragged
  readonly element: HTMLElement;
  // Where it may go, in order
  readonly containers: () => readonly HTMLElement[];
  // A container's elements in order (the one dragged among them once it is there)
  readonly items: (container: HTMLElement) => readonly HTMLElement[];
  // In lines that wrap (a row's items), or one under another (the rows)
  readonly flow: "inline" | "block";
  // The class base: `${base}-placeholder` on it while dragged, `${base}-ghost` on the copy
  readonly base: string;
  // Where the copy goes (the dialog: its look's variables are set there), else the body
  readonly layer?: HTMLElement;
  // Let go after moving: the container's index and the index it ends at; undefined: cancelled, or never moved
  readonly done: (to: { readonly container: number; readonly index: number } | undefined) => void;
  // Let go without moving (a click, a tap): told after `done`
  readonly clicked?: () => void;
  // A finger's press takes it only once held still HOLD_MS (moved before: the page's scroll, nothing told; let go
  // before: a tap, `clicked`); the element's CSS lets a finger pan (touch-action), a mouse's and a pen's take it at once
  readonly hold?: boolean;
};

// How far the pointer goes before it is a drag (a press without it is a click or a focus)
const THRESHOLD = 4;
// Near a scrolling container's top or bottom (px), it scrolls, by up to SCROLL_STEP a frame
const SCROLL_EDGE = 28;
const SCROLL_STEP = 12;
// The others sliding aside
const SLIDE_MS = 150;
// A finger held this long, moved less than HOLD_PX, takes the element (`hold`)
const HOLD_MS = 400;
const HOLD_PX = 8;

export function reorder(e: PointerEvent, options: Reorder): void {
  const { element, base } = options;
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const start = { x: e.clientX, y: e.clientY };
  const box = element.getBoundingClientRect();
  const grab = { x: e.clientX - box.left, y: e.clientY - box.top };
  let ghost: HTMLElement | undefined;
  // Its copy made, following the pointer from now on, where the pointer is
  const lift = (x: number, y: number) => {
    ghost = element.cloneNode(true) as HTMLElement;
    ghost.classList.add(`${base}-ghost`);
    ghost.removeAttribute("id");
    // A picture of it: no second field or button for a screen reader, nor for what counts them
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.style.width = `${box.width}px`;
    ghost.style.height = `${box.height}px`;
    ghost.style.left = `${x - grab.x}px`;
    ghost.style.top = `${y - grab.y}px`;
    (options.layer ?? doc.body).append(ghost);
    element.classList.add(`${base}-placeholder`);
  };
  // A finger's press with `hold`: waiting to be held (taken once the timer runs out)
  const waiting = !!options.hold && e.pointerType === "touch";
  let holding = 0;
  // Its moves, once taken, the drag's: kept from scrolling (told for every move: the browser asks as it may scroll)
  const keep = (t: TouchEvent) => {
    if (ghost && t.cancelable) t.preventDefault();
  };
  // A long press's own menu (the system's), never while a finger holds it
  const noMenu = (c: Event) => c.preventDefault();

  const move = (m: PointerEvent) => {
    if (m.pointerId !== e.pointerId) return;
    if (!ghost) {
      const far = Math.hypot(m.clientX - start.x, m.clientY - start.y);
      if (waiting) {
        // Moved before it was held: the page's scroll, not a drag
        if (far > HOLD_PX) leave();
        return;
      }
      if (far < THRESHOLD) return;
      lift(m.clientX, m.clientY);
    }
    m.preventDefault();
    ghost!.style.left = `${m.clientX - grab.x}px`;
    ghost!.style.top = `${m.clientY - grab.y}px`;
    last = { x: m.clientX, y: m.clientY };
    place(m.clientX, m.clientY);
    if (!scrolling) scroll();
  };

  // A container that scrolls, or a box around it that does (a long list in a box), scrolls while the pointer is near its top or bottom
  const scrollerOf = scrollers();
  let last = start;
  let scrolling = 0;
  const scroll = () => {
    scrolling = 0;
    if (!ghost) return;
    const found = containerAt(options.containers(), last.x, last.y, scrollerOf);
    const container = found && scrollerOf(found);
    if (!container) return;
    const r = container.getBoundingClientRect();
    const by = last.y < r.top + SCROLL_EDGE ? -1 : last.y > r.bottom - SCROLL_EDGE ? 1 : 0;
    if (!by) return;
    const edge = by < 0 ? r.top + SCROLL_EDGE - last.y : last.y - (r.bottom - SCROLL_EDGE);
    const before = container.scrollTop;
    container.scrollTop += by * Math.ceil((SCROLL_STEP * Math.min(edge, SCROLL_EDGE)) / SCROLL_EDGE);
    if (container.scrollTop === before) return;
    place(last.x, last.y);
    scrolling = win.requestAnimationFrame(scroll);
  };

  /** The element moved in the document to the gap nearest the point, the others sliding there from where they were */
  const place = (x: number, y: number) => {
    const containers = options.containers();
    const container = containerAt(containers, x, y, scrollerOf);
    if (!container) return;
    const others = options.items(container).filter((item) => item !== element);
    const index = options.flow === "inline" ? inlineIndex(others, x, y) : blockIndex(others, y);
    const next = others[index];
    if (element.parentElement === container && (next ? element.nextElementSibling === next : !nextItem(element, others))) return;
    const before = new Map(containers.flatMap((c) => options.items(c)).filter((item) => item !== element).map((item) => [item, item.getBoundingClientRect()] as const));
    if (next) container.insertBefore(element, next);
    else if (others.length) others[others.length - 1]!.after(element);
    else container.prepend(element);
    for (const [item, was] of before) {
      const now = item.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (!dx && !dy) continue;
      item.style.transition = "none";
      item.style.transform = `translate(${dx}px, ${dy}px)`;
      win.requestAnimationFrame(() => {
        item.style.transition = `transform ${SLIDE_MS}ms ease`;
        item.style.transform = "";
        // Its slide over, nothing of it left on the element
        win.setTimeout(() => {
          if (!item.style.transform) item.style.transition = "";
        }, SLIDE_MS);
      });
    }
  };

  // Its listeners gone, nothing told (a finger's scroll before it was held)
  const leave = () => {
    win.clearTimeout(holding);
    win.removeEventListener("pointermove", move, true);
    win.removeEventListener("pointerup", up, true);
    win.removeEventListener("pointercancel", cancel, true);
    win.removeEventListener("keydown", key, true);
    win.removeEventListener("touchmove", keep, true);
    win.removeEventListener("contextmenu", noMenu, true);
    win.cancelAnimationFrame(scrolling);
  };
  const finish = (dropped: boolean) => {
    leave();
    const moved = !!ghost;
    ghost?.remove();
    element.classList.remove(`${base}-placeholder`);
    if (!dropped || !moved) {
      options.done(undefined);
      if (dropped) options.clicked?.();
      return;
    }
    const containers = options.containers();
    const container = containers.findIndex((c) => c.contains(element));
    const index = container < 0 ? -1 : options.items(containers[container]!).indexOf(element);
    options.done(container < 0 || index < 0 ? undefined : { container, index });
  };
  const up = (u: PointerEvent) => {
    if (u.pointerId === e.pointerId) finish(true);
  };
  const cancel = (c: PointerEvent) => {
    if (c.pointerId !== e.pointerId) return;
    // (The browser took a finger's move not held yet for a scroll: nothing to tell)
    if (waiting && !ghost) leave();
    else finish(false);
  };
  // Esc cancels the drag, not the dialog
  const key = (k: KeyboardEvent) => {
    if (k.key !== "Escape" || !ghost) return;
    k.preventDefault();
    k.stopPropagation();
    finish(false);
  };
  win.addEventListener("pointermove", move, true);
  win.addEventListener("pointerup", up, true);
  win.addEventListener("pointercancel", cancel, true);
  win.addEventListener("keydown", key, true);
  if (waiting) {
    win.addEventListener("touchmove", keep, { capture: true, passive: false });
    win.addEventListener("contextmenu", noMenu, true);
    holding = win.setTimeout(() => {
      // (Drawn anew meanwhile: nothing to take)
      if (!element.isConnected) return leave();
      lift(last.x, last.y);
      place(last.x, last.y);
    }, HOLD_MS);
  }
}

/** The item after the element among the others, if any (whether it is already last) */
function nextItem(element: HTMLElement, others: readonly HTMLElement[]): HTMLElement | undefined {
  for (let next = element.nextElementSibling; next; next = next.nextElementSibling) if (others.includes(next as HTMLElement)) return next as HTMLElement;
  return undefined;
}

/** How a container's scrolling box is found: one per drag, a container's boxes that may scroll found once */
type Scrollers = (container: HTMLElement) => HTMLElement | undefined;

/**
 * The box that scrolls a container up and down: the container itself, else the nearest around it that does; none where
 * none does. Which boxes around a container may scroll (their overflow) is read once per drag, as the pointer moves
 * dozens of times a second; whether one scrolls now (its content taller than it: a list an item was dragged into) each time.
 */
function scrollers(): Scrollers {
  const mayScroll = new WeakMap<HTMLElement, readonly HTMLElement[]>();
  return (container) => {
    let boxes = mayScroll.get(container);
    if (!boxes) {
      const found: HTMLElement[] = [];
      for (let one: HTMLElement | null = container; one; one = one.parentElement) {
        const overflow = one.ownerDocument.defaultView?.getComputedStyle(one).overflowY;
        if (overflow === "auto" || overflow === "scroll") found.push(one);
      }
      mayScroll.set(container, (boxes = found));
    }
    return boxes.find((one) => one.scrollHeight > one.clientHeight);
  };
}

/** A container's part in view: its box cut to the box that scrolls it (a list longer than its box: the part the box shows) */
function shownRect(container: HTMLElement, scrollerOf: Scrollers): { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } {
  const r = container.getBoundingClientRect();
  const scroller = scrollerOf(container);
  if (!scroller || scroller === container) return r;
  const s = scroller.getBoundingClientRect();
  return { left: Math.max(r.left, s.left), right: Math.min(r.right, s.right), top: Math.max(r.top, s.top), bottom: Math.min(r.bottom, s.bottom) };
}

/** The container the point is in, else the one nearest it up or down */
function containerAt(containers: readonly HTMLElement[], x: number, y: number, scrollerOf: Scrollers): HTMLElement | undefined {
  let nearest: HTMLElement | undefined;
  let distance = Infinity;
  for (const container of containers) {
    const r = shownRect(container, scrollerOf);
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return container;
    const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (d < distance) {
      distance = d;
      nearest = container;
    }
  }
  return nearest;
}

/** Where a point falls among items in lines that wrap: after every item on a line above, and those on its line left of it (by their middle) */
function inlineIndex(items: readonly HTMLElement[], x: number, y: number): number {
  let index = 0;
  for (const item of items) {
    const r = item.getBoundingClientRect();
    if (r.bottom <= y || (r.top <= y && x > r.left + r.width / 2)) index++;
  }
  return index;
}

/** Where a point falls among items one under another: after those whose middle is above it */
function blockIndex(items: readonly HTMLElement[], y: number): number {
  return items.filter((item) => {
    const r = item.getBoundingClientRect();
    return r.top + r.height / 2 < y;
  }).length;
}
