# Formulas in Silverware Table: in its cells, its module (`features/formulas.ts`), views calculated by them, formulas from Space Lua

The formulas themselves (their language, references, functions, the engine) are `shared/formulas/` (its CLAUDE.md,
docs/silverware-formulas-shared.md). Here: how a table keeps them, its module, its edits and pages, its tests of
formulas in tables (`index`, `custom`, `grids`, `sources`, `views`; `builtin/index.test.ts` checks each function's row
on the library page) and what its modules offer each other about them (`offers.ts`).

## Storage

- A formula is stored in its cell as **the result plus a hidden `<meta formulas.f='=…'>`**: every renderer and SilverBullet's index see a value; `<meta>` is not shown (verified). Not in the metadata row: a formula addressed by cell position there could, after an edit outside Silverware Table, overwrite a value typed by hand.
- **New formulas need the Store table metadata setting** (they are metadata); with it off a typed formula is saved as text, existing ones keep working (calculated columns too).
- Errors are written escaped (`\#REF!`, `cellResult` in cell.ts) and read in either form (`errorCodeIn`): unescaped, SilverBullet reads `#REF!` as the tag `REF` (verified 2.12.1).
- Stale results are offered as *Recalculate*, never rewritten on view. `TODAY()`/`NOW()` are written when calculated and show as stale once out of date.

## References followed

- **Edits made with Silverware Table shift references** (rows/columns inserted, deleted, moved, sorted into the markdown, renamed; `#REF!` for deleted cells), and in the same edit the tables of the page that refer to the edited one by name, transitively (`Affected`, `followTable`). Edits in the markdown do not; references from other pages do not follow.
- Other pages are read by the pageLinks module (`space.readPage`, again on each write that recalculates and as the page is indexed). A page not read (module off, not read yet): `TableSource.unread`, and `Book.notRead` keeps the stored results of formulas reading it.

## Views and pivots: calculated by the formulas (decided 2026-11-06, docs/silverware-table-views-plan.md)

- A table calculated from others (a view, a pivot) is read by the `Book` as calculated now, as its module would write it, so a table reading it follows its sources in the same calculation. The formulas module asks the modules in its `CALCULATING` list (`view`, `pivot`) for a `CalculatedOffer`; a new kind of calculated table is one more name there. Likewise `HOLDING` (`columnTypes`) for formulas kept in a metadata row that calculate no cell (a choice list's): what the table reads, followed through edits as a cell's formula.
- What it reads comes through `CalculatedRead` in the same book, so cycles are seen: one reached again while calculated is `#CYCLE!` (`calculatedKey`: page and name, whichever object of the table a caller holds), its formula reading its own cells too. One that cannot be calculated is its error for its readers and writes nothing.
- On a write, `otherTablesWritten` first finds every affected table and follows all references to the edited table (a calculated table's definition through its `follow`), then calculates each over the page as followed. Calculated one by one, bottom up, a table below a view whose formula followed a rename read `#REF!`. A view's own write (Refresh, settings) is calculated in `writeStep`.
- The pivot was moved onto this on 2026-11-06 (a table reading a pivot was written only on the pivot's next write).

## Formulas from Space Lua (decided 2026-11-05)

- **Values for Lua, text for a page: two functions each**: a `${…}` renders what it gets as markdown (a list a block, records a table, `nil` the word, `#REF!` a hashtag), a script wants values. So `evaluate` / `evaluateText`, `errors` / `errorsText`; one function with an option set aside.
- **An error is `nil, { code, detail }`**, Lua's way: no text starting with `#` is taken for an error. In a list a cell's error is that record in its place; `""` for an empty cell in a list (a `nil` would end it for `ipairs` and `#`), `nil` for one empty value.
- `evaluateText` escapes errors only (`\#REF!`), as cells write them; a text a formula makes (`="#"&"tag"`) stays as typed text would.
- Aliases (`evaluateAlias`, `evaluateTextAlias`) are more than short names: their calls' formulas are followed through edits (`places.ts`) and completed, which a `local` name is not.
- A page is named as SilverBullet's Lua API names one (`"Budget"`), not `[[Budget]]` nor `[Budget]`.
- The index and pages' texts are the Lua's (the JS has no query, and a `${…}` refreshes on what its Lua read); whether a cell holds a formula is the formulas module's (no one else knows its attribute).
- `errorsText` with none is *No formula errors*: an empty result would not tell no errors from nothing calculated.
- Verified 2026-11-05 (2.12.1): `_CTX.currentPage` is nil in a function defined on another page, so `evaluate` takes the editor's page; opening a page from another, the editor's text is still the old page's for a moment, so the page is read as saved where the text does not hold the formula.
