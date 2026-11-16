# SilverBullet's shortcuts where a plugin keeps them

A plugin's surface stops the keys it gets, so SilverBullet does not act on them: a grid's cell edited (Silverware
Layout), a database's peek (Silverware Database), a document's reader (Silverware Assets DOCX and XLSX, in the page or in
Silverware Assets' side panel). SilverBullet's shortcuts do nothing there, and a user pressing one sees nothing happen.
Decided with the user (2026-11-16): such a key is told in SilverBullet's notification, short, the command named:
"Open Command Palette doesn't work here". Only told, nothing offered to run it; the user learns what works where.

## Probed (SilverBullet 2.12.1, 2026-11-16)

- `system.listCommands()` lists every command, 172 in a fresh space, each with `key` and `mac` (a string or a list) where
  it has a shortcut. 45 of them are CodeMirror's editing ("Editor: Cursor Line Up" on ArrowUp, "Editor: Insert Newline"
  on Enter): what a field does itself, never told. The other 38 are SilverBullet's and the plugins' own (Ctrl-/, Ctrl-k,
  Ctrl-b, Alt-ArrowLeft…), some a sequence of two (`Ctrl-q q`, `Mod-. k`). The user's `shortcuts` setting was none there.
- SilverBullet takes its shortcuts at the document: Ctrl+K in a field outside the editor opens the page picker, in one
  whose keydown is stopped it does not. So every key a surface of ours stops is kept from SilverBullet.

## How

- `shared/silverbullet/keptkeys.ts` (generic, knows no surface): given the commands as the init page's Lua hands them over
  (`listCommands = system.listCommands`) and how to tell (`flash`), a function a surface calls with each key it stops.
  Told only where the key is a command's shortcut (the first key of a sequence: the commands it starts named, or "<key>
  shortcuts" where several), on its keydown alone, the field did not take it (`defaultPrevented`: CodeMirror's own
  keys, Esc, a toolbar's shortcut), not AltGr typing, the same message not again within 2 s. A key a field acts on
  natively without saying so (a textarea's Ctrl+Backspace) would be told where it is also a command's: none of
  SilverBullet's own outside "Editor: …" is one of those. The commands read once, again after 30 s (Space Lua loaded again
  adds or changes them); a reading that failed is not kept. Without `listCommands` (an older init page, the playground) nothing is told.
- `shared/keys.ts`: `keyMatches` (moved from shared/editor.ts, its users importing it from here) also takes a key by its key code
  where Ctrl, Alt or Cmd is held, as CodeMirror's keymaps (SilverBullet's) do: `Ctrl-Shift-8` where the key typed is
  `*`. Shift as named, never Ctrl with Alt off a Mac (AltGr typing).
- Silverware Layout: `GridHost.keyKept`, the cell's field's element telling each key it stopped (a listener of its own
  on that element: it runs after the editor's, which stops it).
- Silverware Database: `ModuleHost.keyKept`, the peek's element telling each key it keeps.
- Silverware Assets DOCX and XLSX: the init page hands `flash` and `listCommands` over; the reader's shell
  (`shared/docreader.ts`) tells each key it stops.
- Not told: typing in the peek's read-only content (the user's choice: no message).

## Steps

1. [x] `shared/keys.ts`, `shared/silverbullet/keptkeys.ts`, their tests.
2. [x] Layout's cells, Database's peek, DOCX and XLSX readers; init pages.
3. [x] Checked in SilverBullet 2.12.1 (each surface's message, what JS gets of `system.listCommands()` read): a UI test each, the grid's cell (grid.spec.ts), the peek (database.spec.ts), a reader in the side panel (docx.spec.ts, xlsx.spec.ts).
