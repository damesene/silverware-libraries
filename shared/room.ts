// The room a plugin's bar docked at an edge of the window takes there (Silverware Toolbar's, docked at the bottom or
// under the top bar), told to the other plugins as a CSS variable on the root, so what they lay at that edge (Silverware
// Layout's zoom label at the bottom) stands clear of it without knowing whose bar it is. None set: no room taken.

/** The CSS variable of the room taken at an edge (a length, `120px`) */
export function roomVariable(edge: "top" | "bottom"): string {
  return `--sw-room-${edge}`;
}

/** The room taken at an edge set (px), or given back (undefined) */
export function setRoom(doc: Document, edge: "top" | "bottom", px: number | undefined): void {
  const style = doc.documentElement.style;
  if (px === undefined) style.removeProperty(roomVariable(edge));
  else style.setProperty(roomVariable(edge), `${px}px`);
}
