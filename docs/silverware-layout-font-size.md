# Silverware Layout: the font size

The plan for the editor's font size in Silverware Layout (agreed with the user 2026-11-12). The plugin's plan and decisions: [silverware-layout.md](silverware-layout.md).

## What it does

- **A font size for all pages**, set in the Page layout dialog: a row *Font size* on the Page tab, under the two widths, *Theme* (the theme's) or *Own*, a slider and a number in px; moved or typed, it is Own (as the widths). Saved into CONFIG, `silverware.layout.fontSize` (px). Global only: no page has a font size of its own (the user's choice).
- **Font zoom** (as the browser's zoom, for the page's text alone), on by default, `silverware.layout.fontZoom.enabled` (the repository's shape for a feature that can be turned off: `<feature>.enabled`, room for more of its settings beside):
  - Ctrl + scroll over the editor changes the font size a pixel a step (5 to 40 px); a touchpad's small deltas summed into steps. The browser's own zoom held back there (`preventDefault`); elsewhere (a dialog, a menu) the browser's zoom as ever. A touchpad's pinch, which browsers send as Ctrl + wheel, zooms the same.
  - Ctrl+0 puts it back to the default (the setting, else the theme's).
  - The size zoomed to is **this device's**, kept as the browser keeps its zoom (local storage, across reloads), never written into the space. The dialog sets it too, by a slider of its own (*This device*, while Font zoom is on: its size, *Reset*; no word "default" beside it, which moved the slider as it came and went, 2026-11-13): on a phone, which has no Ctrl + wheel, it is how the font is zoomed (2026-11-13, the user trying it on a phone: SilverBullet takes two and three fingers' moves, so no pinch).
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
6. ~~A phone~~ (2026-11-13): *This device* a slider in the dialog; and every slider of the dialog, held, leaves the dialog all but gone (`swl-dialog-sliding`, its controls held alone shown on a quiet ground), so the page under it is seen as it changes: on a phone the dialog takes the screen. A pinch weighed and left: SilverBullet handles two and three fingers' moves itself; a pinch told from them would have to take the gesture from it, by its version.

## Pinch (asked 2026-11-15, built the same day)

The user's: a pinch with two fingers zooms the font on a touch screen, behind a box of its own (off by default), without
hacks; SilverBullet's own tap with two fingers (its page picker) kept.

- **What SilverBullet does** (`client/editor_ui.tsx`, 2.12.1 and main): a `touchstart` listener of the window, two
  touches opening the page picker (`startPageNavigate("page")`), three the command palette; no setting. Its page is not
  scalable (`user-scalable=no`): a pinch is free, but it starts with two fingers down, which opened the picker.
- **Held at the document** (`ui/fontzoom.ts`): where `fontZoom.pinch` is on, two touches over the editor stop at the
  document as they bubble (every element of the page has had them: the editor, the grids, other plugins), so the
  window's listener does not get them. Three are left to it.
- **Told apart** (`core/pinch.ts`, pure): a pinch once the distance between the fingers changes by more than 12 px (the
  size the start's times the distance's ratio, whole px, 5 to 40; one finger moved alone too); a pan once their middle
  moves more than 10 px with the distance kept (the page's scroll, nothing of ours), a pinch still once they spread; a
  tap where both are lifted within 300 ms, undecided till then. The moves are watched (`touchmove` not passive) only
  once the setting is on, from the first touch after it: a phone's scroll waits for no script otherwise. A pinch holds
  back Safari's own zoom of the page (`gesturestart`, `gesturechange`: iOS zooms despite `user-scalable`); the page's
  scroll by the moves before a pinch is told is not held back (to see on a phone). Over the page's text alone (the
  Page layout dialog open or not).
- **A tap given back**: SilverBullet's tap, as the command doing the same (`Navigate: Page Picker`, `client/editor_commands.ts`)
  run by the host (`host/silverbullet/behaviour.ts` `TWO_FINGER_TAP_COMMAND`, `editor.invokeCommand` handed over), as the
  fingers are lifted. Not a touch event made up and sent to it (Safari makes no `Touch` of a script's).
- **Setting**: `silverware.layout.fontZoom.pinch` (`true` written, none where off), the Font tab's *A pinch with two
  fingers zooms here* under This device.
- **Tested**: `core/pinch.test.ts`, `ui/fontzoom.test.ts` (the window's listener given two fingers or not), and in
  SilverBullet `ui-tests/pinch-touch.spec.ts` (the touch project: CDP's touches; off: the picker at once; on: a pinch
  zooms, a tap opens the picker). Not yet on a real phone (Android, iOS).

## Files zoomed (asked 2026-11-15, built the same day)

The user's: the files a page shows grow and shrink with this device's font zoom, behind a box of its own (off by
default); its scale the share of This device's size in All pages' (the theme's where none), so a page at its default
shows them at theirs; previews not made again (a raster preview is drawn larger, as it is).

- **What is content and what is not**: what a page shows grows, as the browser's zoom would make it (an image, a
  preview, a document's viewer, a card and a label already with the text's font); what acts on it does not (a file's
  "…", a widget's handle, a menu: a control, its size its own). The "…" had followed the text's size before, given the
  editor's font by SilverBullet's rule for a widget's buttons (`#sb-main .cm-editor … button { font-size: inherit }`):
  its font now its own, important.
- **The scale** (`shared/contentscale.ts`): a CSS variable on the root, `--sw-content-scale`, set by Silverware Layout
  alone (`app.ts` `showWith`, the setting `fontZoom.scaleFiles`), none at 1; a contract of the plugins', as the layers
  are, so Silverware Assets follows it without knowing Layout.
- **Silverware Assets**: its sizes in px written times the scale (`scaledPx`: a preview's height and width, an
  original document's height); the host's medium (`swa-medium`: its image, video) of an original of its own size (no
  width laid out) and of a preview zoomed (CSS `zoom`), its limits in px divided by the scale (counted once), a
  percentage left as it is (zoom leaves the room's percentages: never wider than its room); the medium alone, so its
  frame's "…" and label keep theirs and no picture a type draws in its own (a document's) is zoomed. **A type's
  drawing** (Silverware Assets PDF, DOCX, XLSX: a preview, a reader) is given its room as at the scale of 1 (`viewportOf`) and
  writes its sizes as CSS following the scale itself (`scaledPx`, `scaledNumber` for a `zoom`: a preview's box, a
  document's page made smaller, a sheet's cells, a reader's height: `shared/docreader.ts`), so it changes at once with
  the scale, in the same frame as an image, nothing drawn again (it was drawn again 300 ms after the scale changed at
  first, the same day: late and jumping, the user saw); a preview kept in the space is not made again, drawn larger as
  it is.
- **Over the window** (a database's peek, a full screen) the scale is 1 (Layout's style page): its text is not the
  zoomed editor's.
- **A width laid out** (Silverware Layout's handle): a provider says its widgets follow the scale (`LayoutProvider.scales`,
  shared/layout.ts; Assets' does), its width in px then shown times the scale (`--swl-width` a `calc` of it); the
  handle measures, snaps and shows on the screen (the guides are the screen's), what it writes divided by the scale
  (`widgetlayout.ts`): a width kept in the page as it would be at 100 %. A percent or full width is the pane's, as before.
  Decided so (the review's question, 2026-11-15): a width snapped to a guide or to the text's width is written divided
  too, as any width dragged: what shows on the guide now is what a zoom of 100 % shows smaller, as the browser's zoom
  does (the guides and the text's width are the screen's, which the font zoom does not change).

## On by default; the command named Settings (the user's, 2026-11-16)

- `fontZoom.pinch` and `fontZoom.scaleFiles` on by default (tried and found good): read as on unless `false`, written
  as none where on, `false` where off; the boxes ticked in a new space.
- The command *Silverware Layout: Page layout* renamed *Silverware Layout: Settings*, as every other plugin's settings
  are named, its dialog titled *Silverware Layout* (its subtitle the page): it holds the alignment, the widths, the
  font, the guides and the markdown's settings, the page's own width one row of them.
