# Silverware Toolbar: changelog

## 2.0.0 (2026-11-25)

- **Breaking:** needs SilverBullet 3.0 or later. On SilverBullet 2.12, use the versions kept for it in the branch `silverbullet-2.12`: add its repository, `https://github.com/damesene/silverware-libraries/blob/silverbullet-2.12/REPO.md` (*Library: Add Repository*), then remove this library and install it again from there (or change `blob/main/` to `blob/silverbullet-2.12/` in the `share.uri` of its page).

## 1.1.3 (2026-11-24)

- Settings are saved again on SilverBullet 3.0: saving any setting kept nothing before (SilverBullet 3.0 tells its configuration page another way).
- On a phone with SilverBullet 3.0, the toolbar docked at the bottom steps aside while the space tree is open, so it no longer covers the tree's last items.

## 1.1.2 (2026-11-19)

- Fixed: letting go of a favourite dragged in the settings, or cancelling the drag with Esc, no longer counts as a click on what lies under the pointer.
- The settings' lists and the actions' popup scroll with a thin scrollbar, the same in every Silverware plugin.

## 1.1.1 (2026-11-18)

- Fix: Esc pressed right after closing the actions popup hides the toolbar for good (it came back a moment later).

## 1.1.0 (2026-11-17)

- Works with SilverBullet's next version (3.0) as well as 2.12.1: its settings are saved in `Library/Config` there, where SilverBullet keeps them (`CONFIG` in 2.12.1 and before).
- SilverBullet's own toolbar by the selected text (in its versions after 2.12.1) is hidden while this one runs, so only one shows; the settings' General tab offers to turn SilverBullet's off.
- With Silverware Editor installed, the toolbar works in other plugins' fields too: a cell of a Silverware Layout grid as you edit it, an item's content in Silverware Database's peek (shown over the peek).
- Fixes: a selection made before the toolbar started is shown; Silverware Layout's font zoom label stays clear of a toolbar docked at the bottom.

## 1.0.1 (2026-11-12)

- Its menus and dialogs layered in one order with the other Silverware plugins', so none shows under another's.

## 1.0.0 (2026-11-11)

First versioned release.

- A toolbar by the selected text (docked over the keyboard on a phone): formats, links, tags, and turning lines into lists, headings, quotes or code blocks and back.
- Any action or SilverBullet command from a searchable list, toolbars of your own with gesture buttons and text snippets, icons and emoji with Silverware Icons.
- The toolbar no longer shows over a table or a database in full screen.
