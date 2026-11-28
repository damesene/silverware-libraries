// Rendering baselines of what Silverware Tags lays over the page (docs/silverware-core-work.md, step S, item 5): its
// settings dialog (the command "Silverware Tags: Settings", src/settings.ts) and its manager (the command "Silverware
// Tags: Manager", the window by tag); each opened in its theme on a desktop and a phone, its DOM, its look and its
// place in the window (scripts/ui-test-baselines.ts `recordParts`; written anew only by SW_BASELINES=update). Against
// SilverBullet alone, on the sample's pages (helpers.ts: playground/tags-sample.ts, whose tags, counts and page
// names the manager shows: a change of the sample changes this baseline).
import type { Locator, Page } from "@playwright/test";
import { PHONE, type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { command, expect, expectNoPageErrorsYet, onSilverBullet, openManager, test } from "../helpers.ts";

test.skip(!onSilverBullet, "baselines are SilverBullet's (the playground draws otherwise)");

type Args = { page: Page };

// SilverBullet's interface's font, which the dialogs take
const FONT = "Inter";

const PARTS: Readonly<Record<string, Part<Args>>> = {
  settings: {
    open: async ({ page }): Promise<Locator> => {
      await command(page, "Silverware Tags: Settings");
      const settings = page.locator(".swg-settings");
      await expect(settings.locator(".swg-settings-save")).toBeDisabled();
      return settings;
    },
    // (Its first tab's, General: the other panel hidden. A knob is its switch's track, on and off; its dot, a ::after,
    // is not read)
    parts: { dialog: "", title: ".swg-settings-title", subtitle: ".swg-settings-subtitle", close: ".swg-settings-close", tab: '.swg-settings-tab[aria-selected="false"]', selected: '.swg-settings-tab[aria-selected="true"]', card: ".swg-settings-panel:not([hidden]) .swg-settings-card", row: ".swg-settings-panel:not([hidden]) .swg-settings-row", name: ".swg-settings-panel:not([hidden]) .swg-settings-name", hint: ".swg-settings-panel:not([hidden]) .swg-settings-hint", switch: ".swg-settings-panel:not([hidden]) .swg-settings-switch", knob: ".swg-settings-panel:not([hidden]) .swg-settings-knob", knobOff: ".swg-settings-panel:not([hidden]) input:not(:checked) + .swg-settings-knob", select: ".swg-settings-panel:not([hidden]) select", note: ".swg-settings-note", save: ".swg-settings-save", cancel: ".swg-settings-cancel" },
    font: FONT,
    place: () => ({}),
  },
  manager: {
    open: ({ page }) => openManager(page, "todo"),
    // (By tag, its first tag chosen, #active, with #todo waited for listed: the tree, the chosen tag's name, actions
    // and pages; the foot's buttons. On a phone #project's toggle is scrolled out of the list's view, its style still
    // read)
    parts: { window: "", title: ".swg-dialog-title", close: ".swg-dialog-close", view: '.swg-view-tab[aria-selected="false"]', viewOn: '.swg-view-tab[aria-selected="true"]', search: ".swg-search", row: '.swg-tag-item[aria-selected="false"] > .swg-tag-row', chosen: '.swg-tag-item[aria-selected="true"] > .swg-tag-row', name: '.swg-tag-item[aria-selected="true"] .swg-tag-name', count: ".swg-count", toggle: "button.swg-tree-toggle", field: ".swg-name-field", uses: ".swg-detail-uses", action: ".swg-actions .swg-button:not(.swg-danger)", danger: ".swg-actions .swg-danger", page: ".swg-page-link", foot: ".swg-dialog-foot .swg-button" },
    font: FONT,
    place: () => ({}),
  },
};

recordParts(test, (title, body) => test(title, ({ page }) => body({ page })), PARTS);

test.describe("on a phone", () => {
  test.use(PHONE);

  test("the manager over the whole screen, as its settings and every plugin's dialog (known: 760 px tall)", async ({ page }) => {
    const window = await openManager(page, "todo");
    const box = (await window.boundingBox())!;
    const view = page.viewportSize()!;
    expectNoPageErrorsYet(page);
    test.fail(true, "Known (2026-11-28): the style page's phone rule (max-width 640px) takes .swg-dialog alone, and .swg-dialog.swg-workspace keeps its height of at most 760 px over it: the manager centred, the page above and below; expected the whole screen (step K)");
    expect([Math.round(box.y), Math.round(box.height)]).toEqual([0, view.height]);
  });
});
