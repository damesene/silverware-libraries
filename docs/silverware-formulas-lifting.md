# Formulas: a function of one value given a range

**Status: built (2026-11-22, three commits: the declarations, the lifting, the docs).** Asked by the user after `=UNIQUE(UPPER([status] & "-aa"))` in a
database's options by a formula gave `#VALUE!: a range where one value is expected`.

## What is wrong now

The formulas' engine (`shared/formulas/`, Silverware Table's and Silverware Database's) works on ranges cell by cell
for its **operators** only (`evaluate.ts`' `cellByCell`): `[status] & "-aa"` is a list. A **function** of one value
(`UPPER`, `ROUND`, `LEFT`, `TEXT`, `IF`, `YEAR`…) given a range gets it whole and gives `#VALUE!` (`values.ts`
`single`). Excel 365 calls such a function for each value of the range, its result a range of the same size
("lifting"); a formula copied from Excel that does so gives `#VALUE!` here.

## Proposed (to confirm with the user; reviewed 2026-11-22)

1. **A built-in function of one value given a range is called for each of its values**, as an operator is: its result a
   list as long as the range (`UPPER([status])`, `ROUND([price] * 1.21, 2)`, `ISNUMBER([qty])`). Where several of its
   arguments are lifted, their ranges must be of one size, else `#VALUE!` saying their sizes, as `cellByCell` says. A
   reference to one cell (`A1`, `[@x]`, a list of one value) is that value, as now.
2. **Each argument's kind is declared by the function**, one declaration (agreed with the user, 2026-11-22):
   `argument(at, count) → "value" | "range" | "branch"`, from 0 of `count` given, none (or "value") an argument of one value, lifted; "range"
   one read whole (the table below); "branch" one a choosing function chooses among (decided 3). Never guessed. The 10
   functions taking grids (`grids: true`: FILTER, SORT, UNIQUE…) are as they are.
3. **Choosing functions lift over what decides, not over what they choose among** (as Excel 365): IF over its
   condition, IFS over its conditions, IFERROR over its value, SWITCH over its value, XLOOKUP over its value. A branch
   (IF's `value_if_true`, IFERROR's `value_if_error`, IFS's results, SWITCH's cases, results and default, XLOOKUP's
   `if_not_found`) is read
   as today where what decides is one value (`IF([@q] > 0, [x], "none")` is "none" where the condition is false, as
   now); where what decides is a list, a branch that is a range of the same size gives its value at each place, one of
   one value its value. Declared as "branch".
4. **TEXTJOIN's delimiter and `ignore_empty` are not lifted** (declared as taking a range, as its texts are): Excel 365
   takes a list of delimiters and uses them in turn, which lifting would not do; each stays `#VALUE!` for a range, as
   now.
5. **A function of the user's (custom, from Space Lua) is as a built-in one** (agreed with the user, 2026-11-22: a
   breaking change is fine): it declares its arguments the same way (`argument` in its definition), its arguments of
   one value lifted, those it declares "range" given a range as a list, as today. **Breaking**: a function of the
   user's reading a range (a list it sums, joins, looks up in) and not declaring it is called for each value of the
   range instead: it declares `argument: () => "range"` (every argument) or by its place
   (`argument: (at) => at === 1 ? "range" : "value"`). Said in Silverware Table's changelog (`**Breaking:**`, what to
   add) and on its library page; Silverware Table's release a MAJOR one. A definition whose `argument` is no function,
   or whose `argument(0, 1)` throws or gives another kind, is refused as any mistake of a definition is (a notification,
   the others defined); another argument's wrong answer, met in a formula, is taken as one value. Its answers are kept
   by place and count (asked for every call). `ALL_RANGES` is in HELPERS. Silverware Database has no functions of the
   user's yet (docs/silverware-database-formulas.md, *Later*): nothing changes there.
6. **As an operator takes it** (decided with the user, 2026-11-22): a grid of several rows and columns (a table's
   `[#Data]`, FILTER's result) given where one value is expected is `#VALUE!` whole, "pick a column first
   (CHOOSECOLS)"; an area of several columns written as one (`A1:B2`) is its cells row by row, as an operator reads it
   (`A1:B2 & "x"`). A shape kept, as Excel keeps one, would be a change of operators and functions alike, not here.
7. **What changes for formulas giving a result today** (to confirm), all as Excel 365 has them:
   - a function of one value given a range: `#VALUE!` now, a list (a cell's `#SPILL!`, a list where a function or a
     list's formula takes it);
   - `ISNUMBER(range)`: FALSE now (it reads an error as no number), a list of each value's;
   - a column of no rows where one value is expected: `#VALUE!` now, a list of none (an empty cell), as an operator's
     on it is;
   - an error beside a list (`ROUND([price], 1/0)`): a list of that error, a cell's `#SPILL!`, as an operator's is;
   - a function of the user's reading a range it does not declare (decided 5): called for each value.
8. **A cell shows one value**: a lifted result of several values left as a cell's result is `#SPILL!` (as an operator's
   is), seen by Show result; a function taking it (`SUM(ROUND([price], 0))`, `TEXTJOIN(", ", TRUE, UPPER([name]))`), a
   view's formula, a choice list's formula, a database's options by a formula take the list.

### The functions reading a range, and where

By their files in `shared/formulas/builtin/` (each one's `call` checked, 2026-11-22: 24 of the 66 not taking grids, of
76 built-in functions):

| Arguments taking a range | Functions |
| --- | --- |
| every one | SUM, AVERAGE, MIN, MAX, PRODUCT, COUNT, COUNTA, MEDIAN, STDEV, AND, OR, CONCAT, SUMPRODUCT |
| every one (the delimiter not lifted, decided 4) | TEXTJOIN |
| the 1st | LARGE, SMALL (`k` of one value) |
| the 2nd | RANK (`number` and `order` of one value) |
| the ranges, not the criteria | SUMIFS, AVERAGEIFS, MAXIFS, MINIFS (1st, then every range before a criterion), COUNTIFS (every range before a criterion) |
| the 2nd and 3rd | XLOOKUP (`value` lifted, its branch `if_not_found` as decided 3, the modes of one value) |
| the 3rd | NETWORKDAYS, WORKDAY (`holidays`) |

Choosing over branches (decided 3): IF, IFS, IFERROR, SWITCH, XLOOKUP. Every other built-in function takes values of
one value only (a test lists them, so a function added later must say).

## How it fits

- **`FormulaFunction.argument?(at: number): ArgumentKind`** (`function.ts`, `ArgumentKind = "value" | "range" |
  "branch"`): its argument at `at`'s kind, none "value". Helpers for the common ones (`ALL_RANGES`, every argument a
  range) in `function.ts` and in the HELPERS given to a module of functions of the user's. Kept in each function's
  file, as the rest of its definition is; a custom one's in its definition, checked and guarded by `custom.ts` as its
  `call` is (a throw or another kind: told once, "value").
- **The evaluator** (`evaluate.ts`, the `call` case, a function not taking grids, built-in or the user's): the arguments
  evaluated as now; a list of other than one value at a place neither taking a range nor a branch lifts the call; then
  a branch's list of the same size lifts with it. Sizes one, else `#VALUE!`; a grid of several columns `#VALUE!`
  (decided 6); the function called once for each place, each lifted argument's value there, the others as they are
  (a null literal left as `null`, so a default on `undefined` keeps working); its results the list. An error at a
  place is that place's result. A list of none gives a list of none. A function of the user's gets its lists as
  copies, as now (a row-free part is calculated once for every row).
- **`givesList`** (`evaluate.ts`' `listNode`, what `silverware.table.evaluate` tells a list from one value by): a call
  lifted over an argument that gives a list gives one too, as an operator over one does (a range of one cell its value
  either way).
- **Row-free parts** (`Sheet.rowFree`): a call is row-free where its arguments are, lifted or not: nothing changes.
- **The Excel export** (silverware-table/src/excel/formulas.ts, the `call` case): a call lifted over a range gives a
  range (`range: true`), so a cell whose formula is one is refused as a range result there (as Silverware Table shows
  `#SPILL!`), and one inside a function taking it is an array formula for an Excel before 365 (`array = true`), as an
  operator on a range is; Excel 365 lifts as we do. The templates written otherwise in Excel (DATEADD, DATEDIF) are
  operators or functions of one value: an array formula covers them (not verified in an Excel before 365).
- **Help and docs**: `shared/formulas/CLAUDE.md`'s *Functions* (operators and functions of one value both work cell by
  cell; IF and the like over what decides); Silverware Table's library page, its paragraph on operators on ranges
  (the same for functions of one value, IF's way, a grid refused), its line "`=[qty] * 2` alone is `#VALUE!`" (it is a
  list, a cell's `#SPILL!`: checked as the docs are written); its *Custom functions* (`argument` with an example of a
  function reading a range, what happens without it, the helper `single` said as it is: a one-cell list's value, an
  error for more, not "a range's first value"); Silverware Database's library page, its *Formulas*
  (options by a formula with `UNIQUE(UPPER([status]))`, docs/silverware-database-formulas.md step 7). Said with a
  function of the user's: lifted, it is called once for each value, so one inside a row's formula over a whole column
  (`XLOOKUP([@a], SHOUT([b]), [c])`) is called rows × values times (a function of the user's is calculated in every
  row, rowFree).

## Steps

1. **The declaration and its test**: `ArgumentKind`, `argument` and `ALL_RANGES` (`function.ts`); `argument` on the
   built-in functions reading a range ("range") and the choosing ones ("branch"); a test (builtin/index.test.ts) that
   every built-in function not taking grids declares it or is listed as of one value only, and that each declaration
   reads what its `call` does (a list given there reads as a list). Custom functions' `argument` checked in their
   definition (`custom.ts`), in HELPERS, its tests (custom.test.ts). Nothing lifted yet: no result changes.
2. **The lifting, with `givesList` and the Excel export in the same commit** (no commit reporting a lifted call as one
   value): its tests in shared/formulas (a new `lifting.test.ts`): a function of one value over a column, over two
   (`ROUND([price], [digits])`), sizes differing (`#VALUE!`), a grid of several columns (`#VALUE!`), an error at one
   place and beside a list, a list of none, a reference to one cell (as now), a function of the user's lifted and one
   declaring "range" given the list, one whose `argument` throws (told, lifted), IF over a comparison with ranges and
   values as branches, IF of one condition with a range in the branch not picked (as now), IFERROR and SWITCH over a
   list, XLOOKUP over a list of values to find (its ranges not lifted), a -IFS criterion as a range,
   `ISNUMBER(range)`, TEXTJOIN's delimiter a range (`#VALUE!`), lifting inside a function taking a range
   (`SUM(ROUND([price], 0))`), `givesList` of a lifted call; the export's: `=UPPER([s])` refused as a range result,
   `SUM(ROUND(C1:C2, 0))` an array formula. Every test of today passing, but those the changes of decided 7 change
   (said in the commit's tests).
3. **Docs**: as *How it fits* says; Silverware Table's changelog entry with the release: **Breaking** first (a function
   of the user's reading a range declares it, how), then the lifting and the changes of decided 7.

Each step a commit, `npm run verify` and Silverware Table's and Database's UI tests of formulas passing; a review after
each, its fixes and a quick review of them.

## Risks

- **A declaration wrong or missing**: a function reading a range lifted would call itself once a value
  (`SUM([qty])` a list of each qty): the test of step 1 and the existing tests of every function catch it.
- **Results that change** (decided 7): formulas of Silverware Table giving a result now (ISNUMBER of a range, a
  column of no rows) give another; said in the changelog.
- **Functions of the user's** (decided 5): one reading a range gives a list (a cell's `#SPILL!`) until it declares
  `argument`; the changelog's Breaking line says what to add, the library page shows it.
