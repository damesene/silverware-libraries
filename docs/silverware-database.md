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

The database knows neither SilverBullet nor pages. Its model is databases, properties and items in memory; where they are kept is a **store**'s, what the platform offers a **port**'s, as Silverware Table's store plan has it (*Principles* there, followed here: the model says what a thing is, a store how it is kept; dependencies go one way; an interface is proven by its implementations). Running elsewhere, or keeping databases elsewhere, is a new binding or a new store, with no view, module or core changed.

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
store/        pages/ (pages, frontmatter, folders), memory.ts, contract.ts; over ports
   ▲
host/         silverbullet/ (the ports, the code widget, the index and its events,
              the Lua API, the commands); playground/ (a space in memory)
```

`isolation.test.ts` checks it by folder from the first commit: each layer imports only what is above it in the list (and `shared/`); nothing outside `host/silverbullet/` names SilverBullet's API, nothing outside `store/pages/` knows a page, a folder or frontmatter.

* **An item is an `ItemKey`, opaque**: the core, views and modules hold it, compare it and give it back, never make or read it (as Silverware Table's `TableKey`). That an item is the page `Projects/db-tasks/Fix login` is the pages store's alone. The item's name is its property `name`, which the pages store writes as the page's name; a view's order by hand (a kanban column's cards) is kept by keys, the store giving each key a form that lasts (`ItemKey` ↔ the form kept, the pages store's the page's name).
* **`DatabaseStore`** (core/store.ts), what the core asks and modules never see:
  * `databases()`, `database(id)`, `items(id)`: each with a `revision` that changes whenever it does (what tells a view to draw anew);
  * `transaction(id, changes)`: properties set, items made, renamed or removed, the schema changed, **as one step** (one undo step where the platform has undo), whichever items are open or not;
  * `changed(listener)`: a database or its items changed outside a transaction (a page edited by hand, another device's sync);
  * `plan(changes)`: what a transaction would make of each item, nothing written (the review of changes over many items);
  * `writable(key)`: what may be written (a read-only property, a store that is read only); `validatePropertyKey(key)` and `validateItemName(name)`: what the store's form cannot hold, each giving why as text, `undefined` where it can (the pages store's: SilverBullet's page keys, what a page's name may not be); `documentOf(item)`: where the item can be opened, if anywhere;
  * `capabilities`: what one store can and another cannot (`renameFollowsLinks`, `itemBody`, `undo`): the core offers by them, never assumes.
* **An item's body** is content in the markdown language (as a cell's content in Silverware Table's store plan): how it is kept is the store's.
* **`ViewStateStore`**: what a view keeps where a database is shown (`kanban.groupBy`) is kept somewhere too: by block and view, `get(key)` / `set(key, value)`. SilverBullet's binding keeps it in the code block; tests in memory. Views know no block.
* **Ports** (`shared/ports.ts`, so that Silverware Table's store plan takes the same in its step 1, not a set of its own): `DocumentPort` (the open document's text, an edit applied, the cursor, undo), `SpacePort` (documents read, written, listed, renamed, navigated to), `UiPort` (notify, ask, pick), `ConfigPort` (settings read and saved, reload). Each plugin's binding makes them; a plugin uses those it needs. The index of SilverBullet (`index.tag`) and its events (`page:index`, `editor:pageModified`) are the binding's: the pages store gets a port for querying and for changes, not the index.
* **Contract tests** (`store/contract.ts`): one suite every store runs against itself: databases and items read with stable keys, a transaction as one step, an item renamed keeping its key, revisions, changes from outside told, `writable` and `capabilities` respected. The memory store passes it as the pages store does; the core's, the views' and the modules' tests and the playground run over the memory store, the pages store's own tests over a `SpacePort` in memory (as Silverware Tags' `space/memory.ts`).
* **Room for Silverware Table**: the model maps onto the store plan's `TableModel` (a property a column with its attributes: type, label, readonly; an item a row by its key), so that after that plan Silverware Table may offer its own table view of a database (`defineViews` from its bundle, over an adapter of the `DatabaseStore`), with formulas and column types, the database's own table view staying for a space without it. Nothing of it is built now; decided 2 holds.
* **What stays SilverBullet's**: the code widget and its rendering anew, the Lua API, the commands, the probes' facts: all in `host/silverbullet/`, none in the core.

## The pages store: what is where in SilverBullet

This section, to *The model*, is how `store/pages/` keeps a database in a space (and the block, the binding's `ViewStateStore`): the core, the views and the modules know none of it.

```
Projects.md                         a page showing a database: its block
Projects/db-tasks.md                the database's root page (frontmatter: tags db-root, id, name, schema)
Projects/db-tasks/Fix login.md      an item (frontmatter: tags db, its properties; the body the page's text)
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
* **The root page** (`<page>/db-<id>.md`) holds what is the database's whatever view shows it: its name, its properties (the schema). Its frontmatter has `tags: db-root` and `id: <id>`: **the database is found by its id** (`index.tag "db-root"`), so the root page's name is a convention only, and a root page moved or renamed is still found.
* **Items** are the root page's subpages tagged `db` (`<root>/<item>`, its frontmatter `tags: db`): membership is the folder, the tag what makes them queryable (`from index.tag "db"`) and tells them from other pages a user puts there. A subpage of an item is no item.
  * **Why the folder, not a `db: <id>` key in every item** (decided 2026-11-06): a folder renamed (`Projects` → `Work`) is renamed whole, SilverBullet's space being files on disk, so its root and its items stay together; and a change of the database's id (its slug, a later command) renames one folder and one root page, where a key in every item would rewrite them all. The one case that parts them: the root page renamed alone (*Page: Rename* of `Projects/db-tasks`, if it leaves its subpages where they are: probe 2), its items then in a folder no root heads. The block says so (the root found, its folder empty, a folder of `db` pages with no root beside it named) and offers to move the root back or the items after it.
* **An item's name is its page's name** (decided 2026-11-06): `Projects/db-tasks/Fix login`, as Notion's title. Renaming the item renames the page, its links followed (SilverBullet's rename, to verify: *Probes*). A name taken in the folder gets a number (`Fix login 2`). A name is checked against what a page's name may be in SilverBullet (no `/`, which would make a subpage, nor the characters a link cannot hold); what cannot be is refused with why, not changed silently. `name` is the built-in property every database has, the first column of a table.
* **The id** (decided 2026-11-06): a slug made from the name the database is created with (`Tasks` → `tasks`; lower case ASCII, words joined by dashes, unique in the space), not changed by renaming the database: the name shown is the root page's `name`, changed freely. Changing the id itself may come later as a command (the root's `id`, its page and folder, and the blocks naming it rewritten; the items untouched, their membership being the folder). Readable in the folder (`db-tasks`) and, later, in formulas (`@tasks`).
* **Two root pages of one id** (a copy): the first by the index's order is the database, the block says so in the attention look, as two tables of one name are.

### The schema in the root page

The model's schema (*The model*) as the pages store keeps it: in the root page's frontmatter, by the property's key, which is the key in the items' frontmatter:

```yaml
---
tags: db-root
id: tasks
name: Tasks
properties:
  status: { type: select, label: Status, options: [Todo, Doing, Done] }
  due: { type: date, label: Due }
  estimate: { type: number, label: Estimate, readonly: true }
  labels: { type: multi-select, label: Labels }
---
```

* Renaming a label touches the root page alone; renaming a key rewrites every item's frontmatter. A key is a valid YAML key and a valid column key for Space Lua queries (the model's rule for keys is strict enough for both).
* **Keys SilverBullet's page objects have are refused** (the pages store's `validatePropertyKey`, which the core asks of the store as it checks a key: another store has its own or none) (`name`, `tags`, `tag`, `itags`, `ref`, `aliases`, `displayName`, `lastModified`, `created`, `perm`, `contentType`, `size`, `pageDecoration`; the list confirmed by probe 1): the index puts them beside the frontmatter's keys in one object, so a property `name` would be the page's name, `tags` the page's tags. The page's tags as a property (a multi-select over `tags`) can come later as a property of its own kind, not a key.
* An item without a key has that property empty; a key the schema lacks is the page's own and left alone (shown nowhere, never removed): the store keeps what the model does not hold.
* Values in YAML: a number, `true`/`false`, a list, ISO text for a date (as formulas write dates); a relation's value (later) the items' links, `[[Projects/db-projects/Website]]`, which SilverBullet's rename follows: the store turns them into `ItemKey`s and back.

## The model (`model/`, `domain/`)

What a database is, wherever it is kept:

* `Database { id, name, properties }`, `Property { key, label, type, params, readonly }`, `Item { key: ItemKey, name, values, body, modified }`; `name` the built-in property every database has, the first column of a table.
* **The key is the property's identity**, the label what is shown: a label renamed changes the schema alone, a key renamed every item that has it. Keys strict as choice lists' names (lower case ASCII, dashes); a store may refuse more (`validatePropertyKey`).
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
  * `create(values)` (its name from `name` or *Untitled*), `rename(item, name)` (refused with why where the store's `validateItemName` says so: the pages store's names of pages), `remove(item)` (asked first through the `UiPort`).
  * `createDatabase(name)` (the id made from it, unique among the store's), the database's name changed.
  * The schema: `addProperty`, `renameProperty` (the label), `rekeyProperty`, `retypeProperty` (values kept where they read as the new type, else listed before), `removeProperty` (the schema, and the values in the items if asked). Changes over many items are planned (the store's `plan(changes)`: what each item becomes, nothing written), shown, applied where an item is still at the revision read: Silverware Tags' way (`core/plan.ts`), to be shared where it fits.
* **Views are the core's, not modules** (decided 2026-11-06): a place shows nothing without a view, so turning off "views" would mean nothing; a module is a whole one may want to turn off, on or replace, not made one at any cost. The core keeps the registry of views and knows none by name: a view is `{ name, label, icon, render(host, element), settings? }`; the place's `view` names the one shown; a switcher in the place's toolbar lists every view registered and on, a pick writing `view` into the place's state. A view the place names that no one registered (or one turned off) shows a note and the switcher.
* **The built-in views** (`src/views/builtin/`, one per file: table, list, kanban, below) are made through the same API as the user's (`defineViews`, below), importing only types from the core's view API (a test checks it, as the conditions' built-in definitions are checked): what kanban needs a custom view gets too, and no view leans on the core's insides.
* **A view's settings** (decided 2026-11-06): each view has its object of settings, `silverware.database.views.<name>`, as a module has: `enabled` (off, the switcher leaves it out), and the view's own global settings beside it (`silverware.database.views.kanban.cardProperties`), declared by the view (`settings`: key, label, hint, control, default, as Silverware Table's SETTINGS rows), so the binding defines them (SilverBullet's `config.define`) and the settings dialog shows them for built-in and custom views alike (a tab *Views*: each with its switch and its settings under it), read and saved through the `ConfigPort`. `host.setting(key)` reads the view's own. What a view keeps per place (its meta) and everywhere (its settings) are apart: a place's meta for what differs where it is shown (`kanban.groupBy`), a setting for what is the user's way everywhere.
* **Modules reach views through the core**, neither knowing the other: `host.open(item)` goes to the peek module's offer where it is on (else navigation); `host.itemMenu(item)` gathers the modules' entries for an item (Open, Duplicate, Delete, Edit property…) in slots by what they do, as Silverware Table's `lineMenu` slots; `host.propertyMenu(key)` the same for a property (its settings, through the properties module).
* **A view's own data** (`host.getMeta(key)`, `host.setMeta(key, value)`): the core prefixes the key by the view's name (`kanban.groupBy`), so a view reads and writes its own only, as a Silverware Table module's host does. Kept for every view in the place's state, so switching back finds them as left. What is the database's (the schema, its name) goes to the store through the core's functions, never a view's meta.
* **Filtering and sorting per view** (decided 2026-11-06, as Notion's views): the core offers them as services (`host.filter`, `host.sort`: the expression parsed, the items it keeps, in order) stored under the view's prefix (`table.filter`, `kanban.sort`), the view asking for them where it shows items. The filter is **a condition per property** in Silverware Table's syntax (`filter.ts`, moved to `shared/`), all of them to hold, as the table's filter row is one field per column: `{"status": "!=Done", "estimate": ">3"}`. That syntax compares numbers and text, not dates (`due < today`): comparisons of dates, and conditions joined by *or*, are its later growth, for both plugins.
* **A view's order by hand** (a kanban column's cards) is its own meta, the items by their keys, kept in the form the store gives them (the pages store's: page names): a rename through the core follows it, a key no item has any more is left out as the view reads it (an item renamed otherwise drops to its column's end). A long list in the place's state is the cost; the item's own data was set aside, as one order per view and place would put keys of views into every item.
* **A place's state written may render it anew** (in SilverBullet the block's text changed, and its widget is made anew): a view writes its meta at the end of what the user does (a drag let go, a width set), not while it goes, and the core hands the new rendering the view's state that is not kept (the scroll, the item edited), keyed by place and view.
* **Opening an item** (`host.open(item)`): the peek module's panel where it is on, else the item's document (the `SpacePort`'s navigate to what the store says the item's document is). A view only calls it from its own action (a click on a card's name, a row's open icon); how it opens is the core's.
* **The API a view gets** (`ViewHost`): the database and its items (filtered and sorted as asked), the property types (how a value shows, its editor), `update`/`create`/`rename`/`remove`, `open`, its meta, the shared UI (`el`, menus, dialogs, drag reordering from `shared/`), `refresh`. Written as a type in the core and documented on the library page, so a custom view outside the bundle uses the same.
* **Custom views** are given to the core's `defineViews` (a list or a function given HELPERS; checked, a mistake told through the `UiPort`; replaced when the binding says definitions load again). In SilverBullet the binding takes them from Space Lua as Silverware Table's custom definitions: a JS module of the space, `silverware.database.defineViews(js.importFromSpace(…))` in the API page's priority-50 block. Another plugin's view the same way, from its own bundle.
* **What the core uses of the browser**: views and modules draw their UI in the DOM (`shared/` elements, menus, dialogs), as every Silverware plugin does; that is the UI, not SilverBullet. A host without a DOM would need other views, not another core.

## Built-in views (the core's, each can be turned off by its settings)

* **table**: a row per item, a column per property (`name` first), shown as its type shows it; a cell edited in place by its type's editor (`readonly` not offered); a column's menu (sort, filter, hide, the property's settings through the properties module's offer); widths and hidden columns in its meta; + a row (`create`), + a column (the properties module). Its own code, pure parts shared with Silverware Table (decided 2026-11-06, below).
* **list**: an item a line, its name and the properties the view's meta picks.
* **kanban**: columns by a `select` property (`kanban.groupBy`, an empty value its own column), a card per item, dragged between columns (`update`) and within one (the order in its meta), + a card in a column (`create` with that value).

## Modules (each can be turned off)

A module is a whole one may want to turn off, on or replace, working across the views: `silverware.database.modules.<name>`, an object as a view's settings are (`enabled` and its own).

* **peek**: the item's panel (decided 2026-11-06): over the right of the editor's area (the binding says where it is: in SilverBullet its editor), as Notion's side peek: its name (renaming), its properties as fields of their types, its body as markdown text in a field (where the store's `capabilities` have `itemBody`; without the editor's features: whether SilverBullet's editor can be put there, *Probes*), *Open* (the item's document); written as the fields are left, where the item is still at the revision read, else said and read anew; Esc and a press beside it closing it.
* **properties**: the schema's dialog (add, label, key, type, options, readonly, order, remove), the plans of changes over items reviewed before applied.
* **create**: commands as data (`commands`, as Silverware Table's modules give them; the binding defines them: in SilverBullet *Silverware Database: New database* and `/database`, *Silverware Database: Insert database view*): a name asked, `createDatabase`, and a place inserted where the user is (the binding's `insertPlace`: in SilverBullet the block at the cursor); or an existing database picked (the `UiPort`'s `pick`: SilverBullet's `editor.filterBox`) and its place inserted.

## The SilverBullet binding (`host/silverbullet/`)

Everything SilverBullet's, in one place, as Silverware Table's store plan has its binding:

* **A place is a code block** of the language `silverware-database` (`codeWidget.define`, as the chart's): its element the place's, its text the place's `ViewStateStore` (*The pages store*, the block). A code widget is rendered anew only when its text changes (verified for the chart, 2026-11-01), so the binding tells the pages store of the index's changes (`page:index`, `editor:pageModified` for the page open), which tells the core through `changed`.
* The ports made of what the init page hands over (`editor.*`, `space.*`, `config.*`, the index's queries).
* The Lua API (`silverware.database.defineViews`, `defineTypes`), the commands and slash commands defined from the core's, the settings defined from the views' and modules' declarations.

The modules use each other only through offers, as Silverware Table's and Silverware Tags' do (`offer`, `offered`).

## Shared with Silverware Table and Silverware Tags (decided 2026-11-06)

The database needs no other plugin installed (as the chart needs no table). What both plugins need is moved into `shared/` (bundled into each), the plugins moved onto it first, their tests passing, before the database uses it:

* `shared/filter.ts`: the filter syntax (`parseFilter`, `filterMatcher`, `normalizeForFilter`) from `silverware-table/src/filter.ts`, with the number reading it uses (`asNumber`, from the table's `view.ts`); `filterExcelFormula` stays the table's (Excel is the table's).
* `shared/compare.ts`: how values are compared for sorting (numbers, dates, text by locale), as the table's sorting compares them.
* `shared/frontmatter.ts`: a frontmatter key read and written in the page's own form, from Silverware Tags' `tags/frontmatter.ts` (which knows only `tags` today): generic over keys and values, the tags' part a use of it.
* `shared/ports.ts`: the ports (*Layers*), the interfaces only; Silverware Table's store plan takes them in its step 1.
* Possibly Silverware Tags' plan of changes over pages (`core/plan.ts`), if it shares without bending; else the database's own.
* Already there: menus, dialogs, tabs, controls, elements, drag reordering, the CONFIG page's settings.

Not shared: Silverware Table's core (its writes are markdown tables: `replaceRange` over a table, the metadata row, `data-pos`). Giving it a data backend of pages was weighed and set aside: a refactor of its core and a dependency of the database on it, for features (formulas, pins, the sheet) a view over pages does not need.

## Probes in SilverBullet (first step)

Verified in the local SilverBullet (Podman, the release `scripts/silverbullet/Dockerfile` names) before code relies on it. They decide the SilverBullet binding and the pages store only, not the core's interfaces:

1. What the index gives of a page's frontmatter: lists, nested objects (the schema's `properties`), numbers, booleans, dates (text or a date), and whether `index.tag "db"` has every key.
2. A rename that follows links (the command *Page: Rename*'s function, through `system.invokeFunction` or a syscall), callable from the bridge; else what `space` offers. Whether *Page: Rename* of a page moves its subpages with it (the root page renamed alone), and what renames a folder whole (*Page: Batch Rename Prefix* or the like), for the database's own rename of its root.
3. Whether an editor of a page can show beside the page open (a second CodeMirror of SilverBullet's, `editor.showPanel("rhs", …)`), or the peek's body is a field of ours.
4. A code widget's element kept or made anew as the page scrolls (CodeMirror's viewport) and as its block is written: what the view's state survives.
5. Events for the items' changes: `page:index` of another page, `editor:pageModified` of the page open, a page deleted.
6. YAML in Space Lua (`yaml.parse` / `yaml.stringify`), or the block's few forms read by the binding itself.

## Steps

Each a branch's worth, with its tests (unit tests of the domain and the core, Playwright scenarios against SilverBullet, as the chart's: code widgets are SilverBullet's; a playground over a space in memory, as the tags' has, for working without it):

1. **Probes** (above), their results written here.
2. **Shared parts**, right after views are merged, before Silverware Table's store refactor starts: `shared/filter.ts`, `shared/compare.ts`, `shared/frontmatter.ts`, Silverware Table and Silverware Tags moved onto them; `shared/ports.ts` (the interfaces); nothing changed for users.
3. **The model, the stores and the core**: the layers and `isolation.test.ts` by folder; the model; `DatabaseStore`, `ViewStateStore` and the contract tests; the memory store; the core over them (transactions, the types (the first seven), the view registry and switcher, views' meta and settings, filter and sort per view, `open`, the item's and property's menus gathered from the modules); the playground over the memory store.
4. **The pages store and the SilverBullet binding**: the plugin's folder and pages (library page, -init, -api, -style); the ports made of what the init page hands over; the pages store over them, passing the contract tests; the code widget and the block as the `ViewStateStore`; the index and its events.
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
