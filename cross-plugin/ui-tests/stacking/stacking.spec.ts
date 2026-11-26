// What one plugin lays over another's (docs/silverware-core-work.md, step S, items 1 and 3): the one on top whole (what
// the document has at its middle and corners, not visibility alone), Esc closing the top one alone, the focus back in
// the one under it. What each does for itself is tested in its plugin's ui-tests; here only how they stack.
import type { Locator, Page } from "@playwright/test";
import { chooseIn, expect, ON_TOP, onTopAt, root, type Space, test } from "../helpers.ts";

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

test("Silverware Icons' picker over a database's Properties dialog: on top whole, but its bottom (known)", async ({ page, space }) => {
  const { picker } = await iconPickerInProperties(page, space);
  // Known (2026-11-26), today's behaviour kept as it is: the picker lies in the dialog's scroller, its bottom under the
  // dialog's footer (Cancel, Save). Fixed (expected from the overlays in the core, step 6), this fails: expect ON_TOP
  // here then, the title's "but its bottom (known)" taken off and the runbook's *Known* entry with it
  expect(await onTopAt(picker)).toEqual({ ...ON_TOP, "bottom left": false, "bottom right": false });
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

test("Silverware Toolbar over a database's peek: one Esc hides the toolbar and closes the peek too (known)", async ({ page, space }) => {
  const { peek, bar } = await toolbarInPeek(page, space);
  await page.keyboard.press("Escape");
  // Known (2026-11-26), today's behaviour kept as it is: the Esc that hides the toolbar closes the peek under it too.
  // Fixed (expected from the core's one stack of overlays and keys, steps 4 and 6), this fails: expect the toolbar gone
  // and the peek still there, its content focused, a second Esc closing it; the title's "(known)" and the runbook's
  // *Known* entry taken off
  await expect(bar).toHaveCount(0);
  await expect(peek).toHaveCount(0);
});
