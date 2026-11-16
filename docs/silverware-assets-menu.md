# Silverware Assets: a file's menu, made clear

Proposed and built 2026-11-15 (the user's decisions under *Decided*). The menu a file opens (its "…", a card's icon, a link's icon) had
grown item by item into one flat list that reads as a jumble. This is its redesign: what is wrong, the menu as
proposed, what changes in the code and the contract, and what is for the user to decide.

## The menu now (2026-11-15)

An image shown as the original, its "…":

```
Show as a card
Show as a preview
Show as the original        ✓
───
Open in a new tab
Show in a side panel
Show enlarged
Copy image
Download
Copy markdown
Show as a link
───
Delete file…
```

A PDF's preview adds Regenerate preview; a link's icon opens the same list less the three views, Show as embedded in
place of Show as a link. Where the file stands (Align) and its width are in another menu, Silverware Layout's, by the
grip beside the file (a preview's grip opens that menu alone).

## What is wrong

1. **One verb, three meanings.** "Show as a card / preview / original" changes the page (written into the embed, kept),
   "Show in a side panel / enlarged" only looks at the file now, "Show as a link" rewrites the markdown. The user cannot
   tell from the words which items change the page and which do not.
2. **One choice spread over two places.** How a file appears in the page is a choice of four (a link, a card, a
   preview, the original), yet three of them are the top section and the fourth ("Show as a link", "Show as embedded")
   sits among the actions. The link's menu has no views at all, so going back from a link is another item again.
3. **A flat middle.** Eight items of four kinds in one section: looking at the file (tab, panel, enlarged), copying
   (image, markdown), the file itself (download, regenerate), the page's form (as a link). Nothing groups them.
4. **Two menus for one file.** Its look is in the "…", where it stands in the page is in Layout's grip menu, which a
   user finds only by pointing beside the file.
5. **Order by history, not by use.** The views first, though a menu on a file is opened most often to open or download
   it.

## The menu proposed

The same for every file and form (a preview, the original, a card, a link), only what does not apply left out:

```
report.pdf                                   (the file's name)
Show as   [ link | card | preview | original ]   (segmented, icons, the one shown active)
Align     [ left | centre | right ]               (segmented, with Silverware Layout; not for a link or a card)
───
Open in a new tab
Open in side panel
Open enlarged
───
Copy image                                   (an image)
Copy markdown
Download
Regenerate preview                           (a preview kept in the space)
───
Remove from page                             (an embed, a file of the web too: its markdown alone, 2026-11-15)
Delete file…                                 (danger colour; a file of the space)
```

- **"Show as" is one choice of four**, as Align is one of three: a row of icons (link, card, preview, original), each
  its name and "(default)" for the one the settings give as its tooltip, the one shown active. Choosing link writes
  the embed as a link, choosing another from a link writes it as an embed of that view: what "Show as a link" and
  "Show as embedded" did, in the same row. One the file cannot be shown as is disabled with why (a zip has no preview).
- **Changes to the page first, together**: Show as and Align, the two rows that write the embed. Everything below
  leaves the page as it is (but Delete).
- **"Open …" for looking at the file**, three items with one verb: a new tab, the side panel, enlarged. (The side
  panel and enlarged keep their names in the settings' click choices: the same words there.)
- **The file's own section**: copies (image, markdown), download, regenerate. What other plugins add goes in by the
  group it names (below).
- **Delete last and apart**, as now.
- **Align in Assets' menu**: Assets keeps a file's `align` in its metadata already and hands it to Layout through its
  provider (docs/silverware-layout-align.md); the row writes the same metadata. Shown only where Silverware Layout is
  installed (its API handed over), as without it no alignment means anything. Layout's grip menu keeps its own Align
  (any widget's) and its width: the same metadata, two ways in.
- A link's menu is the same list: Show as with link active, no Align (a link stands in its line), Open, the file's
  section, Delete.

## What changes

- **shared/popupmenu.ts**: nothing new (sections and segmented rows exist).
- **shared/assets.ts**: `AssetAction.group?: "open" | "file"` (none: `open`), where another plugin's action goes; an
  optional field, the contract's version unchanged. The built-in actions named by it: open-tab, peek, popover `open`;
  copy-image, download `file`.
- **shared/glyphs.ts**: four icons for the views (link, card, preview, original), as the align icons are there.
- **silverware-assets/src/ui/moremenu.ts**: `MoreMenu` as rows (show as, align) and sections (open, file, delete);
  `decorate.ts` builds one menu for an embed and a link alike (`menuOf`), from the asset, its form and its capabilities.
- **Labels**: "Show in a side panel" → "Open in side panel", "Show enlarged" → "Open enlarged", in the settings' click
  choices too; "Show as a link" / "Show as embedded" / the three "Show as …" items gone into the row.
- **Tests**: the unit tests that list the menu (decorate.test.ts) and the UI tests that pick an item by its label
  (assets.spec.ts, link-touch.spec.ts, settings, the grid's), the library page's description of the menu.
- **Not a breaking change**: nothing stored changes (the metadata written is the same); Assets is not released yet.

## Decided (the user, 2026-11-15)

1. **No Align in Assets' menu**: Layout's grip keeps it, and that grip's menu is where a widget's menu goes in time
   (this "…" menu to be given up for it then). The rows above have Show as alone.
2. **Separators alone**, no headings over the sections.
3. **The page's row first**, then Open, then the file's section, Delete last.

Built so: the menu above less its Align row; the copies first in the file's section (Copy image, Copy markdown),
then Download, Regenerate preview.

## The arrow (2026-11-16)

The user's decision: a link's and a card's icon opened the file's menu (the arrow after the text only where the icon
was hidden), which made sense once known and was found by nobody new. Now the type's icon is a picture alone and the
small arrow (`swa-link-marker`, `swa-card-marker`) is always drawn after a link's text and after a card's name, and it
alone opens the menu. A click on a link's icon is the link's (it follows it, as its text does, in a field of another
plugin too: the editor's `swe-link-lead`); on a card's icon, the card's action. In another plugin's field the arrow is
drawn after the link through `FieldDrawing.linkAfter` (shared/editor.ts), its edit finding the link's markdown before
it. Hiding the icon (Appearance, Link or Card) no longer touches the menu. A link to an image offers a preview in its
Show as, as an embed of it does (the browser's drawing, smaller): it had offered one only where the type drew its own.
