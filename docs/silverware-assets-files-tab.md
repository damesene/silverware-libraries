# Silverware Assets: the settings' Files tab, all files first and each type's own apart

Proposed 2026-11-16 from the user's screenshot, decided with the user the same day; built the same day on their word.

## Why

The tab was a table: a row for all files and one per type, four selects each (Shown as, Inserted as, Click,
Shift+click). At the dialog's width every select cut its value ("Like all fil", "Same as show", "Open in side"), so what
is set could not be read; 32 selects said "Like all files", which hid the few rows that differ; the types were named as
the code names them (`pdf`, `archive`, `file`); the insert dialog's checkbox stood under the table, away from Inserted
as; and the Appearance tab sets per type another way (a row per type, one open, marked Own, Reset).

## Decided (the user, 2026-11-16)

1. **All files first, each type's own apart, as Appearance does**: All files' four settings one under another, full
   width, their names before them; then a row per type, closed showing what it sets ("Like all files", or "Own" and
   what differs: "Shown as Preview, Click Open enlarged"), one open at a time with the four settings and
   "↺ Reset to all files".
2. **Shown as a pick list, as the others** (first a segmented control, Card | Preview | Full; seen built, the user
   chose a pick list everywhere the same day: the row of buttons beside the lists did not look right); a type's
   "Like all files · Full" as its other lists. Inserted as's name at its pick list's height, the insert dialog's box
   under it in the controls' column (centred against both, the name read as the box's).
3. **Types by human names**: Images, Videos, Audio, PDF, Archives, Word (DOCX), Excel (XLSX), Other files (a type
   registered by another plugin: its own label where it gives one, else its name); the settings keep `image`, `pdf`….
4. **The insert dialog's checkbox under Inserted as**, in All files' block.

```
Files
How files are shown, inserted and opened: for all files, and a type's own where it differs. How one file is shown,
chosen in its … menu, wins over both.

ALL FILES
  Shown as      [ Full                   ▾ ]
  Inserted as   [ Same as shown          ▾ ]
                ☑ Use the insert dialog for pasted, dropped and uploaded files
  Click         [ Open in side panel     ▾ ]
  Shift+click   [ Open in a new tab      ▾ ]

PER TYPE
  Images             Like all files                    ›
  PDF        Own     Shown as Preview                  ›
  ▾ Excel (XLSX)  Own
        Shown as      [ Like all files · Full          ▾ ]
        Inserted as   [ Like all files · Same as shown ▾ ]
        Click         [ Open enlarged                  ▾ ]
        Shift+click   [ Like all files · New tab       ▾ ]
        ↺ Reset to all files
```

- A type's choice "Like all files" says what that gives ("Like all files · Full"), so what happens is seen.
- On a phone it is one column already: the table's own layout for touch goes.

## A document's height, by type (decided 2026-11-16)

The Appearance tab's "A PDF's height" (`full.height`, 480 px) stood alone under Full's labels, named for PDFs while it
sets every document shown full whose drawing has no height of its own: the browser's PDF viewer, Silverware Assets DOCX's and
XLSX's readers (images, videos and audio have their own size); an embed's own size (`|600x800`) wins. It goes into
Full's rows as a preview's size is in Preview's: All files' row "Document height", and a type's own where it applies
(PDF, Word, Excel: marked Own, Reset), none for a type it does nothing for. Kept as `full = { height, types = { pdf =
{ height } }, labels }` (unreleased: no migration). Which types it applies to: a type says so (a document of its own,
the registry's), not a list here.

## Saved previews (decided 2026-11-16)

The Files tab's last section, "Saved previews": its checkbox "Save slow previews in the space (PDF, Word, Excel)" with a
line of what it does; under it, indented, the Folder field (disabled while saving is off) with a line, and a
"Clean up previews…" button (the command's own clean-up, also while saving is off: what was kept before) with a line.
"Folder" alone said nothing, the field was live with saving off, Clean up was a command alone.

## The Markdown tabs, Assets' and Layout's (decided 2026-11-16)

Their texts said neither what "markdown as written" is nor that the settings change SilverBullet's own behaviour (off
being SilverBullet's own was a note's), and a checkbox read as a negation ("as markdown only"). Each tab: a line on
top ("These settings change how SilverBullet itself behaves. Turn one off to get SilverBullet's own behaviour back."),
then each setting under a heading of when it applies, a sentence on what SilverBullet does then, the checkbox as what
we do, "On: …" and "Off (SilverBullet's own): …". Assets: PLAIN MARKDOWN VIEW, "Hide embedded files in this view".
Layout: LINKS SHOWN AS MARKDOWN, "A click only places the cursor; Ctrl+click opens the link"; PLAIN MARKDOWN VIEW, "Hide
grids in this view" (no "columns"). The same words in the init pages' `config.define` labels.

## Layout's Guides tab (decided 2026-11-16)

Full width is a guide (the whole pane), so it is the list's last row (the widest, the list ascending), a checkbox for
its number; "+ Add guide" under it. A line on top says what guides are (the widths a table, a file or a grid snaps to
as its width is dragged, marked under the width's slider too); Preview says it is held ("Hold to preview" by its eye);
an empty list says "No guides: a drag does not snap".

## Steps

1. [x] Assets: the Files tab rebuilt (ui/mediatab.ts), the types' human names and which are documents (the type's
   own, `shared/assets.ts`), a document's height by type (`full.types`), Saved previews, the Markdown tab's texts.
2. [x] Layout: the Markdown tab's texts, the Guides tab (an agent, its files apart).
3. [x] Unit tests, UI tests (Assets, Layout), screenshots, review, commit on the user's word.

## Findings

- **Built** as decided; screenshots shown to the user. A choice pressed in a segmented control told no change, so the
  window kept Save off (found by the UI test): told now as a field's change, a unit test of it.
- **Review** (independent agent): no setting lost or changed. Fixed: the library page described the old tab (columns,
  "Keep previews in the space", "a full PDF's height", "markdown as written"); the tab's line said a file's own choice
  wins over its type's in everything, while a file chooses only how it is shown; the window read only had its new
  buttons live (Shown as, Reset); Saved previews named PDF, Word and Excel where only Silverware Assets PDF, DOCX and XLSX keep
  previews (said by the types that do, `storesPreview`); Clean up previews had an ellipsis and asked nothing; a type's
  "Like all files" in Shown as said what it gives in its tooltip alone (its name now, read out too); Full's Reset said
  "label and size"; Layout's links had no "On" note; the init pages' labels and descriptions alike. Tests added: Full's
  Reset of a type's height, the folder kept while saving is off, the note by the types keeping previews, Shown as on a
  phone within the screen.
