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
| `[ ]` / `[x]`, a state of its own (`[IN PROGRESS]`), `[status: …]` / `[state: …]` | `status`, always (*Status instead of Done*, below) | select |
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

## Status instead of Done (2026-11-10, the user's choice after step 5)

* No checkbox **Done**: one select **Status**, always with *Todo*, *In progress*, *Done* (a status added or renamed in
  Properties, a board by it). `[ ]` is *Todo*, `[x]` *Done*, a state of its own (`[Waiting]`) as written.
* An attribute `[status: …]` or `[state: …]` (its name whatever its case) gives the status over the checkbox; it is no
  property of its own.
* A status is matched to the options whatever its case and spaces (`[IN PROGRESS]`, `[status: in  progress]` are *In
  progress*); one not among them is added as first written, before *Done*.
* The database is shown first as a board by Status: `Converted.view` (`{ name, groupBy }`), which the command writes
  into the block (`view: board`, `board.groupBy: status`) where that view exists.
* *Copy as tasks*: *Todo* `[ ]`, *Done* `[x]` (and, in a database without a Status, its own checkbox `done` ticked: in
  one converted, `done` is a task's attribute), another `[ ]` with `[status: …]` after the name (the user's choice,
  2026-11-11: a task's own state, `- [In progress]`, is no markdown task outside SilverBullet), read back as the status.
  Not `[state: …]`: verified in SilverBullet 2.12.1 (2026-11-11), an attribute `state` takes the place of the task's own
  field `state` in the index (`- [x] B [state: Waiting]`: `state: Waiting`, `done: true`), `status` is a field of its
  own. A property of another type keyed `state` or `status` is written with `_2` after its key (read, either would be
  the status).
* A state attribute's value YAML reads as no text (a list, a map, `@ada`) is taken as written; an empty one leaves the
  checkbox's state.
* The view asked for is written only where it is there and on (`silverware.database.views.<view>.enabled`): else the
  block names none and the place shows the first view on. `groupBy` names the converter's key, followed to the key the
  property got (`createDatabaseOf` gives them back as `keys`). A text changed while the name was asked: the block,
  with its view, at the cursor.
* This replaces what steps 4 and 5 say of **Done** below.

## The task's text in the item's page: its attributes escaped (2026-11-11, the user's report)

Verified in SilverBullet 2.12.1: an attribute in a paragraph of a page's body is given to the page, over its frontmatter's
value (`status: In progress` in the frontmatter, `[status: in progress]` in the body: the index has `in progress`; with
`\[status: in progress]`, the frontmatter's). The task's text put first in the item's page (`source`) had its attributes
as written, so a status read ignoring case, a key made another or a value typed otherwise showed wrong (an option
`in progress` none of Status's). The source is written with its attributes escaped (`shared/markdown/inline.ts`
`escapedAttributes`): shown the same, read as no attribute. Lines under the task are the user's own text and are kept as
written (a paragraph's attribute there still gives the page its value, as in any page).

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
* **Inside an attribute's value nothing is a mark**: `[x: #a]` gives no tag (and `x: null`: `#` starts a YAML comment),
  `[y: '@a']` no mention, `[n: [[Linked]]]` no link (`n: [["Linked"]]`). `a#b` is the tag `b`; `mail@x.dev` is no mention;
  marks in inline code are none. `[a-b: y]` is no attribute (it stays in the name); `[$s: z]` and `[Name: x]` are.
  `[k: a: b]` is the map `{ a: b }` (our reader refuses it: the converter takes it as text).
* A subtask has `parent` (the parent's ref); the parent's range covers its subtasks; a line under a task without a mark
  belongs to the task's `text` (`"Child [c: 1]\n    more text"`).
* **The clipboard** needs no probe: `shared/clipboard.ts` (moved out of Silverware Table) writes it in SilverBullet over http in a local
  network too (where `navigator.clipboard` is undefined, a copy event through `execCommand("copy")`); it moves to
  `shared/` for *Copy as tasks*.
* Read by our own parser, not from the index: the selection is converted as the editor has it (the index has the page as
  last saved), and the name and the person in an attribute follow the rules above, not the index's.

## Shape

* **A converter reads, a target writes.** A converter (core/converter.ts): `{ name, label, description, read(text) }`,
  `read` giving `{ properties, items }` (the properties the items need, each with its key, label, type; items
  `{ name, values, body, tags }`), knowing no database; `write(items, properties) → text` comes with *Copy as tasks*.
  What is made of it goes through a target. The one target now is *a new database* (`createDatabase` with the items, one
  transaction); *an existing database* comes later (keys mapped onto its properties, values converted), the converters
  unchanged.
* **The core** gets generic steps only (a database made with its items in one transaction, definitions checked as
  `defineViews` / `defineTypes` are). Converters are a layer of their own, `converters/` beside `views/` (built-in ones in
  `converters/builtin/`, one per file, through the same API as a user's): like views they import only the core's types,
  and they may read markdown through `shared/markdown/`, which the core, the model and the domain never do.
* **One command**, *Silverware Database: Convert selection to database*, with a choice of converter (or the one whose
  `read` finds anything): commands are defined at start from `commandNames()`, so a converter defined later in Space Lua
  would get no command of its own. Silverware Toolbar needs no code for it: its `commands` module finds the command, a
  user puts it among favourites.
* **`shared/markdown/`** (step 2, done): reading markdown as SilverBullet does, pure, writing no page. `lines.ts`: the
  selection's whole lines and fenced code (tasks inside code are not converted), out of Silverware Toolbar (`linesOf`,
  its two copies of the fences). `inline.ts`: a line's hashtags, mentions, wiki links and attributes, one scanner, which
  `shared/pages/tags/scan.ts` now reads hashtags by (it had its own; a hashtag in an attribute's value no longer counts,
  as in SilverBullet). `task.ts`: a task's line and state, attributes' values read and written as YAML on one line
  (`shared/yaml/tree.ts`, YAML moved out of `shared/pages/` so markdown does not stand on the page writer). Not in `shared/pages/` as first planned: the converters may not
  import the page writer, and none of this writes a page. `shared/clipboard.ts`: out of Silverware Table.
* **Copy as tasks**: an entry of the place's ⋯ (a menu slot), the view's listing as shown (filtered, sorted) through the
  converter's `write`.

## Steps

1. ~~The probes above~~ (done 2026-11-10).
2. ~~`shared/markdown/`: whole lines and fences, a line's marks, a task's line read and written; the clipboard out of
   Silverware Table~~ (done 2026-11-10).
3. ~~a) The store: an item made with its document's tags (`createItem`'s `tags`, beside `db`; `StoreRules.validateTag`);
   the core: `createDatabase(name, properties, items)`, a new database with its items in one transaction~~ (done
   2026-11-10). ~~b) `defineConverters`: the `converters/` layer, its registry and checks (`core/converter.ts`; the
   views' registry made one of any definitions, `core/registry.ts`), the API page~~ (done 2026-11-10).
4. ~~The tasks converter, the command, the block under the selection; a UI test~~ (done 2026-11-10). As built:
   * `converters/builtin/tasks.ts`; a key's type from its values in `converters/infer.ts` (people and links told by
     their marks, a date and time, then `guessedType` as for loose values; several values in any item a select of
     several options). Done tasks have Status *Done* where there is a Status.
   * The text put at the top of an item's body is the task's text after its checkbox, not the whole line: the item's
     page would hold a second task of the same.
   * The body is dedented by the common indentation of the lines under the task (not by the task's own): a subtask
     indented four spaces under its task stays a task, not indented code. A line under a task at the top level that is
     no task (a paragraph after the list) goes into the body of the task before it too.
   * A task of marks alone (`- [ ] [[Project X]]`) is named by their words. A person quoted (`[owner: "@ada"]`) is a
     person. Days, some with a time: a date and time. A tag the store cannot give a page (`#db`) is left out of the
     item's tags (its text keeps it); a key the model or the store refuses (`name`) and a label shown twice are made
     others (`name_2`, `Tags 2`). The block goes after a blank line: a selection touching it shows its markdown.
   * A name made one the store keeps is the store's: `DatabaseStore.keepableName(name, taken)` (the pages store: what a
     page cannot hold a space, a dot before an end read as an extension a dash, `(2)` by its names whatever their
     case). `DatabaseCore.createDatabaseOf(name, converted)` is the target *a new database*: names kept so, the source
     put first in the body where the name is not it, a key the store refuses made another.
   * The command *Silverware Database: Convert selection to database*: the lines selected whole, or the cursor's line
     with those under it (`shared/markdown/lines.ts` `linesUnder`); the block put on the line after them, the lines
     selected again (with their last line break); the text changed meanwhile: the block at the cursor.
5. ~~*Copy as tasks* from ⋯~~ (done 2026-11-10). As built: a converter's optional `write(items, properties)`; the place's ⋯
   offers *Copy as* and its label (slot `data`) for each converter that writes, given `host.items` (filtered, in the view's
   order) and written onto the clipboard at once (nothing awaited before it: `shared/clipboard.ts` over http). An item's
   text is not copied: the pages store reads no bodies with the items, and reading them first would await before the
   copy. The tasks converter writes Status *Done* as `[x]`, *Todo* `[ ]`, another `[ ]` with `[status: …]` (since
   2026-11-11, *Status instead of Done*; before, the task's own state), People, Links and
   the page's Tags as marks after the name (`hashtagOf`, moved to `shared/markdown/inline.ts` with `hashtagBefore`),
   the other properties but the system's as attributes (`writeAttribute`; a person `"@ada"`, a reference its links
   bare); read back, the values are the same, but for what a task cannot hold as the property had it (after the
   review, 2026-11-10): a person no mention can name (`Ada Lovelace`) is written as an attribute, read back under a
   key of its own (`people_2`); a tag no hashtag can be
   (holding `>`) is left out; a reference not written `[[…]]` is made one; the name's characters reading takes as
   syntax are escaped (`\[`, `` \` ``, `\#`, `\@`…), read back without the backslash. Labels, types and settings come
   back from the values, not as they were. A view showing no item copies nothing.

## Helpers for converters (2026-11-11, agreed with the user)

Converters to come need not be about tasks (a markdown table, a list, sections under headings, CSV), so what a
converter is given is markdown's structure and values, not tasks. Checked against what Silverware Toolbar's *Turn into*
reads: the same per line (a line's block kind, its indentation, its text after the marker and where that starts), no
tree (it rewrites lines in place; its only blocks of several lines are fenced code and numbering by indentation), and
kinds of its user's own (its format registry). So two layers in `shared/markdown/`:

* **`readLine(line)`**, for *Turn into* and converters alike: `{ kind, indent, marker, content, contentFrom }` with
  `kind` one of `blank`, `paragraph`, `heading` (`level`), `bullet`, `numbered` (`number`), `task` (`state`, `done`;
  a list item's), `quote`, `table`, `rule`; standard markdown only (a user's own formats stay the toolbar's registry).
  Fenced code is `lines.ts`'.
* **`readBlocks(text)`**, for converters: a tree made of `readLine` (items with the items and lines under them,
  headings with their section, a table's header and cells, paragraphs, quotes, fenced code), each block with the lines
  it was read from.

Converters are given, as `HELPERS` (a module's function form, as views and types are): `readLine`, `readBlocks`,
`inlineMarks`, `plainText` (a text without its marks, as a task's name is made), `readValue` (YAML, people, links),
`inferProperty`, `keyFromLabel`, `writeAttribute`, `escapedAttributes`; and the tasks converter, to build on.

Steps (a commit each, reviewed; unit tests, the UI tests not run, at the user's word):

1. ~~`readLine` and `readBlocks` in `shared/markdown/blocks.ts`, tested~~ (done 2026-11-11).
2. ~~The tasks converter on `readBlocks` (its behaviour unchanged: its tests pass as they are)~~ (done 2026-11-11: a
   task under a heading, or under a list's item that is no task, is one of the top level; a heading's line goes into
   the body of the task before it, as any line between two tasks).
3. `CONVERTER_HELPERS` given to `defineConverters`; the library page's *Converters* with them, its example using them.
4. Silverware Toolbar's built-in block formats read through `readLine` (*Turn into* then knows a task of a state of its
   own, `[IN PROGRESS]`); its user's formats unchanged.
