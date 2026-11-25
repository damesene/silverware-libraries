// SILVERBULLET-INTERNAL: the one place Silverware Assets reaches into SilverBullet past its API (search the repository
// for this mark to find every such place).
//
// What: where a point of the window is in the page's text (a file dropped there: docs/silverware-assets-insert.md),
// asked of SilverBullet's editor itself: the global `client.editorView`, CodeMirror's `posAtCoords` (2026-11-15).
// SilverBullet has no public call for it; where an element is (an embed's widget, a link) it has one,
// `editor.posAtDOM` (from 3.0), which the init page hands over (shared/silverbullet/position.ts).
//
// Why here and how safe: the user's choice (2026-11-14), weighed against the repository's rule of no SilverBullet
// internals (docs/silverware-assets.md). Used where it is there; without it a drop is placed at the cursor.
//
// To take it out: delete this file and its use in host/silverbullet/insert.ts (once SilverBullet has a public call).

/** Where a point of the window (px) is in the page's text, as SilverBullet's editor says; none where it cannot say */
export function editorPositionAt(doc: Document, x: number, y: number): number | undefined {
  const view = (doc.defaultView as { client?: { editorView?: { posAtCoords?: (coords: { x: number; y: number }) => unknown } } } | null)?.client?.editorView;
  if (typeof view?.posAtCoords !== "function") return undefined;
  try {
    const at = view.posAtCoords({ x, y });
    return typeof at === "number" && Number.isInteger(at) && at >= 0 ? at : undefined;
  } catch {
    return undefined;
  }
}
