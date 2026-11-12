# Silverware Layout: the font size

The plan for the editor's font size in Silverware Layout (agreed with the user 2026-11-12). The plugin's plan and decisions: [silverware-layout.md](silverware-layout.md).

## What it does

- **A font size for all pages**, set in the Page layout dialog: a row *Font size* on the Page tab, under the two widths, *Theme* (the theme's) or *Own*, a slider and a number in px; moved or typed, it is Own (as the widths). Saved into CONFIG, `silverware.layout.fontSize` (px). Global only: no page has a font size of its own (the user's choice).
- **Font zoom** (as the browser's zoom, for the page's text alone), on by default, `silverware.layout.fontZoom.enabled` (the repository's shape for a feature that can be turned off: `<feature>.enabled`, room for more of its settings beside):
  - Ctrl + scroll over the editor changes the font size a pixel a step (5 to 40 px); a touchpad's small deltas summed into steps. The browser's own zoom held back there (`preventDefault`); elsewhere (a dialog, a menu) the browser's zoom as ever. A touchpad's pinch, which browsers send as Ctrl + wheel, zooms the same.
  - Ctrl+0 puts it back to the default (the setting, else the theme's).
  - The size zoomed to is **this device's**, kept as the browser keeps its zoom (local storage, across reloads), never written into the space. The dialog shows it while it differs from the default: *This device: 20 px*, *Reset*.
  - **A label at the window's bottom left** while zooming, as the browser's "Page Zoom 90%": *Font size 20 px*, gone about 1.5 s after the last step. At the default it says so in its text, *Font size 18 px · default*, with no other mark and no stop there (the browser does not stop at 100 % either).
- Shown by a rule of the style page's, `:root[data-swl-font-size] #sb-main .cm-editor { font-size: var(--swl-font-size) !important }`, the attribute and the variable set on the root: SilverBullet 2.12.1 sets the editor's font size as a number (`#sb-main .cm-editor { font-size: 18px }`); its main has `--editor-font-size` since, which this rule wins over as well. Headings, code, tables and the rest of the text are in `em` of it.

## Order of the font size

this device's zoom, else the setting, else the theme's (nothing set).

## Probe (2026-11-12, SilverBullet 2.12.1, the UI tests' server)

A page with headings, a paragraph with code, a list, a table (Silverware Table), a chart (Silverware Chart, Mermaid), a database (Silverware Database) and 40 paragraphs; 1400 px wide.

- `--editor-font-size` set on the root changed nothing: 2.12.1 sizes `#sb-main .cm-editor` as `18px` (SilverBullet's main reads the variable, not yet released). A rule `#sb-main .cm-editor { font-size: 24px !important }` did: the text 24 px, h1 36, h2 28.8, code 24, a table's cells 24, a database's cells 24 and its name 20.4: all in `em`.
- **CodeMirror measures again by itself**: 50 ms after the change, where it puts a character (`coordsAtPos`) is where the DOM has it (227 px, it was 188), a point's position (`posAtCoords`) the character under it, the content's height grown (3558 to 5699 px). Nothing to ask of it.
- **A chart's labels stay** (Chart.js draws them in px: ticks 12, the title 14); its box follows the text. For Silverware Chart to take on, later, if wanted (its theme reading the editor's font size).
- Ctrl + wheel over the text reaches a capture listener on the document, `ctrlKey` true, cancelable (the browser's zoom held back by `preventDefault`); Ctrl+0 reaches it with nothing prevented before, SilverBullet taking no part (no key binding of `Mod-0` in its source).

## Steps

1. ~~The probe~~: done (above).
2. ~~The model~~ (settings `fontSize`, `fontZoom.enabled`; which size applies; a wheel's turns as steps), unit tests: done.
3. ~~The font size shown~~ (host/marks.ts, the editor the host's), the zoom (ui/fontzoom.ts: Ctrl + wheel, Ctrl+0, the label; host/devicezoom.ts: local storage), the dialog's row, Font zoom box and *This device* with Reset: done. Reset is the dialog's, applied on Save (Cancel keeps the zoom), as everything in it. Font zoom off leaves this device's zoom kept but not shown.
4. ~~UI tests~~ (silverware-layout/ui-tests/fontsize.spec.ts, against SilverBullet): done.
5. ~~Docs~~: done (2026-11-12).
