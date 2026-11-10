# Silverware Database: converters (plan)

Talked through with the user on 2026-11-10. Nothing built yet.

A **converter** turns text selected in a page into a database: the first one makes a database of tasks
(`- [ ] Call the client [due: 2026-11-12] @ada #sales`). Converters are registered as views and types are
(`silverware.database.defineConverters` on the API page; the built-in ones through the same API). The way back, a
database to markdown, starts as *Copy as tasks* to the clipboard; a conversion in place may come later.

## Decided (2026-11-10, with the user)

1. **Into a new database only, for now.** Adding to an existing database comes later, so the code keeps that door open
   (*Shape*: a converter reads, a target writes).
2. **The selected text stays.** The database's block is put under it (the selection widened to whole lines, the block
   after the last of them) and the selection stays on the text, unchanged: Delete takes the original away. Without a
   selection, the caret's line and the lines under it (its subtasks, *5*) are converted.
3. **An item's name** is the task's plain text, before and after its attributes, spaces collapsed, cut at about 100
   characters, without what a page's name cannot hold (`@ # | < > $ [[ ]]`); a name taken gets `(2)`, `(3)`… after a space. Wherever
   the name differs from the task's line, the line goes whole to the top of the item's body: nothing is lost.
4. **Marks in the text** (`#tag`, `@name`, `[[link]]`), one rule for the three: inside the sentence the word stays in
   the name without its mark (`Ask @jana about the budget` → `Ask jana about the budget`); a run of marks at the end of
   the text (after its last plain word) is taken out of the name. Every mark goes into its property whichever it is:
   tags into the page's tags, people into `people`, links into `links`.
5. **Everything under a task** (subtasks of any depth, other lines, any markdown) goes into its body, its indentation
   shortened by the task's own, so subtasks stay tasks there.
6. **A key given twice** (`[prop: a] [prop: b]`) is one multi-valued property, as a YAML list (`[prop: [a, b]]`) is.

### The mapping

| In the task | Property | Type |
| --- | --- | --- |
| `[ ]` / `[x]` | `done` | toggle |
| a state of its own (`[IN PROGRESS]`) | `status`, only where some task has one (`x` is then a state too) | select |
| `#tag` (any number) | the page's tags (`tags: [db, sales]`), shown by the system property `page_tags` | tags |
| `@name` (any number) | `people`, Multiple, *Anyone* on, its options the names found | person |
| `[[link]]` in the text | `links`, Multiple | reference |
| an attribute: a number | its key | number |
| an attribute: a date, a date and time | its key | date, datetime |
| an attribute: `true` / `false` | its key | toggle |
| an attribute: `[[Page]]` | its key | reference |
| an attribute: `@name` | its key | person |
| an attribute: a YAML list, a key given twice | its key | multi-select (person or reference where its values are people or links) |
| an attribute: anything else | its key | text |
| the order in the text | the items' rank | |

* **One type a property over every item**: values of different kinds (a number here, a text there) make it text;
  Multiple is on where any item has more than one value.
* Several `@name` go into one `people` (Multiple), not a property each: the text does not say who is the owner and who
  the reviewer, so properties of their own would have no names that mean anything. Who wants roles writes
  `[owner: @ada]`, which is a property of its key.
* **Tags are the page's tags** (decided over a multi-select `labels`): a tag in SilverBullet stays a tag (`#sales`
  lists the item). The database shows them by the system property `page_tags`, read only today. **Editing them comes
  later by making that same system property writable, not by a new type**, so the databases a converter makes now
  need no migration then. For now the store writes the tags beside `db` as an item is made (memory and pages stores,
  a case in `store/contract.ts`).

## Verified: SilverBullet's attributes (its main, 2026-11-10)

* `client/markdown_parser/parser.ts`: `attributeStartRegex = /^\[([\w$]+)(::?\s*)/`. A name is ASCII letters, digits,
  `_`, `$` (no dash, dot, space nor diacritics: a property `úkol` cannot be an attribute); `[name: value]` or
  `[name:: value]` (Obsidian's form).
* The value runs to the matching `]`, brackets inside counted; no escaping (an unbalanced `]` ends it); a `]` followed
  by `(` is a link, not an attribute.
* docs.silverbullet.md/Attribute: values are read as YAML (`[a: 10]` a number, `[a: [x, y]]` a list).
* docs.silverbullet.md/Task: a task's state cannot hold `:` (it would be an attribute); states of its own exist
  (`[IN PROGRESS]`).
* **Written back** (*Copy as tasks*): a key that is no attribute's name is left out (or written as text, to decide in
  that step), a value as a YAML flow value, quoted where it is not plain or its brackets do not balance, a space after
  each attribute; a list as `[key: [a, b]]`, never a key twice.

## Probed in SilverBullet (2.12.1, 2026-11-10: a page written through `space.writePage`, its `task` objects read)

* **A key given twice: the last wins** (`[prop: a] [prop: b]` → `prop: "b"`). Merging them into a list (*Decided*, 6)
  is ours on purpose; written back, a list is always `[key: [a, b]]`.
* A task's **`text`** is its line after the state, whole; its **`name`** is that text with the attributes and the tags
  taken out, wherever they are (`Ask @jana about #budget [[Some Page]] #sales @ada` → `Ask @jana about  [[Some Page]]
  @ada`, two spaces left where a mark was), mentions and links kept. Text after an attribute stays in the name. Our
  name follows *Decided*, 3 and 4 instead (a tag inside the sentence keeps its word).
* The task object gives **`tags`** (`["budget", "sales"]`), **`links`** (`["Some Page"]`), **`recipients`**
  (`["@ada", "@jana"]`), `state` (`" "`, `"x"`, `"IN PROGRESS"`), `done`, and each attribute under its key
  (`due: "2026-11-12"` as text, `n: 10` a number, `prop: ["a", "b"]`, `v: "a [b] c"`: brackets inside counted).
* **`[owner: @ada]` gives no attribute at all**: `@` cannot start a YAML value, so the value fails to parse and the key
  is left out, silently. A converter reads `@name` in an attribute as a person all the same (the user wrote it so);
  written back, a person is `[owner: "@ada"]`.
* A subtask has `parent` (the parent's ref); the parent's range covers its subtasks; a line under a task without a mark
  belongs to the task's `text` (`"Child [c: 1]\n    more text"`).
* **The clipboard** needs no probe: Silverware Table's `src/clipboard.ts` writes it in SilverBullet over http in a local
  network too (where `navigator.clipboard` is undefined, a copy event through `execCommand("copy")`); it moves to
  `shared/` for *Copy as tasks*.
* Read by our own parser, not from the index: the selection is converted as the editor has it (the index has the page as
  last saved), and the name and the person in an attribute follow the rules above, not the index's.

## Shape

* **A converter reads, a target writes.** A converter: `{ name, label, description, read(text) → rows, write?(items,
  properties) → text }`; rows are neutral (`{ name, values, body }` and the values seen by key), knowing no database.
  Inferring the schema from rows is a step of its own; writing goes through a target. The one target now is *a new
  database* (the schema inferred, `createDatabase` and the items in one transaction); *an existing database* comes later
  (keys mapped onto its properties, values converted), the converters unchanged.
* **The core** gets generic steps only (a database made with its items in one transaction, definitions checked as
  `defineViews` / `defineTypes` are); the tasks converter is a module (the core knows no markdown).
* **One command**, *Silverware Database: Convert selection to database*, with a choice of converter (or the one whose
  `read` finds anything): commands are defined at start from `commandNames()`, so a converter defined later in Space Lua
  would get no command of its own. Silverware Toolbar needs no code for it: its `commands` module finds the command, a
  user puts it among favourites.
* **`shared/`**: the selection's whole lines and the fenced code blocks (tasks inside code are not converted) move out of
  Silverware Toolbar (`core/context.ts` `linesOf`, `formats/lines.ts` fences); reading and writing a task's line with its
  attributes goes into `shared/pages/` (the one place that knows how anything is written in a page), its tests by
  SilverBullet's rules above.
* **Copy as tasks**: an entry of the place's ⋯ (a menu slot), the view's listing as shown (filtered, sorted) through the
  converter's `write`.

## Steps

1. ~~The probes above~~ (done 2026-11-10).
2. `shared/`: whole lines and fences; a task's line read and written (`shared/pages/`); the clipboard out of Silverware
   Table.
3. The store: an item made with page tags beside `db`; the core: `defineConverters`, a new database made with its items
   in one transaction.
4. The tasks converter, the command, the block under the selection; a UI test.
5. *Copy as tasks* from ⋯.
