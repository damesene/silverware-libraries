# Conditional formatting of Silverware Table: the domain (`conditions/`) and its module (`features/conditions.ts`)

The plan and its decisions (2026-11-03): docs/silverware-table-conditional-formatting.md. The domain is pure; the module reads values through the column types module's offer `valueOf` and formula conditions through the formulas module's `rowValues`.

## Decisions

- **Formats are JS, not CSS**: a definition says how a cell looks as data (`Style`), any number of levels and colors; it reaches the cell as the core's `CellLook.vars` (custom properties, `--swt-*` only: `mergeLooks` drops others) and marks. A few generic rules of the style page read them by mark (`swt-cf`, `swt-cf-fill`, `swt-cf-color`…), under `:is(#sb-main, html)`, no CSS per format, never `!important` (a theme that uses it wins, accepted).
- **One API for built-in and custom definitions** (`api.ts`): a built-in one is a function of HELPERS importing only types from api.ts, made through the same checks as the user's (`custom.ts`). Tests enforce it: each file's imports are `import type` from api.ts only, and each is loaded with its types stripped as a user's file would be. A custom definition of a built-in's name replaces it in place.
- **A definition gives its own Excel form** (`excel(params, at)`, or a text saying why it has none), so nothing outside the definitions knows one by name. Reviewed 2026-11-03: Excel's forms had been a table by built-in name, which left custom definitions out of the file. A test requires the decision on every built-in condition and format of a look.
- Formats set up in the dialog (keywords, number ranges, levels, own style) are built-in formats with richer params (`list`, `style`, `color`, `pattern`, `boolean`), stored in the rule: nothing saved apart.
- Stored params keep only what differs from the default (`storedParams`); a rule that does not read is kept as written.

## Invariants

- The header and pinned rows and columns are never formatted. Hidden (filtered) rows count in a scope, so filtering does not reshuffle colors.
- A whole table's rule is one range, as in a spreadsheet (decided 2026-11-03, after it had been each column on its own: "over the whole table" read as the whole table); `perColumn` makes each column its own.
- A column's rules are stored on its column (`conditions.-c-<column>.rules`), so the core keeps them with it through renames and moves; the table's and named rows' on the table (`conditions.rules`). The order across those places is each rule's `at`.
- Looks are evaluated once per table object and `definitionsVersion`, not for `${…}` cells. What a definition got wrong is said once per page visit.
- The dialog previews in the table only while it is put aside (peeked), one preview at a time, taken back unless saved (decided 2026-11-04: a 2000 x 10 table repainted on every change stalled about 750 ms, under a dialog covering it).
