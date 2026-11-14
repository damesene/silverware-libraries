// SILVERBULLET-INTERNAL: the one place Silverware Assets reaches into SilverBullet past its API (search the repository
// for this mark to find every such place).
//
// What: where an element of the editor (an embed's widget, a wiki link) is in the page's text, asked of SilverBullet's
// editor itself: the global `client.editorView`, CodeMirror's `posAtDOM`, as SilverBullet's own Alt+click finds a
// widget (2.12.1, 2026-11-14). SilverBullet's widget of an embed carries no position in its DOM.
//
// Why here and how safe: the user's choice (2026-11-14), weighed against the repository's rule of no SilverBullet
// internals (docs/silverware-assets.md, *Which embed a widget is*). Used where it is there; its answer is checked by
// the decorator against the text (an embed or a link of the element's target must start there), else the text around
// the element and the run of widgets drawn decide, as without it. `ui-tests/assets.spec.ts` checks it by name
// ("SilverBullet's editor gives a widget's position"), so a SilverBullet changing it fails there.
//
// To take it out: delete this file and the `positionOf` line in host/silverbullet/assets.ts (the decorator then works
// as before it). To change it (SilverBullet giving a position of its own, a `data-pos` on its widget): change this
// function alone.

/** Where an element of the editor is in the page's text, as SilverBullet's editor says; none where it cannot say */
export function editorPosition(doc: Document, element: Element): number | undefined {
  const view = (doc.defaultView as { client?: { editorView?: { posAtDOM?: (node: Node, offset?: number) => unknown } } } | null)?.client?.editorView;
  if (typeof view?.posAtDOM !== "function") return undefined;
  try {
    const at = view.posAtDOM(element, 0);
    return typeof at === "number" && Number.isInteger(at) && at >= 0 ? at : undefined;
  } catch {
    return undefined;
  }
}
