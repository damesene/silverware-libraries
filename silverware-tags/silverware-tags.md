---
name: Library/damesene/silverware-tags
tags: meta/library
description: "Silverware Tags: manage the tags of your space in one window: rename and merge them everywhere (pages, items, tasks), delete them, give tags to many pages at once or to every page under a folder, edit a page's tags; every change reviewed first, and undone with one command."
files:
- silverware-tags.js
- silverware-tags-init.md
- silverware-tags-api.md
- silverware-tags-style.md
---
# Silverware Tags

A manager for the tags of your space. Rename a tag everywhere it is used, merge two tags into one, delete a tag, give tags to many pages at once (every page of a folder too), and edit the tags of the page you are on. Every change shows you what it changes first, and *Undo* takes it back.

## At a glance

Everything is in one window, **Silverware Tags: Manager**, with two views (tabs at its top) and nothing opening over it:

* **By tag**: every tag of the space as a tree (`project/alpha` is under `project`: a `/` in a tag's name makes levels). Type to find a tag, **↑ ↓** to go through them, **→ ←** to open and close a level; in the tree **F2** puts you in the tag's name to rename it, **Delete** removes it (reviewed first). **Ctrl** (Cmd) and a click picks several tags (**Shift** and a click those between): *Merge into…* makes them one tag (the field offers your tags; a new name too), *Remove N tags…* removes them all, reviewed first. The tag you pick shows how many pages use it and where (on the page itself, in items, in tasks, in tables), its pages (click one to open it) and what you can do with it.
  * **Rename**: its name is a field: type the new name and press **Enter** (or *Rename…*). Every use of it changes: the pages' frontmatter, their tag lines, and their text, items, tasks, tables and headings. A name another tag has merges the two, which the field says as you type. A tag with tags under it renames them too (`project` to `work/project` makes `project/alpha` into `work/project/alpha`), unless you untick *Its subtags too* in the review. **Esc** puts the name back.
  * **Remove tag…**: takes it off every page using it. The review lets you choose *Remove from*: the text and the page's own tags (the default), the text only, or the page's own tags only (its frontmatter and its tag lines, a line of hashtags alone, which SilverBullet reads as the page's tags too). In the text you choose to keep the word, only the `#` going (the default: `#project/alpha` becomes `project/alpha`, `#<two words>` becomes `two words`), or to take it out with the space beside it. A page's own tag always goes whole. Its subtags go too if you tick that.
  * **Add to pages…** and **Remove from pages…** take you to *By page* with the tag to add, or with the pages having it picked and the tag to take off.
* **By page** (the command **Silverware Tags: Tag pages**): your pages as a tree of folders. Tick pages, or a folder for every page under it (its own page too); type to find pages. The search takes tags too: `#project` finds the pages using the tag anywhere (in their frontmatter, tag lines or text; its subtags too, `#project/alpha`), `-#done` leaves out those using it, other words look in the page's name, and all of them must hold (`#project -#done plan`); the tags of your space are offered as you type a `#`. *Untagged* shows the pages using no tag. While a search shows some pages only, a folder's box ticks the pages shown, *Check all shown* ticks them all, and pages you ticked that the search hides stay ticked (it says how many). On the right are the tags the pages you picked have, each with how many of them have it (`2/3`), and under *In their text* the tags they use only in their text (shown, not changed here): **×** takes one off them all (click again to keep it), and the *Add* field gives tags to them all (the tags of your space are offered as you type: **↑ ↓** and **Enter**, or **Tab** for the first). Then *Review changes…*. Tags are added into each page's frontmatter (a page that has one already is left as it is) and taken off its frontmatter and its tag lines; a hashtag in a page's text stays (*Remove tag* takes those off).
* **Silverware Tags: Page tags** opens *By page* with the page you are on picked.
* **Cleanup** (a tab of the window): tags that are likely one, found by their names: the same but for capitals or a separator (`Todo`, `to-do`, `todo`), a plural of another (`ideas`, `idea`), or one letter apart at the same level (`meeting`, `meetnig`; names of five letters or more). Each group offers the tag to merge into (the most used, unless you pick another) and *Merge…*, reviewed first. Below them the tags used on one page only, each opening in *By tag*.
* **The Tags panel** (the command **Silverware Tags: Tags panel**): the tags as a tree in SilverBullet's right sidebar, beside your pages (its menu moves it to the left or the bottom; it stays open across reloads). Each tag shows how many pages use it, a level how many use a tag under it. **The tags of the page you are on have their # in the accent color** (and so does a level holding one), and come first where *List this page's tags first in the Tags panel* is on (Settings; off by default: by name, folders first); *This page* above it shows only them, *Page tags* and *Tasks* only those, and its filter field finds a tag. A click opens a level, a **double click** opens the tag in the window; the buttons of a row (shown as the pointer is over it) **add the tag to the page you are on** (+; at once, as one of its own tags; Undo takes it back), or where it is one of the page's own tags already **take it off** (−: from its frontmatter and tag lines), **rename it** (✎, or **F2**: the window with its name to type) and **open it in the window**, and dragging a tag onto another level moves it there (`alpha` dropped on `work` becomes `work/alpha`, its subtags with it), reviewed in the window first.
* **SilverBullet's own pages are left alone** (*Hide and protect meta pages*, on by default): a page tagged `meta` or a tag under it (`meta/library`, `meta/template`…: libraries, templates, SilverBullet's API) is out of everything. Its tags show nowhere (a tag a library's documentation uses, `#VALUE!` written in its text, is not one of yours), and no change touches it: renaming `#auto` to `#automobile` renames it on every page but those. Turned off (*Silverware Tags: Settings*), they show, their tags apart (the panel's and the window's *Meta*, as SilverBullet's own tree has its meta pages apart), and changes reach them. **Enter** or a click opens the tag in the window, **F2** opens it with its name to type, and dragging a tag onto another level moves it there (`alpha` dropped on `work` becomes `work/alpha`, its subtags with it), reviewed in the window first.
* **Every change is reviewed first**, in the same window: each page that changes with its lines before and after (the first few open, click a page for its lines), and the pages left alone and why. *Apply* writes them and takes you back; *Back* (or **Esc**) changes nothing.
* **Undo**: the window's *Undo* at its bottom, the notification after a change (in SilverBullet's newer versions) and the command **Silverware Tags: Undo last change** take back the last change, reviewed as any change: you see each page going back to how it was, and a page you edited since is left as it is (named in the review). *Apply* writes them; the change before it is then the one to undo.

## Where tags are written

A page's own tags are its frontmatter's `tags` and its **tag lines** (a paragraph of nothing but hashtags, as SilverBullet reads them). Silverware Tags adds a page's tags into its frontmatter. A page that has no `tags` yet gets them on one line by default (a page without a frontmatter gets one too); *How new tags are written* (Settings) writes them as `- ` lines or as `tags: a, b` instead:

```yaml
---
tags: [project/alpha, meeting]
---
```

A page that has its tags already keeps their form: a list of `- ` lines stays one, `tags: a, b` stays a string (a tag with a space in it makes it `[…]`). The rest of the frontmatter stays as you wrote it, its comments too. A page whose tags it cannot read safely (a list in brackets over several lines) is left alone, and the review says so.

Hashtags are found as SilverBullet finds them: not in code (blocks and `inline`), links, URLs or HTML. Those in headings and tables count too.

**Which pages use a tag** comes from SilverBullet's index, so a page it has not indexed yet is not found: wait a moment after a large edit (or run *Space: Reindex*).

## Settings

**Silverware Tags: Settings** (or the gear at the bottom of the window): *Hide and protect meta pages* on the *General* tab, each part on the *Modules* tab. They are saved in CONFIG (shown in *Configuration: Open* too); a module turned on or off applies after a reload, which *Save and reload* does. In CONFIG:

```lua
config.set("silverware.tags.protectMeta", true)
config.set("silverware.tags.panelPageFirst", false)
config.set("silverware.tags.newTagsForm", "flow") -- or "block", "string"
config.set("silverware.tags.modules", {
  rename = { enabled = true }, -- Rename (and merge): the tag's name as a field
  pages = { enabled = true },  -- By page, Tag pages, Page tags, Add to pages, Remove from pages
  remove = { enabled = true }, -- Remove tag
  cleanup = { enabled = true }, -- Cleanup: tags likely one, tags used once
  panel = { enabled = true },  -- The Tags panel beside the page
  custom = { enabled = true }, -- Custom operations
})
```

## Custom operations

Things of your own done with a tag, in a JS file of your space, given to Silverware Tags in Space Lua:

```lua
silverware.tags.defineOperations(js.importFromSpace("Library/me/tag-operations.js"))
```

Each is a button of the tag you pick in the window, after the built-in ones, and works as they do: you see every change first, *Undo* takes it back, and SilverBullet's meta pages are left alone (*Hide and protect meta pages*). The file exports a list of operations, or a function that gets the helpers and returns them:

```js
export default (helpers) => [
  // The tag made lower case everywhere (merged with one of that name)
  {
    name: "lowerCase",
    label: "Lower case",
    when: (context) => context.tag !== context.tag.toLowerCase(),
    edit: (text, page, context) => helpers.renameTags(text, (name) => (name === context.tag ? name.toLowerCase() : undefined)),
  },
  // The tag given to every page that uses it in a task, as a page's own tag
  {
    name: "promote",
    label: "Make it the page's",
    pages: (context) => context.contexts(context.tag).task ?? [],
    edit: (text, page, context) => helpers.addPageTags(text, [context.tag]),
  },
];
```

* `name` (letters, digits, `_`), `label` (its button). `title(context)`: the review's title (else the label and the tag). `danger: true` shows it in the danger color (it takes something away).
* `when(context)`: whether it is offered for the tag (left out: always).
* `pages(context)`: the pages it may change (left out: those using the tag); the others are not read.
* `edit(text, page, context)` gets a page's text and gives the text it should have: a text, `{ text, changes }` (what the helpers give), or nothing (the page as it is). It may be `async`.
* `context`: `tag` (the tag the button is on), `tags` and `pages` (every tag and page of the space, meta pages left out while they are protected), `pagesWith(tag, children)` (the pages using a tag, with `children` its subtags' too), `contexts(tag)` (its pages by where it is used: `page`, `item`, `task`, `table`, `header`).
* Helpers, the functions the built-in operations are made of (text in, text out): `renameTags(text, rename)` (`rename(name)` gives a tag's new name, or nothing), `removeTags(text, match, how)` (`how` optional: `{ frontmatter: false }` leaves the frontmatter, `contexts: ["task", "item"]` takes the hashtags of those contexts only, `keepWord: true` leaves a hashtag's name in the text, only the `#` going), `addPageTags(text, names)` (into the frontmatter), `removePageTags(text, names)` (from the frontmatter and the tag lines), `pageTags(text)`, `frontmatterTags(text)`, `hashtags(text)` (each with its `name`, place and `context`), `tagUses(text)`, `hashtagOf(name)`, `isMetaTag(name)`, `renamedTag(name, from, to, children)`, `matches(name, tag, children)`, `isWithin(name, root)`, `parentOf(name)`, `nameProblem(name)`, `applyEdits(text, edits)`.

A mistake in a definition is a notification; a page an operation's `edit` fails on is left alone and named in the review. Definitions are made again each time Space Lua loads. The *Custom operations* module (Settings) turns them off.

## Implementation

Silverware Tags is started by [[Library/damesene/silverware-tags-init]] (its settings, commands and the Tags panel), its Space Lua API is [[Library/damesene/silverware-tags-api]] and its look [[Library/damesene/silverware-tags-style]]. All three are installed with this page.
