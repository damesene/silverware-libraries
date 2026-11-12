# Silverware

| Tests | SilverBullet |
| :--- | :--- |
| [![unit](https://img.shields.io/github/actions/workflow/status/damesene/silverware-libraries/unit-tests.yml?branch=main&label=unit)](https://github.com/damesene/silverware-libraries/actions/workflows/unit-tests.yml) [![integration](https://img.shields.io/github/actions/workflow/status/damesene/silverware-libraries/integration-tests.yml?branch=main&label=integration)](https://github.com/damesene/silverware-libraries/actions/workflows/integration-tests.yml) | [![version](https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdamesene%2Fsilverware-libraries%2Fmain%2Fscripts%2Fsilverbullet%2FDockerfile&search=silverbullet%3A(%5B%5E-%5Cs%5D%2B)&replace=%241&label=version)](https://github.com/damesene/silverware-libraries/blob/main/scripts/silverbullet/Dockerfile) [![bumped](https://img.shields.io/github/last-commit/damesene/silverware-libraries/main?path=scripts%2Fsilverbullet%2FDockerfile&label=bumped)](https://github.com/damesene/silverware-libraries/commits/main/scripts/silverbullet/Dockerfile) |

Silverware is a collection of plugins (libraries) for [SilverBullet](https://silverbullet.md) by `damesene`.

## Install

Add this repository in SilverBullet with the `Library: Add Repository` command and the URI:

```text
https://github.com/damesene/silverware-libraries/blob/main/REPO.md
```

Then install a plugin with `Library: Install`.

## Plugins

- **Silverware Table** ([`silverware-table/`](silverware-table/silverware-table.md)): sort, filter and edit markdown tables
  in place, formulas (Excel 365's array functions too), column types (a choice of a list of values too), conditional
  formatting, views and pivot tables that stay up to date, tables of your space from Space Lua queries, and moving,
  adding or deleting rows and columns. Tables stay plain markdown.
- **Silverware Toolbar** ([`silverware-toolbar/`](silverware-toolbar/silverware-toolbar.md)): a toolbar by the text you
  select (docked over the keyboard on a phone) to format it, turn lines into lists, headings, quotes or code blocks, and
  run any action or command, with gesture buttons, text snippets and an emoji picker.
- **Silverware Tags** ([`silverware-tags/`](silverware-tags/silverware-tags.md)): a manager of the space's tags: rename and
  merge them everywhere, delete them, tag many pages at once (a folder's too), edit a page's tags; every change previewed.
- **Silverware Chart** ([`silverware-chart/`](silverware-chart/silverware-chart.md)): charts written as Mermaid (other
  Mermaid renderers can draw them too), drawn in SilverBullet with Chart.js; their data from the block or from any markdown table, followed live.
- **Silverware Database** ([`silverware-database/`](silverware-database/silverware-database.md)): databases of pages, in
  the spirit of Notion's: each item a page, its properties the page's frontmatter, shown as a table, a list, a board, a
  calendar or a timeline; every change reviewed where it touches many pages, and undoable.
- **Silverware Layout** ([`silverware-layout/`](silverware-layout/silverware-layout.md)): the width of a page's text (its
  own or a default for every page) and of its tables, databases and charts, wider or narrower than the text by a handle
  beside them that snaps to guides of your own; the editor's font size, and font zoom with Ctrl + scroll.
- **Silverware Icons** ([`silverware-icons/`](silverware-icons/silverware-icons.md)): monochrome icons (Lucide) and emoji
  for the other Silverware plugins, drawn in the colors of your theme, and sets of icons of your own.

## Layout

- `REPO.md`: the repository page (`#meta/repository`) listing every plugin.
- One folder per plugin, named `silverware-<name>`: its library page `silverware-<name>.md` (installed as
  `Library/damesene/silverware-<name>`; its documentation only), the pages its `files:` install beside it
  (`silverware-<name>-init.md`: settings, the JavaScript loaded, commands; `silverware-<name>-api.md`: the
  Space Lua API; `silverware-<name>-style.md`: the CSS), the built `silverware-<name>.js`, the TypeScript
  sources in `src/` and its interaction tests in `ui-tests/`.
- Built `.js` files are committed, because SilverBullet installs them straight from the repo.
- Settings and the Space Lua API of a plugin live under `silverware.<name>` (e.g. `silverware.table`), CSS
  classes, data attributes and CSS variables under a prefix of its own (`swt-` for the table).
- `playground/`: a page that mocks SilverBullet, for trying Silverware Table without it.

### Adding a plugin

1. A folder `silverware-<name>/` with `silverware-<name>.md` (its library page: the documentation, its
   `files:` listing the bundle and the pages below), `silverware-<name>-init.md` (which loads
   `Library/damesene/silverware-<name>.js`), `silverware-<name>-api.md` and `silverware-<name>-style.md` where
   it has an API and CSS, and `src/index.ts`.
2. Its name in the lists of `scripts/build.mjs` and `scripts/deploy.mjs`, and an entry in `REPO.md`.
3. Its Space Lua API as a field of the shared global: `silverware = silverware or {}`, then
   `silverware.<name> = …`; its settings with `config.define("silverware.<name>", …)`.
4. Unit tests (`src/**/*.test.ts`) and interaction tests in its own `ui-tests/` (`*.spec.ts`, with a `helpers.ts`
   of its own: no plugin's tests use another's). CI runs each plugin's interaction tests in a job of its own
   (`scripts/ui-test-groups.mjs`), found by the folder: nothing to register. A folder under `ui-tests/` (as
   `silverware-table/ui-tests/sheet/`) is a job of its own too, for an area that would slow its plugin's job.

## Development

```sh
npm install
npm run build          # bundle each plugin's src/index.ts into <plugin>/<plugin>.js
npm run watch          # rebuild on change
npm test               # vitest: unit tests and jsdom UI tests
npm run verify         # before a commit: TypeScript, vitest, and each bundle matches its sources
npm run test:ui        # interaction tests in Chrome against the playground (test:ui:open: in Playwright's window)
npm run test:ui:sb     # the same tests against a real SilverBullet in Docker (scripts/silverbullet/Dockerfile's version, the plugins deployed)
npm run deploy -- <space folder>   # copy the plugins into a local space's Library/damesene/
npm run playground     # try Silverware Table without SilverBullet, on mock data: http://localhost:8000/
```

`npm run test:ui:sb` runs one SilverBullet per worker, up to 4 by the machine's cores. This machine's own
settings go into `.env.local` (not committed; a variable set in the shell wins):

```sh
SW_SB_WORKERS=8                                           # how many workers, each with its own SilverBullet
SB_IMAGE=ghcr.io/silverbulletmd/silverbullet:latest-slim  # another image than scripts/silverbullet/Dockerfile's
SB_BIN=/path/to/silverbullet                              # a silverbullet binary instead of Docker
SW_SB_FIRST_PORT=3210                                     # the first server's port, where 3010 on is reserved (Windows)
```

After deploying, reload the SilverBullet page so the new `.js` module is loaded. How Silverware Table is built
(its core, features and the decisions behind them) is in [CLAUDE.md](CLAUDE.md).
