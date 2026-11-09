# Silverware Database: conditional formatting, the plan

Asked by the user on 2026-11-07, to be built in a later session: an item, or one of its values, colored by rules over its
properties, as Notion has it (a date within 7 days red, a tag Done green, a number over 1000 purple), alike in every view,
without a second implementation of what Silverware Table has (its `conditions/`, docs/silverware-table-conditional-formatting.md).

Nothing of it is built yet. What follows is agreed in outline with the user (2026-11-07: it makes sense, reuse the table's
logic, no two implementations); the details marked *to decide* are asked of the user as their step comes.

## What there is to reuse

Silverware Table's conditional formatting is a pure domain, `silverware-table/src/conditions/` (about 2,400 lines with its
built-in definitions), and the table's parts around it:

* **The domain** (no DOM, no table):
  * `api.ts`: `Style` (fill, color, bold, italic, underline, strike, bar, icon: data, never CSS), `Cell` (`text`, `value`,
    `number?`, `date?`, `column`), `Scope` (size, numbers, min, max, average, sum, position, share, rank, percentile,
    quantile, count), `Context` (`params`, `scope`, `row`: the other cells of the row by column key, `formula()`), `ParamSpec`
    (a parameter as data, the dialog's fields made of it), `ConditionDefinition` (`test(cell, context)`),
    `FormatDefinition` (`style` or `look(cell, context)`), each with an optional Excel form (`excel`);
  * `rule.ts`: `Rule` (condition and format, each a `Ref`: a name and params; `scope`: the table, a column, a named row;
    `at`: its order), stored JSON read leniently (`rulesOf`, a rule that does not read kept as `UnreadRule`), written by
    `rulesText`, `inOrder`, `numbered`;
  * `evaluate.ts`: `evaluateRules(rules: RuleCells[], formula)` → `{ styles: Map<"row:column", Style>, problems }`, each
    rule over its `Placed` cells (`row`, `column`, `cell`, `rowCells`);
  * `scope.ts` (`scopeOf`), `style.ts` (`checkStyle`, `combineStyles`: an earlier rule's property kept), `params.ts`,
    `registry.ts` (built-in and custom definitions, module state: each plugin bundling it gets its own), `custom.ts`,
    `helpers.ts` (HELPERS: palette names, `mix`, `gradient`, `levels`, `matches`, `normalize`, `today`, `icons`);
  * `builtin/conditions/` (20: aboveaverage, belowaverage, between, bottom, contains, datein, duplicate, empty, endswith,
    equal, formula, greater, less, matches, notcontains, notempty, notequal, startswith, top, unique) and
    `builtin/formats/` (16: arrows, bluefill, bold, bypattern, byrange, colorscale, custom, databar, dots, greenfill,
    heatmap, levels, redfill, redtext, traffic, yellowfill).
* **Its ties to the table**, the only ones (checked 2026-11-07):
  * `scope.ts` and `helpers.ts` import `parseDate` and `now` from `../formulas/dates.ts`;
  * `helpers.ts` imports `filterExcelFormula` from `../filter.ts` (a filter's pattern as an Excel formula: the Excel file's);
  * the condition `formula` needs the table's formulas (`Context.formula`; undefined where there are none: it then picks no
    cell, as with the formulas module off);
  * every built-in definition carries its Excel form (`excel`), which only the table's Excel export reads.
* **The table's own parts**, not the domain: `features/conditions.ts` (the module: rules in the metadata row, looks as the
  core's `CellLook.vars`, `--swt-cf-*`), `features/conditionsdialog.ts` (the dialog), `excel/conditions.ts` (the Excel file's
  rules). Its users: `index.ts` (custom definitions from Space Lua), `features/excel.ts`.

The tests that keep the domain right are its own: `conditions/conditions.test.ts` (each built-in definition loaded as a
user's file would be, its types stripped), `builtin.test.ts`, `sample.test.ts`, `excel/conditions.test.ts`.

## Rules and the colors the database has (decided with the user 2026-11-09)

The database colors three ways already: an option's color (a select's value, its chip), an item's own color, and **Color by**
(each view's own: its items in the color of a property's option; an item's own color first). Rules come with them so:

* **Rules are the database's**, alike in every view: one list, in the order the user gives it. Rules of a view were set
  aside: mixed with the database's into one order, their place among rules another view reorders cannot be kept, and a rule
  such as *overdue in red* is wanted everywhere. What is a view's own is its Color by alone (a board by Status, a calendar by
  Project: each view answers its own question).
* **An item's look, one layer after another**, each property of a style (fill, color, bold, italic, strike, icon…) taken from
  the first that sets it (the domain's `combineStyles`, an earlier rule's property kept):
  `the item's own color → the rules, in their order → the view's Color by`. So layers add up: a timeline colored by Status
  keeps its bars' color under a rule that only adds an icon; *Done → strike* strikes an item and leaves its color to Color
  by; a rule's color wins over Color by, never over a color the user gave the item (the user's choice, 2026-11-09).
* **The item's own color is a line of the rules' list**, first by default, moved among the rules like any (an item's own color
  under *overdue* where the warning should win).
* **Color by stays a view's setting**, in ⋯ as today, always the last layer, not moved among the rules. Inside it may be
  evaluated as a rule of a built-in format, *option colors* (`look(cell)`: the color of the value's option), with no
  condition; to the user it is the view's. In the rules' dialog it is either not shown at all or shown so that it is plainly
  the view's, not the database's (apart from the list, under a line, named *This view: colored by Status*, not draggable):
  which of the two, decided in step 3 (the user, 2026-11-09).
* **A value's chip keeps its option's color**: a rule over a value adds what an option's color does not say (a fill of the
  cell, bold, strike, an icon). A rule that would only color a select's value as its option already is (*Done → green*) is
  not offered as a value's format of a select, or the dialog says the option's color does it.
* **One palette**: rules take the database's colors (`domain/colors.ts`, the options' palette, a color of one's own as
  `#rrggbb`, the dark look alike); the domain's palette names (`HELPERS`) map onto it (whether the two palettes match today
  is not checked).

## The plan, in four steps

Each step its branch's worth or less, reviewed, tested, committed apart; the first changes nothing a user sees.

### Step 1: the domain shared (about half a day to a day)

Move `silverware-table/src/conditions/` to `shared/conditions/`, Silverware Table onto it, nothing changed for its users:

* `parseDate` and `now` (or what they need of `formulas/dates.ts`) to a small `shared/dates.ts`, the table's formulas
  importing it from there too, or handed to the domain as HELPERS where that is cleaner (*to decide on reading the code*:
  the domain should not import a plugin's formulas);
* `filterExcelFormula` to `shared/filter.ts`, beside the filter syntax it reads;
* the Excel forms stay on the definitions, optional in the API (they are: `excel?`), the table's Excel export reading them
  as now; the database ignores them;
* the condition `formula` stays a built-in (its `Context.formula` is the host's to give; the database gives none until it
  has formulas: the condition is then left out of the database's dialog, not offered);
* the tests move with the domain (vitest finds `shared/` tests: check `vitest.config`), the table's tests pass unchanged;
* `isolation.test.ts` of the table: the domain now outside `src/`: what imports it allowed as `shared/` is.

Done when: `npm run verify` passes, the table's conditional formatting looks and exports as before (its Playwright tests),
`git grep "conditions/" silverware-table/src` shows only the module, the dialog and the Excel part using `shared/conditions`.

### Step 2: rules in the database, one evaluation for every view (about a day)

* **The model**: a database's `rules` (the domain's `Rule`s, its `scope` widened for the database: *to decide*, proposed
  `{ kind: "item" }` (the whole item: a table's row, a list's line, a card) and `{ kind: "property"; key }` (one value's
  cell), each rule's condition reading one property's value: the rule names it (`property: key`), as a table's rule reads
  its column).
* **The stores**: the rules with the schema in the root page (`_database.rules`, YAML through the page writer, a rule a map;
  or one JSON text as the table keeps them: *to decide*: YAML reads better by hand, JSON is what `rulesOf` reads already);
  the memory store alike; the contract tests over both; a rule that does not read kept as written (`UnreadRule`), never lost.
* **The core**: `addRule`, `updateRule`, `removeRule`, `moveRule` (the schema alone, written at once, kept for Undo, checked:
  a condition or format of a name not defined refused, its params checked by their `ParamSpec`); the database's rules
  evaluated once per data read (the items a `Placed` each: `row` the item's place, `column` the property's, `cell` its value
  as its type gives it: `text` the type's text, `number`, `date` read from the value, `rowCells` the item's other values),
  cached by the database's and items' revisions.
* **The layers** (*Rules and the colors the database has*): the item's own color a line among the rules (stored in the order
  with them, first by default); the view's Color by evaluated as the last layer by the format *option colors*, `colorBy`
  staying where the block keeps it; what `host.look.item` draws today (own color, Color by) made of the same evaluation, so
  there is one way an item gets its look.
* **The views, alike**: the place's host gives `look(item)` (the item's style, from its `item` rules) and
  `look(item, key)` (a value's, from its `property` rules); one helper of the views, `applyLook(element, style)` in
  `views/values.ts`, sets it on an element as CSS variables (`--swd-cf-fill`, `--swd-cf-color`…) and marks (`swd-cf`),
  one rule of the style page reads them (as the table's `--swt-cf-*`). The table (its row, its cells), the list (its line,
  its values), the board (its card, its values) and the peek (its values) each call it where they draw: a line or two each,
  nothing of the rules. A view of the user's gets `look` from its host too.
* Values a type marks invalid (a select's none of the options, a required one missing) keep their marks over a rule's
  color (*to decide*: or the rule's color over them).

Done when: rules written by hand in a root page color the playground's and SilverBullet's views; a rule changed elsewhere
shows as the place refreshes; Undo takes a rule's change back.

### Step 3: the rules' dialog (about a day)

A module, `conditions` (on by default, turned off in Settings, Modules), as the properties module is: under ⋯ beside the
views **Conditional formatting…**, and in Properties a property's own rules (*to decide*: both, or one of them).

* The item's own color a line of the list, dragged as a rule; the view's Color by not among them (not shown, or apart as the
  view's: *to decide* with the user, *Rules and the colors the database has*).
* The rules in their order (dragged, shared/drag.ts), each a line: *when* (a property, a condition, its params' fields made
  of its `ParamSpec`) *then* (a format, its params: the palette's colors, a color of your own as option colors have it);
  what it applies to (the whole item or the property's value); a sample of how it looks; removed.
* The conditions offered by the property's type (a date's: within, before, after; a number's: greater, between, top…;
  a select's: equal, not equal, empty…), the formula condition left out (no formulas yet).
* Every change written at once through the core (as option colors are), drawn in the places as they refresh.

Done when: the user's three examples (a date within 7 days red, Done green, a number over 1000 purple) are made in the
dialog alone, in the playground and in SilverBullet, against Playwright tests.

### Step 4, later: the dialog's parts shared with the table (half a day to a day)

What both dialogs build alike (a rule's fields from `ParamSpec`, the color picker, the sample) to `shared/conditions/ui`,
each plugin's dialog over it in its own look (as `shared/menu.ts` is). Only once the database's dialog has settled in use,
so that what is shared is what both need.

## What the database gets that the table has not

* A rule over a whole item (a row, a line, a card), not only a value's cell.
* Rules by property, not by column: a property renamed or moved keeps its rules (they name its key); a property's key
  changed (`rekeyProperty`) changes the rules naming it in the same write; a property removed asks whether its rules go.

## Left open

* Custom conditions and formats in the database (`silverware.database.defineConditions` / `defineFormats` as the table's
  `defineConditions`): the registry is the shared one, so they would be given the same way; when a user asks.
* The formula condition, once the database has formulas (docs/silverware-database.md, *Later*).
* Excel: the database exports nothing to Excel; the definitions' Excel forms are unused there.
