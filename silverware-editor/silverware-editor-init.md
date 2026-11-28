---
tags: meta
---
# Silverware Editor init

What starts [Silverware Editor](silverware-editor.md) in SilverBullet: the space's pages handed over (for links completed as you type `[[`), the editor loaded when the browser is idle. It is installed with the library; its Space Lua API is [silverware-editor-api](silverware-editor-api.md).

```space-lua
if js and js.window and not silverware_internal.editor.refused then
  local silverwareEditorJs = js.importFromSpace("Library/damesene/silverware-editor.js")
  silverwareEditorJs.init({
    listPages = space.listPages,
    -- SilverBullet takes Ctrl+Z (Ctrl+Y) at the window and holds them back (2.12.1): our editors undo at the window too
    historyAtWindow = true,
  })
end
```
