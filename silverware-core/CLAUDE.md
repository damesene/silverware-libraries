# Silverware Core

What the Silverware plugins share at run time: **one module per window that every plugin loads**, so what must be one (a registry, the overlays' stack, a watcher of the document) has one instance, and what must be one version for every plugin (the formulas' engine) is. **A library for the other plugins, nothing on its own**: no init page, no commands, no settings. Prefix `swk-`, Space Lua API under `silverware.core`, commit scope `core`. The plan: docs/silverware-core.md; the work and its progress: docs/silverware-core-work.md.

## How the plugins load it

- **Its API page runs first of ours** (`-- priority: 60`): it imports the bundle and sets `silverware.core.version`.
- **Each plugin's gate** (priority 55, in its API page, or its init page where it has none) imports the core in a `pcall` and checks its `VERSION` against the plugin's need (`scripts/coregate.mjs` `NEEDS`, the one place it is kept): a core of the same major, that minor or later. Refused, the plugin says why once, its Space Lua API's functions refuse with the same message (`error`), and its own blocks do nothing (each `js.window` check also checks `silverware_internal.<key>.refused`; check-build fails on one that does not). The block is written by `npm run build` from the script: never edit it in a page. A plugin taking another's function through its Lua (Silverware Chart Table's `tables`, Assets and Layout the toolbar's `defineActions`) checks that one was not refused, `not (silverware_internal.<other> and silverware_internal.<other>.refused)`: a refused plugin's stubs only refuse (check-build fails on one unchecked; an `api` field is not stubbed, nil where refused). check-build reads the pages line by line: a guard goes on its `if`'s line, the other plugin's function named whole (`silverware.<other>.<name>`, never through a local alias).
- Every library page `requires:` `../silverware-core/silverware-core.md`: Library: Install of a plugin installs the core with it; Library: Update of one plugin leaves the core as it was (SilverBullet updates no requirement installed), Library: Update All updates it. An updated core is loaded only by a reload of the browser: a module is evaluated once per window, and System: Reload evaluates none again.
- A plugin's bundle imports the core as `silverware-core`: the build leaves it out, as `./silverware-core.js` beside the plugin's (`scripts/build.mjs`); tsc, vitest and the playground resolve it to `src/api.ts`.

## Its API

- **`src/api.ts` is the public module**, the only one a plugin imports (`scripts/coreneeds.test.ts`: no file of a plugin or shared/ names a file of the core). Every export carries `@since X.Y`, the core's version that first had it; the test fails where a plugin imports an export newer than its need, so a need is raised by what the plugin uses, not by memory.
- **The core's version is its API's**: within a major the core only adds; a change that breaks a plugin is a new major, released with every plugin. `VERSION` in `src/api.ts` is the library page's (check-build).

## Layers

- `src/` is host-free; what knows SilverBullet goes in `src/host/silverbullet/` (none yet: from step 4 the bridge, events, SilverBullet's panels and widget menu), imported by the entry `index.ts` only (`src/isolation.test.ts`). No plugin's code.
