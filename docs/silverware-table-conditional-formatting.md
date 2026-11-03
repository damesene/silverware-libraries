# Silverware Table: conditional formatting (plan)

Conditional formatting as in Excel: cells of a column, a named row or the whole table look different where their values meet a condition (a fill, a text color, bold; later data bars, color scales and icons). Predefined conditions and formats, and the user's own registered without changing the plugin, as custom column types are. A module of its own, `conditions`, that the core knows nothing of.

Status (2026-11-03): planned, nothing done. The research behind it is in *What the code has* below; what was decided with the user is in *Decisions*, what is still open at the end.

## Goals and limits

- Scopes: a column (one or more), a named row, the whole table. The header (row 0) and pinned rows and columns are never formatted: the header is not data, and pinned rows are mostly totals, which would distort top N, averages and scales.
- Viewing never writes: the rules are metadata (they need the metadata setting, as names and formulas do); applying them changes only what a cell looks like, never the markdown.
- Formats are CSS only, as themes are: a predefined format is a class with its light and dark look; a user's format is a space-style rule, found by its selector.
- Conditions are data with parameters (as a column type's `params`), so the dialog is built from them, and a custom condition gets a UI without code of its own.
- Rules are evaluated on the values sorting and filters see (a column type's value, a formula's result), not on what the markdown has.

Not in scope: arbitrary address ranges (`B2:D9`) as a scope (they break on every sort written into the markdown and on edits in the markdown; a named row and a column follow their lines through the core); formatting the header; a rule per cell.

## What the code has (research, 2026-11-03)

- **Looks are model terms already.** `Feature.looks(info, table)` gives `TableLooks` (cells by markdown row and column), `core/looks.ts` merges every feature's in their order, the adapter (`core/silverbullet/looks.ts`) applies them and takes them back when they change. It works for rows out of the document (largeTables) and for tables the sheet draws. A module needs no DOM: the `conditions` module is a model module in `features/`.
- **`CellLook` has no colors.** It has `display`, `value`, `marks` (classes `swt-<mark>`) and `title`. A fixed set of formats would work with marks alone; a color picked by the user, a data bar's length or a color scale's shade would not (a class per color is not possible). This is the one real gap in the core.
- **The looks of one view are computed side by side.** `mergeLooks(this.features.map((f) => f.looks?.(info, table)))`: one feature does not see another's looks of the same pass, so the conditions module cannot read the column types module's `value` through `host.shownValue` while looks are made (that reads what was applied before). It needs the typed value another way: an offer of the column types module.
- **Column types** (`columntypes/type.ts`): `sortValue(text, params)` is what sorting and filters compare; `check` tells a valid value; both pure. `view.ts asNumber` reads numbers as sorting does.
- **Formulas** offer `cells` (`FormulasOffer`); the domain has `rowValues(table, formula, calculation)`: a formula of one row (`[@status]="late"`) calculated for each body row, which the pivot uses for its conditions. A formula condition is exactly that, with no new code in the formulas.
- **Metadata**: `host.getMeta` / `setMeta` (table attributes) and `columnsMeta` / `setColumnsMeta` (a column's: `<owner>.-c-<column>.<key>`, followed by the core through renames, moves and deletes, also while the module is off). There are no row attributes; a row is addressed by its name (`core.n`, `host.rowNames`), which moves with it.
- **Pins**: `host.pinsOf(table)` gives the pinned rows and columns.
- **CSS layering** (style page): pinned cells and held rows paint `background` (a tint over the page color); column stripes paint `background-image` on body cells; a selected or edited cell is an inset `box-shadow` over the background; an invalid typed value is `color: var(--danger-color)`. So a fill set as `background-color` sits under the selection and over the stripes, as wanted.
- **Custom definitions**: `defineTypes` / `defineSeries` in `index.ts`, the API page's priority-50 block, a domain's `registry.ts` and `custom.ts` (definitions checked, HELPERS, a mistake a notification, replaced as Space Lua loads again, `tablesChanged` telling modules). A test requires the built-in ones' syntax and description in the library page.
- **Custom styles found at run time**: `themesInStyles` walks the style sheets for `data-swt-theme="…"` selectors.
- **Menus and dialogs**: `columnMenuEntries`, `cellMenuEntries`, `toolbarButtons` with `place: "menu"` (the ⋯ menu), `host.openDialog`, `host.previewTable` (a small table looking as the page's, used for the themes' previews).
- **A module turned off is not loaded** (`FEATURE_NAMES`, `MODULE_CATEGORY`, `MODULE_LABELS`, `MODULE_DESCRIPTIONS` in bridge.ts): its rules stay in the tables, unused.

## Design

### Core: two generic additions

1. **`CellLook.vars`**: CSS custom properties for a cell, only names starting `--swt-` (checked by the adapter, so a module cannot set arbitrary styles), merged later-wins per property, set on the `td` and taken back like marks. The core knows no property: the CSS that reads them is the module's, on the style page. Cost: `MergedCell` gets `vars`, `applyCellLook` / `takeBack` a few lines, tests. This also lets the column types' meter, or a theme, use variables later.
2. **`CellLook.icon`** (phase 3, for icon sets): an icon before a cell's content, as a header's `HeaderIcon`, a `UI_CLASS` element the core's `layOutCells` keeps outside the content box. Not needed before icon sets.

Nothing else in the core: no rule, scope, condition or format is its concept.

### Column types: an offer

`columnTypes` offers `valueOf(table, ref)`: the value its type compares (`sortValue`, else the text; nothing for an invalid value), the same the module's looks give as `value`. Its own small contract in `columntypes/index.ts`, as `FormulasOffer` is in the formulas. Off: the conditions read the cell's text, as sorting then does.

### The domain: `src/conditions/`

Pure, as `columntypes/` and `autofill/` are; `index.ts` its API.

- `rule.ts`: a rule: `{ scope, when: { condition, params }, format, stop? }`; `scope` is `table`, `column` (the rule is stored on its column) or `row` (a row's name). Reading and writing rules (`rulesOf`, `withRules`), lenient: a rule it cannot read is kept as written and reported, never dropped.
- `condition.ts`: the shape of a condition, as `ColumnType`: `name`, `label`, `syntax`, `description`, `icon`, `params: ParamSpecs` (the column types' `ParamSpec` reused, extended where needed: a value compared, a date range), and one of
  - `match(value, params, context) → boolean` (a cell alone: greater than, between, contains, empty), or
  - `prepare(values, params) → (value) => boolean` (needs the scope's values: top N, above average, duplicates), or
  - `scale(values, params) → (value) => number | undefined` (0..1: data bars, color scales).
  `context`: the cell's row values by column key, for a condition that reads its row.
- `registry.ts`, `custom.ts`, `builtin/` (one per file, a test requiring each in the library page's table): greater, less, between, equal, notEqual, contains, startsWith, empty, notEmpty, duplicate, unique, top, bottom, aboveAverage, belowAverage, dateIn (today, yesterday, last 7 days, this month…), formula (`=[@due] < TODAY()`, through `rowValues`; only while the formulas module is on, else the rule is inactive and says so), and the scales dataBar, colorScale.
- `evaluate.ts`: a table's looks from its rules: each scope's cells (body only, pinned rows and columns out), `prepare` and `scale` over the scope's values (hidden rows included, so filtering does not reshuffle the colors), the rules in order, `stop` ending a cell's, formats combined (later rules do not override an earlier rule's property, as in Excel). Cached by the table's text and the rules (looks run on every view).
- `formats.ts`: the predefined formats by name (Excel's: light red fill with dark red text, yellow fill with dark yellow text, green fill with dark green text, light red fill, red text, red border; bold) and a format of the user's own colors (`{ fill, text, bold }`), each turned into marks and vars.

### The module: `features/conditions.ts`

- `looks`: the domain's evaluation with values from the column types' offer; marks `cf-<format>`, vars `--swt-cf-fill`, `--swt-cf-text`, `--swt-cf-bar`, `--swt-cf-scale`.
- Storage: a column's rules as a column attribute (`conditions.-c-<column>.rules`, so the core keeps them with their column, also while the module is off); the table's and named rows' rules as a table attribute (`conditions.rules`). JSON in apostrophes (`metaAttribute`), compact. A named row's rule whose row is gone stays inactive, shown so in the dialog.
- `tablesChanged`: custom conditions defined anew: looks of tables with rules applied again.
- Without the metadata setting: the menu entries are disabled with why, as naming is.

### CSS (the style page)

`td.swt-cf-…` rules with light and dark variants under the theme engine's specificity (`:is(#sb-main, html)`), `background-color: var(--swt-cf-fill)`, `color: var(--swt-cf-text)`, the data bar a `background-image` gradient by `--swt-cf-bar` (so it does not replace the cell's content and works under a column type's display), a color scale a `color-mix` by `--swt-cf-scale`. Order agreed with the rest: the selection's shadow over it, `swt-type-invalid`'s color over the text color (an error is told first), pinned cells never get a mark.

### Custom formats and conditions

- **Formats**: CSS only. A space-style rule `.sb-table-widget td[data-swt-cf~="urgent"] { … }` (or a class, decided in step 1), found as themes are (a shared helper with `themesInStyles`: rules matching a selector pattern), offered in the dialog's list of formats with a preview cell.
- **Conditions**: `silverware.table.defineConditions(js.importFromSpace("…"))`, the same API block and lifecycle as `defineTypes` (a list or a function given HELPERS; checked; a throw in `match` marks no cell and is logged once per rule, never breaking the table).

### UX

- **Column menu → Conditional formatting**: a submenu with quick rules as Excel's ribbon has them (Greater than…, Less than…, Between…, Equal to…, Text contains…, Duplicate values, Top 10, Above average, Data bar, Color scale), each asking only its parameters and a format in a small form in the menu's place (as a filter is set in its bubble), then *Manage rules…* and *Clear rules of this column*.
- **Table ⋯ menu → Conditional formatting…**: the dialog of all the table's rules: a list in priority order (↑ ↓ and drag), each row its scope, condition and format as a preview cell; a rule edited in place under its row (no dialog over the dialog: the tags' first version of stacked dialogs was abandoned for that); scope picked as This table, a column, a named row. Nothing written until Save, one write.
- **Cell menu** on a selection: the same quick rules for the selection's columns.
- **Where a table's rules are seen** (decided 2026-11-03): not in headers (a rule need not be a column's). *Conditional formatting…* is always an item of the table's ⋯ menu; a table with at least one rule (any scope, active or not) also gets an icon in its toolbar (`toolbarButtons`, `place: "icon"`, shown pressed as Edit mode is), opening the same dialog. A table without rules shows no icon: the toolbar stays as it is.

### Elsewhere

- **Excel**: `<conditionalFormatting>` in the .xlsx for the predefined conditions (phase 3, the excel module asking an offer of the conditions module); until then the export lists rules as not exported.
- **Pivot**: a pivot's cells are readOnly, not unformatted: rules work there too.
- **Sheet view**: drawn tables apply looks the same way: nothing to do.

## Phases

1. **Core and the simplest rules** (about 3 to 4 days): `CellLook.vars` with tests; the column types' offer; the domain with column and table scopes, the cell conditions (compare, between, equal, contains, empty) and the predefined formats; the module's looks and storage; quick rules in the column menu; CSS; library page; a ui-test (a rule added from the menu, a cell edited into and out of it, a sort keeping colors with values).
2. **The dialog and the rest of the conditions** (about 4 to 5 days): Manage rules; conditions over the scope (duplicates, top / bottom, averages, dates); formula conditions; own colors; custom conditions (`defineConditions`) and custom formats found in the styles; the cell menu.
3. **Scales and export** (about 3 days): data bars and color scales, icon sets (`CellLook.icon`), Excel's conditional formatting.
4. **Named rows as a scope** (later, about 1 to 2 days): the scope `row` in the dialog and the quick rules of a row's grip menu. Nothing before it may need changing for it: the rule's `scope` has `row` from phase 1 (read, kept, inactive until this phase), table and row rules share the table attribute, and the evaluation takes a scope as a set of cells, not as a column.

Estimates are rough, from the parts above, not from a prototype.

## Risks

- **Specificity against themes** (decided 2026-11-03): the module's CSS never uses `!important`; a user's theme that does wins over a fill, and that is accepted. Checked against the built-in themes and Tiniri in step 1, so that a theme without `!important` never hides a format.
- **Cost on large tables**: a rule over the scope (top N, scales) reads the column's values on every view; cached by the table's text, so it is paid once per write. Formula conditions build a `Book` per table, cached the same way.
- **The values compared**: depends on the column types' offer being exactly what sorting compares; one function for both, so they cannot drift.
- **JSON in metadata**: readable but long; kept compact (short keys, defaults left out). A rule written by hand wrong is kept and reported, never dropped.

## Decisions (2026-11-03, with the user)

1. **Pinned rows and columns are always left out**, with the header. No option per rule.
2. **A table's rules are seen from its toolbar**, not from headers: the ⋯ menu always has *Conditional formatting…*, a table with rules gets an active icon in the toolbar too (see *UX*).
3. **Named rows come later** (phase 4), but the design counts on them from phase 1 (see *Phases*).
4. **No `!important`** in the module's CSS; a theme that uses it wins (see *Risks*).

## Open questions

1. **How a custom format is written in CSS**: as a class (`td.swt-cf-urgent { … }`: the core's marks are classes already, nothing to add) or as a data attribute (`td[data-swt-cf~="urgent"] { … }`, as themes are `data-swt-theme`: no clash with the plugin's own classes, but the core would have to set attributes too). Proposed: the class, names checked against the built-in formats' so a user's cannot take an internal one.
