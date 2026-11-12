// The layers every Silverware plugin lays its elements over the page in (z-index): one scale for all of them, so one
// plugin's never come out over another's where they should not (a table's + over a database's peek). This file is the
// one place they are set. A style page cannot import it: each plugin sets them as it starts (`applyLayers`), CSS
// variables on the root (`--sw-layer-control`), which its rules take their z-index from (`var(--sw-layer-control)`, a
// step `calc(var(--sw-layer-control) + 1)` for its own order within a layer). Everything laid in them is the plugins'
// JS's own (their controls, a widget over the window, a peek), so they are set before any is shown (Space Style is
// active only after Space Lua, which starts the plugins). Under 30: the order within a widget (its held header, a cell).

/** Each layer's z-index */
export const LAYERS = {
  // CodeMirror's scroller lifted over SilverBullet's top bar (z-index 20) while it holds a widget over the window
  lifted: 30,
  // A widget shown over the whole window (a table or a database in full screen, the sheet's board)
  overWindow: 45,
  // A plugin's controls floating over the page (a table's toolbar, grips and +, a chart's toolbar, a width's bar)
  control: 50,
  // Menus, and what floats over the controls (Silverware Toolbar's bar)
  menu: 60,
  // A sheet over part of the window (a database's peek): over the other plugins' controls placed by a widget under it
  sheet: 70,
  // A plugin's own panels over its sheet (an editor of the peek's)
  sheetPanel: 75,
  // Dialogs
  dialog: 100,
  // What is dragged in a dialog, over it
  dragged: 101,
} as const;

export type Layer = keyof typeof LAYERS;

/** A layer's CSS variable (`--sw-layer-sheet-panel`) */
export const layerVariable = (layer: Layer): string => `--sw-layer-${layer.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** The layers set as CSS variables on the document's root, as a plugin starts (every plugin sets the same) */
export function applyLayers(doc: Document): void {
  const style = doc.documentElement.style;
  for (const [layer, z] of Object.entries(LAYERS)) {
    const name = layerVariable(layer as Layer);
    if (style.getPropertyValue(name) !== String(z)) style.setProperty(name, String(z));
  }
}
