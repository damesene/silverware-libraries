---
name: Library/damesene/silverware-core
tags: meta/library
version: 1.0.0
description: "Silverware Core: what the Silverware plugins share in a window. Installed with them; nothing on its own."
files:
- silverware-core.js
- silverware-core-api.md
- silverware-core-style.md
---
# Silverware Core

What the Silverware plugins share while they run: one copy for every plugin in the window, so they work together. It does nothing on its own, and you need not install it yourself: each Silverware plugin installs it with itself.

## Where a plugin says it needs a newer Silverware Core

A plugin built for a newer Silverware Core than the one installed does not start, and says so in a notification ("Silverware Table needs Silverware Core 1.1 or later (installed 1.0.0)"). Its Space Lua functions say the same where a script calls them. To fix it:

1. Run **Library: Update All** (updating one plugin alone leaves Silverware Core as it was).
2. Reload the page: an updated Silverware Core is loaded only by a reload of the browser.

The same holds where Silverware Core is missing: Library: Update All installs it.
