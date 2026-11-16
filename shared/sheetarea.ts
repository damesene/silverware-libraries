// Where a panel beside the page goes (a sheet over part of the window: shared/layers.ts), as a host gives it: the area of
// its editor, under its top bar and what is docked at the editor's edges. A plugin's panel places itself in it, the
// window where the host gives none.

export type SheetArea = {
  /** The area on screen (none: the window's) */
  rect(): DOMRect | undefined;
  /** `listener` told as the area may have changed; its end given back */
  watch(listener: () => void): () => void;
};

/** The area a panel is placed in: the host's, else the window's */
export function sheetRect(area: SheetArea | undefined, view: Window): DOMRect {
  return area?.rect() ?? new DOMRect(0, 0, view.innerWidth, view.innerHeight);
}
