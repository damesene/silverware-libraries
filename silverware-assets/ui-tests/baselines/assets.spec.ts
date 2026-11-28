// Rendering baselines of what Silverware Assets lays over the page (docs/silverware-core-work.md, step S, item 5): its
// settings window (the command "Silverware Assets: Settings", src/ui/settingswindow.ts) and a file's menu (its "…");
// each opened in its theme on a desktop and a phone as a user there opens it, its DOM, its look and its place (the
// window's in the window, the menu's against its "…" too) (scripts/ui-test-baselines.ts `recordParts`; written anew only
// by SW_BASELINES=update). The file is an image shown as a preview; its "…" shows as the pointer is over it, always
// on a touch screen. The Files tab lists the types the test space's plugins register (Assets PDF, DOCX, XLSX): one
// installed or renamed there changes this baseline.
import type { Locator, Page } from "@playwright/test";
import { type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { onPhone, press } from "../../../scripts/ui-test-helpers.ts";
import { ASSETS_SETTINGS, expect, PIXEL_PNG, runCommand, type Space, test } from "../helpers.ts";

type Args = { page: Page; space: Space };

// SilverBullet's interface's font, which the window and the menu take
const FONT = "Inter";

/** A page of an image shown as a preview, opened; its frame given */
async function previewShown(page: Page, space: Space): Promise<Locator> {
  await space.open({ Page: `# Page\n\n![[${space.folder}/a.png|A||{ view: preview }]]\n\nAfter\n` }, "Page", { "a.png": PIXEL_PNG });
  const preview = page.locator("#sb-main [data-swa-type='image'][data-swa-view='preview']");
  await expect(preview).toBeVisible();
  return preview;
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  settings: {
    open: async ({ page, space }) => {
      await space.open({ Page: "# Page\n" }, "Page");
      await runCommand(page, ASSETS_SETTINGS);
      const dialog = page.locator(".swa-dialog");
      await expect(dialog.locator('[role="tab"][aria-selected="true"]')).toBeVisible();
      return dialog;
    },
    // (Its first tab's: the other panels hidden. Its folder field and button lie below the body's view, scrolled out,
    // their style still read)
    parts: { dialog: "", title: ".swa-dialog-title", close: ".swa-dialog-close", tab: '[role="tab"][aria-selected="false"]', selected: '[role="tab"][aria-selected="true"]', panel: '[role="tabpanel"]:not([hidden])', body: ".swa-dialog-body", intro: '[role="tabpanel"]:not([hidden]) .swa-settings-intro', heading: '[role="tabpanel"]:not([hidden]) .swa-settings-heading', select: '[role="tabpanel"]:not([hidden]) .swa-settings-select', check: '[role="tabpanel"]:not([hidden]) .swa-settings-check', typeRow: '[role="tabpanel"]:not([hidden]) .swa-type-head', field: '[role="tabpanel"]:not([hidden]) .swa-settings-folder', button: '[role="tabpanel"]:not([hidden]) .swa-settings-button', note: ".swa-dialog-note", save: ".swa-dialog-save", cancel: ".swa-dialog-cancel" },
    font: FONT,
    place: () => ({}),
  },
  fileMenu: {
    open: async ({ page, space }) => {
      const preview = await previewShown(page, space);
      // (The pointer over the file shows its "…"; a finger has none, the "…" always shown)
      if (!(await onPhone(page))) await preview.hover();
      await press(page, preview.locator(".swa-more"));
      const menu = page.locator(".swa-popup");
      await expect(menu.locator(".swa-menu-item", { hasText: "Open enlarged" })).toBeVisible();
      return menu;
    },
    parts: { menu: "", title: ".swa-menu-title", close: ".swa-menu-close", item: ".swa-menu-item", label: ".swa-menu-item .swa-label", row: ".swa-menu-segmented", segment: '.swa-segment[aria-checked="false"]', segmentOn: '.swa-segment[aria-checked="true"]', separator: ".swa-menu-separator", danger: ".swa-menu-item.swa-danger" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator("#sb-main [data-swa-type='image'] .swa-more") }),
  },
};

// (A guard: no text recorded holds the test's folder today, a file's name shown might)
recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS, { replace: ({ space }) => ({ [space.folder]: "<folder>" }) });
