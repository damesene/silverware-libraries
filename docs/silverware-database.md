# Silverware Database (plan)

Talked through with the user on 2026-11-06; its layers (apart from SilverBullet and from where a database is kept) decided on 2026-11-07. Nothing of it is built yet; this is the plan to agree on before the first step.

A new plugin (`silverware-database/`, prefix `swd-`, settings and API under `silverware.database`, commands `Silverware Database: …`): databases in the spirit of Notion, where in SilverBullet **one item is one page** and its properties are the page's frontmatter (the pages store's form: *Layers*). Built as the other plugins: a core that knows no module and no view by name, modules turned off not loaded (`silverware.database.modules.<name>.enabled`), views added (built-in and the user's or another plugin's alike) without changing the core.

## Order: after Silverware Table's views (decided 2026-11-06)

Silverware Table's views and choices from Space Lua (both on the branch `feat/views`, docs/silverware-table-views-plan.md there) are finished first, the database after. Why:

* **A database is a source for formulas.** The views plan makes `defineSource` and `@tasks`: rows from Space Lua that any formula, view or pivot reads. A database is exactly such rows; built after, it plugs into that shape (`@tasks[due]`, a pivot of a database) instead of designing sources twice.
* **A select property is a choice list.** The views plan settles how a column's choices come from Space Lua (`=@projects`); the database's options follow that, not a model of their own reconciled later.
* **Both would refactor the same ground.** The views refactor the table's writes and the pivot (`src/calculated/`); this plan moves pure parts of the table into `shared/` (below). Done one after the other, they do not fight.
* **The unreleased branch ages.** The choices wait for views; the longer main moves, the dearer their merge.

This plan is committed now, so the database is designed with views in mind; its implementation starts when views are on main.

**Before Silverware Table's store refactor** (docs/silverware-table-store-plan.md on `refactor/table-store`; weighed 2026-11-07): the refactor is the table's insides, the database a plugin apart, so neither makes the other harder where the database takes the refactor's shapes from the start (*Layers*). What they share is moved into `shared/` right after views are merged, before either starts (step 2), so the refactor's long branch does not meet the moves on a rebase.

## Layers: apart from SilverBullet and from where it is kept (decided 2026-11-07)

The database knows neither SilverBullet nor pages. Its model is databases, properties and items in memory; where they are kept is a **store**'s, what the platform offers the **platform**'s (`shared/platform.ts`), how a page is written the **page writer**'s (`shared/pages/`), as Silverware Table's store plan has it (*Principles* there, followed here: the model says what a thing is, a store how it is kept; dependencies go one way; an interface is proven by its implementations). Running elsewhere, or keeping databases elsewhere, is a new binding or a new store, with no view, module or core changed.

```text
model/        Database, Property, Item, ItemKey, ViewState: data, no page, folder or frontmatter
   ▲
domain/       property types, the schema's rules, filter and sort (shared/), plans of changes over items
   ▲
views/, modules/   ViewHost / ModuleHost and the model only
   ▲
core/         registries (views, modules, types), writes as transactions;
              store.ts: DatabaseStore and ViewStateStore (the interfaces)
   ▲
store/        pages/ (pages, frontmatter, folders), memory.ts, contract.ts; over the platform and the page writer
   ▲
host/         silverbullet/ (the platform, the code widget, the index and its events,
              the Lua API, the commands); playground/ (a space in memory)
```

`isolation.test.ts` checks it by folder from the first commit: each layer imports only what is above it in the list (and `shared/`); nothing outside `host/silverbullet/` names SilverBullet's API, nothing outside `store/pages/` knows a page, a folder or frontmatter.

* **An item is an `ItemKey`, opaque**: the core, views and modules hold it, compare it and give it back, never make or read it (as Silverware Table's `TableKey`). That an item is the page `Projects/db-tasks/Fix login` is the pages store's alone. The item's name is its property `name`, which the pages store writes as the page's name; the order by hand (a kanban column's cards) is the item's own `rank` (*The model*), so no view keeps keys of items.
* **`DatabaseStore`** (core/store.ts), what the core asks and modules never see:
  * `databases()`, `database(id)`, `items(id)`: each with a `revision` that changes whenever it does (what tells a view to draw anew);
  * **Many items** (thousands; not now, the way kept open): views get items from the core (`ViewHost`, filtered and sorted), never from the store, so a later `items(id, { after, limit })` (a page after a rank, as the index's query can give it, probe 1) and views drawing only the rows in view (as Silverware Table's largeTables module) change the core and the stores, not the views' API;
  * `transaction(id, changes)`: properties set, items made, renamed or removed, the schema changed, whichever items are open or not; **applied document by document** (decided 2026-11-07 after probe 5: SilverBullet writes no pages together, a rename is a page written and another deleted), each written only where it is still at the revision read, and **reported**: what was written, what was left and why. A document is one write (one undo step of the editor where it is the page open); the transaction as a whole is undone by the core (*The core*, *Undo*), not by the platform;
  * `changed(listener)`: a database or its items changed outside a transaction (a page edited by hand, another device's sync);
  * `plan(changes)`: what a transaction would make of each item, nothing written (the review of changes over many items);
  * `writable(key)`: what may be written (a read-only property, a store that is read only); `validatePropertyKey(key)` and `validateItemName(name)`: what the store's form cannot hold, each giving why as text, `undefined` where it can (the pages store's: SilverBullet's page keys, what a page's name may not be); `documentOf(item)`: where the item can be opened, if anywhere;
  * `capabilities`: what one store can and another cannot (`renameFollowsLinks`, `itemBody`): the core offers by them, never assumes.
* **An item's body** is content in the markdown language (as a cell's content in Silverware Table's store plan): how it is kept is the store's.
* **`ViewStateStore`**: what a view keeps where a database is shown (`kanban.groupBy`) is kept somewhere too: by block and view, `get(key)` / `set(key, value)`. SilverBullet's binding keeps it in the code block; tests in memory. Views know no block.
* **The platform** (`shared/platform.ts`, decided 2026-11-07, *Decided* 24; named so in place of ports, a term the code's readers would have to learn): what a plugin asks of where it runs, interfaces only, `Platform = { editor, space, index, ui, settings }`: `Editor` (the open document's text, an edit applied, the cursor, undo, a document opened, told as it is edited or another is opened), `Space` (documents read, written, listed, renamed), `Index` (queries of the index and its changes: a page indexed, deleted; reading only), `UserInterface` (notify, ask, pick, reload), `Settings` (read, saved). Each plugin's binding makes it of what its host hands over (SilverBullet's `editor.*`, `space.*`, `index`, `config.*`; the playground's; memory in tests); Silverware Table's store plan takes the same (*Shared with Silverware Table and Silverware Tags*). The index and its events are the binding's to reach, what they mean the pages store's.
* **The page writer** (`shared/pages/`, decided 2026-11-07, *Decided* 18 to 25): the one place that knows how anything is written in a page. The pages store does not edit text: it builds changes in the model's terms and hands them to the writer (*Shared with Silverware Table and Silverware Tags*).
* **Contract tests** (`store/contract.ts`): one suite every store runs against itself: databases and items read with stable keys, a transaction applied document by document (an item changed meanwhile left and reported, the others written), its undo (an item still as the transaction left it written back, one changed since left and reported), an item renamed keeping its key, its `rank` kept, revisions, changes from outside told, `writable` and `capabilities` respected. The memory store passes it as the pages store does; the core's, the views' and the modules' tests and the playground run over the memory store, the pages store's own tests over a `Space` in memory (as Silverware Tags' `space/memory.ts`).
* **Room for Silverware Table**: the model maps onto the store plan's `TableModel` (a property a column with its attributes: type, label, readonly; an item a row by its key), so that after that plan Silverware Table may offer its own table view of a database (`defineViews` from its bundle, over an adapter of the `DatabaseStore`), with formulas and column types, the database's own table view staying for a space without it. Nothing of it is built now; decided 2 holds.
* **What stays SilverBullet's**: the code widget and its rendering anew, the Lua API, the commands, the probes' facts: all in `host/silverbullet/`, none in the core.

## The pages store: what is where in SilverBullet

This section, to *The model*, is how `store/pages/` keeps a database in a space (and the block, the binding's `ViewStateStore`): the core, the views and the modules know none of it.

```
Projects.md                         a page showing a database: its block
Projects/db-tasks.md                the database's root page (frontmatter: tags db-root; _database: id, name, schema)
Projects/db-tasks/Fix login.md      an item (frontmatter: tags db, its properties; _database: rank; the body the page's text)
Projects/db-tasks/Write docs.md
```

* **The block** shows a database where it is written; any page may have one, several pages the same database (Notion's linked database):

  ````markdown
  ```silverware-database
  id: tasks
  view: kanban
  kanban.groupBy: status
  kanban.filter: {"status": "!=Done"}
  table.sort: due asc
  table.widths: {"name": 240, "due": 120}
  ```
  ````

  `id` the database, `view` the view shown; every other key a view's own, prefixed by its view's name (below): SilverBullet's `ViewStateStore`, written by the binding. Values are YAML scalars, or JSON where a value is a list or an object, one key a line, so the block stays readable and a diff of it small.
* **The root page** (`<page>/db-<id>.md`) holds what is the database's whatever view shows it: its name, its properties (the schema). Its frontmatter has `tags: db-root` and `_database.id: <id>`: **the database is found by its id** (`index.tag "db-root"`, `where _database.id == "tasks"`), so the root page's name is a convention only, and a root page moved or renamed is still found.
* **The database's own data is under `_database`** (decided 2026-11-07, *Decided* 16), a nested object, in the root page (`id`, `name`, `properties`) and in each item (`rank`): apart from the user's properties, which stay at the frontmatter's top level so that a query reads them bare (`_.status`). The leading `_` says it is the system's, and no property's key can start with it (keys start with a letter), so `database` stays free as a property's key; Space Lua reads it bare (`_database.rank`), verified in probe 1, where `$` (SilverBullet's own keys, `$ref`) needs `_["$database"]` and a leading `.` is split by the index into `"": { database: … }`. It also keeps the database's `name` away from the page object's `name`, which overrules a frontmatter key of that name (probe 1).
* **Items** are the root page's subpages tagged `db` (`<root>/<item>`, its frontmatter `tags: db`): membership is the folder, the tag what makes them queryable (`from index.tag "db"`) and tells them from other pages a user puts there. A subpage of an item is no item.
  * **Why the folder, not a `db: <id>` key in every item** (decided 2026-11-06): a folder renamed (`Projects` → `Work`) is renamed whole, SilverBullet's space being files on disk, so its root and its items stay together; and a change of the database's id (its slug, a later command) renames one folder and one root page, where a key in every item would rewrite them all. The one case that parts them: the root page renamed alone (*Page: Rename* of `Projects/db-tasks`, if it leaves its subpages where they are: probe 2), its items then in a folder no root heads. The block says so (the root found, its folder empty, a folder of `db` pages with no root beside it named) and offers to move the root back or the items after it.
* **An item's name is its page's name** (decided 2026-11-06): `Projects/db-tasks/Fix login`, as Notion's title. Renaming the item renames the page, its links followed (SilverBullet's `renamePageCommand`, verified in probe 2: links in text and in frontmatter; the root with its folder by `renamePrefixCommand` then the page, as the space tree moves one). A name taken in the folder gets a number (`Fix login 2`). A name is checked against what a page's name may be in SilverBullet (no `/`, which would make a subpage, nor the characters a link cannot hold); what cannot be is refused with why, not changed silently. `name` is the built-in property every database has, the first column of a table.
* **The id** (decided 2026-11-06): a slug made from the name the database is created with (`Tasks` → `tasks`; lower case ASCII, words joined by dashes, unique in the space), not changed by renaming the database: the name shown is the root page's `_database.name`, changed freely. Changing the id itself may come later as a command (the root's `_database.id`, its page and folder, and the blocks naming it rewritten; the items untouched, their membership being the folder). Readable in the folder (`db-tasks`) and, later, in formulas (`@tasks`).
* **Two root pages of one id** (a copy): the first by the index's order is the database, the block says so in the attention look, as two tables of one name are.

### The schema in the root page

The model's schema (*The model*) as the pages store keeps it: in the root page's frontmatter under `_database`, by the property's key, which is the key in the items' frontmatter:

```yaml
---
tags: db-root
_database:
  id: tasks
  name: Tasks
  properties:
    status: { type: select, label: Status, options: [Todo, Doing, Done] }
    due: { type: date, label: Due }
    estimate: { type: number, label: Estimate, readonly: true }
    labels: { type: multi-select, label: Labels }
---
```

An item:

```yaml
---
tags: db
status: Doing
due: 2026-11-10
_database:
  rank: a1V
---
```

* Renaming a label touches the root page alone; renaming a key rewrites every item's frontmatter. A key is a valid YAML key and a valid column key for Space Lua queries (the model's rule for keys is strict enough for both).
* **Keys SilverBullet's page objects have are refused** (the pages store's `validatePropertyKey`, which the core asks of the store as it checks a key: another store has its own or none) (`name`, `tags`, `tag`, `itags`, `ref`, `range`, `aliases`, `displayName`, `lastModified`, `created`, `perm`, `contentType`, `size`, `pageDecoration`; the list confirmed by probe 1, `range` added by it): the index puts them beside the frontmatter's keys in one object, so a property `name` would be the page's name, `tags` the page's tags. The page's tags as a property (a multi-select over `tags`) can come later as a property of its own kind, not a key.
* An item without a key has that property empty; a key the schema lacks is the page's own and left alone (shown nowhere, never removed): the store keeps what the model does not hold.
* Values in YAML: a number, `true`/`false`, a list, ISO text for a date (as formulas write dates); a relation's value (later) the items' links, `[[Projects/db-projects/Website]]`, which SilverBullet's rename follows: the store turns them into `ItemKey`s and back.

## The model (`model/`, `domain/`)

What a database is, wherever it is kept:

* `Database { id, name, properties }`, `Property { key, label, type, params, readonly }`, `Item { key: ItemKey, name, values, rank, body, modified }`; `name` the built-in property every database has, the first column of a table.
* **The order by hand is the item's `rank`** (decided 2026-11-07, *Decided* 16): a text compared as is (a fractional index: between `a0` and `a1` goes `a0V`), so a card moved writes that one item. Its characters `0-9A-Za-z`, in their ASCII order, which is how Space Lua compares texts (probe 1). Cards put again and again at one place make ranks longer (`a0V`, `a0VV`…): where one grows past a length, its group's ranks are given anew, short (one write per item of the group, a transaction as any other); a known algorithm, not one of our own. One order per database, which every view ordering by hand shows (kanban within a column; a card moved to another column writes its select value and its rank in one write); an item without a rank (made by hand) comes after the ranked ones, by name. Kept by the item, it follows any rename, also one outside the database, and a move of the folder.
* **The key is the property's identity**, the label what is shown: a label renamed changes the schema alone, a key renamed every item that has it. Keys strict, as Space Lua reads them bare (decided 2026-11-07 after probe 1): lower case ASCII letters, digits and `_`, starting with a letter (`due_date`, not `due-date`, which a query reads as a subtraction); a store may refuse more (`validatePropertyKey`).
* `readonly: true`: no view offers to change it (the core's `update` refuses it too, so a custom view cannot either); its value may still be changed outside the database (by hand, by a script), as the store allows.
* **Values are the model's kinds**: text, number, boolean, a list of texts, a date as ISO text, a list of `ItemKey`s (relations, later); how each is kept is the store's. A value that does not read as its property's type is kept as read and shown invalid, as a column type's value.
* The first types (decided 2026-11-06): `text`, `number`, `checkbox`, `date`, `select`, `multi-select`, `url`, each its kind of value, how it shows and is edited. Types are a registry as Silverware Table's column types are, so the user's own come through the core's `defineTypes` (the binding's `silverware.database.defineTypes`), a custom one of a built-in name replacing it.
* **Relations later, room kept now** (the user: databases will be linked, not in the first version): a type may declare what it refers to (`{ type: relation, database: projects }`, values a list of `ItemKey`s of that database). So now: a type's parameters are an object of its own (not a fixed set of fields), a value may be a list of keys, and an item renamed keeps its key (the contract tests check it), so relations need no rewriting by the core. Rollups and formula properties come with relations and the formulas' sources.
* **A place** is where a database is shown: the binding makes it (an element and the place's `ViewStateStore`) and hands it to the core; which database and which view it shows are in its state (`id`, `view`).

## The core

* **A place is drawn and kept up to date** by the core: the view named in its state renders into its element; the store's `changed` and a revision moved draw it anew, keeping the view's state (scroll, an open editor) where it can. What makes a place and when it is rendered anew is the binding's (*The SilverBullet binding*).
* **Reading**: through the `DatabaseStore` (*Layers*), the model's data (*The model*).
* **Writing**, every change one call of the core, a transaction of the store, never a view writing anything itself:
  * `update(item, key, value)`: one property.
  * `create(values)` (its name from `name` or *Untitled*), `rename(item, name)` (refused with why where the store's `validateItemName` says so: the pages store's names of pages), `remove(item)` (asked first through the platform's `ui`).
  * `createDatabase(name)` (the id made from it, unique among the store's), the database's name changed.
  * The schema: `addProperty`, `renameProperty` (the label), `rekeyProperty`, `retypeProperty` (values kept where they read as the new type, else listed before), `removeProperty` (the schema, and the values in the items if asked). Changes over many items are planned (the store's `plan(changes)`: what each item becomes, nothing written), shown, applied where an item is still at the revision read: Silverware Tags' way (`core/plan.ts`), to be shared where it fits.
  * `move(item, before?, after?)`: the item's `rank` between its neighbours' (with a value set in the same write where it moves to another group).
* **Undo** (decided 2026-11-07, *Decided* 17), Silverware Tags' way (`core/history.ts`, `undoOperation` in `core/plan.ts`): the core keeps the transactions applied; undoing one is a transaction back, each item written back where it is still as the transaction left it, one changed since left and reported. The same over every store: not atomic, not the editor's Ctrl+Z (which still undoes a write of the page open). The pages store's undo is the page writer's (`PageHistory`, *Decided* 23): the core keeps what the store reported, the store gives it back through the writer.
* **Views are the core's, not modules** (decided 2026-11-06): a place shows nothing without a view, so turning off "views" would mean nothing; a module is a whole one may want to turn off, on or replace, not made one at any cost. The core keeps the registry of views and knows none by name: a view is `{ name, label, icon, render(host, element), settings? }`; the place's `view` names the one shown; a switcher in the place's toolbar lists every view registered and on, a pick writing `view` into the place's state. A view the place names that no one registered (or one turned off) shows a note and the switcher.
* **The built-in views** (`src/views/builtin/`, one per file: table, list, kanban, below) are made through the same API as the user's (`defineViews`, below), importing only types from the core's view API (a test checks it, as the conditions' built-in definitions are checked): what kanban needs a custom view gets too, and no view leans on the core's insides.
* **A view's settings** (decided 2026-11-06): each view has its object of settings, `silverware.database.views.<name>`, as a module has: `enabled` (off, the switcher leaves it out), and the view's own global settings beside it (`silverware.database.views.kanban.cardProperties`), declared by the view (`settings`: key, label, hint, control, default, as Silverware Table's SETTINGS rows), so the binding defines them (SilverBullet's `config.define`) and the settings dialog shows them for built-in and custom views alike (a tab *Views*: each with its switch and its settings under it), read and saved through the `ConfigPort`. `host.setting(key)` reads the view's own. What a view keeps per place (its meta) and everywhere (its settings) are apart: a place's meta for what differs where it is shown (`kanban.groupBy`), a setting for what is the user's way everywhere.
* **Modules reach views through the core**, neither knowing the other: `host.open(item)` goes to the peek module's offer where it is on (else navigation); `host.itemMenu(item)` gathers the modules' entries for an item (Open, Duplicate, Delete, Edit property…) in slots by what they do, as Silverware Table's `lineMenu` slots; `host.propertyMenu(key)` the same for a property (its settings, through the properties module).
* **A view's own data** (`host.getMeta(key)`, `host.setMeta(key, value)`): the core prefixes the key by the view's name (`kanban.groupBy`), so a view reads and writes its own only, as a Silverware Table module's host does. Kept for every view in the place's state, so switching back finds them as left. What is the database's (the schema, its name) goes to the store through the core's functions, never a view's meta.
* **Filtering and sorting per view** (decided 2026-11-06, as Notion's views): the core offers them as services (`host.filter`, `host.sort`: the expression parsed, the items it keeps, in order) stored under the view's prefix (`table.filter`, `kanban.sort`), the view asking for them where it shows items. The filter is **a condition per property** in Silverware Table's syntax (`filter.ts`, moved to `shared/`), all of them to hold, as the table's filter row is one field per column: `{"status": "!=Done", "estimate": ">3"}`. That syntax compares numbers and text, not dates (`due < today`): comparisons of dates, and conditions joined by *or*, are its later growth, for both plugins.
* **A view's order by hand** (a kanban column's cards) is the items' `rank` (*The model*), set through `move`: no view keeps items' keys in its meta. Decided 2026-11-07 after probes 2 and 5, over an order by page names in the block: SilverBullet's rename follows links, not names in a code block, so blocks of the database on other pages would have kept the old names, and a rename outside the database (a page deleted and another made) would have dropped the item to its column's end.
* **A place's state written may render it anew** (in SilverBullet the block's text changed, and its widget is made anew): a view writes its meta at the end of what the user does (a drag let go, a width set), not while it goes, and the core hands the new rendering the view's state that is not kept (the scroll, the item edited), keyed by place and view.
* **Opening an item** (`host.open(item)`): the peek module's panel where it is on, else the item's document (the platform's `editor.open` at what the store says the item's document is). A view only calls it from its own action (a click on a card's name, a row's open icon); how it opens is the core's.
* **The API a view gets** (`ViewHost`): the database and its items (filtered and sorted as asked), the property types (how a value shows, its editor), `update`/`create`/`rename`/`remove`, `open`, its meta, the shared UI (`el`, menus, dialogs, drag reordering from `shared/`), `refresh`. Written as a type in the core and documented on the library page, so a custom view outside the bundle uses the same.
* **Custom views** are given to the core's `defineViews` (a list or a function given HELPERS; checked, a mistake told through the platform's `ui`; replaced when the binding says definitions load again). In SilverBullet the binding takes them from Space Lua as Silverware Table's custom definitions: a JS module of the space, `silverware.database.defineViews(js.importFromSpace(…))` in the API page's priority-50 block. Another plugin's view the same way, from its own bundle.
* **What the core uses of the browser**: views and modules draw their UI in the DOM (`shared/` elements, menus, dialogs), as every Silverware plugin does; that is the UI, not SilverBullet. A host without a DOM would need other views, not another core.

## Built-in views (the core's, each can be turned off by its settings)

* **table**: a row per item, a column per property (`name` first), shown as its type shows it; a cell edited in place by its type's editor (`readonly` not offered); a column's menu (sort, filter, hide, the property's settings through the properties module's offer); widths and hidden columns in its meta; + a row (`create`), + a column (the properties module). Its own code, pure parts shared with Silverware Table (decided 2026-11-06, below).
* **list**: an item a line, its name and the properties the view's meta picks.
* **kanban**: columns by a `select` property (`kanban.groupBy`, an empty value its own column), a card per item, dragged between columns and within one (`move`: the items' `rank`, a value set where it changes column), + a card in a column (`create` with that value).

## Modules (each can be turned off)

A module is a whole one may want to turn off, on or replace, working across the views: `silverware.database.modules.<name>`, an object as a view's settings are (`enabled` and its own).

* **peek**: the item's panel (decided 2026-11-06): over the right of the editor's area (the binding says where it is: in SilverBullet its editor), as Notion's side peek: a floating panel of ours in the page's `body`, as the plugins' dialogs and menus are (decided 2026-11-07 after probe 3: not SilverBullet's `rhs` panel, which gives no editor of its own, puts the panel in a shadow root the space's CSS does not reach and lets SilverBullet take the keys typed there), its keys its own as `shared/dialog.ts` keeps a dialog's; its name (renaming), its properties as fields of their types, its body as markdown text in a field of ours (where the store's `capabilities` have `itemBody`; SilverBullet has no API for an editor of its own there, probe 3), *Open* (the item's document); written as the fields are left, where the item is still at the revision read, else said and read anew; Esc and a press beside it closing it.
* **properties**: the schema's dialog (add, label, key, type, options, readonly, order, remove), the plans of changes over items reviewed before applied.
* **create**: commands as data (`commands`, as Silverware Table's modules give them; the binding defines them: in SilverBullet *Silverware Database: New database* and `/database`, *Silverware Database: Insert database view*): a name asked, `createDatabase`, and a place inserted where the user is (the binding's `insertPlace`: in SilverBullet the block at the cursor); or an existing database picked (the platform's `ui.pick`: SilverBullet's `editor.filterBox`) and its place inserted.

## The SilverBullet binding (`host/silverbullet/`)

Everything SilverBullet's, in one place, as Silverware Table's store plan has its binding:

* **A place is a code block** of the language `silverware-database` (`codeWidget.define`, as the chart's): its element the place's, its text the place's `ViewStateStore` (*The pages store*, the block). A code widget is rendered anew only when its text changes (verified for the chart, 2026-11-01), so the binding tells the pages store of the index's changes (`page:index`, `editor:pageModified` for the page open), which tells the core through `changed`.
* The platform made of what the init page hands over (`editor.*`, `space.*`, `config.*`, the index's queries and events).
* The Lua API (`silverware.database.defineViews`, `defineTypes`), the commands and slash commands defined from the core's, the settings defined from the views' and modules' declarations.

The modules use each other only through offers, as Silverware Table's and Silverware Tags' do (`offer`, `offered`).

## Shared with Silverware Table and Silverware Tags (decided 2026-11-06)

The database needs no other plugin installed (as the chart needs no table). What both plugins need is moved into `shared/` (bundled into each), the plugins moved onto it first, their tests passing, before the database uses it:

* `shared/filter.ts`: the filter syntax (`parseFilter`, `filterMatcher`, `normalizeForFilter`) from `silverware-table/src/filter.ts`, with the number reading it uses (`asNumber`, from the table's `view.ts`); `filterExcelFormula` stays the table's (Excel is the table's).
* `shared/compare.ts`: how values are compared for sorting (numbers, dates, text by locale), as the table's sorting compares them.
* `shared/platform.ts`: the platform (*Layers*), the interfaces only; Silverware Table's store plan takes it in its step 1.
* `shared/pages/`: **the page writer** (decided 2026-11-07, *Decided* 18 to 25). Plugins see neither frontmatter nor a page's text: they say what is to change, the writer alone knows how it is written.
  * **A builder of changes**, one per batch, mutating and fluent, `build()` giving frozen data (the builder unusable after); a page named twice is one page's changes in the order called; a section per part of a page's content, and what is the page's own (its name) on the page itself:
    ```ts
    const changes = pageChanges()
      .page("Projects/db-tasks/Fix login", (p) => p
        .properties.set("status", "Done")
        .properties.remove("old_key")
        .tags.rename("bug", "defect"))
      .page("Projects/db-tasks/Old name", (p) => p.rename("Projects/db-tasks/New name"))
      .page("Projects/db-tasks/Write docs", (p) => p.tags.add("docs"))
      .build();
    ```
    Every method of a section gives the page's builder `p` back, so a page's changes are one chain whatever their parts.
  * **The writer in two steps**: `plan(changes)` reads each page, keeps how it was read (its revision: the text as read, compared again before writing), makes its new text in memory (never handed out), and gives a summary in the model's terms (`status: Doing → Done`), a preview of lines before and after ready to show (a plugin draws it, never reads it) and the problems (a page whose tags are in a form not read: left out, and why); nothing written. `apply(plan)` writes page by page where a page is still as read (the open page through the editor, one undo step), the rest left, and gives an `ApplyReport`: what was written, what was left and why, and the pages as they were and as it left them. `write(changes)` is both without a preview (a value changed in a cell). The writer gets the platform's `editor` and `space`.
  * **Parts**, each one form in a page's content: `properties` (keys of the frontmatter, nested ones too: `_database.rank`; the form a page has kept, from Silverware Tags' `tags/frontmatter.ts`, made generic), `tags` (the page's own tags in its frontmatter and its hashtags in the body, as SilverBullet writes them: Silverware Tags' reading and writing moved here; `p.tags.remove("x", { from: "pageTags" | "body" | "both" })`: the page's own tags, as SilverBullet's *page tags*, or the hashtags in its body, in the tags' terms, not where they are written), and the page's own, its name (`p.rename(name)`, through `space.rename`, done first). A key a part holds (`tags`) is no property. Built in only for now, but as a registry the built-in parts go through, as another plugin's part would: opening it is exporting the registration (and its builder's types), not rebuilding the writer.
  * **A plugin's own metadata is no part**: its store says what goes where (the database's `rank` under `_database.rank`), `properties` how it is written. Silverware Table's metadata row and hidden tags are the form of tables in markdown, its store plan's codec: it stays the table's store's (the one place that reads that form back) and is registered with the same writer as its part `tables` once the two are joined (Silverware Table's store plan, *The platform and the page writer*).
  * **Undo**: `PageHistory`, a plugin's own instance: `history.record(report, "Rename #bug → #defect")` keeps the `ApplyReport` with a label shown to the user (*Undo: Rename #bug → #defect*); `history.undo()` (or `history.planUndo()`, a plan to preview first) gives each page back where it is still as `apply` left it, a page renamed renamed back, the rest left and reported. The editor's Ctrl+Z still undoes the one write of the open page.
* Silverware Tags moved onto the writer: its operations build changes (`tags.rename`, `tags.remove`, `tags.add`), the review shows the writer's preview, its history is a `PageHistory`; what remains of its domain is what to change (the catalog, similar tags, queries of pages), not how it is written.
* Already there: menus, dialogs, tabs, controls, elements, drag reordering, the CONFIG page's settings.

Not shared: Silverware Table's core (its writes are markdown tables: `replaceRange` over a table, the metadata row, `data-pos`). Giving it a data backend of pages was weighed and set aside: a refactor of its core and a dependency of the database on it, for features (formulas, pins, the sheet) a view over pages does not need.

## Probes in SilverBullet (first step)

Verified in the local SilverBullet (Docker in WSL, the release `scripts/silverbullet/Dockerfile` names) before code relies on it. They decide the SilverBullet binding and the pages store only, not the core's interfaces:

1. What the index gives of a page's frontmatter: lists, nested objects (the schema's `properties`), numbers, booleans, dates (text or a date), and whether `index.tag "db"` has every key.
2. A rename that follows links (the command *Page: Rename*'s function, through `system.invokeFunction` or a syscall), callable from the bridge; else what `space` offers. Whether *Page: Rename* of a page moves its subpages with it (the root page renamed alone), and what renames a folder whole (*Page: Batch Rename Prefix* or the like), for the database's own rename of its root.
3. Whether an editor of a page can show beside the page open (a second CodeMirror of SilverBullet's, `editor.showPanel("rhs", …)`), or the peek's body is a field of ours.
4. A code widget's element kept or made anew as the page scrolls (CodeMirror's viewport) and as its block is written: what the view's state survives.
5. Events for the items' changes: `page:index` of another page, `editor:pageModified` of the page open, a page deleted.
6. YAML in Space Lua (`yaml.parse` / `yaml.stringify`), or the block's few forms read by the binding itself.

### Results (2026-11-07)

Probed in SilverBullet 2.12.1 (the container of the user's test space, port 3010) by Playwright scripts calling its syscalls (`client.clientSystem.localSyscall`, `lua.evalExpression`), pages written through `space.writePage`, a code widget defined in a `space-lua` block of a page and the client loaded anew; the source read at the tag `2.12.1`. The probe pages were deleted after.

1. **The index's page objects** (`index.tag "db"`; `plugs/index/page.ts` `indexPage`):
   * Every frontmatter key is in the object, with its YAML type: a number a number, `true`/`false` a boolean, a list a list (`[a, b c]`), a nested object an object (the root page's `properties.status.options` a list, `readonly: true` a boolean), a key without a value `null` (`nil` in Lua). A key an item lacks is `nil`: a query's `where estimate > 2` over items without it fails (*attempt to compare number with nil*), so comparisons are the store's, never a query's.
   * **Dates**: `due: 2026-11-10` unquoted stays the text `2026-11-10` (as `"2026-11-10"` quoted); `when: 2026-11-10T14:30:00` unquoted becomes `2026-11-10T14:30:00.000Z`: a date and time is not kept as written, so the store writes one quoted (the first `date` type is a date alone).
   * **Keys the page object has overrule the frontmatter's**: `{ ...pageMeta, ...frontmatter, ...pageMeta }`, so `name`, `ref`, `lastModified`, `created`, `perm`, `size`, `contentType` in frontmatter are lost (`name: Other name` read as the page's name); `tag` is set to `page`, `tags` and `itags` made of the frontmatter's tags; `range` is the frontmatter's place in the page (`plugs/index/frontmatter.ts`); `displayName`, `aliases` and `pageDecoration` are read from the frontmatter and mean something to SilverBullet. So the list under *The schema in the root page* holds, `range` added.
   * **A subpage of an item tagged `db` is in `index.tag "db"`** (`Fix login/Sub`): the pages store takes only the root's folder's direct children.
   * **A key with a dash is no column in a query**: `select due-date` is the subtraction `due - date` (*attempt to perform arithmetic on a nil value*); `_["due-date"]` reads it, `due_date` is read bare. This contradicted the plan's keys made as choice lists' names (dashes): keys are made with `_` instead (decided 2026-11-07, *The model*).
2. **Renames** (`plugs/index/refactor.ts`):
   * `system.invokeFunction("index.renamePageCommand", { oldPage, page })` renames a page without asking and follows its links: in other pages' text (`[[…]]`, `[[…|alias]]`) and in their frontmatter (`rel: "[[…]]"`, a list of such), and in the page itself where its folder changes. Its result is `true` also where it refused (a name with `|`, a page that exists: a notification, nothing renamed): the store checks the pages after.
   * **It does not move subpages**: the root page renamed alone leaves its items in the old folder (the case *Items* names).
   * `index.renamePrefixCommand({ oldPrefix, newPrefix, disableConfirmation = true })` renames every page and document whose name starts with the prefix, each as `renamePageCommand` does (links followed); it compares with `startsWith`, so the prefix ends with `/` (`Projects/db-tasks/`, else `db-tasks-old` goes too). The space tree moves a page with children by both, the prefix then the page (`client/navigator/navigator.ts` `moveByRename`): the root and its items so, verified (the links to the root and to the items followed).
   * A page's name is valid where `isValidName` (`plug-api/lib/ref.ts`) holds: none of `@ # | < > $`, no `[[` or `]]`, no segment `.` or `..`, no `//`, not starting with `.` or `^`; a name ending in what reads as a file's extension (`Fix v1.2`) is a document's path, not a page's: the pages store's `validateItemName` follows it.
3. **The peek's body is a field of ours**: SilverBullet 2.12.1 has no API for a second editor of its own (`editor.showPanel(id, mode, html, script)` takes HTML only). `editor.showPanel("rhs", 1, element, "")` shows an element of ours at the right of the editor (the editor 853 px, the panel 427 px of a 1280 px window), in a **shadow root** (`client/components/panel.tsx` `ShadowPanel`; a string goes into an iframe instead): the page's and the space's CSS do not reach it, so the peek brings its own style into it. **SilverBullet takes the keys typed in it**: Enter in a textarea there moved the focus to the page's editor (a key from a shadow root is retargeted to its host, so SilverBullet does not see a field); stopping `keydown`, `keyup` and `keypress` at the panel's element kept them in the field and the page unchanged.
4. **A code widget's element**: `render` runs once for each block of the page as it opens (also for a block far out of view) and again only when its block's text changes; not as the page scrolls, as text above or below it is edited, nor as another page is written. A widget whose `html` is an element made in JS (as the chart's) is **the same element** after it was scrolled out of the DOM and back (a field's value kept); one whose `html` is a string is made anew from it (the field's value lost). Its block written: `render` again, a new element. So the binding gives an element, and the core hands the view's state that is not kept to the new rendering after a write of the block, as *The core* has it.
5. **Events** (watched on the client's event hook):
   * Another page written: `file:changed`, `page:saved`, then `page:index` with `{ name, meta }` (`meta` the page object): the pages store asks the index for that page again.
   * The page open edited: `editor:pageModified` (its `changes`) at once; `page:saved` and `page:index` once saved.
   * A page deleted: `page:deleted` (its name) and `file:deleted`; no `page:index`.
   * **A rename is no event of its own**: the new page saved and indexed, the old one deleted (`page:saved`, `page:deleted`, `page:index`). A rename outside the database (*Page: Rename*, the space tree) is so an item gone and another come: its key does not follow (a page name kept anywhere would be stale: why the order by hand became the item's `rank`, *Decided* 16); a rename through the core does, the store renaming it.
   * **The items by rank in a query** (asked by the user the same day): `query[[from index.tag "db" where string.startsWith(name, "Projects/db-tasks/") and not string.find(string.sub(name, 19), "/") and _database ~= nil order by _database.rank limit 10]]` gives the first ten (`desc` the last); texts are ordered by code point (`Zz`, `a0`, `a00`, `a0V`, `a0a`, `a1`), as a fractional index needs. Without `_database ~= nil` an item without one fails the query (*attempt to index a nil value*), so the store gives every item it makes a rank, and the library page shows the query. A function of the Lua API giving a database's items in order (`silverware.database.items`) can come with step 8. **Pages of them**: `limit 10 offset 20` works; so does a page after the last rank shown (`and _database.rank > "a00" order by _database.rank limit 10`), which stays right as items are added or moved meanwhile, where an offset shifts. `nulls last` does not help an item without `_database` (the field is read before ordering, and fails).
6. **YAML**: `yaml.parse` and `yaml.stringify` are in Space Lua, but `yaml.parse` makes an unquoted date a JS `Date` (Lua `userdata`), unlike the index, and `yaml.stringify` writes a JSON value as a quoted string with `\"` escapes (`kanban.filter: "{\"status\": \"!=Done\"}"`), keys in the order set. So the binding reads and writes the block itself, in JS (the widget's `render` hands it the block's text anyway).

## Steps

Each a branch's worth, with its tests (unit tests of the domain and the core, Playwright scenarios against SilverBullet, as the chart's: code widgets are SilverBullet's; a playground over a space in memory, as the tags' has, for working without it):

1. **Probes** (above), their results written here.
2. **Shared parts**, right after views are merged, before Silverware Table's store refactor starts: `shared/filter.ts`, `shared/compare.ts` (Silverware Table moved onto them), `shared/platform.ts` (the interfaces); nothing changed for users.
2b. **The page writer** (`shared/pages/`: the builder, `plan`/`apply`/`write`, the parts `properties` and `tags`, a page renamed, `PageHistory`), its tests against a `Space` in memory; Silverware Tags moved onto it (its frontmatter and hashtags' reading and writing into the `tags` part, its operations building changes, its review the writer's preview, its Undo a `PageHistory`), its tests of behaviour passing unchanged; nothing changed for users.
3. **The model, the stores and the core**: the layers and `isolation.test.ts` by folder; the model; `DatabaseStore`, `ViewStateStore` and the contract tests; the memory store; the core over them (transactions, the types (the first seven), the view registry and switcher, views' meta and settings, filter and sort per view, `open`, the item's and property's menus gathered from the modules); the playground over the memory store.
4. **The pages store and the SilverBullet binding**: the plugin's folder and pages (library page, -init, -api, -style); the platform made of what the init page hands over; the pages store over it and the page writer, passing the contract tests; the code widget and the block as the `ViewStateStore`; the index and its events.
5. **Built-in views**: table, list, kanban, through the view API alone.
6. **Peek**: the item's panel.
7. **Properties**: the schema's dialog, changes over items reviewed, `readonly`.
8. **Custom views and types** from Space Lua; the library page's API.
9. **Later** (none of it in the first version): relations and rollups; formulas in a database (a formula property calculated per item, by Silverware Table's formulas' language, after the views plan's sources and grids); the database as a source of Silverware Table's formulas (`@tasks`; its id then shares the `@` names with `defineSource`'s, which one wins to decide then); several saved views in one block as tabs; a template for a new item's body; grouping in the table and list views.

## Decided (2026-11-06, with the user)

1. The database after Silverware Table's views and choices from Space Lua.
2. A table view of its own, the pure parts shared with Silverware Table through `shared/`; the database needs no other plugin.
3. Opening an item: a panel at the right, its properties as fields and its body as markdown text, *Open as page*.
4. An item's name is its page's name, renamed with it (the pages store's form; in the model the item's `name`, its key unchanged).
5. The id a slug of the name the database is created with, not changed by renaming the database; a command changing it may come later.
6. Filtering and sorting per view, under the view's prefix.
7. The first property types: text, number, checkbox, date, select, multi-select, url; relations later, the schema and values kept able to hold them.
8. No formulas in the first version; formula properties later, with relations and the formulas' sources.
9. In the pages store, items belong to their database by the folder, not by a key in each: a folder renamed stays whole, and a change of the id touches no item.
10. Views are the core's, not modules; the built-in ones made through the same API as custom views. Modules are wholes worth turning off or replacing, not one per piece.
11. A view's settings are an object as a module's: `silverware.database.views.<name>` with `enabled` and the view's own global settings.

## Decided (2026-11-07, with the user)

12. The database is apart from SilverBullet and from where it is kept (*Layers*): a model in memory, `DatabaseStore` and `ViewStateStore` as the core's interfaces, ports for the platform, items by an opaque `ItemKey`; pages, folders, frontmatter and the code block are the pages store's and the binding's forms. The memory store and the contract tests from the first step of code, `isolation.test.ts` by folder.
13. Built before Silverware Table's store refactor, in its shapes: the ports in `shared/ports.ts` for both plugins, the model mappable onto its `TableModel`; the shared parts moved right after views are merged.

## Decided (2026-11-07, with the user, after the probes)

14. The peek is a floating panel of ours, not SilverBullet's `rhs` panel (probe 3).
15. Property keys are lower case ASCII letters, digits and `_`, starting with a letter, so Space Lua reads them bare (probe 1).
16. What the database keeps for itself is under the frontmatter key `_database` (the root page's `id`, `name`, `properties`; an item's `rank`), apart from the user's properties at the top level; the order by hand is the item's `rank`, one per database, not a list of page names in the block (probes 1, 2 and 5).
17. A transaction is applied document by document, each where still at the revision read, and reported; undo is the core's, a transaction back, Silverware Tags' way (`core/history.ts`, `undoOperation`), the same over every store, not atomic (probe 5).

## Decided (2026-11-07, with the user: the page writer)

18. Plugins see neither frontmatter nor a page's text: a page is changed through one writer (`shared/pages/`), the only one that knows how anything is written in it; `shared/frontmatter.ts` is not a module of its own but the writer's part `properties`.
19. Changes are a model made by a builder: one builder per batch, mutating and fluent, `build()` giving frozen data, the builder unusable after; a page named twice is one page's changes in the order called; a section per part of the content (`p.properties`, `p.tags`), the page's own on it (`p.rename`).
20. The writer in two steps: `plan(changes)` (pages read, revisions kept, new texts in memory, a summary in the model's terms, a preview of lines ready to show, the problems; nothing written) and `apply(plan)` (page by page where still as read, the rest reported); `write(changes)` both at once without a preview.
21. Parts built in only (`properties`, `tags`), made as a registry the built-in parts go through as another plugin's would, so that opening it to other plugins is exporting the registration, not rebuilding.
22. A page renamed is the page's own change (`p.rename`), done first in its changes, through `space.rename` (links followed).
23. Undo is the writer's: `PageHistory`, a plugin's own instance, `record(report, label)` (the `ApplyReport` `apply` gave) and `undo()` / `planUndo()`; pages given back only where still as `apply` left them, the rest reported; the plugin only keeps the reports and says when Undo is offered.
24. The platform in place of ports: `shared/platform.ts`, `Platform = { editor, space, index, ui, settings }` (`Editor`, `Space`, `Index`, `UserInterface`, `Settings`), plain names over a term to learn; `index` reads only, every write goes through the writer.
25. A plugin's own metadata is no part of the writer: its store says what goes where, `properties` how it is written; the tags are a part (SilverBullet's syntax, the same for every plugin); Silverware Table's metadata row and hidden tags are its tables' codec, which stays its store's and is registered with the same writer as its part `tables`: Silverware Table's store plan is changed to say so (the shared platform and writer, one writer per document for tables and pages alike).

**Open**: what other plugins write with a write (Silverware Table's `onWrite(fn(text))`, the chart's data written with a table's edit) is text today, and the table's store plan keeps it so ("names kept"). Joined to the writer, a plugin would give changes in its model and the writer would write them in the same edit; to decide with the store plan.
