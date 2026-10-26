// Reordering by dragging, live, for the settings' favourites (items within and
// across rows, and the rows themselves): once the pointer has moved a little,
// the element dragged moves in the document to where it would go, so it holds
// its place (dimmed) and the others slide aside (each animated from where it
// was: FLIP), while a copy of it follows the pointer. Where it goes is the gap
// nearest the pointer in the container under it (or the nearest container),
// not only over another element. Esc cancels. Let go, the caller is told the
// container and the index it ended at, and draws the list anew from its values.

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
};

// How far the pointer goes before it is a drag (a press without it is a click or a focus)
const THRESHOLD = 4;
// The others sliding aside
const SLIDE_MS = 150;

export function reorder(e: PointerEvent, options: Reorder): void {
  const { element, base } = options;
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const start = { x: e.clientX, y: e.clientY };
  const box = element.getBoundingClientRect();
  const grab = { x: e.clientX - box.left, y: e.clientY - box.top };
  let ghost: HTMLElement | undefined;

  const move = (m: PointerEvent) => {
    if (m.pointerId !== e.pointerId) return;
    if (!ghost) {
      if (Math.hypot(m.clientX - start.x, m.clientY - start.y) < THRESHOLD) return;
      ghost = element.cloneNode(true) as HTMLElement;
      ghost.classList.add(`${base}-ghost`);
      ghost.removeAttribute("id");
      ghost.style.width = `${box.width}px`;
      ghost.style.height = `${box.height}px`;
      (options.layer ?? doc.body).append(ghost);
      element.classList.add(`${base}-placeholder`);
    }
    m.preventDefault();
    ghost.style.left = `${m.clientX - grab.x}px`;
    ghost.style.top = `${m.clientY - grab.y}px`;
    place(m.clientX, m.clientY);
  };

  /** The element moved in the document to the gap nearest the point, the others sliding there from where they were */
  const place = (x: number, y: number) => {
    const containers = options.containers();
    const container = containerAt(containers, x, y);
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
      });
    }
  };

  const finish = (dropped: boolean) => {
    win.removeEventListener("pointermove", move, true);
    win.removeEventListener("pointerup", up, true);
    win.removeEventListener("pointercancel", cancel, true);
    win.removeEventListener("keydown", key, true);
    const moved = !!ghost;
    ghost?.remove();
    element.classList.remove(`${base}-placeholder`);
    if (!dropped || !moved) {
      options.done(undefined);
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
    if (c.pointerId === e.pointerId) finish(false);
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
}

/** The item after the element among the others, if any (whether it is already last) */
function nextItem(element: HTMLElement, others: readonly HTMLElement[]): HTMLElement | undefined {
  for (let next = element.nextElementSibling; next; next = next.nextElementSibling) if (others.includes(next as HTMLElement)) return next as HTMLElement;
  return undefined;
}

/** The container the point is in, else the one nearest it up or down */
function containerAt(containers: readonly HTMLElement[], x: number, y: number): HTMLElement | undefined {
  let nearest: HTMLElement | undefined;
  let distance = Infinity;
  for (const container of containers) {
    const r = container.getBoundingClientRect();
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
