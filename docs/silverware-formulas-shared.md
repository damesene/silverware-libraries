# Formulas apart from Silverware Table: the model and the formulas in `shared/`

Status (2026-11-21): planned with the user as a step of the store plan
(docs/silverware-table-store-plan.md, *Order*: after step 6's leftovers, before
step 8), on branch `refactor/table-store`.

## Why

Formulas should work outside tables: Silverware Database's formula properties
next (docs/silverware-database.md, *Later*), any plugin's rows read by
formulas. The store plan made the formulas' domain read the model only
(`TableSource` gives `TableModel`, *Decided* 4): what ties it to Silverware Table
now is where its files are. Code is shared between plugins by `shared/`
(bundled into each plugin, nothing shared at run time); one plugin uses
another only through its public API.

## What moves

Found by the imports, transitively (2026-11-21): `formulas/` (about 5,900
lines) imports only `model/`, `columns.ts`, `namerules.ts`, `format.ts` and
`shared/filter.ts`; `columns.ts` reaches the markdown (`markdown.ts`,
`tags.ts`, `names.ts`) for one function, `columnName`, and for the fixed
column name's attribute.

- **`shared/table/`: the table model**, whole and pure: `model.ts`, `ops.ts`,
  `rules.ts` (from `model/`); `columns.ts`: how a column is named (`ColumnId`,
  `ColumnHead`, `columnName`, `columnKey`, `findColumn`, `columnIdOf`,
  `matchColumns`, `followColumn`, `sameColumnId`, `modelHeads`, a header's
  hashtags); `names.ts`: the model's own names of rows, columns and cells (the
  attributes `core.n`, `core.cn`, `CORE`, `modelRowName`…); `namerules.ts`:
  what a name may be. A plugin giving rows to formulas makes a `TableModel`.
- **`shared/formulas/`: the formulas' language and engine**, whole: today's
  `formulas/` with `builtin/`, custom functions' registry, `formatLuaNumber`
  (`format.ts`). Its tests move with it.
- **Stays Silverware Table's**: the formulas module (`features/formulas.ts`,
  where a cell's formula is an attribute, recalculation on writes), formulas on
  a page and from Space Lua (`store/markdown/pageformulas.ts`, the Lua API),
  sources (`store/sources.ts`), Excel (`excel/`), the help's link to the
  library page's functions table and the test that each function is
  documented there; how a header is written in markdown (`headerText`,
  `columnOfHeader`, `typedHeader`, `withHeaderText`, `nameEmptyHeaders`) and
  read from it (`headsOf`), names in a cell's text (`nameOf`, `withName`…),
  `metanames.ts` (attributes' names in the metadata row).

## Decided

1. **A column head's text is the model's.** `ColumnHead.text` was either a
   markdown header cell or a model's header; `columnName` unescaped and took
   `<meta>` tags out for the first. In `shared/` it reads the model's text
   (hashtags and emphasis left out of the name, as before); the markdown store
   makes heads of its header cells (`headsOf`: unescaped, tags out) before it
   names a column. One meaning, and `shared/` knows no markdown.
2. **The model's own attributes are the model's.** The owner `core` and the
   keys of names (`n`, `cn`) are what formulas read a fixed column name, a
   row's and a cell's name by: they move with the model; how they are written
   in a cell (`<meta core.n='…'>`) stays the markdown store's.
3. **`shared/` imports no plugin.** `shared/table/` imports nothing of
   `shared/formulas/`; `shared/formulas/` imports `shared/table/` and
   `shared/filter.ts`. A test in `shared/` checks it (as each plugin's
   isolation test checks its own imports).
4. **References across plugins go through public APIs.** A table's formula
   reading a database (`@tasks`) and a database's formula reading a table read
   the other plugin's rows as a `TableModel` source, handed over by its init
   page's Lua, never by its code. This step makes the engine and its
   `TableSource` usable by another bundle; the database's side (its items as a
   source, a formula property, recalculation on a change across plugins,
   cycles across plugins, a plugin missing: an error of the formula, `@` names
   shared with `defineSource`) is the database's own plan, when the user starts
   it.
5. **Each plugin bundles its own copy**: a change in `shared/formulas/`
   releases every plugin using it, each by its own number (as `shared/` now),
   so two plugins' formulas do not drift apart.

## Steps

Each a commit (or a few) that leaves `npm run verify` and the UI tests passing.

1. `ColumnHead.text` the model's (decided 1): `headsOf` gives model text, the
   callers naming a markdown header go through it; `columnName` without the
   markdown. Test: a header cell escaped, with tags and hashtags, names the
   same column through `headsOf` as before.
2. The model to `shared/table/` (`model/`, the model's part of `columns.ts`
   and `names.ts`, `namerules.ts`); Silverware Table imports it from there.
3. The formulas to `shared/formulas/`; the formulas module, page formulas,
   sources, Excel and the help import them from there.
4. `shared/`'s import test (decided 3); Silverware Table's isolation test
   updated (its formulas' domain is `shared/formulas/`).
5. Docs: shared/CLAUDE.md (the root CLAUDE.md's *shared/*), the formulas'
   CLAUDE.md moved with them, silverware-table/CLAUDE.md, the database's
   *Later* pointing here.

## Progress

- **Steps 1 to 4 done (2026-11-21)**: a column head's text is the model's
  (`headsOf` and `markdownHeaderText` make one of a markdown header cell); the
  model is `shared/table/` (`model.ts`, `ops.ts`, `rules.ts`, `columns.ts`,
  `names.ts`, `namerules.ts`; `CORE` defined in `model.ts`, the table's
  `metanames.ts` taking it), its tests against the markdown staying the
  table's (`silverware-table/src/model/`); the formulas are `shared/formulas/`
  (with `format.ts`, `formatLuaNumber`), their tests in tables staying the
  table's (`silverware-table/src/formulas/`: `index`, `custom`, `grids`,
  `sources`, `views`, and `builtin/index.test.ts`, each function documented
  on the table's library page); `shared/imports.test.ts` checks decided 3;
  the table's isolation test reads the model and the formulas where they are.
- **Step 5 (docs)** is done with the store plan's step 7, at the end, of the
  final names.
