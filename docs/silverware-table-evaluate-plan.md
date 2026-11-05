# evaluate gives values, evaluateText gives text; then errors (plan)

Talked through with the user on 2026-11-05; decided the same day, to be built.

**Status (2026-11-05): done**, both steps (960052d, 102ba3d and the review's fixes after them), each verified in the local SilverBullet 2.12.1. Where the code went otherwise than below:

* A range is a list where the formula writes one (`givesList` in formulas/evaluate.ts: `B1:B1`, a column, an operator over one), as a cell is a one-cell list too in the formulas' values; a name (`pear`, a row's or a cell's) is not told apart by the formula, so a named row of one cell gives its value.
* `js.tolua` is not needed: SilverBullet makes the JS's arrays and objects Lua tables and null nil (verified).
* `evaluateAliases` keeps the names only (what each calls is not needed: completion and following are the same for both).
* Step 2's pages are read by the API page's Lua, not by `index.ts` through the bridge: a `${…}` follows what its Lua read, and the JS needs no reading of its own; a page the index has but the space no longer does is left out (`pcall`).
* The command's options have the page in their name (`Budget · C3 #REF!`): SilverBullet's picker filters by the name only.
* `ref` is the cell's place in the markdown, not its row's (`cellSourceOffset`): a link or the command puts the cursor in the cell (asked by the user after the review).
* Which pages have formulas is told by the formulas module (`formulaPagesIn` in index.ts, the index's rows handed over by the Lua, a cell read by `cells.formulaOf`), not by the Lua looking for the attribute's name: the Lua knows no module's attribute (found in the review). The page shown is always among them, its formulas typed since it was indexed too.
* Merged into `main` on 2026-11-05 (PR #9, both steps). Starts from `main`, which has `fix/errors-not-tags` (an error written into a cell as `\#REF!`: `cellResult` / `errorCodeIn` in formulas/cell.ts) and `fix/evaluate-other-page` (the page a `${…}` is on read as that page, `_CTX.currentPage`).

## How it is worked

Two steps, each a branch of its own, the second on the first:

1. `evaluate` / `evaluateText` and their aliases (breaking: `feat(table)!`), on this branch (`feat/evaluate-values`).
2. `errors` / `errorsText` and the command *Find formula errors* (new, nothing breaks), a branch on the first: it uses the conventions the first sets (values for Lua, text for a page, an error's code plain or escaped) and the way of calculating it leaves in `index.ts`.

After step 1: stop, show the result and a review; commit only when the user says so (CLAUDE.md's rules: one line, Conventional Commits, the bundle built, `npm run verify`). Step 2 starts after that. The tests against SilverBullet run against the local Podman container (no Docker on this machine; `npm run test:ui:sb` wants Docker): deploy with `npm run deploy`, run the specs with the container's URL.

## What was verified (SilverBullet 2.12.1, local container, 2026-11-05)

How a `${…}` shows what it is given:

* a number, a text, `true`: in the line, as written (`42`, `3.5`, `true`); a text as markdown: `#REF!` a hashtag (the user's observation; not checked whether the index takes it, which reads the page's source, the `${…}`);
* a Lua list of texts or numbers (`{"Pear", "Fig"}`, `{100, 250}`), and a JS array of them: a block, each item on a line of its own in a box: a sentence around it is broken;
* a list of records (Lua tables, or a JS array of objects, `js.tolua` or not), and one record alone: a table; its columns the first record's keys in the order written, keys of later records after them, a key a record lacks an empty cell (probe page `probe/Records`);
* in such a table each value is markdown: `#REF!` a hashtag (a link to its tag's page), `\#REF!` plain text, `[[Budget]]` a link to the page, `[[Budget@12|C3]]` a link to that place shown as `C3`;
* `template.each(list, template.new[==[…]==])`: each record by the template (a list, any format);
* `nil`: the word `nil`; a second value (`return nil, "#REF! …"`): not shown.

So a page's text needs functions giving what shows well (text, records of markdown), Lua wants plain values: two functions each time.

## Step 1: evaluate and evaluateText

### Why

`silverware.table.evaluate(formula)` gives text today: one value as its text, several as a JSON list of texts (`["Pear","Fig"]`), an error as its code. Made for a `${…}` in a page's text, it is awkward in Lua: a JSON string to parse (`js.tolua(js.window.JSON.parse(…))`, no `json` in Space Lua), one value and several told apart by the caller, numbers as texts, an error a text like any other. Its name promises values.

And in a page's text an error shows as a hashtag: `${silverware.table.evaluate("x!A1")}` gives `#REF!`, which SilverBullet renders as the tag `REF`, as it did in cells before they were written `\#REF!`. What is for the page's text and what is for Lua want different things: escaped text, plain values.

### The API

* **`silverware.table.evaluate(formula[, text, page])`: values, for Lua.** A number as a number, a logical value as `true`/`false`, a date, a time and any other value as its text (ISO, as cells hold them). Several values (a range, a column, an operator over one) as a Lua list, always a list, also of one value. An error: `nil`, and as a second value the error, `{ code = "#REF!", detail = "…" }` (Lua's way: no error is taken for a text starting with `#`): its code plain, no markdown in it. A plain cell holding an error written `\#REF!` (a pivot's) is read as the error's code, as formulas read it. An empty value and an error inside a list: *Decided* 5 and 6. With the formulas module off (or Silverware Table not started): `nil, { code = "#N/A", detail = "formulas are off" }`, as today's `#N/A`.
* **`silverware.table.evaluateText(formula[, text, page])`: text for a page, as a cell shows it.** One value as its text, several joined by a comma and a space (`Pear, Fig`: it is for reading; a script wanting the values calls `evaluate`), an error as a cell holds it, `\#REF!` (`cellResult`), so it shows `#REF!` and is no hashtag. Only errors are escaped, as in cells: a text value is given as it is, so a `${…}` shows what its cell shows (a cell's `**x**` bold, `#tag` a tag; `="#"&"tag"` a tag, as typed text would be).
* Both read the page as `evaluate` does today (the page a `${…}` is on, `_CTX.currentPage`, else the editor's; the page being opened read as saved where the editor still holds the page left; the other pages it reads watched for a `${…}` to follow them), from one function of the Lua.
* **Aliases, one for each**: `silverware.table.evaluateAlias(name)` a global function calling `evaluate` (values: a script's short name, `ev("orders![revenue]")`), `silverware.table.evaluateTextAlias(name)` one calling `evaluateText` (text: a page's, `${te("orders![revenue]")}`). Two functions as the API has two, so a name says what it gives. An alias is more than a short name: its calls are known, so their formulas are followed and completed (a `local ev = silverware.table.evaluate` in a script is not). Both kept in `silverware_internal.table.evaluateAliases` (with what each calls), a name taken by anything but an alias made refused, `madeAliases` kept across loads of Space Lua, as today.
* Formulas in the page's text, followed through renames and moves and completed while typed: the calls of `evaluate`, `evaluateText` and the aliases of both (`host/lua.ts` `luaCallPlaces`, the init page's names and its `editor:complete` listener).

### Breaking

`evaluate` changes what it gives: a page's `${silverware.table.evaluate("…")}` shows a block for several values and `nil` for an error; so does an alias made by `evaluateAlias`, which calls it. So `feat(table)!`, and the library page says how to keep the look: in a page's text `evaluateText` in place of `evaluate`, and an alias made by `evaluateTextAlias` in place of `evaluateAlias` (which also stops an error showing as a tag). Silverware Chart, Toolbar and Tags do not call it.

### Where

* `index.ts`: `evaluated` gives the values (`Value` made a list of scalars: number, boolean, text, null; an error its code and detail, `FormulaError` made a plain object) and the pages read; the text made by a function beside it (`evaluatedText`: each value's text through `cellResult`, joined by `, `), one way of calculating for both: the formulas module's offer `evaluate` as today (it reads the tables' names through its host; index.ts reads no metadata), only what is made of its `Value` changes.
* The API page: `evaluate` turns the JS list into a Lua table (`js.tolua`), the error into `nil, { code, detail }`; `evaluateText` returns the text; `evaluateAlias` and `evaluateTextAlias` (one function of the Lua making both, given what the alias calls). Their `---` doc comments.
* The init page: the names of the calls whose formulas are followed and completed (both functions, every alias of either).
* The library page's *Formulas from Space Lua*: both functions and both aliases, an example of each (a `${…}` with `evaluateText`, a script summing with `evaluate`), the migration note, that an error shows as `#REF!` and is no tag. And its sentence that a `${…}` is shown anew as the page is edited: true from SilverBullet's next release (its commit 6541b491, on main, not in 2.12.1), said so.
* CLAUDE.md: the API's line (`evaluate`, `evaluateText`, the two aliases), the verified rendering above.

### Tests

* Unit (index.test.ts): values of one value, several, a date, a logical value, an error (`nil` and its code plain with its detail), an empty value, an error inside a list; the text of the same (several `Pear, Fig`, an error `\#REF!`, in a list too: `Pear, \#N/A`); a pivot's cell `\#DIV/0!` read by both; a text value given as it is (`#tag`).
* SilverBullet only (formulas.spec.ts): a `${silverware.table.evaluateText(…)}` shows `Pear, Fig` in its line; an error with `evaluateText` shows `#REF!` and no hashtag element (`.sb-hashtag`) in the line; a `space-lua` function summing `evaluate`'s values shows the sum; an alias of each gives what its function gives, and the formula in a call of each is followed as a column is renamed.

### Decided (2026-11-05)

1. An error from `evaluate`: `nil, { code, detail }`, Lua's way; no error is taken for a text starting with `#`.
2. `evaluateText`'s list: joined by `, `, for reading; values are `evaluate`'s.
3. Aliases: one for each function, `evaluateAlias` (values) and `evaluateTextAlias` (text), not one function with an option: the name says what it gives.
4. `evaluateText` escapes errors only, as cells do: a `${…}` shows what its cell shows.
5. **An empty value from `evaluate`**: one value empty (an empty cell) is `nil` without a second value (told from an error, which has one); in a list an empty cell is `""`, as a `nil` would end the list for `ipairs` and `#`. `evaluateText` gives an empty text, an empty item in a list as nothing between its commas.
6. **An error inside a list from `evaluate`** (`[revenue]` with one cell `#REF!`): only that item fails, the others stay; the item is the error as a record, `{ code = "#REF!", detail = "…" }`, a table, not a text, so `type(v) == "table"` tells it from a value (a text starting with `#` stays a text). The whole call fails (`nil, { code, detail }`) only where the formula itself does (a reference to no table, a function's error). `evaluateText` writes the item as `\#REF!` among the others.

## Step 2: errors, errorsText and Find formula errors

### Why

Every formula error of the space, or of a page, in one list: to find broken references after a page or table was renamed, a `#NAME?` after a custom function went, and so on. Errors are no hashtags any more (`fix/errors-not-tags`), so the index's tags no longer find them; a query of the index's table rows can (a cell's raw text holds `\#REF!`), but sees only results as written: a table not calculated since shows what it showed then, and the index has no reason.

### The API

* **`silverware.table.errors([page])`: records, for Lua.** Without a page every page of the space with formulas, with one that page only. A list of records, one per formula cell showing an error, in the pages' order and each page's tables' and cells' order:

  ```lua
  {
    page = "Budget",               -- the page, its name as SilverBullet's API gives it
    ref = "Budget@1234",           -- the cell's row, as the index's table rows have it
    table = "orders",              -- the table's name, nil where it has none
    cell = "C3",                   -- its address as formulas write it
    column = "revenue",            -- its column's key
    code = "#REF!",                -- plain, as evaluate's
    detail = "nope is no table on the page",
    formula = "=nope!A1",
  }
  ```

  An empty list where there are none. Calculated now, not read from what is written: a table out of date shows its errors as they are, with their reason.
* **`silverware.table.errorsText([page])`: for a page.** The same errors as records whose values are markdown, in a fixed order of keys, so `${silverware.table.errorsText()}` shows a table: `page` a link (`[[Budget]]`), `table`, `cell` a link to the row (`[[Budget@1234|C3]]`), `error` the code escaped (`\#REF!`: no hashtag), `reason` the detail. None: the line `No formula errors` (an empty result would show nothing, not told from a page not calculated or a call that failed).
* **The page**: its name as SilverBullet's Lua API takes one (`space.readPage("Budget")`, `editor.getCurrentPage()`, a query's `page == "Budget"`), so `errors(editor.getCurrentPage())` is the page shown. Not `[[Budget]]` (a link's form, in a page's text and in formulas, which this argument is not), nor `[Budget]` (a column in formulas). Room later for an options table after it (`errors("Budget", { table = "orders", codes = { "#REF!" } })`), its first argument unchanged.
* **The command *Silverware Table: Find formula errors***: the space's errors in SilverBullet's picker (`editor.filterBox`), each an option `C3 #REF!` with its page, table and reason as its description, the one picked opened at its row (`editor.navigate` to its `ref`); none: a notification saying so. The same records as `errors`; needs no rendering nor refreshing, so it works in 2.12.1 as it is.

### How

Each part where it belongs: SilverBullet's index is the Lua's (the JS has no query), the tables' names the formulas module's (its host reads metadata), the records `index.ts`'s.

* **Which pages** (the API page's Lua): those whose tables hold a formula, from the index (`query[[from index.tag "table"]]`: rows with a field holding `formulas.f=`; the index keeps a cell's raw text, its `<meta>` too, verified), each page once, in the index's order; with a page given, that page alone. Not every page read. The JS gets the names.
* **Each page's errors** (the formulas module's offer, beside `evaluate`: `errors(text, page)`): the page's tables calculated as a write would (`formulaErrors` in formulas/evaluate.ts), with their names and the other pages they read (the pageLinks module's `readFor`, as `evaluate`); each error its table's name, its cell (address, column key, the row's offset in the text) and `{ code, detail }`. `formulaErrors` gives a `FormulaError` by cell instead of the text `"#REF! detail"` it gives now, the cell's title made of it where the module shows it.
* **The records** (`index.ts`, `formulaErrorsOf(pages)`): each page's text read (the page shown from the editor, as `evaluate` reads it, else `bridge.readPage`), the module's errors made records (`ref` the page and the row's offset, `Budget@1234`, which a link and `editor.navigate` go to: to verify that it lands on the row, as the index's refs do); the text records beside them (`cellResult` for the code). With the formulas module off: `nil, { code = "#N/A", detail = "formulas are off" }`, as `evaluate`.
* **The API page**: both functions, records made Lua tables (`js.tolua`), `errorsText`'s line where there are none; `---` doc comments.
* **The command** (the init page's Lua, as its other `command.define`s there): `silverware.table.errors()`, `editor.filterBox` of them, `editor.navigate` to the one picked, `editor.flashNotification` where there are none. Over the public API only: nothing handed to the JS, no module of it (the modules' commands are for what acts on tables in the editor).
* A `${…}` follows what it read as `evaluate`'s does (the pages read in `dependsOn`), shown anew as they are edited from SilverBullet's next release (its commit 6541b491).

### Where

* The API page (which pages, both functions), `index.ts` (`formulaErrorsOf`), the formulas module (the offer `errors`, its `FormulasOffer` type in formulas/index.ts), formulas/evaluate.ts (`formulaErrors` structured), the init page (the command), the library page's *Formulas from Space Lua* (both functions, an example of each: a `${silverware.table.errorsText()}`, a script counting by code with `errors`; the command), CLAUDE.md (the API's line, the command, the rendering of records verified).

### Tests

* Unit (index.test.ts): an error of a table's own reference, of another table, of another page (its detail), a table without a name (`table` nil), cells without errors left out, two pages in order; the text records (links, the code escaped, the keys' order), and the line where there are none; the formulas module off.
* Unit (formulas/index.test.ts): `formulaErrors` gives each error's code and detail by cell.
* SilverBullet only (formulas.spec.ts): a `${silverware.table.errorsText()}` shows a table with the error's row linked and no hashtag element, `No formula errors` on a space without them; `errors(editor.getCurrentPage())` from a `space-lua` function gives the page's errors; the command's picker lists an error and picking it opens its page at the row.

### Decided (2026-11-05)

1. `silverware.table.errors` gives records for Lua (the code plain), `errorsText` records of markdown for a page (links, the code escaped), as `evaluate` and `evaluateText`; built after step 1.
2. The page is named as SilverBullet's Lua API names one (`"Budget"`), not `[[Budget]]` nor `[Budget]`; filters later as an options table after it.
3. `errorsText` with no errors: the line `No formula errors`, not an empty result.
4. The command *Find formula errors* is part of step 2, Lua of the init page over the public API (reviewed the same day: a module's command would need the picker and navigating handed to the JS for nothing).
5. Which pages have formulas is asked of the index by the API page's Lua (the JS has no query), each page's errors of the formulas module (its offer, as `evaluate`), the records made by `index.ts`.
