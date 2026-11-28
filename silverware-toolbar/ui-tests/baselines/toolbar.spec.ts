// Rendering baselines of what Silverware Toolbar lays over the page (docs/silverware-core-work.md, step S, item 5): the
// popup of every action (its bar's "…") and its settings dialog (opened from that popup, as a user opens it); each in
// its theme on a desktop and a phone as a user there opens it (text selected: on a desktop the bar by the selection,
// on a phone docked at the bottom), its DOM, its look and its place (the popup's against its "…", the dialog's in the
// window) (scripts/ui-test-baselines.ts `recordParts`; written anew only by SW_BASELINES=update). The bar holds the
// tests' favourites (helpers.ts `TEST_FAVORITES`); the popup lists the other installed plugins' actions too (Assets',
// Layout's), so a change of theirs changes this baseline. Against SilverBullet alone, as every baseline.
import type { Locator, Page } from "@playwright/test";
import { type Part, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { onPhone, press } from "../../../scripts/ui-test-helpers.ts";
import { bar, barButton, expect, expectNoPageErrorsYet, lineBox, onSilverBullet, popup, select, test } from "../helpers.ts";

test.skip(!onSilverBullet, "baselines are SilverBullet's (the playground draws otherwise)");

type Args = { page: Page };

// SilverBullet's interface's font, which the popup and the dialog take
const FONT = "Inter";

/** The popup of every action open, from the bar shown for "some text" selected as a user there selects it; given */
async function popupOpen(page: Page): Promise<Locator> {
  if (await onPhone(page)) {
    // (A tap in the text first: the editor a finger's, the bar docked at the bottom for it)
    const line = await lineBox(page, "in this page");
    await page.touchscreen.tap(line.x + 4, line.y + line.height / 2);
    await select(page, "some text");
    await expect(bar(page)).toHaveClass(/swb-docked/);
    // (Drawn anew once the selection settles, SETTLE_MS after the keys: tapped once its "…" is the same node for 30
    // frames, as a person taps what they see)
    await barButton(page, "actions.more").evaluate(async (first) => {
      let button: Element | null = first;
      for (let still = 0, frames = 0; still < 30; frames++) {
        if (frames > 600) throw new Error("The docked bar never settled");
        await new Promise((done) => requestAnimationFrame(done));
        const now = document.querySelector('.swb-bar.swb-visible [data-swb-action="actions.more"]');
        still = now !== null && now === button ? still + 1 : 0;
        button = now;
      }
    });
  } else {
    await select(page, "some text");
    await expect(bar(page)).toBeVisible();
  }
  await press(page, barButton(page, "actions.more"));
  await expect(popup(page).locator(".swb-search-field")).toBeVisible();
  // (Its other plugins' actions drawn in Silverware Icons' set, loaded as first asked for)
  await expect(popup(page).locator(".swb-option").first()).toBeVisible();
  await expect(popup(page).locator('[data-swi-state="pending"]')).toHaveCount(0);
  return popup(page);
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  popup: {
    open: ({ page }) => popupOpen(page),
    parts: { popup: "", search: ".swb-search", field: ".swb-search-field", tool: ".swb-popup-tool", group: ".swb-group", option: ".swb-option:not(.swb-current)", current: ".swb-current", icon: ".swb-option .swb-icon", label: ".swb-option .swb-label" },
    font: FONT,
    place: ({ page }) => ({ anchor: barButton(page, "actions.more") }),
  },
  settings: {
    open: async ({ page }) => {
      const tools = await popupOpen(page);
      await tools.locator(".swb-search-field").fill("settings");
      await press(page, tools.locator('.swb-popup-tool[data-swb-action="actions.settings"]'));
      const dialog = page.locator(".swb-settings");
      await expect(dialog.locator('[role="tab"][aria-selected="true"]')).toBeVisible();
      return dialog;
    },
    // (Its first tab's, General: a card of advice (on a desktop SilverBullet's own toolbar by the selection, on a phone
    // its keyboard bar: a SilverBullet without either changes this baseline), the key, a switch's track on; the other
    // panels hidden)
    parts: { dialog: "", title: ".swb-settings-title", subtitle: ".swb-settings-subtitle", close: ".swb-settings-close", tab: '.swb-settings-tab[aria-selected="false"]', selected: '.swb-settings-tab[aria-selected="true"]', card: ".swb-settings-panel:not([hidden]) .swb-settings-card:not(.swb-settings-advice)", advice: ".swb-settings-panel:not([hidden]) .swb-settings-advice", adviceButton: ".swb-settings-panel:not([hidden]) .swb-settings-advice-button", row: ".swb-settings-panel:not([hidden]) .swb-settings-card:not(.swb-settings-advice) .swb-settings-row", name: ".swb-settings-panel:not([hidden]) .swb-settings-name", hint: ".swb-settings-panel:not([hidden]) .swb-settings-hint", key: ".swb-settings-panel:not([hidden]) .swb-settings-key", switch: ".swb-settings-panel:not([hidden]) .swb-settings-switch", knob: ".swb-settings-panel:not([hidden]) .swb-settings-knob", note: ".swb-settings-note", save: ".swb-settings-save", cancel: ".swb-settings-cancel" },
    font: FONT,
    place: () => ({}),
  },
};

recordParts(test, (title, body) => test(title, ({ page }) => body({ page })), PARTS);

test("the popup's actions within its list: none wider, nothing to scroll sideways (known: 16 px wider)", async ({ page }) => {
  const list = (await popupOpen(page)).locator(".swb-list");
  await expect(list.locator(".swb-option").first()).toBeVisible();
  const sizes = await list.evaluate((l) => ({ scroll: l.scrollWidth, client: l.clientWidth }));
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-28): an action of the popup is 100% of its list wide and padded besides (.swb-option, its box content-box), so it is 16 px wider than the list and the list scrolls sideways; expected within it (step K)");
  expect(sizes.scroll).toBe(sizes.client);
});
