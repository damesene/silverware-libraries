---
name: Library/damesene/silverware-database
tags: meta/library
description: "Silverware Database: databases of pages, in the spirit of Notion's: one item a page, its properties the page's frontmatter, shown in your pages as a table, a list or a kanban. In development."
files:
- silverware-database.js
- silverware-database-init.md
- silverware-database-api.md
- silverware-database-style.md
---
# Silverware Database

Databases of pages, as Notion has them: each item is a page of its own, its properties are the page's frontmatter, and a database is shown wherever you write its block, by a view you pick.

**In development.** What is here: databases kept in your pages, made, changed and undone safely, shown as a table, a list or a kanban (or by views you write yourself).

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

Above it, a button for each view; the one you pick is written into the block (`view: …`), and so is what a view keeps there (its filter, its sort, prefixed by its name). Beside them:

* **Filter**: a condition for each property, written as in Silverware Table's filter row (`Done`, `!=Done`, `>3`, `/regex/`); every condition has to hold.
* **Sort**: a property and its direction; *Order by hand* is the order you give items yourself (a kanban's cards dragged).
* **Undo**: puts this database's last change back, where it is still as it was written (also the command **Silverware Database: Undo**).

## The views

* **Table**: a row per item, a column per property. Click a value to change it, or reach it with Tab and press Enter or F2: Enter or a click elsewhere saves, Esc puts it aside; a value you leave as it was is not written. A value typed that does not read (`1,000` as a number) is not written, and you are told. A checkbox turns at once; ↗ opens the item's page; ✕ removes the item (asked first); a header sorts by its column. A value that does not read as its property's type shows in red, its reason on hover, and is kept as it is until you change it.
* **List**: an item a line, its name (a click shows it in the peek) and its values; **Properties** picks which.
* **Kanban**: a column for each option of a select property (the first one, or the one picked in **Group by**), one for items without a value, and one for any value that is none of the options, so no item is out of sight. Drag a card to another column or within one; on a phone, or from the keyboard, **Move to…** on the card does the same. **+ New** adds an item in its column.

## Properties

**Properties** beside the views opens the database's properties: change a property's label, its key (how pages and queries name it), its type, a select's options (one a line), whether it is read only (no view offers to change it), its place in the order, or remove it; add one with its label and type. A change that touches items (a key, a type, options, a property removed) first shows how many items it changes and which values it keeps as they are (a value that does not read as the new type is never emptied), and is written only when you apply it. Removing a property asks whether its values go too: if not, they stay in the pages and show again if the property comes back.

The table is a basic one: with [[Library/damesene/silverware-table|Silverware Table]], a table of its own over a database (formulas, column types, widths) is to come.

## Peek

A click on an item's name (or its ↗) shows the item in a panel at the right of the page: its name, its values (a click on one edits it, as in the views), its content as text, and **Open** for its page. Each is written as you leave its field. If the content was changed elsewhere since the panel showed it, what you typed is not written over it: it stays in the field with a note, and **Load the content as it is now** replaces it only once you agree. Esc, a click beside the panel or opening another page closes it (not while it holds content that could not be written). With the module turned off (Settings, Modules), a click opens the item's page.

## Nothing lost by mistake

* A change is written only where the page is still as it was read: an item edited by hand meanwhile is left as it is, and you are told.
* Removing items asks first, and a change can be undone (where a view offers Undo): what is still as it was written is put back.
* A value that does not read as its property's type is kept as written and shown as invalid, never emptied; a property removed from a database keeps its values in the pages.

## Your own views and types

Views and property types of your own are JS modules of your space, given to Silverware Database in a `space-lua` block:

```lua
silverware.database.defineViews(js.importFromSpace("Library/me/views.js"))
silverware.database.defineTypes(js.importFromSpace("Library/me/types.js"))
```

A module gives a list of definitions, or a function that is given `HELPERS` and gives the list. A definition with a mistake is shown in a notification and left out; the others are defined. When Space Lua loads again (a script changed), the definitions it makes replace those of before. A view of a built-in one's name replaces it; a type needs a name of its own (the views draw and edit the built-in types, a list of options or a checkbox, by their names).

### Views

```js
// Library/me/views.js: a view listing the items' names and their status, the status edited in place
export default (HELPERS) => [
  {
    name: "names",
    label: "Names",
    icon: "•",
    render(host, element) {
      const draw = () =>
        element.replaceChildren(
          ...host.items.map((item) => {
            const line = document.createElement("div");
            const status = document.createElement("span");
            const show = () => (status.textContent = host.text(item, "status") || "–");
            show();
            status.addEventListener("click", () => HELPERS.editValue(host, status, item, "status", show));
            line.append(item.name, " ", status);
            return line;
          }),
        );
      draw();
      return { update: draw };
    },
  },
];
```

A view has:

| Field | What it is |
|---|---|
| `name` | How a block (`view: names`) and the settings name it: lower case letters, digits and `-` |
| `label`, `icon` | How the switcher shows it (the icon a character) |
| `settings` | Optional: its settings, each `{ key, label, hint, control, choices, default }` (`control`: `switch`, `number`, `text` or `choice`), shown in **Settings** under the view and read with `host.setting(key)` |
| `render(host, element)` | Draws the view into `element`. It may give back `{ update, destroy }`: `update()` is called when the data change (without it the view is drawn anew), `destroy()` when it goes |

`host` gives:

* `document` (draw with it rather than the global one), `database` (its name and `properties`: each `{ key, label, type, params, readonly }`), `items` (filtered and sorted as the place shows them: each `{ key, name, values }`, a value read as `item.values[property.key]`; `key` tells items apart, nothing to read in it) and `total` (every item's count);
* `text(item, key)` a value as it shows (`"name"` the item's name), `type(property)` its type;
* the writes: `update(item, key, value)` (`undefined` takes the value off), `create({ name, values, body }, place)`, `rename(item, name)`, `remove(items)` (asked first), `move(item, { after, before, values })` and `undo()`. Each is checked (a value is a text, a number, `true`/`false`, `null` or a list of texts), written only where the item is still as the view read it, and undoable. One not done gives back `{ problem, cause }`: `invalid` (refused, said to the user) or `left` (the item changed since, said), `declined` (the user said no) or `unchanged` (nothing to do);
* `open(item)`: the item in the peek (or its page);
* `listing`: the place's filter and sort (`filter`, `sort`, `setFilter(key, condition)`, `setSort([{ key, direction }])`, `validateCondition(condition)`);
* `getMeta(key)` and `setMeta({ key: value })`: what the view keeps in its block (`kanban.groupBy`), `setting(key)` its settings, `refresh()`, `notify(message)`.

Write only from what the user does (a click, a key), never while `render` or `update` draws: a write draws the view again, which would write again.

`HELPERS` are the built-in views' own editors: `editValue(host, cell, item, key, show)` edits a value in `cell` by its type (a date field, a list of options…) and writes it as you leave it, nothing written you did not change, then calls `show` to draw the cell again; `toggle(host, item, key)` turns a checkbox; `shownValue(host, item, property)` a value as a card's line shows it; `NAME`, the key that renames (`editValue(host, cell, item, HELPERS.NAME, show)`).

### Types

```js
// Library/me/types.js: stars, a number from 1 to 5
export default (HELPERS) => [
  {
    name: "stars",
    label: "Stars",
    validate: (value) => (HELPERS.isEmpty(value) || (Number.isInteger(value) && value >= 1 && value <= 5) ? undefined : "1 to 5"),
    text: (value) => (Number.isInteger(value) ? "★".repeat(value) : HELPERS.keptText(value)),
    parse: (text) => (text.trim() === "" ? { value: null } : /^[1-5]$/.test(text.trim()) ? { value: Number(text.trim()) } : { problem: "1 to 5" }),
  },
];
```

A property of it is `type: stars` in the database's properties (or chosen in **Properties**). A type has:

| Field | What it is |
|---|---|
| `name`, `label` | How a property names it (a name of its own, not a built-in type's: lower case letters, digits and `-`), and how it is shown |
| `validate(value, params)` | Why a value is not of the type (shown red, kept as it is), `undefined` where it is; an empty value always is |
| `text(value, params)` | The value as text: shown, filtered and copied |
| `parse(text, params)` | A text typed made a value, `{ value }`, or why not, `{ problem }`; an empty text an empty value (`null`) |
| `sortKey(value, params)` | Optional: what sorting compares, where it is not the text |
| `validateParams(params)` | Optional: why a property's `params` are not the type's |

A value is a text, a number, `true`/`false`, `null` or a list of texts. `HELPERS` are `keptText(value)` (a value as it is kept, as text), `isEmpty(value)` and `isValue(value)`.

A type that throws or gives back the wrong kind of answer breaks nothing: the value shows as it is kept, a text typed is not written, and what failed is said once for each of its methods.

## Settings

The command **Silverware Database: Settings** shows every view and module (Properties, Peek) with a switch, and under it the settings it has; saved, they apply at once. They are kept in your CONFIG, in a block of their own, where you can set them too: `silverware.database.views.<view>.enabled`, and a view's own `silverware.database.views.<view>.<setting>`, e.g. `config.set("silverware.database.views.count.enabled", false)`; a module's likewise, `silverware.database.modules.<module>.enabled` (`silverware.database.modules.properties.enabled`).
