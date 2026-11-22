# Silverware Database: formula properties (plan)

Status (2026-11-22): planned, on branch `feat/database-formulas`; nothing built. Its scope decided with the user the
same day (*Decided*), reviewed against the code the same day (its findings are in *Decided* and *How it fits*);
references outside the database come after its release (*Later*).

## What

A property whose values a formula gives, as Notion's formula property: `Total = [@qty]*[@price]`, `Share =
[@hours]/SUM([hours])`. The formula is the property's, kept once in the database's schema (the root page); an item
keeps neither the formula nor its value: every value is calculated when the items are read, so nothing is written
into the items for it. Formulas are the language of Silverware Table's (`shared/formulas/`, its CLAUDE.md:
references, functions, dates), calculated by its engine on the database as a table of the model (`shared/table/`).

Also: a select's, a multi-select's and a person's options given by a formula (`=SORT(UNIQUE([project]))`), and the
items with their calculated values readable from Space Lua.

## Decided (2026-11-22, with the user)

1. **A formula property is a type of its own, `formula`; its formula and result's type are its params.** Kept in the
   root page as any type's settings are (a select's `options`), every field the schema does not know being a param:
   `total: { type: formula, label: Total, formula: "=[@qty]*[@price]" }`, with `resultType: number` where the result's
   type is chosen (decided 3); no field of the model's own, as `system` is. Chosen 2026-11-22 over a `formula` field
   beside a type that was the result's: a formula is picked as a type in Properties, as Number or Select are. An item's page
   keeps no value under the key: none is read from a page (one typed there by hand is left, unseen, as a system
   property's is) and the calculation sets or takes off every calculated key of an item read, so no stored value is
   ever shown or written back. `query[[from index.tag "db"]]` does not see calculated values; Space Lua reads them
   through the database's API (decided 6).
2. **What a formula reads, first**: its own item (`[@qty]`) and the whole database (`[hours]`, every item's value:
   `SUM([hours])`, a share of the whole, `COUNTIFS`). Another database, a Silverware Table table or a source of the
   space come after the release (*Later*); until then such a reference is the formula's error (`#REF!`, saying they
   come later), never another meaning.
3. **The result's type is chosen, Auto by default.** `resultType` names a type (number, date, date and time, text,
   checkbox): the formula type then shows, sorts, filters and groups its values as that type does (the registry's
   `forParams`, as a select is a multi-select by its params), read only. Without it, **Auto**: each value as what it is
   (a number as a number, a date as a date, a logical value as a checkbox); no type of its own. A value that does
   not read as the chosen type is kept as calculated and shown as one that does not read (as a value typed into a page
   is). An error (`#DIV/0!`, `#REF!`) is shown with its message, as a table's cell shows it.
4. **A calculated property's values are one rule; its settings are its kind's.** A system property (domain/system.ts)
   and a formula property are both *calculated* as to their values: never read from an item's page, set or taken off
   by the calculation, read only (`readonly` forced, as `versions.ts` and `newProperty` force it for a system property
   today), none taken off an item when the property is removed. The domain says it once (`calculated(property)`: a
   system property, or one of the formula type, by the built-in type's name, which the stores may read as they read
   `system`), and the places that ask `system` about values ask that (`versions.ts`' read, `itempart.ts`' own keys,
   the core's removal and its forced `readonly`). The rules about settings stay each kind's: a system property's
   type, key, params and required are not changed (the core's `system` refusals, unchanged); a formula property's
   key, label and params (its formula, its result's type) are changed as any property's, and so is its type (to
   formula and back, decided 8). Properties tells a formula's read-only from *Locked in views* (both `readonly`): a
   formula property shows its formula, not the lock.
5. **Where values are calculated**: in the domain, pure (`domain/formulas/`, `withFormulaValues(items, database,
   tables)` as `withSystemValues(items, database, …)`). It is applied by a store over the store (`core/` file, a
   `DatabaseStore` whose `items(id)` reads `database(id)` itself and gives the items calculated, the rest passed
   through: `onChanged`, `body`, the writes), made by the entry (`index.ts`) and handed to everything that shows or
   reads items: the places, the modules' hosts, the Space Lua API (the media host reads no item, only the files'
   folder, and keeps the store). **The core keeps the raw store for
   every read a write is made from** (`editSchema` writes the values it read under a new key or type; `newProperty`'s
   keys taken; `validateKeptValues`), so a calculated value can never be written. The stores calculate nothing; system
   values stay theirs (they need the store's facts).
6. **Space Lua reads the items**: `silverware.database.items(id)` on the API page: the items as records (`name`,
   `page` where kept as pages, every property's value by key, calculated ones too), read only.
7. **Options by a formula** for select, multi-select and person: kept in a param of their own (`optionsFormula`), not
   in `options` (a list, which `validateOptions` checks). The calculating store gives everything that shows a database
   a derived schema whose `options` are the formula's list (by the engine's `listResult`, "a choice list's formula"),
   so the types stay as they are; a write is never made from that derived schema (Properties, `setPropertyParams`'s
   `was`, a board adding an option), and no view offers to add an option to such a property. Its order is the
   formula's, colors by value as now; a value no option holds shown as none of them (Anyone keeps a person's name
   valid), nothing taken off; renaming an option is then its source's.
8. **A property turned into a formula and back.** Its type changed to `formula` leaves the values items keep under its
   key where they are, unseen while it is a formula; changed back to another type, they show again, read as that type.
   The core's change of a type converts the values items keep (`editSchema`); to or from the formula type it converts
   and writes none.

## How it fits

- **The database as a table of the model** (`domain/formulas/model.ts`): a column per property and the item's name
  first; a column's header its label, its fixed name the property's key (`core.n`, `LINE_NAME_KEY`, as `modelHeads`
  reads it; the name's column `name`), so a formula reads `[@due]` by key whatever its label is, and `[@Due date]` by
  label as a table's column; a row per item in the order read, no row named; a formula property's cells formula
  cells through the database's own `FormulaCells` (owner `database`, not a table's `formulas.f`).
- **Values to the engine and back, by value, not by guessed text.** In: each value as the cell language reads it,
  written in one place both ways: a number with a dot (the calculation told so, not guessing a decimal comma from the
  cells, which a text property holding `1,5` would flip), a checkbox `TRUE`/`FALSE` (as the engine compares logical
  values), a date as ISO text, a date and time without milliseconds (`Created` keeps them, the engine reads none), a
  list as a multi-select is shown (a comma and a space between), each given to the engine as it is
  (`FormulaCells.plainValue`, a generic hook of `shared/formulas`: a text `007` stays a text, a checkbox a logical
  value), not read back from that text. Out: each formula cell's result as the engine's value (a new,
  generic call of `shared/formulas` giving every formula cell's `Scalar` of one calculation, beside `recalculate`,
  which writes text), turned into a `Value` by the property's type (Auto: by its kind; a date and time with `T`); an
  error kept with its code and message (`formulaErrors`), not as escaped text (`\#REF!`).
- **No total rows**: Silverware Table's engine takes a row whose formula reads its own column whole (`[#Data]`) as a
  total row, out of its column; a database has none. The calculation says so (a generic option of `Calculation`, no
  total rows), not the database refusing what a table allows.
- **Calculated again** whenever what it read changed: the key of the last calculation is a list of (what was read,
  its revision): the database's record and items revisions now, other sources added later without changing the key's
  shape. A formula giving another value as time goes or as Space Lua's definitions change (`TODAY()`, `NOW()`, a
  function of the user's: what `callsPureFunctionsOnly` does not call pure) keeps its calculation for its minute only
  (its key takes the minute), so a view shows today's result and a value and its error are one calculation.
- **Isolation** (`isolation.test.ts`): a rule of its own: `shared/formulas/` and `shared/table/` in the domain, the
  core and the entry only (pure, as `shared/filter.ts`); refused in views, modules, converters and stores, which today
  may import any other `shared/` path. No layer below the domain's users calculates.
- **Writes**: a formula is set, changed and removed as any param of the schema (the formula type's `validateParams`:
  the formula parses, references outside the database refused with why, `resultType` a type the formula type can
  show by); nothing of the model, `PROPERTY_FIELDS`, `NewProperty` or `withFlags` changes, params being read and
  written whole already. A property turned into a formula and back: decided 8. A converter (`converters/builtin/tasks.ts` skips system properties)
  treats a calculated property as it treats a system one: it writes none of its values.
- **Editing the formula**: where and how is *How it is used*'s, decided before any UI is built.

## How it is used (to design with the user before any UI is built)

Formulas are to be easy to write and to read, designed for that, not fitted into today's Properties dialog as a
first idea of where a field could go. Before step 4 a short design, weighed against how Notion, Airtable and Coda do
it and against Silverware Table's own formula editing (so the two feel alike), mockups where it helps, agreed with the
user:

- **Making one**: from where a property is added (a table's +, Properties), Formula picked as its type (decided 1);
  what a new one starts with (an empty field, an example of this database's own properties).
- **Writing it**: a field big enough for a long formula; the database's properties offered as they are typed and by
  a click on them (no key to remember, a label with spaces written for you); functions offered with their syntax
  (Silverware Table's completions); the result shown live for an item while typing (which item: the one it was
  opened from, else the first); an error said in words next to the field, where it is, before it is saved.
- **The result's type**: Auto first, a type picked only where it matters (a number's format, a date to sort as a
  date), said plainly what it changes.
- **Reading it**: a calculated value told apart from a typed one (read only, and why, without noise in every cell);
  its formula seen from its column's header and from the item's panel; an error's cell saying what is wrong.
- **Options by a formula**: how a select says its options are a formula's, and what the user sees when a value is
  none of them.
- **Phones**: writing and reading a formula on a small screen.

What comes out is written here (decided, with the user) before step 4 starts; step 4 then builds that, not the
first idea.

### Decided (2026-11-22, with the user)

1. **Making one**: Formula is a type in Properties' list of types, last, apart from the others under *Calculated*;
   from a table view's + alike. A new one opens with its formula field focused, an example made of this database's
   own properties as its placeholder (`=[@Qty] * [@Price]`).
2. **Writing it**: one formula field for Silverware Table and Silverware Database: the table's (`formulafield.ts`:
   names offered as typed, the syntax of the function the caret is in, why a formula does not read) moved into
   `shared/` and used by both. The database's properties under it as buttons, a press writing `[@Label]` as it must
   be written. The result shown live for one item (the one the dialog was opened from, else the first; `Result for:
   Pear ▾ → 7.5`), calculated in memory after a pause in typing, the whole-database parts once.
3. **Errors**: a formula that does not read (or reads outside the database) is said under its field, where it is,
   and not saved; errors only some items give when calculated (`#DIV/0!`) never stop a save: said after it from the
   calculation the views make anyway (`2 of 40 items give an error: division by zero`), no calculation of its own.
4. **The result's type**: `Show as: Auto · Number · Date · Date & time · Text · Checkbox`, Auto by default, a line
   saying what the one picked changes (`Number: sorted and filtered as numbers`).
5. **Reading it**: an ƒ in its column's header (in place of its type's icon) and in the item's panel, not in every
   cell; its formula shown over the header; its values not editable (no editor, no field's look); an error's cell
   its code, muted red, why over it; in the item's panel a press on ƒ shows the formula and *Edit formula*
   (Properties). Sorted, filtered and grouped by its result's type.
6. **Options by a formula** (step 6): in Options, `Fixed list / From a formula`; from a formula the same field and
   the list it gives.
7. **Phones**: a property's dialog over the whole screen, the formula field at its top, the names offered as a strip
   over the keyboard, the result under the field.
8. **Large databases**: a database of tens of thousands of items stays usable (measured, *Steps* 3b and 3c); while a
   calculation takes long, *Calculating…* instead of a frozen page. **Not built (3c)**: every formula of 50,000 items
   is calculated in 0.7 s; what takes long is drawing them, which Load more cuts (docs/silverware-database-load-more.md).

## Steps

Ordered by the code (each step's tests passing before the next; UI tests where a step changes what a user does).

1. **The formula type and the stores.** The formula type (domain/types/builtin: its params `formula` and
   `resultType`, `validateParams` but for the formula's parsing, which step 2 adds, `forParams` giving the result's
   type read only, Auto without one); `calculated(property)` (values only, decided 4); `versions.ts`' read and
   `itempart.ts` through `calculated`; `readonly` forced for a formula property as for a system one. The stores'
   contract tests: a formula property kept with its params and read back; no value of it read from a page (one typed
   by hand left unseen).
2. **The calculation, in the domain.** `domain/formulas/`: the database as a
   table of the model, values in and out (*How it fits*), `withFormulaValues` setting or taking off every calculated
   key. In `shared/formulas/`: the call giving each formula cell's value, no total rows, the number form given, each
   with its tests there. The isolation test's rule. Unit tests: a row's own values, a whole column, a label renamed
   (`[@key]` still read), a formula reading another formula property, a cycle, errors with their messages, Auto and a
   chosen type, a value of each type in and back, `[#Data]`, a reference outside the database refused with why.
3. **The core and the entry.** A property's formula set, changed and removed through the schema's changes
   (its params validated with the formula's parsing); a type changed to or from formula converting and writing no
   value (decided 8), nor keeping the params of the type it was; one changed away from formula no longer read only
   (its read only was the formula's, forced as read, and Properties gives back the one it read: the core cannot tell a
   lock asked in the same edit, so that lock is dropped and the user locks it again after); a formula read only for the core whatever a store keeps
   (`writable`), its unlocking refused; the calculating store (over the store's items, so after the system's values:
   a formula reads Created and Modified; `core/calculating.ts`, its key of revisions and the minute) made by the entry
   and handed to the places and the modules; the core on the raw store for every read a write is made from; tests
   that a schema edit of a formula property's key or type, or both at once, writes nothing of its values, and that the
   tasks converter writes none.
3b. **The engine: a formula's parts reading nothing of its row calculated once** (measured 2026-11-22: a database of
   50,000 items with `=[@hours]/SUM([hours])` took 63 s, SUM read once a row). `shared/formulas`: a part with no
   `[@column]`, no function reading its cell (`readsPlace`: ROW()) and no custom function is calculated once in a
   calculation; Silverware Table's tables alike. Its tests with the table's rules (total rows, ROW(), cycles).
3c. **Large databases measured**: the calculation and the views with tens of thousands of items; where an edit still
   takes long, only what it changes calculated anew (the items changed; the whole-database parts once). Measured
   2026-11-22 (playground, a table view, `=[@qty]*[@price]` and `=[@hours]/SUM([hours])`): 2,000 items shown in
   0.35 s, a change in 0.1 s; 10,000 in 1.9 s and 0.5 s; 20,000 in 3.9 s and 1.0 s. The formulas' share is small
   (all of 50,000 items' formulas calculated in 0.7 s, 3b): the table view draws every row (26 elements each, 520,000
   at 20,000 items), so incremental calculation is not done; drawing only the rows in sight is the views' work, a
   plan of its own (docs/silverware-database.md, *Left open after the UI work*).
3d. **A type changed keeps none of the old type's params** (found on the way: a select turned into a number kept its
   options), its own commit.
4. **The views.** What *How it is used* decided:
   making and editing a formula; its icon (the formula type's, or its result's type's: today the views draw a type's
   icon by its name); values read only in tables, lists, boards, calendars, timelines and the item's panel;
   errors shown as decided. UI tests for making, editing and reading one, a phone's too.
   **Done (2026-11-22)**, as decided but:
   - A property's button and the names offered write it by its key (`[@unit_price]`), not its label: a key stays as
     the property is renamed, a label would break the formula; the buttons and the list show the labels.
   - The item's panel: ƒ and the formula over the property's name (its title), a press opening Properties at it (its
     formula edited there), not a view of the formula of its own.
   - The preview's item: found by its name among all of them (ten offered), the one the panel was opened from first.
   - A formula's result type keeps its type's editor (what the views know a date or a checkbox by), no value typed in
     it: a formula is read only; a calendar places its dates, never moved there.
   - The properties (decided again with the user, 2026-11-22: a row of buttons did not scale, needed `[@` known and
     showed no values): a panel under the field, its head the preview (`= 7.5 for Fix login`), its rows the
     properties with their values for that item, filtered by the name typed, a press putting one in for this item
     (`[@key]`), its Σ for every item (`[key]`, for SUM, COUNT…); the names offered as typed have the properties too,
     no `[@` needed (`Est` offers Estimate). A strip over a phone's keyboard dropped with the buttons.
   - Phones: the formula and its panel first in the details.
5. **Space Lua's read.** `silverware.database.items(id)` (the entry's export over the calculating store, the API
   page's function with its `---` docs).
6. **Options by a formula.** `optionsFormula` (a choice type's param, validated as a formula), the derived schema
   given by the calculating store (decided 7), the editors offering its options, no option added to such a property,
   Properties saying they are a formula's; the core never writing the derived schema.
7. **Docs.** The library page's *Formulas* (what they read, the result's type, what is not kept and why, the
   functions: Silverware Table's library page has their table), docs/silverware-database.md's *Later* pointing here,
   silverware-database/CLAUDE.md (the calculating store, the raw store's reads).

## Later (after the release, each a plan step of its own)

- **References outside the database**: another database (calculated on demand, a guard against cycles between
  databases), a database as a source of Silverware Table's formulas (`silverware.table.defineSource` from the
  database's init page, over decided 6's read), tables of pages and the space's sources in a database's formulas
  (reading markdown tables: with the markdown codec moved into `shared/`). **To decide first**: how a database is
  named in formulas apart from the space's sources (`@tasks` is a source of the space today; a database whose id is
  `tasks` would collide). Nothing of steps 1 to 7 depends on it: references outside the database are refused until
  then.
- **Custom functions**: each plugin's bundle has its own registry (`shared/formulas/registry.ts`), so a function
  Silverware Table's `defineFunctions` defines is `#NAME?` in a database until the database offers the same API.
- Calculated values kept in the items (for SilverBullet's queries; a change then writes many pages and moves
  `modifiedAt`), formulas per item, completions while typing a formula (Silverware Table's `completions`).

## Risks

- **The name `formula` is the built-in type's from step 1**: a type of the user's of that name (`defineTypes`) is
  refused from then on (as any built-in name is), and its properties become formula properties, their values unseen
  though still in the pages. Said in the release's changelog entry.
- **Cost on large databases**: every reading calculates every item's formulas. Kept by its key of revisions;
  measured with 50,000 items (3b, 3c): own values only 0.4 s, a whole column 63 s before 3b, 0.4 s after it. A large
  table view's cost is its drawing, not the formulas (3c).
- **Writing a calculated value by mistake**: only the raw store is written from (decided 5), and a test per write path
  that reads items (schema edits, a converter, Apply to all).
