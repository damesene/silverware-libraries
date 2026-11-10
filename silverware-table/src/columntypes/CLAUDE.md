# Column types of Silverware Table: the domain (`columntypes/`) and its module (`features/columntypes.ts`)

## A type is a hashtag in the header

- `| Price #currency-usd |`, as MdTableRender does. Verified: it changes neither the column key nor tags the rows or the page, so it needs no metadata setting, and MdTableRender's tables work (its aliases: `#euro`, `#usd`, `#int`, `#float`, `#kg`, `#km`, `#watt`, `#logical`, `#evaluation`, `#gauge`). MdTableRender's number suffixes (`#percent10`) are not supported.
- Parameters after a dash (`#number-2`, `#stars-10`; the last takes the rest: `#unit-m-s`). A type declares them (`params`: number with bounds, choice of words, text with a pattern, optional defaults) and `readParams` reads them: a hashtag whose parameters do not fit is not the type's. Methods get the values, never the text after the dash.
- Display only: the markdown keeps the value, the editor shows it. What a type shows is a text, a link or a meter (`{ text, meter }`); the model side makes no element. Sort, filter and copy use the cell's value (`sortValue` where the text does not sort, e.g. check marks).
- An invalid value shows marked with the reason; saving it is allowed and announced.
- Editing a header shows and changes only the name; the type hashtag is kept. The hashtags are hidden by CSS injected at load (MdTableRender hides them with JS, which flickered).

## Built-in and custom types

- One type per file in `builtin/` (nothing else there). A test requires each type's syntax and description in the library page's Column types table.
- **Custom types are JS** (`silverware.table.defineTypes`, the priority-50 API block), as custom functions are and for the same reason (see formulas/CLAUDE.md): replaced each time Space Lua loads, a mistake a notification. A custom type of a built-in's name replaces it in its place in the Type menu, its aliases gone with it; a type's own name wins over another's alias.
- A method that throws or gives the wrong kind of value (custom.ts checks it) marks the cell invalid with `#tag failed: …` (`attempt` in the module, around every call of a type's method), never breaking the table.
- SilverBullet loads Space Lua before it opens a page (and renders the editor anew after a reload), so tables are decorated with the custom types; a change of definitions refreshes the CSS hiding type hashtags (`tablesChanged`), not cells already shown.
- Custom types get no `TypeTable` (a choice list's values, the column's values) nor `rank`: not part of their API yet. A method returning a promise is an error: a type gives its result at once.

## Choices (`#choice-<name>`, decided 2026-11-03)

- A list of values per column is a column type, not a validation module (Excel's Data Validation for any type would be worth it only for constraints on numbers or dates).
- The list is in the metadata row by name (`columntypes.choice.<name>`, a JSON list: values may hold spaces, `|`, commas; room for a color per value later), the header names it. A fixed prefix, not a bare `#status`, so the CSS hiding type hashtags stays generic and no list's name clashes with a type's. One name, no aliases (`#select`, `#enum`). List names strict (`LIST_NAME_RE`: lower case ASCII, dashes).
- A value not in the list is marked, saved as typed; matched ignoring case; sorted in the list's order. `#choice` without a list, or a list the table lacks, checks nothing and offers the column's values.
- A list no column takes is not deleted by itself (it stays in the Type menu, deleted there); deleting one columns take is asked first and leaves those columns without a type.
- The choice UI is for the built-in choice type only (`isChoice` in choicecolumn.ts): a custom type named choice replacing it gets none.

## A choice list made by a formula (decided 2026-11-05/06, docs/silverware-table-views-plan.md, *Step 5: decided*)

- `columntypes.choice.projects='=@projects'` (a leading `=`, which no JSON list starts with: `listFormula`). A list from Space Lua is a source's formula, never found by a header's name alone, so the table says where its values come from.
- Calculated as the column shows (the formulas' offer `list`), never written. Values as cells show them (plain cells as written where a number would lose what they show: `007`, `2024 Roadmap`, `2,5`), empty ones and repeats (ignoring case) left out, errors left out, several columns `#VALUE!`.
- Formulas off, a source or page not read, an error or several columns: the column checks nothing, said in its type icon's title and in the dialog.
- Its formula follows the page's tables it reads (renamed, columns renamed or moved) in the same edit, as a cell's does: the module offers it to the formulas as `HeldFormulas`. A source is renamed by no edit; another page's tables are followed nowhere.
