# Silverware Layout: where a widget stands

Decided with the user 2026-11-14. Where a widget stands on the page (left, centred, right) is Silverware Layout's, as its width is: a widget's plugin keeps the value, Layout gives it its meaning, places the widget and offers the control. Without Layout nothing is aligned.

## Decided

- **An entry of Layout's, `align`** (`left`, `center`, `right`), beside `width`: read and written through the provider alone (`read`, `write`), each plugin keeping it in its own form (a table's metadata `layout.align`, a chart's `%% layout.align`, a database block's, a file's embed `{ align: right }`). Layout never reads a widget's markdown.
- **Kinds of widget**: a provider names the kinds of its widgets (`kinds`: an id, a name, a default alignment) and says each element's (`kindOf`): Silverware Assets' *Preview* and *Original*, a table's *Table*, a chart's *Chart*, a database's *Database*, Layout's own grid *Grid*. A widget stands as its entry says, else as the user's default for its kind (the Page layout dialog), else as its kind's own default, else centred. The provider's `anchor()` goes.
- **The control**: a click on the handle's grip opens a menu, **Align** (Left, Center, Right; the one in force checked, the default marked) and the width taken off. A widget not widened (a preview: `resizable` false) gets the grip for the menu alone, no drag. Choosing the default writes none (the widget then follows its kind's default as that changes).
- **The Page layout dialog**: a tab **Alignment**, a row per kind of the providers registered, its default.
- **Silverware Assets**: its alignment leaves the file's "…" menu and the Appearance tab (all files', a type's own, an original's): per type was a rare need, a file has its own. Its provider maps `align` to the embed's metadata.
- **Grids** as every widget: the width's handle and the alignment, the column dividers within. The edge lines and `shift` go (`ui/edges.ts`): a grid wider on one side alone is aligned to the other (wider to the left: right), narrower ones stand left, centred or right exactly; only an offset with neither edge on the text's is lost, which the edges snapped away from anyway.
- Nothing is converted: grids and alignments are only in the test pages so far.

## Steps

1. The contract (`shared/layout.ts`): `align`, `kinds`, `kindOf`; `anchor`, `edges` and `shift` out.
2. Layout: alignment from the entry or the defaults; the handle's menu (a click on the grip, a double click still takes the width off), a grip without a drag; the Alignment tab; the grid's provider (`width`, `align`, kind *Grid*), its edges and `shift` out.
3. Silverware Assets: the provider's `align` and kinds; its own alignment out (menu, Appearance, model).
4. Silverware Table, Chart, Database: their kind in their provider.
5. Tests (unit, UI in SilverBullet), docs, the user's check.

Steps 1 to 4 done 2026-11-14, with the tests and docs of step 5 (the grid's edge tests replaced by its handle's, the files' alignment by the handle's menu, the Alignment tab's own test); the user's check is left.
