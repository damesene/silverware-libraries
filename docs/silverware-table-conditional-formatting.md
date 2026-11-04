# Silverware Table: conditional formatting (plan)

Conditional formatting as in Excel: cells of a column, a named row or the whole table look different where their values meet a condition (a fill, a text color, bold; later data bars, color scales and icons). Predefined conditions and formats, and the user's own registered without changing the plugin, as custom column types are. A module of its own, `conditions`, that the core knows nothing of.

Status (2026-11-03): phases 1 to 3 done on the branch `feat/conditional-formatting`: the core's `CellLook.vars`, the offers (`valueOf` of column types, `rowValues` of formulas, `ranges` of conditions), the domain `src/conditions/` with 20 conditions and 17 formats, the module with its dialog (a live preview in the table), quick rules in a column's menu, the cell menu, the toolbar's icon, `defineConditions` / `defineFormats`, the Excel file's conditional formatting (verified in Excel 16), the library page. Phase 4 in part: a named row's scope works in the dialog (and is evaluated, stored, exported); quick rules in a row's grip menu are not done. What was decided with the user is in *Decisions*, what is still open at the end.

## Goals and limits

- Scopes: a column (one or more), a named row, the whole table. The header (row 0) and pinned rows and columns are never formatted: the header is not data, and pinned rows are mostly totals, which would distort top N, averages and scales.
- Viewing never writes: the rules are metadata (they need the metadata setting, as names and formulas do); applying them changes only what a cell looks like, never the markdown.
- Formats are JS definitions, not CSS (decided 2026-11-03): a format says how a cell looks as data (a fill, a text color, bold…), and may grade the cells it applies to into levels (3 for a traffic light, 10 for a heat map) by a distribution of its own. The built-in formats are written in the same form as a user's, through the same helpers.
- Conditions and formats are data with parameters (as a column type's `params`), so the dialog is built from them, and a custom one gets a UI without code of its own.
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
- **Custom styles found at run time**: `themesInStyles` walks the style sheets for `data-swt-theme="…"` selectors. Not used here: formats are JS (see *The API*).
- **Filter syntax** (`filter.ts parseFilter`, pure): `>10`, `=a|b`, `/regex/flags`, `!…`, what a filter field accepts. One condition can take it whole, so a user writes a condition as they filter.
- **Menus and dialogs**: `lineMenu` (its `look` slot, under a column's alignment), `cellMenuEntries`, `toolbarButtons` with `place: "menu"` (the ⋯ menu), `host.openDialog`, `host.previewTable` (a small table looking as the page's, used for the themes' previews).
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

- `rule.ts`: a rule: `{ scope, when?, format, stop? }`; no `when`: every cell of the scope (a color scale over a column). `scope` is `table`, `column` (the rule is stored on its column) or `row` (a row's name). Reading and writing rules (`rulesOf`, `withRules`), lenient: a rule it cannot read is kept as written and reported, never dropped.
- `api.ts`: the public API, the one thing built-in and custom definitions use: the types (`FormatDefinition`, `ConditionDefinition`, `Cell`, `Context`, `Scope`, `Style`, `Helpers`) and `HELPERS` (see *The API* below).
- `cell.ts`: a cell as definitions get it, and `scope.ts`: the statistics of a rule's cells, lazy (see *The API*).
- `style.ts`: a `Style` checked, combined with others, and turned into the core's `vars`.
- `registry.ts`, `custom.ts`, `builtin/conditions/` and `builtin/formats/` (one per file, a test requiring each in the library page's tables). Conditions: greater, less, between, equal, notEqual, contains, startsWith, matches (`/pattern/flags`), filter (the filter row's syntax whole), empty, notEmpty, duplicate, unique, top, bottom, aboveAverage, belowAverage, dateIn (today, yesterday, last 7 days, this month…), formula (`=[@due] < TODAY()`, through `rowValues`; only while the formulas module is on, else the rule is inactive and says so). Formats: Excel's highlights (light red fill with dark red text, yellow, green, red text, bold), own colors, color scales of 2 and 3 colors, a heat map of 10 levels, traffic light (3), data bar; icon sets in phase 3.
- `evaluate.ts`: a table's looks from its rules (see *How a rule is evaluated*). Cached by the table's text and the rules (looks run on every view).

### The API (decided 2026-11-03)

One API for the built-in definitions and the user's: what a built-in format can do, a user's can, and a built-in one copied into the space works there unchanged.

**A definition** is a function that gets `HELPERS` and gives the definition (a user's file gives a list of them, or a function giving the list, as `defineTypes` takes). A user's file cannot import from the plugin (its sources are bundled), so the helpers come only as that argument, for the built-in ones too:

```ts
// src/conditions/builtin/formats/colorscale.ts
import type { FormatDefinition, Helpers } from "../../api.ts";   // types only: nothing of it is left in the bundle

export default ({ palette, mix }: Helpers): FormatDefinition => ({
  name: "colorScale",
  label: "Color scale",
  params: {
    low: { kind: "color", default: palette.red.fill },
    mid: { kind: "color" },                       // none: a scale of two colors
    high: { kind: "color", default: palette.green.fill },
  },
  look: (cell, { scope, params }) => {
    const t = scope.position(cell);               // 0 at the minimum, 1 at the maximum; undefined: no number
    return t === undefined ? undefined : { fill: mix([params.low, params.mid, params.high], t) };
  },
});
```

```js
// Library/me/formats.js, a file of the space
export default ({ palette, levels }) => [
  // Colors by the user's own regular expressions
  {
    name: "status",
    label: "Status colors",
    look: (cell) =>
      /^(done|hotovo)$/i.test(cell.text) ? { color: palette.green.text, strike: true }
      : /^blocked/i.test(cell.text) ? { fill: palette.red.fill, bold: true }
      : undefined,
  },
  // Five levels, own colors, fixed thresholds
  {
    name: "grade",
    label: "School grades",
    look: levels(["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027"].map((fill) => ({ fill })), [1.5, 2.5, 3.5, 4.5]),
  },
  // A color of its own for light and dark
  { name: "brand", label: "Brand", style: { fill: { light: "#e8f0ff", dark: "#1d2b4a" }, bold: true } },
];
```

```lua
silverware.table.defineFormats(js.importFromSpace("Library/me/formats.js"))
```

What holds the built-in ones to it:

- The registry calls each built-in definition with `HELPERS` and checks what it gives with the same code as a user's (`custom.ts`): the checks and their messages are exercised by the built-in ones too.
- A test: files in `builtin/` import nothing but types from `api.ts` (`import type`).
- A test: each built-in definition, its types stripped by esbuild, read through `custom.ts` as a user's file is, gives the same looks.

**A format** has `name`, `label`, `description`, `icon`, `params` (the column types' `ParamSpec`, with two new kinds: `color`, shown as a color picker, and `boolean`, a switch), and one of:

- `style`: one look for every cell (`style: X` is `look: () => X`), or a function of the params giving one;
- `look(cell, ctx) → Style | undefined`: the look of one cell; `undefined` leaves the cell as it is.

**A condition** has the same fields and `test(cell, ctx) → boolean`:

```ts
// builtin/conditions/greater.ts
export default (): ConditionDefinition => ({
  name: "greater",
  label: "Greater than",
  params: { value: { kind: "number" } },
  test: (cell, { params }) => cell.number !== undefined && cell.number > params.value,
});
// duplicate: (cell, { scope }) => scope.count(cell) > 1;  top: (cell, { scope, params }) => (scope.rank(cell) ?? Infinity) <= params.count
```

**`cell`**: the cell's value as sorting sees it (a column type's value, a formula's result), read already: `{ text, number?, date?, column }`; `number` and `date` only where the text reads as one (`view.ts asNumber`, the formulas' dates).

**`ctx`**:

- `params`: the rule's parameters, typed by `params` (a color as a color, a number as a number);
- `scope`: statistics of the cells the definition is applied to (a condition's: the rule's scope; a format's: the cells that passed the condition, all of the scope without one): `min`, `max`, `average`, `size`, `position(cell)` (0..1 from min to max), `share(cell)` (0..1 from min(0, min) to max: a data bar), `rank(cell)` (from the largest), `count(cell)` (how many cells have its value). Lazy: computed only when asked, once per table and rule, kept while the table's text is the same; so a definition never keeps a cache of its own;
- `row`: the other cells of its row by column key (`row.due.date`), of the same shape as `cell`.

**`Style`** (data, never CSS text): `fill`, `color`, `bold`, `italic`, `underline`, `strike`, `bar` (`{ share, color }`: a data bar under the content), and in phase 3 `icon`. Only what changes is given. A color is any CSS color (checked once, with `CSS.supports`, as the definition is given), `{ light, dark }` for the two looks, or a palette color.

**`HELPERS`**:

- `palette`: named colors, each with `fill` and `text`, theme-aware (they resolve to the style page's variables, so a format follows light and dark without saying so);
- `mix(colors, t)`: the color at `t` (0..1) along two or more colors, as `color-mix(in oklab, …)` (no color parsing in JS); `gradient(colors, n)`: n colors along them;
- `levels(styles, split)`: a `look` grading the cells into as many levels as styles, by `split`: `"equal"` (equal ranges between min and max), `"quantiles"` (equal counts), fixed thresholds (`[1.5, 2.5]`), `{ percent: [33, 67] }`, or a function of the scope giving thresholds; it reads the level from `scope`, so it is no form of its own;
- `icons` (phase 3), `matches(pattern)` (the filter row's reading of `/…/flags`).

### Formats set up in the dialog (decided 2026-11-03)

Some built-in formats are ready to be set up: the user picks one for a rule and fills in its settings in the dialog (which words get which colors, which number ranges, how many colors). Nothing is saved apart: the settings are the rule's params, written in the table with the rule, as any format's. They are built-in formats with richer `params`, written through the same API as every other; no JS is made.

- **By keywords** (`byPattern`): rows of a keyword or pattern and a style, as many as the user adds, the first row whose pattern matches giving the cell's look. A pattern is in the filter row's syntax (`/regex/flags`, `=a|b`, `>10`, `!…`), so it is learned once (a plain word is found anywhere in the cell, as in a filter); one that does not read (a bad regular expression) is said at its field as it is typed.
- **By number ranges** (`byRange`): rows of a range (from, to; either end open) and a style, as many as the user adds; a cell in no range is left as it is.
- **Levels** (`levels`): the number of levels (2 to 10), the colors (each picked, or from and to with the ones between made by `gradient`; reversed by one button), the split (equal ranges, quantiles, own thresholds as values or percent).
- **Color scale** and **data bar**: their colors picked.
- **Own style** (`custom`): one style.

What the table keeps of one, set up for its column `score`:

```markdown
| <meta core.table conditions.-c-score.rules='[{"format":["byRange",{"rows":[{"to":50,"style":{"fill":"red"}},{"from":50,"to":80,"style":{"fill":"yellow"}},{"from":80,"style":{"fill":"green"}}]}]}]'> |
```

Every style is edited by one small editor: swatches of the palette (theme-aware) and an own color, toggles for bold, italic, underline and strike, a live preview of a cell.

New kinds of `params`, which the dialog builds its fields from, and which a user's JS format gets too (a custom format with a `list` parameter gets the same editor for free):

- `color`, `boolean`;
- `style`: the style editor;
- `pattern`: text in the filter row's syntax, checked as typed;
- `list`: rows of fields of their own (`{ kind: "list", of: { pattern: { kind: "pattern" }, style: { kind: "style" } } }`), added, removed and ordered.

Regular expressions are the user's own and run on every view: one that takes long (catastrophic backtracking) is not guarded against beyond what the filter row does; noted, not solved.

### How a rule is evaluated

For each rule, in the order of the dialog, on every view (from the cache while the table's text is the same):

1. **Scope**: the cells of its scope (a column, the table, later a named row); the header and pinned rows and columns left out. Hidden rows count, so filtering does not reshuffle colors.
2. **Condition**: where the rule has one, the cells its `test` is true for.
3. **Scope of the format**: the statistics of the cells left (lazy).
4. **Look**: `look` called for each of them; what it gives is the cell's look.

Several rules on a cell combine: a property an earlier rule set is not overridden by a later one (as in Excel); `stop` on a rule ends the rules after it for the cells it formatted. A `test` or `look` that throws, or gives what is not a boolean or a `Style`: that rule formats no cell, logged once per rule, the table never broken (as a custom type's `attempt`).

### How a style reaches the cell

The module turns a `Style` into the core's `CellLook.vars` (`--swt-cf-fill`, `--swt-cf-fill-dark`, `--swt-cf-color`, `--swt-cf-weight`, `--swt-cf-bar`, …) and one mark, `cf`. A single CSS rule on the style page reads them; no CSS per format, so a format of any number of levels and any colors needs no stylesheet.

### The module: `features/conditions.ts`

- `looks`: the domain's evaluation with values from the column types' offer; the mark `cf` and the `--swt-cf-*` vars of the styles.
- Storage: a column's rules as a column attribute (`conditions.-c-<column>.rules`, so the core keeps them with their column, also while the module is off); the table's and named rows' rules as a table attribute (`conditions.rules`). JSON in apostrophes (`metaAttribute`), compact: a condition or format by its name, or `[name, params]` where it has params: `conditions.-c-score.rules='[{"when":["greater",{"value":100}],"format":"lightRed"},{"format":["colorScale",{"high":"green"}]}]'`. A named row's rule whose row is gone stays inactive, shown so in the dialog.
- `tablesChanged`: custom conditions or formats defined anew: looks of tables with rules applied again.
- Without the metadata setting: the menu entries are disabled with why, as naming is.

### CSS (the style page)

One rule for every format, `td.swt-cf`, under the theme engine's specificity (`:is(#sb-main, html)`), never `!important`: `background-color: var(--swt-cf-fill)`, `color: var(--swt-cf-color)`, weight, style and decoration by their vars, the dark values under `html[data-theme="dark"]`, the data bar a `background-image` gradient by `--swt-cf-bar` (so it does not replace the cell's content and works under a column type's display). The palette's colors as variables with their light and dark values. Order agreed with the rest: the selection's shadow over it, `swt-type-invalid`'s color over the text color (an error is told first), pinned cells never get the mark.

### Custom conditions and formats

`silverware.table.defineConditions(js.importFromSpace("…"))` and `silverware.table.defineFormats(js.importFromSpace("…"))`, the same API block and lifecycle as `defineTypes` (a list, or a function given HELPERS that returns one; checked by the same code as the built-in ones; a mistake a notification; replaced as Space Lua loads again; a name of a built-in one replacing it in its place). See *The API*.

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

1. **Core and the simplest rules** (about 3 to 4 days): `CellLook.vars` with tests; the column types' offer; the domain with column and table scopes, the cell conditions (compare, between, equal, contains, matches, filter, empty), `api.ts` with `HELPERS`, the lazy `scope`, `Style` and its one CSS rule, the formats of one style (Excel's highlights) as definitions of `HELPERS`, the tests holding the built-in ones to the API; the module's looks and storage; quick rules in the column menu; CSS; library page; a ui-test (a rule added from the menu, a cell edited into and out of it, a sort keeping colors with values).
2. **The dialog and the rest of the conditions** (about 4 to 5 days): Manage rules; conditions over the scope (duplicates, top / bottom, averages, dates); formula conditions; own colors (the `color` parameter kind); `levels`, `mix` and `gradient`, color scales and the heat map; custom conditions and formats (`defineConditions`, `defineFormats`); the formats set up in the dialog (`byPattern`, `byRange`, `levels`, the style editor, the `color`, `boolean`, `style`, `pattern` and `list` params); the cell menu.
3. **Bars, icons and export** (about 3 days): data bars, icon sets (`CellLook.icon`, `Style.icon`), Excel's conditional formatting (what maps to Excel's: highlights, 2 and 3 color scales, data bars; a format with `look` written as values only, listed).
4. **Named rows as a scope** (later, about 1 to 2 days): the scope `row` in the dialog and the quick rules of a row's grip menu. Nothing before it may need changing for it: the rule's `scope` has `row` from phase 1 (read, kept, inactive until this phase), table and row rules share the table attribute, and the evaluation takes a scope as a set of cells, not as a column.

Estimates are rough, from the parts above, not from a prototype.

## Risks

- **Specificity against themes** (decided 2026-11-03): the module's CSS never uses `!important`; a user's theme that does wins over a fill, and that is accepted. Checked against the built-in themes and Tiniri in step 1, so that a theme without `!important` never hides a format.
- **Cost on large tables**: a rule over the scope (top N, scales) reads the column's values on every view; cached by the table's text, so it is paid once per write. Formula conditions build a `Book` per table, cached the same way.
- **Colors given by the user**: checked once with `CSS.supports("color", …)` as a definition is given; one that fails is a mistake of the definition, said, not a cell left unformatted silently.
- **The values compared**: depends on the column types' offer being exactly what sorting compares; one function for both, so they cannot drift.
- **JSON in metadata**: readable but long; kept compact (short keys, defaults left out). A rule written by hand wrong is kept and reported, never dropped.

## Decisions (2026-11-03, with the user)

1. **Pinned rows and columns are always left out**, with the header. No option per rule.
2. **A table's rules are seen from its toolbar**, not from headers: the ⋯ menu always has *Conditional formatting…*, a table with rules gets an active icon in the toolbar too (see *UX*).
3. **Named rows come later** (phase 4), but the design counts on them from phase 1 (see *Phases*).
4. **No `!important`** in the module's CSS; a theme that uses it wins (see *Risks*).
5. **Formats are JS, not CSS**: defined as column types are, with helpers for palettes, gradients and distributions; any number of levels; regular expressions as a condition and inside a format's `look` (see *The API*).
6. **One API for built-in and custom definitions**: a definition is a function of `HELPERS`, the built-in ones importing only types; a format is `style` or `look(cell, ctx)`, levels a helper giving a `look`; a condition `test(cell, ctx)`; `ctx.scope` the lazy statistics (see *The API*).
7. **Formats set up in the dialog**: by keywords, by number ranges, levels (how many colors, which), color scale, data bar and an own style, as built-in formats whose params the dialog fills in for one rule; no formats saved apart (see *Formats set up in the dialog*).

## Performance on large tables (2026-11-04, with the user)

Measured on a table of 2000 rows and 10 columns (20 000 cells) with three rules (a color scale, greater than → bold, a data bar), in the playground: the main thread's long tasks after a change in the dialog, the change made in the page itself (Playwright's trace off: its DOM snapshots, and a locator over 20 000 cells, cost seconds of their own; the playground's profile.ts wrappers show in profiles too).

Before: one change in the dialog kept the main thread busy for 0.8 to 1.1 s: the dialog drawn anew (about 120 + 70 ms), the table's preview (the rules evaluated, about 140 ms, of which about 90 ms built the cells' inputs; every cell's classes and vars taken off and put on again, about 180 ms; the browser restyling them all), and the open rule's sample (about 115 ms, building the same inputs again). The table's preview ran 120 ms after every change, under a modal dialog covering most of the table.

Three changes, each its own commit:

1. **The cells' inputs read once per table** (`readers` in features/conditions.ts, by the parsed table, emptied on `tablesChanged` as a column type defined anew may read a value otherwise; none kept for a table with `${…}` cells): the looks and the dialog's sample share them.
2. **A cell's look applied again only where it changed** (core/silverbullet/looks.ts: the look applied kept as a key; the same look, and what it shows still in the cell, is left alone): generic, for every module's `looksChanged`.
3. **The table shows the rules edited only as the dialog is put aside** (its eye; shared/dialog.ts `peeked`), kept shown back in the dialog (decided by the user: no repainting on the way back, the next look away showing them as they are then), taken back unless saved. While editing, the open rule's sample shows it on the table's own cells. No Apply button: the eye and Save cover it.

After: a change in the dialog costs 70 to 200 ms (the dialog and its sample drawn anew). Putting the dialog aside costs about 0.75 s once, Cancel after it about 0.67 s (the table's looks applied as written again).

Left for later, if needed: applying looks to the rows in view first and the rest in idle time (only looks without values: sorting and filters read `data-swt-value` and `data-swt-sort` of every cell); the largeTables module (rows far from the view out of the DOM) not verified with conditional formatting.

## Open questions

None now. To decide in phase 1: the exact names of `Style`'s properties and the palette's colors (checked in light and dark, with the built-in themes and Tiniri).
