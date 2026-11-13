# Silverware Assets

**Split out of Silverware Layout into a plugin of its own on 2026-11-14** (docs/silverware-assets-split.md, its steps and renames). This is the assets' decision log, written while they were Layout's: read "Silverware Layout" below as "Silverware Assets" where it is the assets' part (their registry, their decoration, their menus, their settings); the grid, the handle and a widget's width stay Layout's, which Assets uses through its API (`shared/layout.ts`, `shared/rendered.ts`). Their settings are `silverware.assets` (the former Media tab: **Silverware Assets: Settings**, tab Assets); the markdown-as-written mode is each plugin's own (`shared/syntaxmode.ts`).

Proposed 2026-11-13, built 2026-11-13 (*Steps*). Every medium a page embeds (an image, a video, an audio, a PDF, any other file) decorated by Silverware Layout: shown as an icon card, a preview or embedded, resized by a handle, opened by a configurable action. Each kind of file is a **type** registered with Silverware Layout (`silverware.assets`), with its own icon and renderers; an image is one of them. Every embed stays SilverBullet's own markdown, right without the plugin. Belongs with the grid ([silverware-layout-grid.md](silverware-layout-grid.md)): a matrix of images, or of PDFs as cards, is a grid of embeds. Implementation starts on the user's word.

## Requirements

- **Compatible with SilverBullet**: a medium's size is written in SilverBullet's own syntax, so a space without the plugin (removed, or another device) shows every medium at its size, as SilverBullet draws it. Nothing else of the plugin's shows there.
- SilverBullet keeps everything it does with embeds: the index (an embed is a link to its document: backlinks, broken links), renaming an attachment, navigation. **Not by itself in a grid**: a grid's body is not indexed (its plan, *How SilverBullet draws it*), so an embed in a cell would be missed by a rename; the grid's own indexing restores it (the grid's plan, *Indexing*).
- No renderer breaks on what the plugin writes.
- **The plugin's code knows no syntax and no SilverBullet**: what an embed's text looks like is known in one place (the codec), what SilverBullet is in another (the host binding); a change of SilverBullet is a change there.
- Built for links too: an embed first; a link to a file (`[[report.pdf]]`) and an embedded page (`![[Page]]`) later, without changing the registry (see *Later*).

## What SilverBullet does (its source, 2026-11-13)

- `![[…]]` and `![…](…)` are one node, `Image`, whatever the file: an image, a video, a PDF, a page (`![[Page]]`, `![[Page#Section]]`). In the editor it is a block widget, `.sb-inline-content` (`client/codemirror/syntax/inline_content.ts`).
- SilverBullet draws an image, audio, video (`<img>`, `<audio>`, `<video>`) and a PDF (`<object>`) (`createMediaElement`, `client/media.ts`), each capped at its box (`max-width: 100%`); any other file is `**Error:** Unsupported content`.
- The size (`parseDimensionFromAlias`, `plug-api/lib/transclusion.ts`): `|200`, `|50%`, `|200x100` after the alias, for every embed, not images alone. `alt` and `title` of the element are the alias.
- The index indexes an `Image` node as a link to its document (`plugs/index/relation.ts`).
- `markdown.markdownToHtml(text, { expand = true, annotationPositions = true })` renders markdown to HTML, embeds expanded, each element with its offset (`data-pos`); `markdown.renderToDom` (live DOM) is in SilverBullet's main only, not 2.12.1 (*Probe results*).

## SilverBullet draws, the plugin decorates

- The text stays SilverBullet's: its parser reads the `Image` node, so the index and everything above work as they do.
- **Outside a grid** SilverBullet draws an embed as its widget. Silverware Layout finds it (a `MutationObserver` on the content, as it finds widgets) and, by the asset's view, leaves SilverBullet's content as it is (a view the type renders none of, or a renderer's `null`) or replaces it by a render (the card, a type's own renderer); the handle and the "…" menu are added in each.
- **In a grid** the cells' markdown is rendered by SilverBullet too (`markdown.markdownToHtml` on 2.12.1, its elements marked with their offsets: the grid's plan), so a cell looks as the rest of the page and its media are SilverBullet's (an image a plain `<img>` there, not a widget); the same decoration applies to them.
- The rule: **markdown and media are always drawn by SilverBullet; Silverware Layout decorates or replaces what it drew.** A render of its own only for the card and a type's own renderers.
- **Not taken over by `syntax.define`** (weighed 2026-11-13, dropped): a custom inline syntax runs before lezer's `Link` and `Image` and could take every `![`, but the index parses with the user's syntax extensions, so embeds would leave the index (no backlinks, no rename of attachments); `![[Page]]` is the same node; navigation looks for `Image`; a regex is no parser (`[![badge](a.svg)](url)`, a `)` in a URL); every embed in the space through an experimental API.
- What SilverBullet's DOM is (`.sb-inline-content`, the media inside) is known in `host/silverbullet/` alone, as all of Silverware Layout's; `ui-tests/silverbullet.spec.ts` checks it by name.
- **Where an embed is in the source**: in the editor, by its target and its order among the page's embeds (SilverBullet's widget carries no position: *Probe results*); in markdown rendered outside the editor (a grid's cell), by a convention of Silverware Layout's host, not of the grid: **a block rendered outside the editor carries its offset in the page's text** (`data-swl-pos`, as SilverBullet's `data-pos`). Whoever renders such a block sets it (the grid does, for Alt+click anyway); the asset host reads it and finds the embed's text from there. An agreement on an attribute: no area knows another.

### SilverBullet's widget menu

**Hidden on every decorated embed** (decided 2026-11-13): one menu, the plugin's "…". As Silverware Chart and Database hide it on their widgets (their style pages): `.button-bar` (the release 2.12.1) and `.sb-widget-menu-bar` (main), and on a touch screen the longer path SilverBullet forces it shown by (`#sb-main .cm-editor .sb-lua-directive-block .button-bar`, `display: block !important`), named the same with the mark beside it. An embed's widget is SilverBullet's, not given a class by the plugin (`widget.new`), so the host marks it (`data-swa-asset`) and the style page's rule hides the menu within what is marked. SilverBullet's names in `host/silverbullet/` and the style page alone; `silverbullet.spec.ts` checks the menu stays hidden. What the menu offered that a user needs (the probe) comes into the "…" menu (moving into the source is Alt+click already).

The asset is called an *asset* in the code and here; *Media* is only the name the user sees (the dialog's tab).

## How an embed is written

SilverBullet splits the alias at `|` and takes **the first two parts only**:

```ts
[alias, dimPart] = text.split("|");
```

A third segment is ignored by SilverBullet; that is where the plugin's metadata goes (tried by the user in SilverBullet 2.12.1, 2026-11-13: the alt text and the width right, the metadata nowhere in the page):

```markdown
![[cat.jpg|A cat|200|{ view: preview }]]
![A cat|200|{ view: preview }](cat.jpg)
![[report.pdf|Report||{ view: icon }]]
```

- **Always three segments**, `alt|size|{metadata}`, empty ones kept: `||200|{…}` (no alt), `|A cat||{…}` (no size). Never two: `![[cat.jpg|200|{…}]]` makes `200` the alt text and `{…}` the size (`NaN`: the width lost, "200" as the tooltip).
- **The metadata** are `{ key: value, … }`, known by the braces, so an alt text is never taken for metadata. Values unquoted where they can be, quoted where they hold a comma or a brace. Read with SilverBullet's typographic quotes too (`“preview”`: its smart quotes turn a typed `"` into them).
- **An embed without changes is left as the user wrote it**: only an embed given a size or an option is written, in its own form (wiki or markdown).
- **A detail of SilverBullet's code, not its documented syntax**: were SilverBullet to read a third segment one day, it would read ours. `silverbullet.spec.ts` checks an embed written by the codec in SilverBullet (its alt, its width, a clean tooltip) and fails there by name; the fix is the codec's.

### Wiki or markdown

| | `![[cat.jpg\|…]]` | `![…](cat.jpg)` |
| --- | --- | --- |
| SilverBullet | the medium, its size, the metadata | the same (a probe: `mdLinkRegex`) |
| GitHub, VS Code, CommonMark | text | an image, without the size (GitHub sizes only `<img width>`) |
| Obsidian, Foam | the medium (wiki) | the medium |

- SilverBullet links by wiki links (page names not paths, no `.md`, no encoded spaces, absolute from the space's root, `[[` completion). Its setting `defaultLinkStyle` (`"wikilink"` by default, `plug-api/constants.ts`) chooses what its upload command writes (`plugs/editor/upload.ts`; `"markdown"`: `![…](…)`); a paste or a drop into the editor writes `![[…]]` always (`client/codemirror/editing/editor_paste.ts`).
- **The plugin follows `defaultLinkStyle`** for what it inserts: no setting of its own. An embed in the page keeps its form.
- Paths differ: a wiki link's from the space's root, a markdown link's relative to the page (`resolveMarkdownLink`); the codec computes them where it writes a link.

## Types

A type is registered under a name; registered again under it, it replaces the one before (as a `LayoutProvider`).

- `name`: `image`, `video`, `audio`, `pdf`, `file`, or a plugin's or user's own (`excalidraw`).
- `match`: which assets are its (*Matching*).
- `icon`: a plain image, given by the type: a URL (a file in the space, a `data:` URI, `https://…`, drawn as `<img>`) or SVG text (inlined, so `currentColor` follows the theme; the built-in types' icons are SVG text). No dependency on Silverware Icons.
- `views` (optional): per view (`preview`, `embed`) a renderer of its own; **a view left out is drawn by the host, where the host can** (SilverBullet draws an image, not a zip: the host is asked as the asset is drawn, so a type never declares what it cannot do). **A renderer returning `null`** hands that one asset to the host the same way (a preview drawn only where there is room for it). `icon` every type has, as the core draws the card (*The icon card*). **The type provides renderers, the core decides what is rendered** (*Contracts*). A renderer is also told its **placement**, `block` (a transclusion) or later `inline` (a link): a type says which placements it renders; the built-in types render `block` only, to start.
- **No default view**: how an asset is shown is the user's, in the settings (*Views*); a type does not know it.
- `card` (optional): a function given the same context as a renderer, giving (maybe later, asynchronously) the fields the type adds to its card (a PDF's page count).
- `validate` (optional): checks its own metadata keys (*Metadata*).
- **Built-in types**: `image` (no views: SilverBullet's `<img>` in both), `video` (no views: SilverBullet's player; a first frame as preview later), `audio` (no views), `pdf` (embed SilverBullet's `<object>`; preview its own, a smaller `<object>`, cheap, enough to prove the whole works, `null` where there is no room or no URL; a real preview of the first page, by pdf.js loaded on first use, later), `file` (no views, and SilverBullet draws no zip: the card; its `match` the least specific, so the core knows no fallback by name).

  ```ts
  export const imageType: AssetType = {
    name: "image",
    match: { kind: ["file", "web"], mime: "image/*" },
    icon: IMAGE_ICON,
  };

  export const pdfType: AssetType = {
    name: "pdf",
    match: { kind: ["file", "web"], mime: "application/pdf", ext: ["pdf"] },
    icon: PDF_ICON,
    views: {
      preview: (ctx) =>
        ctx.viewport.width >= 200
          ? el("object", { type: "application/pdf", data: ctx.asset.url, className: "swa-pdf-preview" })
          : null,
    },
  };
  ```

### Matching

A type declares which assets are its; the core (`assets/core`) evaluates the declarations and knows no extension or MIME type itself.

```ts
type AssetMatch = {
  kind: readonly Asset["kind"][];     // which kinds of asset (file, web, later page)
  ext?: readonly string[];            // extensions, no dot, any case
  mime?: string;                      // "application/pdf", or with a wildcard "image/*"
  test?: (asset: Asset) => boolean;   // where the above do not do
};
```

- The asset's extension from its path or URL; its MIME type from the platform (SilverBullet knows it from its list of files), else from the extension.
- The types whose every given condition holds match; **the most specific wins**: `test`, then `ext`, then an exact `mime`, then a `mime` wildcard, then `kind` alone (`file`); at the same level the one registered later (as a registration under a name replaces the one before).
- `dovolena.jpg` matches a plugin's `photo` (`ext: ["jpg"]`) and `image` (`image/*`): `photo` wins. A user choosing otherwise per extension (in the Media tab) may come later: the choice is one place in the core.
- **Built-in types can be overridden** by registering the same name (an icon of the user's own). Silverware Layout registers a built-in type only where its name is free: Space Lua loaded again runs Layout's init again, and must not override what a user or another plugin registered. The registry outlives a reload of Space Lua, so an override taken away leaves the built-in type back only after the page is loaded anew (documented).
- **Who registers**: Silverware Layout its built-in types; another plugin through Layout's public API (`silverware.layout.api`, as widgets register); a user from Space Lua later. A renderer in Lua means JS calling a Lua function, asynchronous: a probe first, then `silverware.assets.define({ … })`. **The first version takes types from JS only.**

## Views

`{ view: icon | preview | embed }` in an embed's metadata.

- `icon`: a card, the type's icon and what the user chose to show; the medium itself is not shown.
- `preview`: a small preview (an image smaller, a video's first frame, a PDF's first page).
- `embed`: the asset itself: an image, a player, a viewer. Left to the host by a type that renders none (the built-in ones), the host's own drawing, the handle added.
- **Which applies**: the embed's `view`; else the user's setting for its type; else the user's default for all types (settings, the Media tab: a type has no say). A view neither the type nor the host can draw falls on in the order `embed`, `preview`, `icon`; the card always can.
- **Switched by the "…" menu** on the asset (shared/menu): icon / preview / embed, written as `view` through the codec.
- **The size belongs to the asset, not to a view**: `|300` holds in `preview` and `embed` alike; the card has no size and no handle.

## Size and the viewport

**The size is always Silverware Layout's; only what it takes it from differs.** A renderer never sees the stored width and height: it is handed the room it draws into, `ctx.viewport`, and fits its content to it.

- **An asset laid out in the page** (in the text, in a grid's cell, later by a link): the stored dimensions (`|300`, `|300x200`), within the room there is; none stored, the room's width.
- **An asset in a surface of its own size** (a peek panel, a popover, any later): the surface's size; the stored dimensions are not used there. Each surface says what size it gives, so the core knows none by name.
- **The height is always known**, as the core makes the container: the surface's; else the stored height; else from the stored width by the asset's ratio where it is known (an image's, by the host); else the view's default height (settings: a preview's and an embed's). A renderer draws into a given height; one growing with its content may come later.
- **Resized while shown** (a peek dragged wider, a phone turned): the container follows by CSS and the renderer's element fills it, enough for most. `ctx.viewport` is live: its current `width` and `height`, and `onChange(callback, { signal })` for a renderer whose content depends on its size (a sharper PDF page, another arrangement in a narrow peek). Nothing is drawn anew on a resize; `signal` ends a render, not a size.

## The icon card

Drawn by Silverware Layout in one place, not by each type: the type gives its icon (and its `data`). What the card shows is the user's setting (the icon, the name or alt text, the file's size, its date, the type's data); a file's size and date are asked for only where the setting shows them.

## The core

*The core* in this plan is the assets' own, `assets/core` (the registries, which type, view and action apply, the renders run), not Silverware Layout's `core/`, which knows no area.

## Actions

What a click on a card or a preview does is not fixed. **The mechanism is the core's**: a gesture, the setting for the asset's type (else the default), an action's name, the action run. **The actions are generic**, for every type, and types know none: Silverware Layout provides them, registered as any other (another plugin may add one, Silverware Database a peek), so the core knows no action by name.

- `open-tab`: the asset's URL in a new tab of the browser (the URL from the platform, never put together by the action).
- **`peek` and `popover`, done 2026-11-13** (`builtin/panels.ts`, registered as anyone's, knowing the contract and `shared/elements.ts` alone): Show in a side panel (a panel at the window's right, the sheet's layer, the page beside it still used) and Show enlarged (over the dimmed page, the dialog's layer; a click beside it closes it), each the asset as the core renders it for `embed` (`render`: the type's view, else a copy of the host's drawing shown though hidden in the page, else its card), its head its name, Open in a new tab and ×, Esc closing it, one of a kind at a time, marked `data-silverware-over-window`; they fit an asset drawn larger than its card. Not Silverware Database's peek: its generic part moves to `shared/` once a second plugin needs the same panel (this one is simpler). Seen in SilverBullet 2.12.1: an image's click in its peek, its Shift+click enlarged, each closed by Esc and by a click beside it. A preview of an image or a video is sized by its height alone: no handle, a width its embed keeps not its frame's (it was, the image smaller in it).
- Later: `open` (SilverBullet's document viewer), `embed` (switch to `embed` in place).
- An action that shows the asset asks the core to render it (`ctx.render("embed", container)`): the core calls the type's renderer or the host's own drawing. An action knows no type, a type no action.
- **Whether an action fits is told by capabilities, not names**: an action's `fits(asset)` (`open-tab`: `"url" in asset`, which narrows the union to the kinds with a URL, so a later kind with one fits by itself, and one without never slips through); `popover` needs a view other than the card drawable; for an asset with the card alone it is not offered.
- **Gestures map to actions**: `click`, `shift+click`; later a long press on touch, which has no Shift.
- **Settings, with an override per type**:

  ```lua
  click = {
    default = { click = "open-tab", ["shift+click"] = "open-tab" },
    image   = { click = "popover" },
    pdf     = { click = "peek" },
  }
  ```

  Which applies: the user's setting for the type, else the user's default; an action that does not fit is passed over; none left, no action. `open-tab` is the default of the setting's default value, data in the model, never a name in the core's code; types have no default action, as they know none.
- The `embed` view's content is SilverBullet's (a player, a viewer): a click there is the medium's own, not an action.

## Settings and the Media tab

- `silverware.assets`: the views (a default and per type), the views' default heights, the actions (a default and per type, per gesture), what the icon card shows; later the paste (*Paste and drop*).
- Tables, so in Silverware Layout's own block of CONFIG (`withConfigSettings`, marker `-- managed-by: silverware-layout`), as the guides: the Configuration Manager reads no table back.
- **A Media tab in the Page layout dialog, in the first version**: at the top the defaults for all types (view, click, Shift+click) and what the card shows; a row per registered type (its icon, its name) with its view, click and Shift+click, "default" meaning no override. Saved with the dialog's Save, as the rest of it.

## The handle

- Silverware Layout's handle (ui/handle.ts) on a medium in `preview` or `embed`: a drag sets the width, the height follows the ratio (the width alone written, `|300`); a double click takes the size off; written on release.
- **Not centred**, unlike a table or a chart: a medium stays where it is and grows or shrinks (centring may come as an option).
- Snaps: Silverware Layout's guides and the text's width where the asset's box is the text column; else shares of the asset's own box (`100%`, `50%`), which in a grid's cell is the cell: the handle knows no grid. SilverBullet's `%` is of the medium's box, so `|100%` in a cell is the whole cell; the grid's CSS keeps media within their cell (`max-width: 100%`).

## Contracts

Reviewed 2026-11-13 against Silverware Layout's layers (`src/isolation.test.ts`) and `shared/layout.ts`. The core hands functions over; types and actions use only what they are handed, and import nothing of Silverware Layout.

- **`shared/assets.ts`**, as `shared/layout.ts`: `AssetType`, `AssetAction`, `ASSETS_VERSION`, and `assetsOf(given)` giving the assets' API or a stand-in registering nothing. What a plugin registers types and actions by from JS. The API is `silverware.assets.api` (the init page hands `silverware.layout.api` over as for widgets): its own version beside `LAYOUT_VERSION`, so the two contracts change apart.
- **A type**: `{ name, match, icon, views?, card?, validate? }` (*Types*, *Matching*); no view, no size, no syntax.
- **A renderer's context**, grouped so that a service added later is one more property and no type breaks:

  ```ts
  ctx = {
    asset,      // what is rendered, read-only: the union below
    viewport,   // where it is drawn: { width, height, onChange } (*Size and the viewport*)
    metadata,   // the type's own keys: values, helpers, write
    signal,     // an AbortSignal: the render ended
  }
  ```

- **The asset is a union by `kind`**, each kind with its own required properties, narrowed by TypeScript once `kind` (or a property, `"url" in asset`) is checked; a new kind later is one more branch, and the code using the union is checked against it:

  ```ts
  type Asset = { alt?: string } & (
    | { kind: "file"; path: string; url: string; mime?: string }   // a document in the space, its path resolved from the space's root
    | { kind: "web";  url: string; mime?: string }                 // ![](https://…/cat.jpg)
    | { kind: "page"; page: string; section?: string }             // later: ![[Page#Section]]
  );
  ```

  - A path is handed resolved (`Photos/cat.jpg`, not a markdown link's `../Photos/cat.jpg`): paths are the codec's and the host's, never a renderer's.
  - `alt` optional: `![[cat.jpg]]` has none.
  - No stored size in it: the size is Layout's (*Size and the viewport*).
  - `asset`, not `source` (in these plans the source is the page's text: ranges, Alt+click) nor `file` (a page later is none).
- `viewport`, not `box` nor `size`: the room drawn into (as CSS's, pdf.js's), apart from the stored size.
- `signal` (the web APIs' name: `fetch(url, { signal })`, `addEventListener(…, { signal })`): aborted when the render ends (SilverBullet drew the widget anew, the view changed, the page closed); what a renderer started (listeners, timers, observers, fetches) is cleaned up by it, so no `destroy`.
- A renderer returns an element, or `null` for the host to draw that asset. It is never handed the host's drawing or the card: what is rendered is the core's choice.
- **What the core decides**: the type (*Matching*), the view (*Views*), the viewport (*Size and the viewport*), then the type's renderer, the host's drawing, or the card.
- **An action**: `{ name, fits(asset), run(ctx) }` (*Actions*); its context the asset, the render (`ctx.render(view, container)`) and what the platform opens (`ctx.open(url)`).

  ```ts
  export const openTab: AssetAction = {
    name: "open-tab",
    fits: (asset) => "url" in asset,
    run: (ctx) => ctx.open(ctx.asset.url),
  };
  ```

- **Errors**: a renderer throwing, or a registration not valid (`validateAssetType`), never breaks another asset. A failed render shows the host's own drawing with an error icon over the asset, its tooltip the error's message; where the host draws nothing (a file it does not know), the card with the same icon.
- **Drawn again**: CodeMirror keeps a widget while the embed's text is unchanged; it makes it anew after an edit of that embed and as the page is scrolled far and back (widgets out of view are dropped). Renders are therefore cheap; what is costly (a PDF's first page later) the core caches by URL.

## Metadata

Three responsibilities, apart:

1. **Where and how metadata are in the text** (the third segment, `{…}`, quotes, the canonical form): **the codec**. The same for a PNG and a PDF: it belongs to an embed's syntax, not to a kind of file. The codec keeps them as a flat map of text values without understanding them, as a widget's plugin keeps `LayoutEntries`.
2. **What a key means**: the **core's keys** (`view`; the size, which is not in the metadata but SilverBullet's own segment) for every type; a **type's keys** (a PDF's `page: 3`, a video's `start: 30`) the type's: it alone knows what a value means and of what kind it is. Handed as text in `ctx.metadata.values`, read by the core's helpers so that no plugin writes the conversions again (`ctx.metadata.number("zoom")`, `boolean("autoplay")`, `text("caption")`, undefined where missing or not of that kind), changed by `ctx.metadata.write({ zoom: 3 })` (the core turns values to text), checked by the type's optional `validate`. The core reserves its keys: a type declaring one is not valid.
   **Parsing an embed is never a type's**: the type is known only once the text is read (its target gives it), the syntax is the same for a PNG and a PDF (SilverBullet's), and the third segment rests on a detail of SilverBullet's code that is mended in one place, not in each type, other plugins' included.
3. **Who writes**: the core, as a go-between: `ctx.metadata.write` → the store → the binding → the codec → `shared/pages/`. A type does not know where it is written, the core not how.

A key nobody knows is kept (a file renamed from `.png` to `.jpg`, of another type now, keeps its metadata).

## Layers

As everything here, what a thing looks like in a page is known in one place:

- **Model** (pure): an occurrence, as the codec read it and the host found it, without syntax; the views, the actions and their settings, checked by `validate…`, types and actions in them names only (data, not code).

  ```ts
  // assets/model/occurrence.ts
  type Occurrence = {
    form: "transclusion" | "link";   // ![[…]] / ![…](…); later [[…]] / […](…)
    style: "wiki" | "markdown";      // [[…]] or (…)
    asset: Asset;
    width?: string; height?: string; // stored: Layout's
    metadata: Readonly<Record<string, string>>;
    range: { readonly from: number; readonly to: number };   // in the page's text
  };
  ```

  `form` and `style` are the codec's (written back in the form the user wrote) and are never handed to a type; `form` is not `view` (how an asset is written, not how it is shown), named after SilverBullet's own term for `![[…]]`. The forms there are are the syntaxes the codec reads: a new syntax is the codec's and the host's, never a type's.
- **The codec**, both directions:
  - reading an embed's text (and a link's: read from the start, used later) in `shared/markdown/`, beside `inline.ts`: the asset (its path resolved), alt, the stored size, metadata, form and style;
  - writing it (three segments, empty ones kept, the form given, paths computed) through `shared/pages/`, the one page writer.
  Were SilverBullet to change its alias, the codec and its tests change, nothing else.
- **The registries and the mechanism** (core): types and actions by name, which type matches, which view and action apply, the renders run; the contract `shared/assets.ts`.
- **`AssetHost`**, an interface as `PageHost`: the occurrences found and gone (an observer of the content, a grid's cells included as they are in it), the host's own drawing of an asset (or none), an asset's content replaced, its place in the source. Links later are one more source of occurrences in it. SilverBullet's is in `host/silverbullet/` (`.sb-inline-content`, the media in it); the playground has its own.
- **A store**, as `LayoutStore`: the core says "change this occurrence's metadata or size"; the binding writes it by the codec and `shared/pages/`. Core and UI import neither `shared/pages/` nor `shared/platform.ts` (the isolation test holds this already).
- **The platform** (shared/platform.ts, shared by every plugin, so changed for all at once): optional members `linkStyle?(): "wiki" | "markdown"` (`"wiki"` where none: SilverBullet's binding hands over `config.get("defaultLinkStyle", "wikilink")`, so no code but the binding knows SilverBullet's key), a document's URL (for `open-tab`), later a file uploaded (`editor.uploadFile`). (A document's size and date for the card went to the asset host instead, `fileInfo`: no other plugin needs them.)
- **Areas within the layers**: `silverware-assets/src/` has the layers inside (`assets/model`, `assets/core`, `assets/ui`) under the same rules, its built-in types and actions in `assets/builtin/`, importing the contract (`shared/assets.ts`) and shared UI without state (`shared/elements.ts`), never Silverware Layout: registered as anyone else's. Silverware Layout's core knows no area; `app.ts` puts them together (as `widgetlayout.ts` the widgets) and `index.ts` binds them to SilverBullet. `src/isolation.test.ts` gets the rules: an area's layers as Layout's; the built-in types and actions the contract alone; no area importing another.
- **The grid and the assets know nothing of each other**: the assets decorate occurrences wherever the host finds them, a grid's cells included; a snap "to the cell" is a snap to a share of the asset's own box, never "a grid".
- The grid's syntax the same: its codec in `shared/markdown/` and `shared/pages/` (it is Layout's alone, but its writing is the page writer's, and its reading belongs beside it), the grid's code on its model.

## Paste and drop (later)

SilverBullet's paste and drop are CodeMirror's `domEventHandlers` (`editor_paste.ts`): a file pasted or dropped is named in a prompt, checked against `maximumDocumentSize`, written, and linked as `![[…]]`, `defaultLinkStyle` not asked. No event or setting hands it over.

- Taken over by a `paste` and `drop` listener in the capture phase on the editor (as Silverware Layout's font zoom takes Ctrl + scroll), for **files** alone: `preventDefault`, `stopImmediatePropagation`, then the plugin's own. Text and rich text stay SilverBullet's (its HTML to markdown).
- What it gives: the link in `defaultLinkStyle` (the codec), where a file goes (a folder of attachments by the page, one folder, a name by a pattern), metadata by its type, the same in a grid's cell (whose editor is the plugin's anyway).
- What it costs: SilverBullet's checks are ours to keep (`maximumDocumentSize` read from SilverBullet's setting, a file name's validity, the prompt); a failed write reported, never a file lost (SilverBullet no longer gets the event). `silverbullet.spec.ts` checks the listener runs before CodeMirror and SilverBullet inserts nothing after it.
- Can be turned off (`silverware.assets.paste`), SilverBullet's own then.
- Built after the types, the codec and the writing of links, which it stands on.

**Inserting by a command** (2026-11-13): SilverBullet's `File: Upload` (on Silverware Toolbar, on a phone too) picks a file, asks its name and links it by `defaultLinkStyle`: enough for now, no command of the plugin's. On Android its picker usually offers the camera; `editor.uploadFile(accept, capture)` (`client/plugos/syscalls/editor.ts`) could open the camera at once (`"image/*"`, `"environment"`), which `File: Upload` does not ask for. In a grid it inserts at SilverBullet's cursor: right in the raw text (after an Alt+click, the cursor within `<column>`), wrong while a cell is edited in place (the cell's field is the plugin's; SilverBullet's cursor is outside the grid, and cannot enter it without the grid falling apart into raw text). So the cell editor will need an insert of its own (its "…" menu), built with paste and drop: one way of storing a file (where it goes, its name, `maximumDocumentSize`), the camera one of its choices.

## Later

- **Links** (`[[report.pdf]]`): the same types rendered `inline` (an icon by the link, a preview on hover); a second source of occurrences in the host; the codec reads links from the start. **The icon done 2026-11-13**: the asset host's optional `watchLinks` and `linkAsset` (SilverBullet's: a wiki link's widget `a.sb-wiki-link` in the editor, `a.wiki-link[data-ref]` and a plain `a` in a block rendered outside the editor; a file of the space alone, by an extension not `.md`: no page, no site), the decorator puts its type's icon first in the link (`swa-link-icon`, marked `data-swa-link`), the setting `linkIcons` (on; a box in the Media tab). A markdown link in the editor (`a.sb-link`) is CodeMirror's text, marked, not a widget: an element put there would be taken for an edit, so it gets none. Seen in SilverBullet 2.12.1: `[[sample.pdf]]` and `[[archive.zip|the archive]]` with their icons, in a cell too, a page's and a site's link none. **The icon a menu, done 2026-11-13** (the user's wish): a click on the icon opens the asset's menu with the actions registered that fit it (`ui/moremenu.ts` `opensMenu`: any element opens it, the press held back from the link; the frame's "…" lists the same actions now, not the click's alone), a link's file drawn in a panel by its type's view, else the browser's medium of its kind (`ui/plainmedium.ts`), else its card. Seen in SilverBullet 2.12.1: the icon's click followed no link, Show enlarged showed the PDF, in the editor and in a cell. **Link and embed written as each other, done 2026-11-13** (the user's wish, both ways): `shared/markdown/embed.ts` reads a page's links (`readLinks`: wiki and markdown, no embed, nothing in code) and writes one as the other (`linkAsEmbed`: its `!` added; `embedAsLink`: its alt text the link's, its size and metadata left out, a markdown link without a text named by its file); the page writer's `embeds.toLink` and `links.toEmbed`. The link's menu has Show as embedded (a link in a cell found by its place, `DrawnLink.position`; one in the editor by its target and its order among the links drawn of it, outside the blocks rendered outside the editor), the embed's "…" Show as a link (the asset host's optional `linkToEmbed`, `embedToLink`). Seen in SilverBullet 2.12.1: a link in a cell and one in the page embedded, each the one it was, and back to links.
- **Embedded pages** (`![[Page]]`): drawn by SilverBullet for now, untouched; later a type as the others (matched as a page, not a file), with the links.
- Actions beyond those built (`open`, `embed`), a long press on touch.
- A real PDF preview (pdf.js, loaded on first use), a video's first frame.
- Types and renderers from Space Lua.
- Paste and drop.
- **Another syntax, not planned, kept open** (2026-11-13; HTML is the grid's syntax alone, unrelated to the types: this is only a check that the design closes nothing): an asset written as an HTML tag of a type's own (`<my-type attr="value" />`) is a new form, not a new type. A plugin would not parse it (it would have to know SilverBullet's DOM and the page writer): Silverware Layout would read HTML tags generically, as a form of its own: a kind `{ kind: "tag"; tag; attributes }` in the union, a type declaring `match: { kind: ["tag"], tag: "my-type" }`; the attributes read and written by one codec of attributes, shared with the grid's (`<grid columns="…">`), Layout's reserved ones (`width`, `height`, `view`) apart from the type's (its metadata); found by a `syntax.define` Layout registers per tag name (SilverBullet shows an unknown tag's line as text). What it costs, as the grid: nothing without the plugin, not indexed, active after a reload, an experimental API. Nothing in this plan closes it: the union, the codec's forms, the host's sources and the types stay as they are.

## Probes

1. Where an embed's widget is in the source: no `data-pos` seen on SilverBullet's embed widget in its code; its widget menu moves the cursor, so it knows. Else found by URL and order in the page, as Silverware Table finds tables.
2. A markdown embed with three segments (`![a|200|{…}](cat.jpg)`): `mdLinkRegex` (`client/markdown_parser/constants.ts`) takes `{`, `:`, `,` and quotes in the alt; the same for a wiki link.
3. The index and renaming an attachment with such a link (they read the URL, not the alias: expected to work).
4. Replacing a widget's content: no flicker of SilverBullet's own drawing first; what survives SilverBullet drawing the widget anew; what SilverBullet's own widget menu offers on an embed (so that nothing the user needs is lost as it is hidden, *SilverBullet's widget menu*).
5. The rendering of a cell (`markdown.markdownToHtml` on 2.12.1): embeds drawn as media, the DOM it makes (the same as the editor's widget or not), its speed per block over the bridge, and a whole grid drawn anew after one embed in it is written (its widget's cache key is its body's text): how long, whether it flickers (the grid's plan).
6. A type's renderer in Lua called from JS (for later).

### Probe results (2026-11-13, SilverBullet 2.12.1, Chromium)

1. **No position on an embed's widget**: `div.sb-inline-content.sb-lua-directive-block` in a `span.sb-lua-wrapper` in `.cm-content`, no `data-pos` on it or around it. SilverBullet's own Edit button knows it, but nothing in the DOM says it: an embed is found in the page's text by its target and its order among the embeds (as Silverware Table finds tables), by the host.
2. **Three segments hold in both forms**: `![[cat.png|Wiki cat|150|{ view: preview, zoom: 2 }]]` and `![Md cat|150|{ view: preview }](cat.png)` both drew the image 150 px wide (`style="max-width: 100%; width: 150px;"`), alt and title the first segment, the metadata nowhere; typographic quotes in the metadata too. A plain `![[cat.png]]`: no alt, no width.
3. Not probed apart: a rename of an attachment linked with three segments (the index's relation covers the whole node; the grid's rename was probed, *the grid's plan*). Checked by `silverbullet.spec.ts` when built.
4. Partly: **SilverBullet's widget menu on an embed** is a bar of buttons (`.button-bar`), not a menu: **Reload, Copy, Edit, Open** (`data-button` `reload`, `copy`, `edit`, `open`). Hidden, as decided; what the "…" menu takes over: *Open* (the document's own page in SilverBullet, an action `open`), *Edit* is Alt+click. Flicker on replacing a widget's content: probed when built (it needs the decoration).
5. **In a grid's cell an embed is not SilverBullet's widget**: `markdownToHtml` draws an image as a plain `<img>` with SilverBullet's size and alt, and `data-pos` (its offset in the cell), no `.sb-inline-content` round it. The host knows both: SilverBullet's widget in the editor, an element with `data-swl-pos` rendered outside it; what the host draws "natively" in a cell is what `markdownToHtml` drew. Only an image was probed in a cell; a PDF or a video there is checked when built.

**A zip** embedded: `Error: Unsupported content: archive.zip` in the widget, as read from the code.

## Order

The grid and the assets together, from nothing built (2026-11-13). **All done 2026-11-13**; next: docs/silverware-assets-split.md.

1. **The probes of both plans**, one batch: the grid's step 1 (`syntax.define`, a cell's rendering, a rename and the index; done 2026-11-13, the results in both plans) and this plan's 1 to 5. Their results written into the plans; a probe that fails changes a design, not a detail, so nothing is built before.
2. **The grid's first version** (its plan's steps 2 to 8): the first aim, and needs no assets.
3. **The assets** (the steps below, 2 to 7, and 9).
4. **The assets in a grid** (step 8): where the two meet, by `data-swl-pos` alone.

The assets' codec is pure and could be built beside the grid by a second agent.

## Steps

1. The probes (1 to 5).
2. The codec (read and write, wiki and markdown, embeds and links, the three segments, typographic quotes, an embed untouched without changes); tests. **Done 2026-11-13** for embeds: `shared/markdown/embed.ts` (`readEmbeds`, `writeEmbed`, a size and metadata read and written), the page writer's `embeds.set`. Links (`[[report.pdf]]`) are read when they come (*Later*): the occurrence's `form` then.
3. `linkStyle` in `Platform`, the SilverBullet binding's `defaultLinkStyle`. **Done 2026-11-13**, with `documentUrl` (SilverBullet serves a file at `.fs/<path>`). **Taken out 2026-11-14** (the branch's review): nothing read either (a link turned into an embed and back keeps its own form); SilverBullet's `.fs/` URL is `shared/silverbullet/platform.ts`' `documentUrl`, with the SilverBullet platform both plugins write through.
4. The contract (`shared/assets.ts`), the registries of types and actions, the built-in types and `open-tab` registered through it, which view and action apply, the error state; the isolation test's rules for the area; tests. **Done 2026-11-13** but the error state (it is the render's, step 5): `shared/assets.ts`, `assets/model/settings.ts`, `assets/core/registry.ts` and `choose.ts`, `assets/builtin/` (image, video, audio, pdf, file; `open-tab`), the built-in parts' rule in `src/isolation.test.ts`.
5. The host: embeds found in SilverBullet's widgets, decorated or replaced by view; the icon card; `preview` of image and PDF; a click running its action; UI tests (SilverBullet and the playground). **Done 2026-11-13**, its UI tests too (`ui-tests/assets.spec.ts`, against SilverBullet: the menu writing the grid's embed and not the same file's outside it, a zip's card and its click, a width dragged in the page and within a cell, a PDF and a zip in cells, a link's icon, the Media tab's size and the click to the side panel; a file of the test written beside its pages, `space.open`'s `files`): `silverware-assets/src/decorate.ts` over an `AssetHost` (SilverBullet's: `host/silverbullet/assets.ts`: `.sb-inline-content` watched, its medium's `.fs/<path>` or its "Unsupported content" read as the target drawn, its button bar hidden), `core/locate.ts` (a drawn embed found by its target and its order among those of its target), `core/metadata.ts`, `ui/card.ts`; the host's whole drawing hidden where ours is drawn (its medium, or its words that it could not draw one). Seen in SilverBullet 2.12.1: an image left as drawn, a zip a card, an image with `{ view: icon }` a card, a preview at the setting's height, a card's click opening the file. **The card's size and date, done 2026-11-13**: not the platform's (no other plugin needs them) but the asset host's optional `fileInfo` (SilverBullet's: `space.getDocumentMeta`, handed over by the init page as `documentMeta`), asked only where the setting `card` shows `size` or `modified`, added to the card a moment after it is drawn (`addCardFields`: a line under the name, `12 KB · 13 Nov 2026`, the browser's language); the Media tab's boxes Its icon, Its size, Its date. Seen in SilverBullet 2.12.1: a zip's card with its size and date. Left then: media in a grid (step 8), settings changed applied without a new drawing (step 7).
6. The handle on media; the "…" menu with the view switch. **The menu done 2026-11-13** (`ui/moremenu.ts`, the shared menu in Silverware Layout's style page by `scripts/sharedstyles.mjs`: Show as a card, as a preview, as the original (named so 2026-11-13, "in full" unclear to the user), the one shown checked, the settings' own written as none; Open, the click's action). Seen in SilverBullet 2.12.1: an image shown as a card by it, `{ view: icon }` written. **A card's menu by its icon, 2026-11-13** (the user's wish): a card has no "…" over its name; its icon opens the menu, as a link's icon does (`swa-menu-icon`: filled and a little larger as pointed at, no ring nor arrow, the user's choice); a card without its icon (the setting) keeps the "…". The menu lists the views, then every action that fits (not the click's alone), then Show as a link. **The handle done 2026-11-13** (the user's choice: a medium stays where it is, configurable): `shared/layout.ts` gained `LayoutAnchor` and a provider's optional `anchor` (none: centred, so tables, charts and grids are as they were); the handle's drag (`draggedWidth`) and guides follow it, the style page keeps a widget marked `data-swl-anchor-start` at the text's start; `silverware-assets/src/provider.ts` lays a decorated medium out (not a card), its anchor the setting `silverware.assets.anchor` (`start` by default, `center`), its width in pixels only (SilverBullet's % is of the medium's box, Layout's of the pane: a % left to SilverBullet, one Layout gives written as the pixels shown), written as `|300` with the height taken off. Seen in SilverBullet 2.12.1: a drag of 60 px widened an image by 60 at its place, `|260` written.
7. Settings and the Media tab. **Done 2026-11-13**: the dialog takes tabs of other parts generically (`DialogTabPart` in `ui/pagedialog.ts`, `LayoutApp.dialogTabs`: it knows no area), `silverware-assets/src/ui/mediatab.ts` (All files: shown as, a click, a Shift+click, where a width dragged stays, the card's icon; a row per type, Default following All files), saved in Silverware Layout's own block of CONFIG (`silverware.assets`, in the init page's schema), the media decorated again at once (`redecorateAll`); an action's optional `label` in the contract (`open-tab`: Open in a new tab). Seen in SilverBullet 2.12.1: images set to cards in the tab, saved, the page's image a card at once. **A preview's height in the tab, done 2026-11-13**: a number (40 to 2000 px; anything else keeps the one it had) saved as `heights.preview`; the original's height (`heights.embed`) left to CONFIG, as nothing SilverBullet draws reads it (only a type's own rendering of `embed`).
8. In a grid: the same decoration on the cells' media (found by `data-swl-pos`), the snaps to the cell's shares. **Done 2026-11-13** but the handle in a cell: the grid marks its cells `data-swl-rendered` (markdown rendered outside the editor, a convention of Silverware Layout's, no grid named), SilverBullet's asset host frames each medium there in a frame of its own (`span.swa-frame`), decorated as a widget is; an embed found by its target and order as in the editor (`data-swl-pos` not needed so far). **Fixed 2026-11-13** (the user found it): the same file outside a grid and in it changed both, a view chosen in the grid written to the one outside (a grid drawn before SilverBullet's widget above it counted its image first). Now by the convention: a grid's cell marked with its markdown's place (`data-swl-pos`, `data-swl-end`), a medium there found by its place exactly (its block's place and SilverBullet's `data-pos` in it); SilverBullet's widgets counted among the embeds outside every block rendered outside the editor; a block given its place later (its grid drawn while the editor's text was still the page before) has its media offered again. Seen in SilverBullet 2.12.1: an image in a cell switched to a card by its menu, written in the grid's text. **The handle in a cell, done 2026-11-13**: `shared/layout.ts` gained a provider's optional `room` (the box a widget is laid out in where it is not the page's text); the assets' provider gives a medium in markdown rendered outside the editor that block (`[data-swl-rendered]`, the convention: no grid named). Layout marks such a widget `data-swl-in-room` (the style page holds it within the room, at its start), its handle snaps to the room's quarters (`roomTargets`, kept as pixels) and drags within it (`draggedRoomWidth`, 40 px at least); `Widgets.widgetAt` gives the innermost widget (a medium in a grid, not the grid). Seen in SilverBullet 2.12.1: an image in a cell dragged by 60 px (`|210` written), and far right held at the cell's width, the guides 25 % to 100 % of the cell. **Other media in a cell, done 2026-11-13**: `markdownToHtml` (2.12.1) draws a video and audio as their elements, leaves a PDF out and a zip as its text; SilverBullet's grid host renders each such embed as a stand-in image of no file (`![swl-embed-N](data:,.png)`, nothing loaded) and swaps it in the HTML for a PDF's `<object>` or a place `span[data-swl-embed]`, the offsets after it set back (`host/silverbullet/undrawn.ts`); the asset host frames them as media. Seen in SilverBullet 2.12.1: a video, audio, a PDF (the cell's width) and a zip (a card) in cells, nothing fetched.
   **The markdown shown as written, fixed 2026-11-13** (the user found it): SilverBullet's *Editor: Toggle Markdown Syntax Rendering* keeps drawing an embed's widget and a custom syntax's (`client/codemirror/clean.ts`, `pluginsNeededEvenWhenRenderingSyntax`, 2.12.1: the medium over its line, the grid under its lines). `host/silverbullet/syntaxmode.ts` marks the root `data-swl-syntax-shown` while SilverBullet's UI option `markdownSyntaxRendering` is on (the bridge's `getUiOption`, asked as SilverBullet draws widgets anew, which switching the mode does), and the style page hides the media decorated and the grids there, with the host's box round each (an empty one was a line's height). Seen in SilverBullet 2.12.1: the markdown alone, all back once switched again. **A click there, 2026-11-13** (the user's wish): SilverBullet follows a link on its `click` in the editor (`page:click`, `editor_state.ts`) on all of a wiki link's text, `![[` too, so the cursor could not be put before an embed; while the mode is on, a plain click in the text is held back from it (a capture listener; the cursor is CodeMirror's, placed by the press), Ctrl/Cmd+click following as before, a widget's click its own; the mode asked again at each press in the text (a page with no widget to draw anew kept its mark). Seen in SilverBullet 2.12.1: a click on `![[` and on `[[Links]]` put the cursor there, the page kept; in the usual mode the link followed. **Behind settings, 2026-11-13** (the user's wish): `silverware.layout.syntaxMode.hideWidgets` and `.clickPlacesCursor` (on unless set false; `config.define`d, so the Configuration Manager shows them), the Page layout dialog's **Markdown** tab (`ui/syntaxtab.ts`, a box each); the watcher reads them with the mode at each check, the ones just saved held until the configuration gives them (SilverBullet loads it again a moment after a save); while the click is held back the root is marked `data-swl-syntax-clicks` and the style page shows the text's pointer over a link (the user saw a hand where nothing followed). What SilverBullet 2.12.1 follows there (probed): an embed's line on a click anywhere on it, `!` included; a plain wiki link not. The UI tests check that the click reaches SilverBullet or not (a listener under `#sb-main`), not what it then does, which differs between its versions.
9. Library page (an embed's size and metadata, the views, the settings, what a space without the plugin shows), release. **Library page done 2026-11-13** (*Media*); the release waits for the split (docs/silverware-assets-split.md) and the user's word, before the branch is merged.

Also fixed 2026-11-13: a file in a folder whose name has a run of spaces was not decorated (SilverBullet's "Unsupported content" words keep the run as a no-break space and a space: read as spaces again, `drawnTarget`).

Then *Later*.

## Decided (2026-11-13)

- Media decorated by registered types, `silverware.assets`; an image one of them.
- SilverBullet parses and draws; Silverware Layout decorates or replaces; no `syntax.define` for embeds.
- Metadata in a third segment of the alias, `{ … }`, always three segments.
- The link form by SilverBullet's `defaultLinkStyle`, through the platform; an embed keeps its form.
- A type's icon is a plain image (URL or SVG text), given by the type.
- Views `icon`, `preview`, `embed`, key `view`; the default by the user's settings alone (a default and per type), never a type's.
- The icon card drawn by Silverware Layout, its content the user's setting.
- PDF preview a smaller `<object>` first.
- Clicks by registered actions, a default and an override per type and gesture; `open-tab` first, a peek panel and a popover the aim.
- Built-in types overridable by registering the same name.
- Types from JS first, Lua after a probe.
- A type provides renderers (per view a function, or none for the host to draw where it can; `null` from a renderer the same for one asset); the core decides what is rendered. Its context `asset` (a union by `kind`: `file`, `web`, later `page`; `url` and `alt` where the kind has them), `viewport` (live, its height always given), `metadata` (values, helpers, write), `signal`.
- The size always Layout's: the stored dimensions in the page, a surface's own size in a peek or a popover; never a renderer's.
- A type's assets by `match` (`kind`, `ext`, `mime`, `test`), the most specific winning.
- An embed's syntax the codec's, never a type's; `form` (`transclusion`, `link`) and `style` (`wiki`, `markdown`) in the occurrence, not handed to types.
- Actions generic, for every type: the mechanism the core's, the actions registered (Layout's own as anyone's), fitting by capabilities, rendering through the core.
- Metadata: their place in the text the codec's, their meaning the core's (its reserved keys) and the type's (its own), written by the core through the store.
- A failed render: the host's drawing (else the card) with an error icon and the message as its tooltip.
- `silverware-assets/src/` an area with Layout's layers inside, its built-in parts through the contract alone; grid and assets unaware of each other.
- Reviewed again 2026-11-13: an embed rendered outside the editor found by `data-swl-pos` (a host convention); the default action data in the settings' default, no fallback name in code; the size the asset's in every view, a preview's default size a setting; a type's card fields a function; the API `silverware.assets.api`, versioned apart; *core* meaning `assets/core`; *asset* in code, *Media* in the UI.
- Embeds first, the code ready for links; embedded pages SilverBullet's until links come.
- The "…" menu and the Media tab in the first version; SilverBullet's own widget menu hidden on decorated embeds and on the grid, as on Silverware Chart's and Database's widgets.
- Paste and drop taken over later, files only.

## Open

- The names of the settings' keys and of the card's fields.
- Whether a centred asset (as a widget) is wanted.
- The original's default height (`heights.embed`, CONFIG alone: nothing SilverBullet draws reads it); a preview's is in the Media tab.
- Where pasted files go (a folder per page, one folder, a pattern), when paste comes.
