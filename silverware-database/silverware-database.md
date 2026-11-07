---
name: Library/damesene/silverware-database
tags: meta/library
description: "Silverware Database: databases of pages, in the spirit of Notion's: one item a page, its properties the page's frontmatter, shown in your pages by views. In development: no built-in views yet."
files:
- silverware-database.js
- silverware-database-init.md
- silverware-database-api.md
- silverware-database-style.md
---
# Silverware Database

Databases of pages, as Notion has them: each item is a page of its own, its properties are the page's frontmatter, and a database is shown wherever you write its block, by a view you pick.

**In development.** What is here: databases kept in your pages, made, changed and undone safely, and shown by views. The built-in views (table, list, kanban) come next; until then a database shows with the views you define yourself (*Your own views and types*).

## A database in your space

A database is a folder of pages beside the page it was made on:

```
Projects.md                         a page showing the database: its block
Projects/db-tasks.md                the database's root page: its name and properties
Projects/db-tasks/Fix login.md      an item: its properties in its frontmatter, its notes in its text
Projects/db-tasks/Write docs.md
```

* An item is a page tagged `db`, its properties at the top of its frontmatter (`status: Doing`), so a query reads them as any page's: `query[[from index.tag "db" where status == "Doing"]]`.
* The database's own data is under `_database` (the root page's name and properties, an item's place in the order by hand: `_database.rank`).
* An item's name is its page's name: renamed through the database, the page is renamed and the links to it follow.

## Showing a database

Write its block where you want it (the command **Silverware Database: New database** makes a database and writes its block at the cursor):

````markdown
```silverware-database
id: tasks
```
````

Above it, a button for each view; the one you pick is written into the block (`view: …`), and so is what a view keeps there (its filter, its sort, prefixed by its name).

## Nothing lost by mistake

* A change is written only where the page is still as it was read: an item edited by hand meanwhile is left as it is, and you are told.
* Removing items asks first, and a change can be undone (where a view offers Undo): what is still as it was written is put back.
* A value that does not read as its property's type is kept as written and shown as invalid, never emptied; a property removed from a database keeps its values in the pages.

## Your own views and types

A view is a JS module of your space, given to `silverware.database.defineViews` in a `space-lua` block:

```lua
silverware.database.defineViews(js.importFromSpace("Library/me/names.js"))
```

```js
// Library/me/names.js: a view listing the items' names
export default [
  {
    name: "names",
    label: "Names",
    icon: "•",
    render(host, element) {
      const draw = () => element.replaceChildren(...host.items.map((item) => Object.assign(document.createElement("div"), { textContent: item.name })));
      draw();
      return { update: draw };
    },
  },
];
```

`host` gives the items (filtered and sorted as the view asks), each value's text and type, and the writes (`update`, `create`, `rename`, `remove`, `move`, `undo`), each checked and undoable. `silverware.database.defineTypes` takes property types the same way.

## Settings

The command **Silverware Database: Settings** shows every view with a switch, and under it the settings the view has; saved, they apply at once. They are kept in your CONFIG, in a block of their own, where you can set them too: `silverware.database.views.<view>.enabled`, and a view's own `silverware.database.views.<view>.<setting>`, e.g. `config.set("silverware.database.views.count.enabled", false)`.
