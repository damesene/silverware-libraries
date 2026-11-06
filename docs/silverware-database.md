# Silverware Database (plan)

Talked through with the user on 2026-11-06. Nothing of it is built yet; this is the plan to agree on before the first step.

A new plugin (`silverware-database/`, prefix `swd-`, settings and API under `silverware.database`, commands `Silverware Database: …`): databases in the spirit of Notion, where **one item is one page** and its properties are the page's frontmatter. Built as the other plugins: a core that knows no module and no view by name, modules turned off not loaded (`silverware.database.modules.<name>.enabled`), views added (built-in and the user's or another plugin's alike) without changing the core.

## Order: after Silverware Table's views (decided 2026-11-06)

Silverware Table's views and choices from Space Lua (branches `feat/choices-from-lua` and `feat/views`, docs/silverware-table-views-plan.md there) are finished first, the database after. Why:

* **A database is a source for formulas.** The views plan makes `defineSource` and `@tasks`: rows from Space Lua that any formula, view or pivot reads. A database is exactly such rows; built after, it plugs into that shape (`@tasks[due]`, a pivot of a database) instead of designing sources twice.
* **A select property is a choice list.** The views plan settles how a column's choices come from Space Lua (`=@projects`); the database's options follow that, not a model of their own reconciled later.
* **Both would refactor the same ground.** The views refactor the table's writes and the pivot (`src/calculated/`); this plan moves pure parts of the table into `shared/` (below). Done one after the other, they do not fight.
* **The unreleased branch ages.** The choices wait for views; the longer main moves, the dearer their merge.

This plan is committed now, so the database is designed with views in mind; its implementation starts when views are on main.

## What is where

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
  kanban.filter: status <> Done
  table.sort: due asc
  table.widths: {"name": 240, "due": 120}
  ```
  ````

  `id` the database, `view` the view shown; every other key a view's own, prefixed by its view's name (below). Values are YAML scalars, or JSON where a value is a list or an object, one key a line, so the block stays readable and a diff of it small.
* **The root page** (`<page>/db-<id>.md`) holds what is the database's whatever view shows it: its name, its properties (the schema). Its frontmatter has `tags: db-root` and `id: <id>`: **the database is found by its id** (`index.tag "db-root"`), so the root page's name is a convention only, and a root page moved or renamed is still found.
* **Items** are the root page's subpages tagged `db` (`<root>/<item>`, its frontmatter `tags: db`): membership is the folder, the tag what makes them queryable (`from index.tag "db"`) and tells them from other pages a user puts there. A subpage of an item is no item.
* **An item's name is its page's name** (decided 2026-11-06): `Projects/db-tasks/Fix login`, as Notion's title. Renaming the item renames the page, its links followed (SilverBullet's rename, to verify: *Probes*). A name taken in the folder gets a number (`Fix login 2`). `name` is the built-in property every database has, the first column of a table.
* **The id** (decided 2026-11-06): a slug made from the name the database is created with (`Tasks` → `tasks`; lower case ASCII, words joined by dashes, unique in the space), never changed afterwards; the name shown is the root page's `name`, changed freely. Readable in the folder (`db-tasks`) and, later, in formulas (`@tasks`).
* **Two root pages of one id** (a copy): the first by the index's order is the database, the block says so in the attention look, as two tables of one name are.

### The schema

In the root page's frontmatter, by the property's key, which is the key in the items' frontmatter:

```yaml
---
tags: db-root
id: tasks
name: Tasks
properties:
  status: { type: select, label: Status, options: [Todo, Doing, Done] }
  due: { type: date, label: Due }
  estimate: { type: number, label: Estimate, readonly: true }
  tags: { type: multi-select, label: Tags }
---
```

* **The key is the property's identity**, the label what is shown: renaming a label touches the root page alone; renaming a key rewrites every item (an operation over pages, below). Keys strict as choice lists' names (lower case ASCII, dashes), so a key is a valid YAML key and a valid column key for Space Lua queries.
* An item without a key has that property empty; a key the schema lacks is the page's own and left alone (shown nowhere, never removed).
* `readonly: true`: no view offers to change it (the core's `update` refuses it too, so a custom view cannot either); its value is still written by hand in the page, or by a script.
* The first types (decided 2026-11-06): `text`, `number`, `checkbox`, `date`, `select`, `multi-select`, `url`, each how it is stored in YAML (a number, `true`/`false`, a list, ISO text for a date as formulas write dates) and how it shows and is edited. Types are a registry as Silverware Table's column types are, so the user's own come from Space Lua (`silverware.database.defineTypes`), a custom one of a built-in name replacing it.
* **Relations later, room kept now** (the user: databases will be linked, not in the first version): a type may declare what it refers to (`{ type: relation, database: projects }`, values the items' links, `[[Projects/db-projects/Website]]`, a list). So now: a type's parameters are an object of its own (not a fixed set of fields), a value may be a list of links, and an item's rename follows its links through SilverBullet's rename, which a relation's values are. Rollups and formula properties come with relations and the formulas' sources.

## The core

* **The block** is a code widget of the language `silverware-database` (`codeWidget.define`, as the chart's), its element the core's. A code widget is rendered anew only when its text changes (verified for the chart, 2026-11-01), so the core refreshes what it shows on the index's changes of its items (`page:index`, `editor:pageModified` for the page open), keeping the view's state (scroll, an open editor) where it can.
* **Reading**: the root and its items from the index through the bridge (`index.tag "db-root"`, `index.tag "db"`, by the root's folder), as data: `Database { id, name, root, properties }`, `Item { page, name, values, lastModified }`. Values as the index has them, typed by the schema (a number written as text read as a number where it is one, else shown invalid as a column type's value).
* **Writing**, every change one call of the core, never a view writing a page itself:
  * `update(item, key, value)`: one property; the item's frontmatter edited in its own form (the order of its keys, its quotes, its comments kept), not SilverBullet's YAML written anew, as Silverware Tags writes tags (its `tags/frontmatter.ts` made generic in `shared/frontmatter.ts`, below). The page open through the editor (one `replaceRange`, one Ctrl+Z), another page through `space.readPage`/`writePage` where its text is still as read.
  * `create(values)` (a page with its frontmatter, its name from `name` or *Untitled*), `rename(item, name)`, `remove(item)` (asked first).
  * The schema: `addProperty`, `renameProperty` (the label), `rekeyProperty`, `retypeProperty` (values kept where they read as the new type, else listed before), `removeProperty` (the schema, and the values in the items if asked). Changes over many items are planned (pages read, edits made, nothing written), shown, applied page by page where a page is still as read: Silverware Tags' way (`core/plan.ts`), to be shared where it fits.
* **Views are registered**, the core knowing none by name: a view is `{ name, label, icon, render(host, element), settings? }`; the block's `view` names the one shown; a switcher in the block's toolbar lists every view registered (built-in modules on, and custom ones), a pick writing `view:` into the block. A view the block names that no one registered shows a note and the switcher.
* **A view's own data** (`host.getMeta(key)`, `host.setMeta(key, value)`): the core prefixes the key by the view's name (`kanban.groupBy`), so a view reads and writes its own only, as a Silverware Table module's host does. Kept for every view in the block, so switching back finds them as left. What is the database's (the schema, its name) goes to the root page through the core's functions, never a view's meta.
* **Filtering and sorting per view** (decided 2026-11-06, as Notion's views): the core offers them as services (`host.filter`, `host.sort`: the expression parsed, the items it keeps, in order) stored under the view's prefix (`table.filter`, `kanban.sort`), the view asking for them where it shows items; a view that orders by hand (a kanban column's cards) keeps its order in its own meta. The filter's syntax is Silverware Table's (`filter.ts`, moved to `shared/`), per property, so `status <> Done`, `due < today` read as the table's filter row does.
* **Opening an item** (`host.open(item)`): the peek module's panel where it is on, else the page (`editor.navigate`). A view only calls it from its own action (a click on a card's name, a row's open icon); how it opens is the core's.
* **The API a view gets** (`ViewHost`): the database and its items (filtered and sorted as asked), the property types (how a value shows, its editor), `update`/`create`/`rename`/`remove`, `open`, its meta, the shared UI (`el`, menus, dialogs, drag reordering from `shared/`), `refresh`. Written as a type in the core and documented on the library page, so a custom view outside the bundle uses the same.
* **Custom views** come from Space Lua as Silverware Table's custom definitions do: a JS module of the space, `silverware.database.defineViews(js.importFromSpace(…))` in the API page's priority-50 block, a list or a function given HELPERS; checked, a mistake a notification, replaced as Space Lua loads again. Another plugin's view the same way, from its own bundle.

## Modules (each can be turned off)

* **table**: a row per item, a column per property (`name` first), shown as its type shows it; a cell edited in place by its type's editor (`readonly` not offered); a column's menu (sort, filter, hide, the property's settings through the properties module's offer); widths and hidden columns in its meta; + a row (`create`), + a column (the properties module). Its own code, pure parts shared with Silverware Table (decided 2026-11-06, below).
* **list**: an item a line, its name and the properties the view's meta picks.
* **kanban**: columns by a `select` property (`kanban.groupBy`, an empty value its own column), a card per item, dragged between columns (`update`) and within one (the order in its meta), + a card in a column (`create` with that value).
* **peek**: the item's panel (decided 2026-11-06): over the right of SilverBullet's editor, as Notion's side peek: its name (renaming), its properties as fields of their types, its body as markdown text in a field (without the editor's features: SilverBullet's editor cannot be put there, to verify in *Probes*), *Open as page*; written as the fields are left, where the page is still as read, else said and read anew; Esc and a press beside it closing it.
* **properties**: the schema's dialog (add, label, key, type, options, readonly, order, remove), the plans of changes over items reviewed before applied.
* **create**: the command *Silverware Database: New database* and `/database` (a name asked, the id made from it, the root page written and the block inserted at the cursor), *Silverware Database: Insert database view* (an existing database picked, by `editor.filterBox`, its block inserted).

The modules use each other only through offers, as Silverware Table's and Silverware Tags' do (`offer`, `offered`).

## Shared with Silverware Table and Silverware Tags (decided 2026-11-06)

The database needs no other plugin installed (as the chart needs no table). What both plugins need is moved into `shared/` (bundled into each), the plugins moved onto it first, their tests passing, before the database uses it:

* `shared/filter.ts`: the filter syntax (`parseFilter`, `filterMatcher`, `normalizeForFilter`) from `silverware-table/src/filter.ts`; `filterExcelFormula` stays the table's (Excel is the table's).
* `shared/compare.ts`: how values are compared for sorting (numbers, dates, text by locale), as the table's sorting compares them.
* `shared/frontmatter.ts`: a frontmatter key read and written in the page's own form, from Silverware Tags' `tags/frontmatter.ts` (which knows only `tags` today): generic over keys and values, the tags' part a use of it.
* Possibly Silverware Tags' plan of changes over pages (`core/plan.ts`), if it shares without bending; else the database's own.
* Already there: menus, dialogs, tabs, controls, elements, drag reordering, the CONFIG page's settings.

Not shared: Silverware Table's core (its writes are markdown tables: `replaceRange` over a table, the metadata row, `data-pos`). Giving it a data backend of pages was weighed and set aside: a refactor of its core and a dependency of the database on it, for features (formulas, pins, the sheet) a view over pages does not need.

## Probes in SilverBullet (first step)

Verified in the local SilverBullet (Podman, the release `scripts/silverbullet/Dockerfile` names) before code relies on it:

1. What the index gives of a page's frontmatter: lists, nested objects (the schema's `properties`), numbers, booleans, dates (text or a date), and whether `index.tag "db"` has every key.
2. A rename that follows links (the command *Page: Rename*'s function, through `system.invokeFunction` or a syscall), callable from the bridge; else what `space` offers.
3. Whether an editor of a page can show beside the page open (a second CodeMirror of SilverBullet's, `editor.showPanel("rhs", …)`), or the peek's body is a field of ours.
4. A code widget's element kept or made anew as the page scrolls (CodeMirror's viewport) and as its block is written: what the view's state survives.
5. Events for the items' changes: `page:index` of another page, `editor:pageModified` of the page open, a page deleted.
6. YAML in Space Lua (`yaml.parse` / `yaml.stringify`), or the block's few forms read by the core itself.

## Steps

Each a branch's worth, with its tests (unit tests of the domain and the core, Playwright scenarios against SilverBullet, as the chart's: code widgets are SilverBullet's; a playground over a space in memory, as the tags' has, for working without it):

1. **Probes** (above), their results written here.
2. **Shared parts**: `shared/filter.ts`, `shared/compare.ts`, `shared/frontmatter.ts`, Silverware Table and Silverware Tags moved onto them; nothing changed for users.
3. **The core**: the plugin's folder and pages (library page, -init, -api, -style), the block read and written, the database and its items from the index, the writes, the types (the first seven), the view registry and switcher, views' meta, filter and sort per view, `open` as navigation; the playground.
4. **Views**: table, list, kanban.
5. **Peek**: the item's panel.
6. **Properties**: the schema's dialog, changes over items reviewed, `readonly`.
7. **Custom views and types** from Space Lua; the library page's API.
8. **Later**: relations and rollups; the database as a source of Silverware Table's formulas (`@tasks`, after the views plan's sources); several saved views in one block as tabs; a template for a new item's body; grouping in the table and list views.

## Decided (2026-11-06, with the user)

1. The database after Silverware Table's views and choices from Space Lua.
2. A table view of its own, the pure parts shared with Silverware Table through `shared/`; the database needs no other plugin.
3. Opening an item: a panel at the right, its properties as fields and its body as markdown text, *Open as page*.
4. An item's name is its page's name, renamed with it.
5. The id a slug of the name the database is created with, unchanged afterwards.
6. Filtering and sorting per view, under the view's prefix.
7. The first property types: text, number, checkbox, date, select, multi-select, url; relations later, the schema and values kept able to hold them.
