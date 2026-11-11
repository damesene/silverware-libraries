---
name: Library/damesene/silverware-database
tags: meta/library
description: "Silverware Database: databases of pages, in the spirit of Notion's: one item a page, its properties the page's frontmatter, shown in your pages as a table, a list, a board, a calendar or a timeline. In development."
files:
- silverware-database.js
- silverware-database-init.md
- silverware-database-api.md
- silverware-database-style.md
---
# Silverware Database

Databases of pages, as Notion has them: each item is a page of its own, its properties are the page's frontmatter, and a database is shown wherever you write its block, by a view you pick.

**In development.** What is here: databases kept in your pages, made, changed and undone safely, shown as a table, a list or a board (or by views you write yourself).

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

Write its block where you want it. **`/database`** (or the command **Silverware Database: Insert database**) lists the databases of your space, **New database…** first: the one you pick has its block written at the cursor, New database… asks a name, makes the database beside the page and writes its block (as the command **Silverware Database: New database** does). Written by hand:

````markdown
```silverware-database
id: tasks
```
````

A database can be shown on as many pages as you like, and more than once on one page. Two blocks written exactly alike on one page show only once in SilverBullet 2.12.1 (it renders them as one), and a view picked there is not written, as it cannot tell which of them it is: write them apart in their markdown (another `view:` line in one of them) and both show.

Above it, one bar: at its left, quietly, the database's name and how many items show (a note, not a heading: write one in the page if you want one), then the view shown as one button (its icon, its name, a down arrow), at its right its tools. Pressed, the view's button lists the views (the one shown checked; arrows and Enter from the keys, Esc closes it). The one you pick is written into the block (`view: …`), and so is what a view keeps there (its filter, its sort, prefixed by its name). Its tools:

* **Filter**: a condition for each property, written as in Silverware Table's filter row (`Done`, `!=Done`, `>3`, `/regex/`); every condition has to hold. It applies as you type, and is kept in the block by Enter or once you leave the field (so the block is not written, and drawn anew, while you type); one that does not read is marked red and not applied.
* **Sort**: a property and its direction; *Order by hand* is the order you give items yourself (a board's cards dragged).
* **Undo**: puts this database's last change back, where it is still as it was written (also the command **Silverware Database: Undo**). One that writes 200 pages or more (an option renamed in many items) asks first, and the button shows how far it is while it writes; it waits for no other: while a change is written, Undo says so and does nothing.
* **Full screen**: shows the database over the whole window, its views and tools as they are (the item's panel still opens over it); the same icon (**Exit full screen**) or Esc puts it back in its page. With the module turned off (Settings, Modules), no icon.
* **⋯**: the database's menu, titled with its name: the pencil after it renames the database (its name only: blocks show it by its `id`, which stays). Its entries by what they do: how the view shows (**Visible properties**, **Group**, **Color by**, and what a view of your own adds), the database (**Properties**, **Copy as tasks**), the block (**Edit source**), and last **Delete database…**. **Group** (its submenu) shows any view in groups by a property, as Notion has it: **Group by** picks the property (the one grouped by checked; *None* where the view may be shown whole), and the groups are listed under it to arrange: drag one by its grip (or Alt+↑ ↓ on it) to put it elsewhere in their order, its eye hides it (or shows it again), **Hide all** / **Show all**, and **Hide empty groups** leaves out those without items. The order and what is hidden are kept in the block, for that property: another property picked starts over. A list grouped is drawn once per group, each under its title and how many items it has (a click folds it; folded groups are kept in the block), an item added in a group gets its value. A table grouped is one table: each group under its title, with its own header row and **+ New**, and every group's columns as wide as the others' (folding a group moves no column). A select's groups are its options in their order (empty ones too, so you can add there), then values that are none of them; a multiple select's item is in the group of each of its values (a reference's in the group of each page it names); a checkbox's are *Checked* and *Unchecked*; any other property's (text, a number, a date) a group per value, in the order sorting gives them; items without a value in a group of their own, first. On a board the groups are its columns. **Edit source** shows the block's own text to edit it as markdown (the cursor put into it; move the cursor out of the block and the database shows again). A click anywhere else in the block, or beside it on its lines, keeps the database shown. **Delete database…** (also the command **Silverware Database: Delete database**, which asks which one) deletes the database: first it reads every page to find its blocks (how far it is shown), then says what goes (its items' pages with their content, its own page, and the pages its blocks are taken out of), and deletes only once you type the database's name. It is written whole or not at all: an item changed meanwhile leaves everything as it was, said why. **Undo** (the command **Silverware Database: Undo**) brings it all back, the blocks too, as long as the window stays open; once SilverBullet is reloaded, it cannot. A block of it inside a list item is left (the dialog names its page: take it out by hand). If another page took the database's own page's name meanwhile, Undo says so and can be tried again once that page is out of the way. If another page took an item's name, Undo brings back the rest and keeps that item as a page of its own, `Recovered/<its name>` (outside the database, so not an item of it), and says so. Other pages in the database's folder, and queries of your own, are left as they are.

## The views

* **Table**: a row per item, a column per property. Click a value to change it, or reach it with Tab and press Enter or F2: Enter or a click elsewhere saves, Esc puts it aside; a value you leave as it was is not written. A value typed that does not read (`1,000` as a number) is not written, and you are told. A checkbox turns at once; **Open** (a page's icon at the name's right end as you hover its row, with the word where the column has room) opens the item; ✕ removes the item (asked first); a header sorts by its column. A value that does not read as its property's type shows in red, its reason on hover, and is kept as it is until you change it.
* **Table** and **List**: a row's grip (shown as you hover it) drags it to its place by hand, Alt+↑ ↓ from the keys; while a sort is on, the grip rests.
* **List**: an item a line, its name (a click shows it in the peek) and its values, those of the properties it hides (**Visible properties** in ⋯) left out.
* **Board**: a column for each group of its items by a property, any property: the one picked under **Group** › **Group by** in ⋯, else the first select, else the first property. A select's columns are its options (then one for any value that is none of them, so no item is out of sight), a multiple select's card is in the column of each of its values, a checkbox's columns are *Checked* and *Unchecked*, any other property's a column per value; first one for items without a value where there are any. Its columns are ordered and hidden under **Group** as any view's groups. Drag a card to another column or within one (near the board's edge it scrolls): it gets that column's value (a multiple select's card dragged from one of its columns has that value replaced, its other values kept; a property not changed by hand, its column stays); its column changes too by its value, in the table or the item's peek. **+ New** adds an item in its column.
* **Calendar**: a month of days, each item on the days it lasts: from its **Start** to its **End** (two properties picked in ⋯: a date or a date and time, Created and Modified too; the first such and no end by default, each item then a day alone). An item lasting several days is a bar across them (cut at a week's edge, its ends dashed there); its time before its name where it starts. **‹ ›** step the months, **Today** comes back; the month shown is not written into the block. A day's **+** (shown as you hover it) adds an item on that day; an item pressed opens it; dragged by its body onto another day, it moves there whole (its length and times kept); its ends' handles (shown as you hover it) change its start or its end alone (an end before the start is refused, said; an item a day alone gets an end so). The items without a start are over the month (**No Start · 3**, folded by a press), dragged onto a day to give them one; an item whose start reads as no day (`soon`) is not dragged: its text would be lost. A week of many items shows three rows of them and **+N more**, which shows 50 rows more each time it is pressed (**Show fewer** goes back); the picked day's items and those without a start are listed 100 at a time (**Show 100 more**), so a calendar of thousands of items stays quick. A day pressed is picked: where the database is narrow (a phone, a narrow column) the bars are marks, and the picked day's items (those lasting over it too, with their days) are listed under the month, whole, with **+ New**. Weeks start on Monday (**Week starts on** in Settings, under the views). A property not changed by hand (Created) offers no + and no drag.
* **Timeline**: a row each item, in the view's order, its bar from its **Start** to its **End** (picked in ⋯ as the calendar's, each view its own) on an axis of days; the names stay on the left as it scrolls sideways. The button in its top left corner folds the names to a strip (the bars name their items; the strip shows their icons, else their names' first three letters; a row without a bar names its item) and back; your browser keeps it so for that database, and where the timeline is narrow (a phone) it starts folded. **Days**, **Weeks** and **Months** set how wide a day is (kept in the block); **Today** scrolls to today, marked by a line; weekends are shaded lightly (Days), weeks lined (Weeks). A bar pressed opens its item; dragged by its body, it moves a day at a time, its length and times kept (with a finger, a bar is taken once held a moment, so a swipe scrolls the timeline; dragged near the timeline's left or right edge, it scrolls on, as a board's card does); its ends' handles (on a bar wide enough for them) change its start or its end alone (an end before the start is refused, said); **Esc** while dragging puts it back. The axis goes at most five years either side of today: an item past that (a year typed wrong) is drawn at its edge, its ends dashed. From the keys: **Alt+← →** move a bar, **Alt+Shift+← →** its end. An item without a start has no bar: its row says so (*No Due: press a day*), a dashed day under the mouse shows where a press puts it, and the press gives it that day. An item whose start reads as no day (`soon`) shows its name in red, its row saying why, and is not moved: its text would be lost. A property not changed by hand (Created) is not dragged. Grouped (**Group** › **Group by** in ⋯, any property, as the other views), its groups share one axis: each group's head (its value and how many items, folded by a click) over its items' rows; an item in several groups (a multiple select) has a row in each.

Long text wraps, as in Notion: a table's cell is at most 24em wide (a date and a number stay on one line), a board's columns are all one width (16em), a list's line wraps. A `space-style` block sets other widths:

```css
.swd-place {
  --swd-cell-max-width: 30em;
  --swd-column-width: 20em;
}
```

## Properties

**Properties** (under ⋯ beside the views) opens the database's properties: change a property's name, its type, a select's options, its place in the order, or remove it; add one with its name and type. Nothing is written as you go: each property you change is marked in the list (*Changed*, *New*, *Removed*) and **Save** at the dialog's foot writes it all as one change, which one Undo puts back; **Cancel** (or Esc, or ×) asks first where you changed something. The same goes for the dialog opened from the item's peek. **Icon** gives a property an icon of its own (an emoji, or a monochrome icon; picking needs [Silverware Icons](https://github.com/damesene/silverware-libraries/blob/main/silverware-icons/silverware-icons.md) installed) in place of its type's icon (in **Properties**, the item's peek, and before its name in a table's header); **Remove** in its picker gives the type's back. **Name in views** (any property but a checkbox, which shows its name already: ✓ Done; a system one's too) shows its name before its value where the value stands alone, on a card and in a list (`Status: Todo`); a table's header names it already, so a table shows the value alone, and an empty value shows nothing. Under **Advanced**: its key (how pages and queries name it; changed, it is changed in every item's page and in the database's views on every page, their filter, sort, Group by, Color by and a calendar's or timeline's Start and End, every page read first to find them, how far it is said; Undo puts back the items and those views together, a view changed by hand since left as it is and said; a query of your own naming it is yours to change) and **Locked in views** (no view offers to change it, for values a script or another tool keeps; the page itself can still be edited by hand). Where your changes touch items or views (a key, a type, options renamed, values taken off), **Save** first shows how many items they change, how many pages it writes (each item is a page; keep the window open until it is done), on which pages it updates the database's views and which values it keeps as they are (a value that does not read as the new type is never emptied), and they are written only when you apply them (**Back** returns to your changes, nothing written); changes to the properties alone are written at once. **Values outside the database…** (under the new property's field) lists the keys the items keep in their pages that no property is: a property removed with its values kept, a key typed in a page, another tool's (but those starting with `_`, and those SilverBullet gives every page). Read only as you open it. Each with how many items keep it and a few of its values: **Add** makes it a property again, of the type picked (the one its values look like, to start with), its values shown again once you save; **Remove from pages** takes it off the items keeping it, shown first as any change of items.

A property removed is marked *Removed* until you save (**Keep it** takes that back), with a switch **Also take its values off the items**: off (as it starts), its values stay in the pages and show again if the property comes back; on, Save first says how many items it takes them off.

A select's options are edited as a list, each with its color, and saved with the rest; a new one is typed under them and added by Enter or **Add** beside it. **Multiple** (a select's switch, under its options) lets an item pick several of them, kept as a list in its page (`labels: [ui, docs]`): turned on, each item's option becomes a list of it; turned off, a list of one becomes that option again, and a list of several is kept as it is, shown as none of the options (the review says which items). An option renamed renames the items' values too, in the same change (in a multiple select's list only that value, the order kept), and two options can swap names: the review says how many items each rename changes (*3 items: Todo → To do*), and Undo puts all of it back in one step. Each item is a page of its own, so the review also says how many pages the change writes (the database's own page with them); from 200 on it says that this takes a while, and **Apply** shows how far it is. Keep the page open until it is done: stopped halfway, the items not written yet keep their old values, shown as none of the options. If any item changed between the review and **Apply**, nothing is written and you save again; if the properties were changed elsewhere since you opened the dialog, Save writes nothing and offers **Show conflict** at the dialog's foot: the database's page as it is now and as your changes would make it, **Write mine** writing all of your changes over theirs (one change, Undo puts it back), **Keep theirs** back to your changes. An option taken away leaves its values in the items, shown as none of the options, and so does a value typed by hand that is none of them. Two options are never put into one: a rename onto a name another option has (kept or taken away), or onto a value items hold that is none of the options, is refused.

A property is optional; **Required** in its details makes it required (not a checkbox: unticked is its value), marked * in the list: an item without a value shows it missing (*Required* in red in the table and the peek, a dashed pill in a list's line and on a card, the board's column of none in red), and a value of it is never emptied (said so). An item can still be added without one, to be filled in later.

**System properties** (in **Properties**, the new property's type list, under *System*): values the database gives, which no one types and no view changes. **Created** and **Modified**: when the item's page was made and last written, as SilverBullet keeps them for the page's file (moving an item in the order writes its page too, so it changes Modified; a page copied or restored from a backup may get new dates). **Order**: the item's place in the order by hand, 1, 2, 3…, counted over the whole database, the same whatever a view filters or sorts. **Page**: the item's page. **Tags**: its page's tags, but the database's own, each a quiet label (no options to pick from, none of them marked). **Task progress**: how much of the tasks in its page is done (`- [x]` of all `- [ ]` and `- [x]`, as SilverBullet indexes them, a state your `taskStates` call done too), as a percent with a short bar (100% only when all are done), empty where the page has no task; sorted by it, filtered by its percent (`>50`). Each can be added once; its name can be changed, it can be hidden, moved or removed, nothing else. Its values are never written into the items' pages (a key of the same name typed into a page by hand stays as it is, not shown), and it can be sorted, filtered and grouped by as any property.

Each view shows the properties it does not hide: **Visible properties** in ⋯ lists them, each with its eye (hidden or shown at once, the menu staying open), and **Hide all** / **Show all**. What a view hides is its own, kept in its block (`table.hiddenProperties`): a table may hide what a board shows. A property a view hides keeps its values in the pages; the bar's filter and sort still offer it, the view can still be grouped and colored by it, and an item's peek shows every property, in the same order whatever a view hides: those hidden in the view you opened it from have their name fainter and a struck-through eye after it (its tooltip names the view), and are edited and moved as any other. A property added shows in every view until one hides it. The calendar and the timeline show none until you show it (their room is small): the calendar each one a line under the item's name, the timeline after the item's bar on its row; a property added stays hidden there (they keep those shown, `calendar.shownProperties`).

**Apply to all views**, at the end of **Visible properties**, **Group** and **Color by**, gives what this view has of it to every other view of the same block (only that block): the same properties shown, the same grouping with its groups' order and hiding, the same colors. A view that cannot take it keeps its own and is named in the message (the calendar is never grouped, so it keeps no grouping).

A **Time** is a time of day (`14:30`), a **Date & time** a day and its time (`2026-11-08 14:30`), each edited in the browser's own field and kept as text in the page (`at: "14:30"`). A **Date** and a **Date & time** read each other's values, so changing a property from one to the other (and back) changes no page and loses nothing: a date shows a value's day and keeps its time (another day picked, the time stays), a date and time shows a day alone without a time (none made up for it). Changed to a **Time**, a date and time keeps its time, its day goes; a date alone stays as it is, shown invalid. Grouped by a date, items are grouped by their day; a card dragged to another day keeps its time. A **URL** is a link to open in a tab of its own (typed without its scheme, `google.com` or `www.google.com/maps`, it is a web address; `me@x.dev` a mail address): shown without `https://` and `www.`, its address's path a little quieter; it can have a text of its own shown in its place, set in its editor beside its address (kept as a markdown link, `[Docs](https://…)`). A press on the link opens it; a press beside it edits it (in the item's panel, the pencil after it too). A select's list opens as soon as its value is pressed.

A **Reference** links an item to other pages of your space, one or several: picked in its editor (search by any words of a page's name; the pages picked first, a box each; a name no page has yet offered as *New*, a link to a page to make, unless a page cannot have it, said why (`#` and `@` in a name are a heading and a place in SilverBullet); Enter in the search ticks the first found, Enter again saves), shown as links (a page in a folder by its name, its folder quieter before it; a press or Enter opens the page, a press beside it edits it). In the item's panel the editor opens in the property's row (as a multiple select's and a URL's do), each page by its name with its folder under it. To make a new page in a folder: the folder icon after a page's name puts that page's path in the search (`Projects/Alpha/`: a page under it), a press on its folder puts the folder's (`Projects/`: a page beside it); the pages there are found, and a name typed after the path is offered as *New*. A link's own text (`[[People/Ada|Ada]]`, typed in the page) is shown and kept. Meta pages (libraries, CONFIG, templates) are not offered. Each is kept in the item's page as a wiki link in a list (`related: ["[[Projects/Alpha]]", "[[People/Ada]]"]`), so the page it names lists the item among its links, a query reads it as any link, and renaming that page renames the link with it: SilverBullet does that, for links in a frontmatter list since its builds after 2.12.1 (2.12.1 renames a frontmatter value only where it is one link alone, not in a list). Grouped by a reference, an item is in the group of each page it names, as a multiple select's in each of its values'.

A select's values show as colored pills. Each option has the color of its place among the options, unless you give it one: in **Properties**, press an option's pill and pick its color (**Auto** takes it back). **Custom…** picks a color of your own. Colors are kept with the property in the database's root page (`colors: { Done: green, Blocked: "#c0392b" }`: gray, blue, green, yellow, orange, red, purple or pink, or your own as `#rrggbb`; every color is mixed with your theme's; a color of your own too light or too dark to read is shown lighter or darker, its hue kept), and a change of them is written with the rest on Save and undone by Undo. An option renamed in **Options** keeps its color. A value that is none of the options shows with a dashed red edge.

A **Person** is a select of people: its options are their names, picked and colored as a select's (**Multiple** too), each shown as SilverBullet shows a mention, `@ada` (an option given a color of its own in **Properties** shows in it; **Auto**, the mention's look), and pressed as one: SilverBullet's **Mention Inbox** opens on that name beside the page, as for a mention in the page's text (a person's value is no mention SilverBullet counts, so the inbox lists where the name is mentioned in text). It is kept in the item's page by the name alone (`owner: ada`, `owner: [ada, bob]`; edited and offered by the name alone, as kept: the `@` is only how it shows; a name typed or pasted with its `@` is kept without it, and an option's name is written without it). With **Anyone** on (its switch beside Multiple) a name none of the options is valid too, shown in a color of its own, and its editor is a field you type any name in, offering the options under it (all of them while it is empty, those holding what is typed as you type; ↑ ↓ and Enter, or a click, take one) (with Multiple: the boxes, and under them a field where Enter, or **Add** beside it, adds the name typed, ticked); off, such a name is kept and shown as none of the options, as a select's, and picked from the options alone.

The table is a basic one: with [[Library/damesene/silverware-table|Silverware Table]], a table of its own over a database (formulas, column types, widths) is to come.

## Peek

A click on an item's name (or a table row's **Open**) shows the item in a panel at the right of the page (on a phone or a narrow window, over the whole page): its name, its values (a click on one edits it, as in the views), its content as text, **Open** for its page (a link: a middle click or Ctrl+click opens it in a new tab), and the bin beside it to remove the item (asked first; what you were typing is written before it goes, and Undo brings the item back with it). A press on a property's name there opens it in **Properties** (its name, type, options, required, hidden, removed), **+ Add a property** adds one, and a property's grip (shown as you hover its row) drags it to its place (Alt+↑ ↓ from the keys). Each is written as you leave its field. Many properties scroll in a box of their own (at most 45% of the window's height; a `space-style` block sets another: `.swd-peek { --swd-peek-properties-max-height: 30vh; }`), so the content stays in view under them; the panel's controls and the item's name stay at its top however it scrolls. If the content was changed elsewhere since the panel showed it, what you typed is not written over it: it stays in the field with a note, and **Load the content as it is now** replaces it only once you agree. Esc, a click beside the panel or opening another page closes it (not while it holds content that could not be written). The panel is 600px wide (at most four fifths of the editor's area); drag its left edge to set another width, or set **Width** under Peek in Settings: it is kept in CONFIG, for every database (a double click on the edge, or ← → when it has the focus: its default again, or 40px wider or narrower). With the module turned off (Settings, Modules), a click opens the item's page.

Over its name, an item gets an **icon** and a **color** (shown as you hover the panel where it has none): **Add icon** opens the picker of [Silverware Icons](https://github.com/damesene/silverware-libraries/blob/main/silverware-icons/silverware-icons.md) (its icons and emoji, their groups, a search by name, those used last first; **Remove** takes the icon off; without Silverware Icons the picker says so), **Color** a choice of the palette's colors, your own (the browser's color picker) or **None**. Every view shows them: the icon before the item's name (on a card, a calendar's or a timeline's bar too), the color as a stripe by the name in a table, a tint of a list's line, of a card and of a calendar's or a timeline's bar. They are kept in the item's page beside its order (`_database: { icon: "🚀", color: blue }`, an icon picked as `lucide:rocket`), not as properties: no filter, sort or group reads them. An icon or a color typed there by hand that is none (a word, a color of no palette) shows nothing and is left as written.

**Color by** (in ⋯, each view its own, kept in its block) colors a view's items by a property of options (a select; a multiple select its first value): each item in its value's option's color, so a bar, a card or a line says its status at a glance, and changes as the value does or as the option's color is changed in **Properties**. An item's own color comes first.

## Tasks made a database

Select a list of tasks and run **Silverware Database: Convert selection to database** (with nothing selected: the task at the cursor and what is under it). You are asked for the database's name; it is made beside the page and its block, a board by Status (where the board is on), is put under the lines, and the lines stay selected: press Delete where you no longer want them.

* Each task at the list's top level is an item; what is under it (subtasks of any depth, other lines) is the item's text.
* Its name is the task's text without its attributes (a line under the task with no blank line between is its text going on, as SilverBullet reads it: put a blank line before what is to be the item's text); a hashtag, mention or link within a sentence stays as a word, those at its end are left out. Where the name is not the task's text, that text is the first line of the item's, so nothing is lost. What a page's name cannot hold (`/`, `#`, `@`…) becomes a space; a name taken gets `(2)`.
* Its properties: **Status**, always with *Todo*, *In progress* and *Done*: from an attribute `[status: …]` or `[state: …]` where the task has one, else `[ ]` *Todo*, `[x]` *Done*, a state of its own (`[Waiting]`) as written; whatever the case (`[IN PROGRESS]`, `[status: in progress]` are *In progress*), a state not among them added before *Done*. Then one for each other attribute, its type from the values (`[due: 2026-11-12]` a date, `[estimate: 3]` a number, `[owner: @ada]` a person, `[project: [[Web]]]` a reference, `[area: [web, api]]` or one name given twice a select of several options, anything else a text); **People** (the mentions), **Links** (the wiki links) and the page's **Tags** (the hashtags), where a task has any.
* **Copy as tasks** in a view's ⋯ puts the items it shows (filtered, in its order) on the clipboard as tasks: Status as *Todo* `[ ]`, *Done* `[x]`, another as `[ ]` with `[status: In progress]` after the name (a task in any markdown, its status read back by the conversion; in a database without a Status, its own checkbox `done` ticked is `[x]`), People, Links and Tags as mentions, links and hashtags after the name, the other properties as attributes (`[due: "2026-11-12"]`). An item's text is not copied.
* All of it is one change: **Silverware Database: Undo** takes the database away again (its block stays in the page, to remove by hand). A hashtag a page cannot have as a tag (`#db`, the database's own) stays in the item's text only.

## Nothing lost by mistake

* A change is written only where what it changes is still as it was shown: a value, a name or a look changed meanwhile (by hand, elsewhere) is left as it is, and you are told. What else of the item changed meanwhile is kept, as only that one thing is written, so a name typed and left and a status picked at once are both written. The notification stays until you close it; its **Show conflict** shows each page's markdown as writing yours would change it (the lines as they are now and as they would be), **Open** for the page (a link: a middle click opens it in a tab of its own), **Keep theirs** and **Write mine**, which writes yours over it (undoable; where it changed again meanwhile, a new conflict is shown instead).
* Removing items asks first, and a change can be undone (where a view offers Undo): what is still as it was written is put back.
* A value that does not read as its property's type is kept as written and shown as invalid, never emptied; a property removed from a database keeps its values in the pages.

## Your own views and types

Views and property types of your own are JS modules of your space, given to Silverware Database in a `space-lua` block:

```lua
silverware.database.defineViews(js.importFromSpace("Library/me/views.js"))
silverware.database.defineTypes(js.importFromSpace("Library/me/types.js"))
silverware.database.defineConverters(js.importFromSpace("Library/me/converters.js"))
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
| `label`, `icon` | How the view picker and its menu show it (the icon a character, or an icon of Silverware Icons: `"lucide:kanban"`) |
| `properties` | Optional: `false` where the view shows no property beside an item's name (no **Visible properties** in ⋯); `{ hiddenByDefault: true }` where none shows until the user shows it (a property added stays hidden in it) |
| `colors` | Optional: `false` where the view draws no item's color (no **Color by** in ⋯) |
| `groupBy` | Optional: how the view is grouped (**Group** in ⋯). By default the place draws it once per group, the view knowing nothing of it (its `host.items` and `host.total` are the group's, an item it adds gets the group's value). `false`: never grouped. `{ types, prefer, required, draws }`: the types of property it groups by (`["select"]`; left out, every type), `required: true` where it always is (no *None*; where none is picked, the first property of a type in `prefer`, else the first), `draws: true` where the view draws its groups itself, reading them as `host.grouping` (the board) |
| `settings` | Optional: its settings, each `{ key, label, hint, control, choices, default }` (`control`: `switch`, `number`, `text` or `choice`), shown in **Settings** under the view and read with `host.setting(key)` |
| `menu(host, menu)` | Optional: the view's own entries in ⋯, asked as it opens. `menu` makes them as values: `menu.item({ label, icon, run, checked, disabled, hint })`, `menu.submenu({ label }, () => [entries])` (shown in the menu's place, a way back), `menu.separator()`; give them back in groups, `menu.slot.view([entries])` (how the view shows its items, beside Group by) or a section of their own, `menu.slot.custom({ name, position: "primary" or "secondary" }, [entries])`. An entry chosen closes the menu |
| `render(host, element)` | Draws the view into `element`. It may give back `{ update, destroy }`: `update()` is called when the data change (without it the view is drawn anew), `destroy()` when it goes |

`host` gives:

* `document` (draw with it rather than the global one), `database` (its name and `properties`: each `{ key, label, type, params, readonly }`), `items` (filtered and sorted as the place shows them: each `{ key, name, values }`, a value read as `item.values[property.key]`; `key` tells items apart, nothing to read in it) and `total` (every item's count);
* `text(item, key)` a value as it shows (`"name"` the item's name), `type(property)` its type;
* the writes: `update(item, key, value)` (`undefined` takes the value off), `create({ name, values, body }, place)`, `rename(item, name)`, `remove(items)` (asked first), `move(item, { after, before, values })` and `undo(progress)` (`progress(done, of)` told as it writes, optional). Each is checked (a value is a text, a number, `true`/`false`, `null` or a list of texts), written only where what it changes (the value, the name, the look, the values a move sets; for a removal, its name, every value and its look, each item apart) is still as the view read it, on the item as it is now (what else of it changed meanwhile kept; a move's place reckoned from its neighbours as they are now), and undoable. One not done gives back `{ problem, cause }`: `invalid` (refused, said to the user) or `left` (the item changed since, said), `declined` (the user said no) or `unchanged` (nothing to do);
* `open(item)`: the item in the peek (or its page);
* `listing`: the place's filter, sort and grouping (`filter`, `sort`, `group`: the key picked under Group by, or none; `groupArrangement`: `{ order, hidden, hideEmpty }`, the groups' keys in the order given them and those hidden; `setFilter(key, condition)`, `setSort([{ key, direction }])`, `setGroup(key)`, `setGroupArrangement({ … })`, `validateCondition(condition)`);
* `look`: how the view shows its items: `shownProperties` (the properties it shows, in the schema's order: draw these, not `database.properties`), `hiddenProperties` (the keys of those it hides) and `setHiddenProperties([keys])`, `colorBy` (the key of the property its items are colored by, or none) and `setColorBy(key)`; `icon(item)` an item's icon drawn (an element, as large as the text around it: your CSS sizes it, `.swd-item-icon`), none where it has none; `ownIcon(value, className)` an icon of the user's (a property's own: an emoji, `lucide:house`) drawn so, in a span of your class; `item(item, element)` its color (its own, else its value's of the property the view is colored by) put on the element that draws it (`data-swd-item-color` and `--swd-item`, its `r, g, b`: `background: rgb(var(--swd-item))`), taken off where it has none;
* `grouping`: where the view draws its groups itself (`draws: true`), `{ property, groups }`, the groups as shown (arranged, the hidden ones left out), each `{ key, label, value, known, items }` (`value`: what an item put there gets, a multiple select's a list of it; none for the group of none); else none;
* `getMeta(key)` and `setMeta({ key: value })`: what the view keeps in its block, under its name (`mine.size`; `filter`, `sort`, `groupBy`, `colorBy`, `hiddenProperties`, `shownProperties` and `folded` are the place's own, not to be used for anything else), `setting(key)` its settings, `refresh()`, `notify(message)`.

Write only from what the user does (a click, a key), never while `render` or `update` draws: a write draws the view again, which would write again.

`HELPERS` are the built-in views' own editors: `editValue(host, cell, item, key, show)` edits a value in `cell` by its type (a date field, a list of options…) and writes it as you leave it, nothing written you did not change, then calls `show` to draw the cell again; `toggle(host, item, key)` turns a checkbox; `shownValue(host, item, property)` a value as a card's line shows it, as text; `valueNodes(host, item, property)` a value drawn as the built-in views draw it (options as pills, a link to open…) where a header names it, as a table's cell; `fieldNodes(host, item, property)` the same where the value stands alone, as a card's line, its property's name before it where **Name in views** is on; `NAME`, the key that renames (`editValue(host, cell, item, HELPERS.NAME, show)`).

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
| `parse(text, params, was)` | A text typed made a value, `{ value }`, or why not, `{ problem }`; an empty text an empty value (`null`). `was`: the value it replaces, where there is one (a date keeps its time from it) |
| `sortKey(value, params)` | Optional: what sorting compares, where it is not the text |
| `lists` | Optional: `true` where its values are lists (grouped by it, an item is in the group of each of its values) |
| `groupValue(value, params)` | Optional: the value of the group a value is in, where values of one group differ (a date's day, whatever its time); an item moved there gets it through `parse(text, params, was)`, keeping what it had of its own |
| `validateParams(params)` | Optional: why a property's `params` are not the type's |
| `editor` | Optional: the field its values are edited in: `"select"` (one of its options), `"multi-select"` (boxes of them), `"date"`, `"time"`, `"datetime-local"` (the browser's own fields), `"link"` (an address and its text), `"toggle"` (no field: a press turns it between true and unticked, never required; with the look `"check"` alone), `"documents"` (pages of the space picked, a list of wiki links); a text field where none |
| `look` | Optional: how a value shows where not as its text alone: `"options"` (pills, its options edited in **Properties**), `"share"` (a bar of a number from 0 to 1), `"link"` (a link to open), `"check"` (a box, ticked where the value is true; with the editor `"toggle"` alone), `"documents"` (links to the pages it names, opened by a press), `"labels"` (a list of texts as quiet pills, no options; with `lists: true`) |

A value is a text, a number, `true`/`false`, `null` or a list of texts. `HELPERS` are `keptText(value)` (a value as it is kept, as text), `isEmpty(value)` and `isValue(value)`.

A type that throws or gives back the wrong kind of answer breaks nothing: the value shows as it is kept, a text typed is not written, and what failed is said once for each of its methods.

### Converters

A converter reads the lines selected for **Silverware Database: Convert selection to database**; where more than one reads anything, you pick which.

```js
// Library/me/converters.js: a markdown table, each row an item named by its first cell, the other columns its properties
export default (HELPERS) => [
  {
    name: "table",
    label: "Table",
    description: "A markdown table: each row an item",
    read: (text) => {
      // (The first table of the selection, under a heading or in a list too)
      const table = HELPERS.allBlocks(HELPERS.readBlocks(text)).find((block) => block.kind === "table");
      if (!table || !table.rows.length) return undefined;
      const keys = new Set();
      const columns = table.header.slice(1).map((label, at) => {
        // (A key of each column's own: two columns of one label, or none, apart)
        let key = HELPERS.keyFromLabel(label);
        for (let n = 2; keys.has(key); n++) key = `${HELPERS.keyFromLabel(label)}_${n}`;
        keys.add(key);
        const values = new Map(table.rows.flatMap((row, i) => {
          const value = HELPERS.readValue(row[at + 1] ?? "");
          return value ? [[i, value]] : [];
        }));
        return HELPERS.inferProperty(key, label || key, values);
      });
      return {
        properties: columns.map((column) => column.property),
        items: table.rows.map((row, i) => ({
          name: HELPERS.plainText(row[0] ?? ""),
          values: Object.fromEntries(columns.flatMap((column) => (column.values.has(i) ? [[column.property.key, column.values.get(i)]] : []))),
        })),
      };
    },
  },
];
```

A module of converters may be a function: it is given `HELPERS`, what the built-in converters read with, of no kind of block:

| Helper | What it gives |
|---|---|
| `readBlocks(text)` | The text's blocks as a tree, as SilverBullet reads markdown (a frontmatter at its start left out; a bar within a table's cell escaped by a backslash): `heading` (`level`, `text`, `children`: its section, `title`: its own lines), `item` (`list`, `number`, `task` `{ state, done }`, `text`: the paragraph it starts with, lines going on it without a blank line too, `title`: that text's lines, `children`: the blocks after it, `body`: those as written, without the list's indentation), `quote` (`children`), `paragraph`, `html` and `comment` (`text`), `code` (`language`, `text`; indented code too), `table` (`header`, `rows`: cells), `rule`; each with `lines` `{ from, to }`, the lines it was read from |
| `allBlocks(blocks)` | Every block of a tree, depth first in the text's order (a table under a heading, in a list, in a quote) |
| `readLine(line)` | One line's block: `kind` (as above, or `bullet`, `numbered`, `task`, `blank`), `indent`, `marker`, `content` and where it starts, `contentFrom`; a heading's `level`, a numbered item's `number`, a task's `state` and `done`; `item` where the line starts with a list's marker, whatever its kind (`{ kind, marker, content }`) |
| `inlineMarks(line)` | A line's hashtags, mentions, wiki links and attributes, each with its name (an attribute's value as written) and where it is |
| `plainText(text)` | A text without its attributes, its hashtags, mentions and links within a sentence as words, those at its end left out (a task's name is made so) |
| `readValue(text)` | A value as written (an attribute's, a cell's): `{ kind: "people", names }`, `{ kind: "links", targets }` or `{ kind: "plain", value }` (YAML: a number, `true`, a list…); `undefined` where it is empty |
| `joinedValues(a, b)` | Two values of one key as one list |
| `inferProperty(key, label, values)` | A property for a key's values (a `Map` of an item's index to its `readValue`), its type from them (number, date, date and time, checkbox, person, reference, select of several options, text), and each value as that type keeps it: `{ property, values }` |
| `keyFromLabel(label)`, `labelOfKey(key)` | A property's key from a label (`Due date` → `due_date`), and back |
| `writeAttribute(name, value)`, `writeTaskLine(state, text)`, `escapedAttributes(line)` | For `write`: an attribute SilverBullet reads back, a task's line, a line whose attributes read as none |
| `tasks` | The built-in tasks converter, to build on (its `read`, its `write`) |

| Field | What it is |
|---|---|
| `name`, `label`, `description` | How it is named (lower case letters, digits and `-`; one of a built-in one's name replaces it: `tasks`), shown and described when you pick |
| `read(text)` | The lines selected, whole, read: `{ properties, items, view }` (`view` optional: `{ name, groupBy }`, the view the database's block shows first and the property it groups by, as the tasks' `{ name: "board", groupBy: "status" }`), or `undefined` where they hold nothing it reads |
| `write(items, properties)` | Optional: the items a view shows (each `{ name, values }`, its values by key) and the database's properties (each `{ key, label, type, params }`) as such a text; a view's ⋯ then offers **Copy as** its label. One that throws copies nothing, said why |

`properties` are those the items need: `{ key, label, type, params }` (`type` a property type's name, `params` its settings, as `{ options: ["a", "b"], multiple: true }`). `items` are `{ name, values, body, tags, source }`: `values` by a property's key; `body` the item's text; `tags` its page's tags (with a property `{ key: "page_tags", label: "Tags", type: "tags", system: "tags" }` to show them); `source` the text it was read from, put first in its text where its name is not that text. A name a page cannot have, or one taken, is made one, as for tasks.

## Settings

The command **Silverware Database: Settings** shows every view and module (Properties, Peek) with a switch, and under it the settings it has; saved, they apply at once. They are kept in your CONFIG, in a block of their own, where you can set them too: `silverware.database.views.<view>.enabled`, and a view's own `silverware.database.views.<view>.<setting>`, e.g. `config.set("silverware.database.views.count.enabled", false)`; a module's likewise, `silverware.database.modules.<module>.enabled` (`silverware.database.modules.properties.enabled`).
