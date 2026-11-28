// Rendering baselines of Silverware Database's cell editors laid over the page (docs/silverware-core-work.md, step S,
// item 5): a person's names offered (one typed besides them, Anyone), a multiple select's boxes, a link's fields, a
// reference's search, a value's files and a file's menu; each opened in a table's cell in its theme on a desktop and a
// phone as a user there opens it, its DOM, its look and its place against its cell (scripts/ui-test-baselines.ts
// `recordParts`; written anew only by SW_BASELINES=update). The link is the table's last column: on a phone its panel
// is held in the window (views/float.ts). A select's and a date's pickers are the browser's (none to record).
import type { Locator, Page } from "@playwright/test";
import { keptThrough, type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { boxOf, expect, expectNoPageErrorsYet, onPhone, press, type Space, test } from "../helpers.ts";
import { type Args, BLOCK, DOM } from "./parts.ts";

// The place's font, which its lifted panels keep (SilverBullet's of the page's text)
const FONT = "iA-Mono";
// A pixel of PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
// A root of every editor laid over the page, the link last
const ROOT = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    owner: { type: person, label: Owner, options: [ada, bob], anyone: true }\n    team: { type: select, label: Team, options: [Web, App], multiple: true }\n    refs: { type: reference, label: Refs }\n    photos: { type: files, label: Photos }\n    web: { type: url, label: Web }\n---\n";
// One item, a file in its Photos, nothing else set (a person's pill pressed would open the Mention Inbox)
const HOLIDAY = (folder: string) => `---\ntags: [db]\nphotos:\n  - "[[${folder}/Page/db-tasks/files/a.png]]"\n_database:\n  rank: a0\n---\n`;

/** The table of one item, its file in place, the two pages a reference finds */
async function opened(page: Page, space: Space): Promise<void> {
  await space.open({ Page: BLOCK("table"), "Page/db-tasks": ROOT, "Page/db-tasks/Holiday": HOLIDAY(space.folder), "Refs target one": "# One\n", "Refs target two": "# Two\n" }, "Page", { "Page/db-tasks/files/a.png": PNG });
  await expect(cell(page, "photos").locator(".swd-media-button")).toHaveCount(1);
}

const cell = (page: Page, key: string): Locator => page.locator(`.swd-table tbody tr:first-child td[data-key="${key}"]`);

/** A press near a cell's right edge, beside what it shows (a file there opens it), as a user's on each device */
async function pressBeside(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await boxOf(target);
  const [x, y] = [box.x + box.width - 4, box.y + box.height / 2];
  if (await onPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** The editor's panel laid over the page from the body, given */
async function floated(page: Page, selector: string): Promise<Locator> {
  const panel = page.locator(`${selector}.swd-floated`);
  await expect(panel).toBeVisible();
  return panel;
}

/** A reference's search opened on Holiday's Refs, narrowed to the test's two pages and a new one (given) */
async function referenceFound(page: Page, space: Space): Promise<Locator> {
  await opened(page, space);
  await press(page, cell(page, "refs"));
  const panel = await floated(page, ".swd-editor-documents");
  // (The two pages of the test's folder, the space's others left out, and a new one of the words typed)
  await panel.locator(".swd-editor-search").fill(`${space.folder} target`);
  await expect(panel.locator(".swd-editor-document-name")).toHaveText(["Refs target one", "Refs target two", /^New: /]);
  return panel;
}

/** The files' popup opened on Holiday's Photos, its image drawn */
async function filesOpen(page: Page, space: Space): Promise<Locator> {
  await opened(page, space);
  await pressBeside(page, cell(page, "photos"));
  const popup = page.locator(".swd-editor-files");
  await expect(popup.locator(".swd-files-row")).toHaveCount(1);
  // (Its image loaded and fitted: its row's height follows it, as files.spec.ts waits)
  await expect.poll(() => popup.locator("img").evaluateAll((all) => all.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0 && !!(img as HTMLImageElement).style.height))).toBe(true);
  return popup;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  personSuggestions: {
    open: async ({ page, space }) => {
      await opened(page, space);
      await press(page, cell(page, "owner"));
      await expect(cell(page, "owner").locator("input.swd-editor-typed")).toBeFocused();
      const list = await floated(page, ".swd-suggest");
      await expect(list.locator(".swd-suggest-item")).toHaveCount(2);
      return list;
    },
    parts: { list: "", item: ".swd-suggest-item" },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, "owner") }),
  },
  multiSelect: {
    open: async ({ page, space }) => {
      await opened(page, space);
      await press(page, cell(page, "team"));
      const panel = await floated(page, ".swd-editor-choices");
      await expect(panel.locator(".swd-editor-choice")).toHaveText(["Web", "App"]);
      return panel;
    },
    parts: { panel: "", choice: ".swd-editor-choice", box: 'input[type="checkbox"]' },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, "team") }),
  },
  reference: {
    open: ({ page, space }) => referenceFound(page, space),
    // (No choice as a part: the new page's holds the test's folder, its width following the folder's length)
    parts: { panel: "", search: ".swd-editor-search", box: 'input[type="checkbox"]' },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, "refs") }),
  },
  files: {
    open: ({ page, space }) => filesOpen(page, space),
    parts: { popup: "", row: ".swd-files-row", grip: ".swd-files-grip", more: ".swd-files-more", upload: ".swd-files-upload" },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, "photos") }),
  },
  fileMenu: {
    open: async ({ page, space }) => {
      const popup = await filesOpen(page, space);
      await press(page, popup.getByRole("button", { name: "a.png: its menu" }));
      const menu = popup.locator(".swd-files-menu:visible");
      await expect(menu).toBeInViewport({ ratio: 1 });
      return menu;
    },
    parts: { menu: "", item: '[role="menuitem"]' },
    font: FONT,
    place: ({ page }) => ({ anchor: page.getByRole("button", { name: "a.png: its menu" }) }),
  },
  link: {
    open: async ({ page, space }) => {
      await opened(page, space);
      await press(page, cell(page, "web"));
      const panel = await floated(page, ".swd-editor-link");
      await expect(panel.locator(".swd-link-address")).toBeFocused();
      // (Whole in the window, the last column's: on a phone held at its right edge)
      await expect(panel).toBeInViewport({ ratio: 1 });
      return panel;
    },
    parts: { panel: "", address: ".swd-link-address", text: ".swd-link-text" },
    font: FONT,
    place: ({ page }) => ({ anchor: cell(page, "web") }),
  },
};

recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS, DOM);

test("a reference's search typed on: the pages still found the same nodes, nothing put back (known: its list drawn anew)", async ({ page, space }) => {
  const panel = await referenceFound(page, space);
  const search = panel.locator(".swd-editor-search");
  // A letter more that both pages still match (the new one, whose name changes with it, left out: a page found has a
  // button into its folder, a new one none)
  const kept = await keptThrough(panel, ".swd-editor-choice:has(.swd-editor-document-into)", ".swd-editor-document-name", () => search.pressSequentially(" t"), async () => {
    // (Both pages still found: a list that lost them fails here, not as the known bug)
    await expect(panel.locator(".swd-editor-document-name")).toHaveText(["Refs target one", "Refs target two", /^New: .* t$/]);
  });
  test.info().annotations.push({ type: "kept", description: JSON.stringify(kept) });
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-28): a reference's search draws its list anew whole on each letter typed (views/editors.ts, `list.replaceChildren`), none of its pages found kept; expected kept by the Preact conversion of the editors (step 10, checkpoint C's measure)");
  expect(kept).toEqual({ root: "kept", kept: ["Refs target one", "Refs target two"], anew: [], blinked: 0 });
});
