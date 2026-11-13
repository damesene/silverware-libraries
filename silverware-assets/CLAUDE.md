# Silverware Assets

The files a page embeds and links (prefix `swa-`, settings and Space Lua API under `silverware.assets`): being split out of Silverware Layout, where its code still is (`silverware-layout/src/assets/`), by [docs/silverware-assets-split.md](../docs/silverware-assets-split.md) (its steps, what goes where, the renames). Its design and decisions: [docs/silverware-layout-assets.md](../docs/silverware-layout-assets.md), to become docs/silverware-assets.md. User docs: `silverware-assets.md`; the code pages `-init.md` (the bridge), `-api.md` (priority 50: `silverware.assets.api`), `-style.md`.

## Mental model

- **Silverware Layout is optional**: its API (`silverware.layout.api`, handed over by the init page) gives a medium's width by its handle (a `LayoutProvider`, as Silverware Table registers) and what its grids draw outside the editor (`shared/rendered.ts`: each file and link drawn, its place in the page). Without it, files are decorated where SilverBullet draws them, without the handle; there are no grids then.
- The code keeps the word "asset" (`shared/assets.ts`: `Asset`, `AssetType`, `AssetAction`), the plugin's name.

## Tests

- `src/isolation.test.ts`: the layers (model, core, builtin, ui; SilverBullet only in `host/silverbullet/` and `index.ts`), no other plugin's code (Silverware Layout only through its API, `shared/layout.ts` and `shared/rendered.ts`), of Layout's marks only `data-swl-width` in the style page.
- `ui-tests/` against SilverBullet only (`helpers.ts`: a test's pages and files under `UiAssets/<test>/`, CONFIG put back): `assets.spec.ts` (files in a page and in Layout's grid, the settings window, the markdown-as-written mode), `link-touch.spec.ts` (the touch project).
