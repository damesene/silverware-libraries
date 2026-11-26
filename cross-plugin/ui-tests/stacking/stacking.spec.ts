// What one plugin lays over another's (docs/silverware-core-work.md, step S, items 1 and 3): the one on top whole (what
// the document has at its middle and corners, not visibility alone), Esc closing the top one alone, the focus back in
// the one under it. What each does for itself is tested in its plugin's ui-tests; here only how they stack.
import type { Locator, Page } from "@playwright/test";
import { chooseIn, expect, expectNoPageErrorsYet, ON_TOP, onTopAt, root, runSilverBulletCommand, type Space, test } from "../helpers.ts";

// A pixel of PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const BLOCK = (view: string) => `# Page\n\n\`\`\`silverware-database\nid: tasks\nview: ${view}\n\`\`\`\n`;
const TASKS = (properties: string, item: string) => ({ "Page/db-tasks": root("tasks", "Tasks", properties), "Page/db-tasks/Fix login": item });

/** Files pasted on an element, as a browser's paste carries them */
async function paste(target: Locator, name: string): Promise<void> {
  await target.evaluate(
    (element, { name, png }) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], name, { type: "image/png" }));
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
    },
    { name, png: PNG.toString("base64") },
  );
}

test("Silverware Assets' dialog over a database's peek: on top whole; Esc closes it alone, the focus back in the peek, then the peek", async ({ page, space }) => {
  const item = `---\ntags: [db]\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: BLOCK("table"), ...TASKS("    photos: { type: files, label: Photos }", item) }, "Page");
  await page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator(".swd-open").click();
  const peek = page.locator(".swd-peek");
  await expect(peek).toBeVisible();
  const row = peek.locator('.swd-peek-value[data-key="photos"]');
  await row.focus();
  await paste(row, "pasted.png");
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  await expect(dialog).toBeVisible();
  expect(await onTopAt(dialog)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(peek).toBeVisible();
  await expect(row).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(peek).toHaveCount(0);
});

/** A database's Properties dialog opened, Silverware Icons' picker opened from its Status' icon */
async function iconPickerInProperties(page: Page, space: Space) {
  const item = `---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: BLOCK("table"), ...TASKS("    status: { type: select, label: Status, options: [Todo, Done] }", item) }, "Page");
  await page.locator(".swd-more").click();
  await chooseIn(page, "Properties").click();
  const properties = page.locator(".swd-properties");
  await expect(properties).toBeVisible();
  await properties.locator('[data-property="status"] .swd-prop-head').click();
  const button = properties.locator('[data-property="status"] .swd-property-icon');
  await button.click();
  const picker = page.locator(".swd-pop", { has: page.locator(".swi-field") });
  await expect(picker).toBeVisible();
  return { properties, button, picker };
}

test("Silverware Icons' picker over a database's Properties dialog: Esc closes it alone, the focus back on its button, then the dialog", async ({ page, space }) => {
  const { properties, button, picker } = await iconPickerInProperties(page, space);
  expect((await onTopAt(picker))["top left"]).toBe(true);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(properties).toBeVisible();
  await expect(button).toBeFocused();
  // (The dialog's frame: its body, `.swd-properties`, scrolls under its footer)
  expect(await onTopAt(page.locator('[role="dialog"]').filter({ has: properties }))).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(properties).toHaveCount(0);
});

test("Silverware Icons' picker over a database's Properties dialog: on top whole (known: its bottom under the footer)", async ({ page, space }) => {
  const { picker } = await iconPickerInProperties(page, space);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): the picker lies in the dialog's scroller, its bottom under the dialog's footer (Cancel, Save); fixed by the overlays in the core (step 6)");
  expect(await onTopAt(picker)).toEqual(ON_TOP);
});

/** A database's peek opened, a word of its content selected: Silverware Toolbar shown over it */
async function toolbarInPeek(page: Page, space: Space) {
  const item = `---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n---\n\nFirst words here\n`;
  await space.open({ Page: BLOCK("list"), ...TASKS("    status: { type: select, label: Status, options: [Todo, Done] }", item) }, "Page");
  const peek = page.locator(".swd-peek");
  const body = peek.locator(".swd-peek-body");
  // (The editor is loaded once SilverBullet has started, when the browser is idle: a peek opened before has a plain field)
  await expect(async () => {
    if (await peek.count()) await page.keyboard.press("Escape");
    await page.locator(".swd-list-name", { hasText: "Fix login" }).click({ timeout: 1000 });
    await expect(body.locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await body.locator(".cm-line", { hasText: "First words here" }).dblclick({ position: { x: 4, y: 6 } });
  const bar = page.locator(".swb-bar.swb-visible");
  await expect(bar).toBeVisible();
  return { peek, bar };
}

test("Silverware Toolbar over a database's peek: the toolbar and its popup on top whole; Esc closes the popup alone", async ({ page, space }) => {
  const { peek, bar } = await toolbarInPeek(page, space);
  expect(await onTopAt(bar)).toEqual(ON_TOP);
  await bar.locator('[data-swb-action="actions.more"]').click();
  const popup = page.locator(".swb-popup.swb-visible");
  await expect(popup).toBeVisible();
  expect(await onTopAt(popup)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(bar).toBeVisible();
  // (The peek closes after a write of its content: its content still focused makes one closing a moment later
  // unlikely, the content unchanged leaving little to write)
  await expect(peek.locator(".swd-peek-body .cm-content")).toBeFocused();
  await expect(peek).toBeVisible();
});

test("Silverware Toolbar over a database's peek: Esc hides the toolbar alone, then closes the peek (known: one Esc closes both)", async ({ page, space }) => {
  const { peek, bar } = await toolbarInPeek(page, space);
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): the Esc that hides the toolbar closes the peek under it too (the toolbar's key listener does not take it); fixed by the core's one stack of overlays and keys (steps 4 and 6)");
  await expect(peek.locator(".swd-peek-body .cm-content")).toBeFocused({ timeout: 5_000 });
  await expect(peek).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(peek).toHaveCount(0);
});

test("Silverware Assets' side panel over a database's peek: on top whole; Esc closes it alone, the peek kept, then the peek", async ({ page, space }) => {
  const item = `---\ntags: [db]\nphotos:\n  - "[[${space.folder}/files/a.png]]"\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: BLOCK("table"), ...TASKS("    photos: { type: files, label: Photos }", item) }, "Page", { "files/a.png": PNG });
  await page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator(".swd-open").click();
  const peek = page.locator(".swd-peek");
  const row = peek.locator('.swd-peek-value[data-key="photos"]');
  await row.locator(".swd-media-button").first().click();
  const panel = page.locator(".swa-side-panel");
  await expect(panel.locator(".swa-panel-title")).toHaveText("a.png");
  expect(await onTopAt(panel)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(peek).toBeVisible();
  // (The peek answers a press after the panel went: kept, not closing)
  await row.locator(".swd-media-button").first().click();
  await expect(panel.locator(".swa-panel-title")).toHaveText("a.png");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(peek).toHaveCount(0);
});

test("Silverware Icons' picker over a database's Properties dialog: Tab and Shift+Tab wrap at the dialog's edges, the focus never in the page under it", async ({ page, space }) => {
  const { properties, picker } = await iconPickerInProperties(page, space);
  const frame = page.locator('[role="dialog"]').filter({ has: properties });
  // The dialog's first and last control the focus can take (shared/dialog.ts' trap reads them shown and focusable; one
  // disabled, Save before a change, takes none)
  const edge = (which: "first" | "last") =>
    frame.evaluate((element, which) => {
      const all = [...element.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex='0']")].filter((one) => one.offsetParent !== null && !(one as HTMLButtonElement).disabled);
      const one = which === "first" ? all[0] : all[all.length - 1];
      one?.setAttribute("data-test-edge", which);
      return all.length;
    }, which);
  expect(await edge("first")).toBeGreaterThan(2);
  await edge("last");
  await frame.locator('[data-test-edge="first"]').focus();
  await page.keyboard.press("Shift+Tab");
  await expect(frame.locator('[data-test-edge="last"]')).toBeFocused();
  await expect(picker).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(frame.locator('[data-test-edge="first"]')).toBeFocused();
  await expect(picker).toBeVisible();
});

const GRID = "# Grid\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n";

test("Silverware Toolbar over a grid's cell edited: the toolbar and its popup on top whole; Esc closes the popup, then the toolbar, then leaves the cell (known: one Esc hides the toolbar and leaves the cell)", async ({ page, space }) => {
  await space.open({ Page: GRID }, "Page");
  const cell = page.locator("#sb-main .swl-grid-editor");
  // (Drawn once SilverBullet's custom syntax is active; the editor loaded once the browser is idle)
  await expect(async () => {
    if (await cell.count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().click({ timeout: 1000 });
    await expect(cell.locator(".cm-content")).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  const bar = page.locator(".swb-bar.swb-visible");
  await expect(bar).toBeVisible();
  expect(await onTopAt(bar)).toEqual(ON_TOP);
  await bar.locator('[data-swb-action="actions.more"]').click();
  const popup = page.locator(".swb-popup.swb-visible");
  await expect(popup).toBeVisible();
  expect(await onTopAt(popup)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(bar).toBeVisible();
  await expect(cell.locator(".cm-content")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): the Esc that hides the toolbar leaves the grid's cell too (the toolbar's key listener does not take it); fixed by the core's one stack of overlays and keys (steps 4 and 6)");
  await expect(cell.locator(".cm-content")).toBeFocused({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  await expect(cell).toHaveCount(0);
});

// One menu open across plugins holds today by the focus leaving a menu or a press beside it, no rule the plugins
// share: a menu of the database's closes as the focus leaves it (silverware-database/src/core/placemenu.ts,
// `focusout`) or by a press beside it, the toolbar's popup by a press outside it. The core's one stack of overlays (step 6) makes it a rule; these keep it so.
test("one menu open across plugins: Silverware Toolbar's popup shown closes a database's menu open", async ({ page, space }) => {
  const item = `---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: BLOCK("table"), ...TASKS("    status: { type: select, label: Status, options: [Todo, Done] }", item) }, "Page");
  await page.locator(".swd-more").click();
  const menu = page.locator(".swd-menu:visible");
  await expect(menu).toHaveCount(1);
  expect(await runSilverBulletCommand(page, "Silverware Toolbar: Show actions")).toBe(true);
  await expect(page.locator(".swb-popup.swb-visible")).toBeVisible();
  await expect(menu).toHaveCount(0);
});

test("one menu open across plugins, as a user goes: the toolbar's popup closed by the database's ⋯ pressed, the database's menu by a press on the toolbar", async ({ page, space }) => {
  const item = `---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: `${BLOCK("table")}\nSome words below\n`, ...TASKS("    status: { type: select, label: Status, options: [Todo, Done] }", item) }, "Page");
  const menu = page.locator(".swd-menu:visible");
  const popup = page.locator(".swb-popup.swb-visible");
  const bar = page.locator(".swb-bar.swb-visible");
  // The toolbar's popup open, then the database's ⋯ pressed: its menu alone
  await page.locator(".cm-line", { hasText: "Some words below" }).dblclick({ position: { x: 4, y: 6 } });
  await expect(bar).toBeVisible();
  await bar.locator('[data-swb-action="actions.more"]').click();
  await expect(popup).toBeVisible();
  await page.locator(".swd-more").click();
  await expect(menu).toHaveCount(1);
  await expect(popup).toHaveCount(0);
  // The database's menu open, then a press on the toolbar: the menu gone
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.locator(".cm-line", { hasText: "Some words below" }).dblclick({ position: { x: 4, y: 6 } });
  await expect(bar).toBeVisible();
  await page.locator(".swd-more").click();
  await expect(menu).toHaveCount(1);
  await expect(bar).toBeVisible();
  await bar.locator('[data-swb-action="formats.bold"]').click();
  await expect(menu).toHaveCount(0);
});

test("a database over the whole window: its own menu on top whole; Silverware Toolbar stands back while it is", async ({ page, space }) => {
  const item = `---\ntags: [db]\nstatus: Todo\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: `${BLOCK("table")}\nSome words below\n`, ...TASKS("    status: { type: select, label: Status, options: [Todo, Done] }", item) }, "Page");
  const place = page.locator(".swd-place");
  await page.locator('.swd-tool[data-tool="fullscreen"]').click();
  await expect(place).toHaveClass(/swd-over-window/);
  expect(await onTopAt(place)).toEqual(ON_TOP);
  await page.locator(".swd-more").click();
  const menu = page.locator(".swd-menu:visible");
  await expect(menu).toHaveCount(1);
  expect(await onTopAt(menu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  // The toolbar's command run while the database is over the window: nothing of the toolbar's shown
  // Every time the toolbar's popup shows, counted in the page: one shown late, after a check, is counted too
  await page.evaluate(() => {
    const w = window as unknown as { swTestPopupsShown: number };
    w.swTestPopupsShown = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target as HTMLElement;
        if (element.classList.contains("swb-popup") && element.classList.contains("swb-visible") && !(record.oldValue ?? "").includes("swb-visible")) w.swTestPopupsShown++;
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
  expect(await runSilverBulletCommand(page, "Silverware Toolbar: Show actions")).toBe(true);
  await expect(place).toHaveClass(/swd-over-window/);
  // The same command once the database is back in the page: its popup shown (its run after the first's), so the
  // toolbar stood back above, not missing; shown once in all
  await page.locator('.swd-tool[data-tool="fullscreen"]').click();
  await expect(place).not.toHaveClass(/swd-over-window/);
  await page.locator(".cm-line", { hasText: "Some words below" }).click();
  expect(await runSilverBulletCommand(page, "Silverware Toolbar: Show actions")).toBe(true);
  await expect(page.locator(".swb-popup.swb-visible")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { swTestPopupsShown: number }).swTestPopupsShown)).toBe(1);
});

test("Silverware Icons' picker in Silverware Toolbar's settings: Esc closes it alone, the focus back on Choose…, then the item's panel, then the settings", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text\n" }, "Page");
  expect(await runSilverBulletCommand(page, "Silverware Toolbar: Settings")).toBe(true);
  const settings = page.locator(".swb-settings");
  await expect(settings).toBeVisible();
  await settings.locator('[data-swb-tab="toolbars"]').click();
  await settings.locator('[data-swb-item="1:0"]').click();
  const choose = settings.locator("[data-swb-look] [data-swb-choose]");
  await choose.click();
  const picker = settings.locator(".swb-settings-icon-picker");
  await expect(picker.locator(".swi-field")).toBeVisible();
  await picker.locator(".swi-field").focus();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(settings).toBeVisible();
  await expect(choose).toBeFocused();
  // (The item's panel, which Choose… is in: a layer of its own)
  await page.keyboard.press("Escape");
  await expect(settings.locator("[data-swb-look]")).toHaveCount(0);
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
});
