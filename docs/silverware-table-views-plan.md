# Views: tables made by one formula (plan)

Talked through with the user on 2026-11-05. Nothing of it is built yet; this is the plan to agree on before the first step.

## What a view is

A table whose body is the result of one formula, written into the page as an ordinary markdown table, as a pivot is. The formula uses Excel's dynamic array functions (`FILTER`, `SORT`, `UNIQUE`, `CHOOSECOLS`…), so a view is what Excel spills, kept apart in a table of its own:

```markdown
| Assignee | Open |
|---|--:|
| anna | 3 |
| petr | 1 |
| <meta core.table core.name='open_by_person' view.formula='=SORT(GROUPBY(tasks![assignee], tasks![assignee], COUNTA))'> |
```

* **Its cells are the formula's.** Read-only and of a fixed shape, as a pivot's (`readOnly`, `fixedShape`): a press on a cell does not edit it, it says why and opens the view's settings (`editRefused`). Its headers may be renamed, the names kept when it is calculated again.
* **It shows anywhere**: the numbers are written in the markdown; only the last row holds the definition.
* **It follows its sources** as a pivot does: written anew with each write of a source on its page (same edit, one Ctrl+Z), *Out of date* in its tab and *Refresh* in its toolbar where a source changed otherwise (typed in the markdown, another page, a Lua source).
* **A named view is a table like any other** for formulas elsewhere (`=SUM(open_by_person![open])`), charts and exports.
* **Why not spilling in cells**: the decision against spilling stays (a spill would overwrite cells it does not own and add or remove rows among the records). A view owns all its cells, so none of that happens. A formula in a cell that gives an array is an error, `#SPILL!` (as Excel says where a spill cannot go), its reason pointing at views.

## Making and changing one

* *Insert view…* in a table's ⋯ menu, the command *Silverware Table: Insert view*, and `/view` in the page, as *Insert pivot table* and `/pivot`.
* The dialog:
  * A formula field with the help formulas have while typed: the names offered (functions, tables, columns), the help of the function the caret is in with its argument marked, a slip fixed (a missing `)`), *fx* for the Functions dialog. The conditional formatting dialog has such a field already (`formulaField` in features/conditionsdialog.ts, over the formulas module's `complete` / `help` / `problem`): it moves to `src/formulafield.ts`, beside src/menu.ts, its helpers given to it (a module may import from the core only feature.ts, structure.ts and press.ts, and no other module: the isolation test), not copied.
  * A preview of the result under it, as the pivot dialog's: calculated on each change, its size, the reason of an error.
  * The view's name.
* *Insert* writes it where the cursor is, or under the table the dialog was opened from.
* *View settings…* in a view's toolbar opens the same dialog with its formula. Editing `view.formula` in the markdown works too: the view shows *Out of date* until refreshed.

## Formulas: values with a shape

Today a range is a flat list (`Value = Scalar | readonly Scalar[]` in formulas/values.ts): `A1:C5` is fifteen values, its rows and columns lost. The array functions need the shape.

* **A new value, `Grid`**: rows × columns of scalars, and for each column where it came from (a table's column, or none), so a view's headers can be named after the source's columns. Beside today's values, not in place of the flat list.
* **One boundary**: a function says it takes grids (a flag in `FormulaFunction`); every other one, the user's custom functions too, gets a grid flattened by the evaluator into today's list before the call. So no existing function, nor its tests, changes. Where the flattening happens is one place: where evaluate.ts calls a function (`case "call"`, its arguments mapped).
* **Operators on a grid** (`tasks![#Data] * 2`, `A1:C5 > 5`): `#VALUE!` with its reason in the first step; element by element as Excel does later, if wanted. A column is a list as today, so `FILTER(tasks![#Data], tasks![due] < TODAY())` works as `cellByCell` does now.
* **Reading them**: `[#Data]` a new item in a table's brackets, `@name` a new kind of token (apart from `[@column]`, this row's), both in tokens.ts and parser.ts.
* **What gives a grid**: a reference of several rows and columns (`A1:C5`, `tasks![[a]:[c]]`), a whole table's body as Excel's tables write it, `tasks![#Data]` (decided 2026-11-05: a bare name is a named cell's or row's already, and the Excel file takes it as it is), and the array functions. A column (`tasks![due]`) stays a list as today, taken as a grid of one column where a function wants one.
* **A cell's result is one value**, as now: a grid there is `#SPILL!`. A new error code in `ERROR_CODES`, and in the Excel file's errors (Excel has it).

### A view is calculated by the formulas, in their order

A view's formula is a formula, so the formulas' domain calculates it, as a table its `Book` knows: a table whose body is its formula's result, in the same graph of what refers to what as the cells' formulas. So a write recalculates, in one edit and in order, a view of the table written, a table whose formulas read that view, a view of that table… (`Affected` transitively, as today for tables). Were the views module to calculate them after the formulas (`otherTablesWritten` after theirs, as the pivot is), a table reading a view would not follow it in the same edit: the pivot has that gap today (a table reading a pivot is recalculated only by its own next write), noted here, not mended by this plan.

So the views module holds the definition, the dialog and the table's protection; the formulas module offers what it needs (calculate a view's formula to a grid, the views a write changes, references followed through renames and moves of what the formula reads: `followTable` and edits.ts, as for any formula), and writes the views it recalculates with the other tables, as it does today.

First functions (one file each in formulas/builtin/, each with its syntax and description in the library page's Functions table, as the test requires): `FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, `DROP`. Later: `VSTACK`, `HSTACK`, `SEQUENCE`, `GROUPBY`, `PIVOTBY` (Excel 365's: a pivot as a formula). Each one's Excel form decided in excel/functions.ts, as the test there requires.

## The views module and what it shares with the pivot

* `features/views.ts` (the module, ModelHost only) and `features/viewdialog.ts`; its attributes `view.formula`, `view.headers` through its host, as every module's.
* **Shared with the pivot, not copied**: what a table calculated from sources needs, whoever calculates it: the cells read-only and the shape fixed, the press that opens the settings instead, *Out of date* (`tableBadges` with `attention`) and *Refresh* in the toolbar, headers renamed and kept by what each column stands for (the pivot's `pivot.headers` by `PivotColumn.id`; a view's by the grid's column origin, else its place), the result written over the table's body with its pins. Where: what is pure (headers kept by id, the result made a table with its pins, staleness compared) in `src/calculated/`, a domain both modules import (modules import no module, nor a file of features/ that is none); what is a hook (the badge, the toolbar's button, `editRefused`) stays a few lines in each module, calling it. The pivot moved onto it first, its tests passing before the view is added. This refactor is the plan's main risk. What is not shared: when they are calculated (the pivot after the formulas, the view by them, above) and how a source's renames are followed (the pivot rewrites its `pivot.source`, a view's formula follows as formulas do).
* The core gets nothing that names either module (the isolation test holds).

## Sources from Space Lua

Depends on `silverware.table.defineChoices` (branch `feat/choices-from-lua`, not on main yet), whose way of calling Lua (a Promise, run as Space Lua loads and again after `page:index`, a failure said once, the values of before kept) a source reuses.

```lua
silverware.table.defineSource("tasks", { columns = { "name", "page", "due", "done" } }, function()
  return query[[from t = index.tag "task" select { name = t.name, page = t.page, due = t.due, done = t.done }]]
end)
```

* A list of objects, each a row; `columns` the order (a Lua table keeps none). Values as text: numbers, text, dates as ISO text; booleans as `TRUE`/`FALSE` as formulas read them; `nil` empty; a list its values joined by a comma and a space (tags, people: read and filtered so); an object left out, the cell empty (it has no form a cell could show) (decided 2026-11-05).
* In formulas a table of the space: `@tasks`, `@tasks[due]`, `@tasks[#Data]` (decided 2026-11-05: `@` is in no table's name, so it cannot clash, and it shows the table is no table of the page). Offered by a module to the formulas' `TableSource`; until the function has run once it is `unread`, so formulas and views keep what they show.
* A pivot gets them too: `pivot.source='@tasks'`.

## Excel

The file gets a view's values, as written (a reader without the formulas sees them). Its formula as Excel's dynamic array formula needs the file's metadata for spills: later, if wanted.

## Steps

Each a branch's worth, with its tests (unit tests of the evaluation, UI scenarios of the dialog and the view), each useful on its own:

1. **Grids in formulas**: the `Grid` value and its one boundary, `#SPILL!` in a cell, the references that give grids, `FILTER`, `SORT`, `SORTBY`, `UNIQUE`, `CHOOSECOLS`, `TAKE`, `DROP`. Visible to users only as the functions inside formulas that reduce a grid to one value (`=COUNTA(UNIQUE(tasks![assignee]))`).
2. **The shared part of calculated tables** (`src/calculated/`), the pivot moved onto it, and the formula field moved to `src/formulafield.ts` for the conditional formatting dialog; nothing changed for users.
3. **Views**: the formulas' domain calculating them in its order (a `Book`'s table made by a formula), the module, the dialog, Insert view, `/view`, the library page's section.
4. **Sources from Space Lua** (after `defineChoices` is on main): `defineSource`, `@name` in formulas, the pivot's source.
5. **More functions**: `VSTACK`, `HSTACK`, `SEQUENCE`, `GROUPBY`, `PIVOTBY`.

## Decided (2026-11-05, with the user)

1. A whole table as a grid: `tasks![#Data]`, as Excel's tables write it.
2. A Lua source in formulas: `@tasks`.
3. Lua values: a list joined by a comma and a space, an object left out.
4. A view has no totals row of its own for now: a formula can `VSTACK` one, or another table's formula sum it; Excel's Total Row as a setting can come later.
