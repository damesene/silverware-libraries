// Rendering baselines of what Silverware Database's Properties opens over its list (docs/silverware-core-work.md, step
// S, item 5): an option's palette, a property's icon picker, and the names offered as a formula is typed
// (shared/formulafield.ts); each opened in its theme on a desktop and a phone as a user there opens it, its DOM, its
// look and its place against what it opened from (scripts/ui-test-baselines.ts `recordParts`; written anew only by
// SW_BASELINES=update). The dialog itself is overlays.spec.ts'.
import type { Locator, Page } from "@playwright/test";
import { type Part, PHONE, recordParts } from "../../../scripts/ui-test-baselines.ts";
import { boxOf, expect, expectNoPageErrorsYet, press, type Space, test } from "../helpers.ts";
import { type Args, DOM, FONT, ICON_POP, iconFound, propertiesOpen } from "./parts.ts";

/** Properties opened from ⋯, Status's details shown, given */
async function statusDetails(page: Page, space: Space): Promise<Locator> {
  await propertiesOpen(page, space);
  const status = page.locator('[data-property="status"]');
  await press(page, status.locator(".swd-prop-head"));
  await expect(status.locator(".swd-option")).toHaveCount(2);
  return status;
}

/** A formula property added in Properties and "=UPP" typed in its field: UPPER offered */
async function formulaTyped(page: Page, space: Space): Promise<void> {
  await propertiesOpen(page, space);
  await page.locator(".swd-property-new-label").fill("Shout");
  await page.locator(".swd-property-new-type").selectOption("formula");
  await press(page, page.locator(".swd-property-add"));
  const field = page.locator('[data-focus="formula"]');
  await expect(field).toBeFocused();
  await field.pressSequentially("=UPP");
  await expect(page.locator(".swd-formulafield-choice-active")).toContainText("UPPER");
}

const PARTS: Readonly<Record<string, Part<Args>>> = {
  optionPalette: {
    open: async ({ page, space }) => {
      const status = await statusDetails(page, space);
      const color = status.locator('.swd-option-color[data-option="Todo"]');
      await press(page, color);
      await expect(color).toHaveAttribute("aria-expanded", "true");
      const palette = status.locator(".swd-option-palette:not([hidden])");
      await expect(palette.locator(".swd-option-auto")).toHaveAttribute("aria-pressed", "true");
      return palette;
    },
    parts: { palette: "", swatch: ".swd-option-swatch:not(.swd-option-auto):not(.swd-option-own)", auto: ".swd-option-auto", own: ".swd-option-own" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator('[data-property="status"] .swd-option-color[data-option="Todo"]') }),
  },
  propertyIcon: {
    open: async ({ page, space }) => {
      const status = await statusDetails(page, space);
      await press(page, status.locator(".swd-property-icon"));
      const pop = page.locator('.swd-pop[aria-label="Icon"]');
      await iconFound(pop);
      return pop;
    },
    parts: ICON_POP,
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator('[data-property="status"] .swd-property-icon') }),
  },
  formulaChoices: {
    open: async ({ page, space }) => {
      await formulaTyped(page, space);
      const choices = page.locator(".swd-formulafield-choices");
      await expect(choices).toBeVisible();
      return choices;
    },
    // (A desktop's alone: on a phone the list closes as it is typed in, *Known*, the test below)
    devices: ["desktop"],
    parts: { list: "", choice: ".swd-formulafield-choice", active: ".swd-formulafield-choice-active", name: ".swd-formulafield-choice-name", kind: ".swd-formulafield-choice-kind" },
    font: FONT,
    place: ({ page }) => ({ anchor: page.locator('[data-focus="formula"]') }),
  },
};

recordParts(test, (title, body) => test(title, ({ page, space }) => body({ page, space })), PARTS, DOM);

test.describe("on a phone", () => {
  test.use(PHONE);
  test("a formula typed: the names offered stay open under its field (known: closed as the dialog's body moves)", async ({ page, space }) => {
    await formulaTyped(page, space);
    // The list shown or not, frame by frame for a second from the last key typed (a list closed keeps its choices: the
    // wait for UPPER passes on one hidden too)
    const shown = await page.evaluate(async () => {
      const list = document.querySelector<HTMLElement>(".swd-formulafield-choices");
      const seen: boolean[] = [];
      for (let n = 0; n < 60; n++) {
        const now = !!list && !list.hidden;
        if (seen.at(-1) !== now) seen.push(now);
        await new Promise((done) => requestAnimationFrame(done));
      }
      return seen;
    });
    test.info().annotations.push({ type: "shown", description: JSON.stringify(shown) });
    expectNoPageErrorsYet(page);
    test.fail(true, "Known (2026-11-27): on a phone, Properties' body moves as a formula is typed (its scroll anchored as the field's help and result change their height: 117, 98, 138 px for \"=\", \"U\", \"PP\"; none with overflow-anchor: none), and the formula's field closes its names offered on any scroll (shared/formulafield.ts closeOnScroll), so the list shows a moment after each key and goes; a desktop's body does not move; expected the list kept under the field (step 6)");
    expect(shown).toEqual([true]);
    // (Under its field: placed at its bottom)
    const [list, field] = [await boxOf(page.locator(".swd-formulafield-choices")), await boxOf(page.locator('[data-focus="formula"]'))];
    expect(Math.abs(list.y - (field.y + field.height))).toBeLessThanOrEqual(3);
  });
});
