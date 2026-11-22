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

1. **The formula is the schema's, the value is no one's.** Kept in the root page beside the property's other
   settings, `_database.properties.total: { type: number, label: Total, formula: "=[@qty]*[@price]" }`. An item's page
   keeps no value under the key: none is read from a page (one typed there by hand is left, unseen, as a system
   property's is) and the calculation sets or takes off every calculated key of an item read, so no stored value is
   ever shown or written back. `query[[from index.tag "db"]]` does not see calculated values; Space Lua reads them
   through the database's API (decided 6).
2. **What a formula reads, first**: its own item (`[@qty]`) and the whole database (`[hours]`, every item's value:
   `SUM([hours])`, a share of the whole, `COUNTIFS`). Another database, a Silverware Table table or a source of the
   space come after the release (*Later*); until then such a reference is the formula's error (`#REF!`, saying they
   come later), never another meaning.
3. **The result's type is the property's, chosen, Auto by default.** A formula property has a type as any property
   (number, date, date and time, text, checkbox: how its values are shown, sorted, filtered and grouped), or **Auto**:
   each value as what it is (a number as a number, a date as a date, a logical value as a checkbox). A value that does
   not read as the chosen type is kept as calculated and shown as one that does not read (as a value typed into a page
   is). An error (`#DIV/0!`, `#REF!`) is shown with its message, as a table's cell shows it.
4. **A calculated property's values are one rule; its settings are its kind's.** A system property (domain/system.ts)
   and a formula property are both *calculated* as to their values: never read from an item's page, set or taken off
   by the calculation, read only (`readonly` forced, as `versions.ts` and `newProperty` force it for a system property
   today), none taken off an item when the property is removed. The model says it once (`calculated(property)`), and
   the places that ask `system` about values ask that (`versions.ts`' read, `itempart.ts`' own keys, the core's
   removal and its forced `readonly`). The rules about settings stay each kind's: a system property's type, key,
   params and required are not changed (the core's `system` refusals, unchanged); a formula property's type (its
   result's), key, label and formula are changed as any property's. Properties tells a formula's read-only from
   *Locked in views* (both `readonly`): a formula property shows its formula, not the lock.
5. **Where values are calculated**: in the domain, pure (`domain/formulas/`, `withFormulaValues(items, database,
   tables)` as `withSystemValues(items, database, …)`). It is applied by a store over the store (`core/` file, a
   `DatabaseStore` whose `items(id)` reads `database(id)` itself and gives the items calculated, the rest passed
   through: `onChanged`, `body`, the writes), made by the entry (`index.ts`) and handed to everything that shows or
   reads items: the places, the modules' hosts, the media host, the Space Lua API. **The core keeps the raw store for
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
  list as a multi-select is shown (a comma and a space between). Out: each formula cell's result as the engine's value (a new,
  generic call of `shared/formulas` giving every formula cell's `Scalar` of one calculation, beside `recalculate`,
  which writes text), turned into a `Value` by the property's type (Auto: by its kind; a date and time with `T`); an
  error kept with its code and message (`formulaErrors`), not as escaped text (`\#REF!`).
- **No total rows**: Silverware Table's engine takes a row whose formula reads its own column whole (`[#Data]`) as a
  total row, out of its column; a database has none. The calculation says so (a generic option of `Calculation`, no
  total rows), not the database refusing what a table allows.
- **Calculated again** whenever what it read changed: the key of the last calculation is a list of (what was read,
  its revision): the database's record and items revisions now, other sources added later without changing the key's
  shape; with the registry of types. A formula calling `TODAY()` or `NOW()` makes the calculation the day's (its key
  takes the date, `NOW()` none kept), so a view shows today's result.
- **Isolation** (`isolation.test.ts`): a rule of its own: `shared/formulas/` and `shared/table/` in the domain, the
  core and the entry only (pure, as `shared/filter.ts`); refused in views, modules, converters and stores, which today
  may import any other `shared/` path. No layer below the domain's users calculates.
- **Writes**: a formula is set, changed and removed as any setting of the schema (the core validates it: it parses,
  and references outside the database are refused with why). `formula` joins `PROPERTY_FIELDS` (versions.ts),
  `NewProperty`, `propertyEdit` and `withFlags` (core.ts), and the converters' property check (`converter.ts`).
  Converting a property to a formula leaves the values items keep under its key where they are (unseen while it is a
  formula); converting it back shows them again. A converter (`converters/builtin/tasks.ts` skips system properties)
  treats a calculated property as it treats a system one: it writes none of its values.
- **Editing the formula**: where and how is *How it is used*'s, decided before any UI is built.

## How it is used (to design with the user before any UI is built)

Formulas are to be easy to write and to read, designed for that, not fitted into today's Properties dialog as a
first idea of where a field could go. Before step 4 a short design, weighed against how Notion, Airtable and Coda do
it and against Silverware Table's own formula editing (so the two feel alike), mockups where it helps, agreed with the
user:

- **Making one**: from where a property is added (a table's +, Properties), a formula offered as a kind of property
  or as a type; what a new one starts with (an empty field, an example of this database's own properties).
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

## Steps

Ordered by the code (each step's tests passing before the next; UI tests where a step changes what a user does).

1. **The model and the stores.** `Property.formula`, `calculated(property)` (values only, decided 4); `formula` in
   `PROPERTY_FIELDS`, read and written with the schema; `versions.ts`' read and `itempart.ts` through `calculated`;
   `readonly` forced for a formula property as for a system one. The stores' contract tests: a formula kept and read
   back; no value of it read from a page (one typed by hand left unseen).
2. **The calculation, in the domain, with the Auto type.** The Auto type (domain/types/builtin, `offered: false`:
   the calculation reads back by it, and the core refuses an unknown type); `domain/formulas/`: the database as a
   table of the model, values in and out (*How it fits*), `withFormulaValues` setting or taking off every calculated
   key. In `shared/formulas/`: the call giving each formula cell's value, no total rows, the number form given, each
   with its tests there. The isolation test's rule. Unit tests: a row's own values, a whole column, a label renamed
   (`[@key]` still read), a formula reading another formula property, a cycle, errors with their messages, Auto and a
   chosen type, a value of each type in and back, `[#Data]`, a reference outside the database refused with why.
3. **The core and the entry.** A property's formula set, changed and removed through the schema's changes
   (validated; `NewProperty`, `propertyEdit`, `withFlags`); the calculating store (`core/`, its key of revisions,
   `TODAY()`) made by the entry and handed to the places, the modules, the media host; the core on the raw store for
   every read a write is made from, a test that a schema edit of a formula property's key or type writes nothing of
   its values.
4. **The design, then the views.** First *How it is used* designed and agreed with the user. Then what it decided:
   making and editing a formula; values read only in tables, lists, boards, calendars, timelines and the item's panel;
   errors shown as decided. UI tests for making, editing and reading one, a phone's too.
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

- **Cost on large databases**: every reading calculates every item's formulas; whole-column functions read every
  item. Kept by its key of revisions; measured on a database of 2000 items before step 4 is done.
- **Writing a calculated value by mistake**: only the raw store is written from (decided 5), and a test per write path
  that reads items (schema edits, a converter, Apply to all).
