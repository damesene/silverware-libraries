# Files & media: the review left to do

The branch `feat/database-files` (docs/silverware-database-files.md) was reviewed step by step up to its step 10, the
files' zoom (768445d2) and its docs (31fb257c). The commits after them were made without a review, on the user's word
(tokens to spare), and are reviewed here, asked by the user 2026-11-18. Each finding is written under its part as it is
found, with what was done; a part is ticked once reviewed.

## The commits

| Commit | What |
| --- | --- |
| 7502a065 | Files small in the peek, smaller in their popup, a ⋯ menu each (View original, Download, Remove) |
| 57bfba46 | The popup narrower, a file's menu beside it, its field and Upload in one row |
| 0769f614 | A file's menu closed by another's or its own press; room for the field on a phone |
| fd9ba7b0 | The popup in the peek laid over the page (`floatPanel`), its list alone scrolling |
| 0abc2dbe | A file's menu placed within the window (`position: fixed`, `placeMenu`) |
| 7f4b0de7 | Assets' dialog: sources (a link, a file of the space), titles; `insertFiles` resolving `AddedFile`; Database's titles (`[[path\|title]]`, `[title](url)`), its popup's **+ Add files…** |
| 0061e8fb | The popup as narrow as its pictures, every ⋯ at its right |
| 942baad6 | The insert dialog of one height |
| 25226e4d | One thin scrollbar for every plugin (`shared/scrollbar.css`, `__scrolls__`) |
| f6b4b68b | The insert dialog plainer: one field and Browse…, a row's title first, the button's verb and count |

## Parts to review (what to look for)

- [x] **Database's files' popup** (`views/fileseditor.ts`, its style): the menu's open and close (one at a time, Esc,
  a press elsewhere, an item chosen, the list scrolled), its placement (`placeMenu`: edges, over the ⋯ where no room
  under it), focus never lost to the body (the popup closing unasked), the field's fallback without Assets, a link
  pasted, the upload's late answer with titles, the drag of a row with the menu's box in it.
- [x] **The popup in the peek** (`floatPanel` for `.swd-editor-files`): lifted or not (`PLACE_SELECTOR`: the peek is no
  place), clipped by the peek's own box, its layer over the peek, Esc and a press beside it.
- [x] **Titles in a value** (`domain/types/files.ts`): `readFile` of `[title](url)` and `[[path|title]]`, `writeFile`'s
  title cleaned, `typedFiles` reading a titled address, `fileLabel` where a name was shown (text, sort, filter,
  tooltips, the menu's download name), `leaves` and `areFiles` with titles, the store's rename of a file keeping a
  title.
- [x] **Assets' insert dialog** (`ui/insertdialog.ts`): the one field (a link, words of the space), Browse…, a drop on
  the dialog (also where it was opened for a page, a field), rows of a link and of the space (no upload, no name
  checked, `pathsApart`), ✎ and the name's field shown on a problem, the title written (a page's markdown, `nameOnly`'s
  `AddedFile`), *Save a copy*'s fetch and its failure, the summary and the button's label, Ctrl+Enter, the focus as it
  opens, a phone (no Camera), the dialog's one height.
- [x] **Assets' API change** (`shared/assets.ts` `insertFiles` → `AddedFile[]`, `GivenFiles` with a link alone):
  callers, docs (docs/silverware-assets.md), the stand-in, every plugin `shared/assets.ts` reaches.
- [x] **The shared scrollbar** (`shared/scrollbar.css`, `scripts/sharedstyles.mjs` `__scrolls__`): each page's
  selectors real (classes that exist), none of SilverBullet's, `:where` losing to a plugin's own rule (the table's held
  header, a strip whose scrollbar is hidden), the marks' place in each style page (inside its `space-style` block).
- [x] **Docs** of these: silverware-database.md, silverware-assets.md, the plans, CLAUDE.md, against what was built.
- [x] **Tests**: what these commits changed of the UI with no scenario (a menu's placement on a narrow screen, Esc on
  a menu, a link pasted on the popup, a drop on the dialog, *Save a copy*), a test that only passes by its own setup.

## Findings

- **Popup: the last file taken out lost the focus** (fixed): it went to the field, which is not there where Silverware
  Assets adds the files; the popup then closed unasked. It goes to + Add files… (or the field without Assets).
- **Popup: Download named the file by its title** (fixed): `download` the title (`Beach`, no extension); the file's own
  name now (`fileName`).
- **Popup: Enter on Download closed the popup** (fixed): the panel's Enter left buttons alone, not a link; a link too.
- **Popup: the space's files listed for nothing** (fixed): with Silverware Assets the popup has no field to search them,
  yet listed them each time it opened; only where the field is.
- Tested: tests/fileseditor.test.ts, a file's menu (its download's name, Enter on it, the focus as the last goes).
- **The popup in the peek**: nothing found (`position: fixed` not contained by the peek, which has no transform; its
  layer 75 over the peek's 70; its `overflow: hidden` over `.swd-floated`'s `auto`, its list alone scrolling).
- **Titles**: nothing found (read, written cleaned, shown, sorted and filtered by; `leaves` and `areFiles` by targets).
- **Insert dialog: a dead option** (fixed): `InsertDialogHost.touch` was left from Camera, read by nothing; taken out,
  the file's header comment written anew (it still told of Files and Camera).
- **API docs** (fixed): docs/silverware-assets.md told `insertFiles` resolved targets; it resolves `AddedFile`, a link
  alone given too.
- **Scrollbar**: nothing found (each selector a class of its plugin, some made of a base in code; `:where` of no weight).
- **User docs** (fixed): silverware-database.md still named **Camera…** in the dialog and said files are sorted by their
  names (their titles first now).
- **Tests added**: a drop on the insert dialog (Assets' insertdialog.test.ts), a link pasted on the files' popup opening
  the dialog, words pasted left alone (Database's fileseditor.test.ts). Left without a scenario: a menu's placement on a
  narrow window (a UI test resizing the page broke SilverBullet's page: the check stays its being whole in view), *Save
  a copy*'s fetch from a site (a network's).
- Review done 2026-11-18: `verify` 2903, Assets' and the files' UI tests 71.
- Left as it is: a file's ⋯ menu is `role="menu"` without arrow keys between its items (Tab moves between them).
