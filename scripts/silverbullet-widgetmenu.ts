// SilverBullet's ⋮ beside a widget (its edge, after 2.12.1: client/codemirror/line_handle.ts), as the interaction tests
// check it is kept from our widgets and shown beside the others (shared/silverbullet/widgetmenu.ts): each plugin's
// tests check their own widgets with it, so a SilverBullet that changes how it finds a widget's card fails there, by
// name. The edge tests (npm run test:ui:sb:edge, CI's edge-tests.yml as SilverBullet's main changes) run them.
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Whether the tests run against SilverBullet's edge, which has the ⋮: its image (scripts/silverbullet/edge.mjs) as
 * scripts/ui-tests.mjs sets it, or as CI's edge tests give it, by its digest (`…:edge-slim@sha256:…`)
 */
export const onSilverBulletEdge = /:edge\b/.test(process.env.SB_IMAGE ?? "");

/** A page embedded (`![[…]]`): a widget not ours, which keeps its ⋮ */
export const embedOf = (page: string) => `![[${page}]]`;

/** The pointer over a widget's top left, a little in */
async function pointAt(page: Page, widget: Locator): Promise<void> {
  await widget.scrollIntoViewIfNeeded();
  const box = await widget.boundingBox();
  if (!box) throw new Error("the widget is not shown");
  await page.mouse.move(box.x + 12, box.y + 12);
}

/**
 * SilverBullet's ⋮ shown beside a widget not ours (`other`: its card's menu, named `label`), then none beside ours
 * (`ours`), its card not registered: what the pointer over each shows
 */
export async function expectWidgetMenuKept(page: Page, other: Locator, label: string, ours: Locator): Promise<void> {
  const handle = page.locator(".sb-line-handle");
  await pointAt(page, other);
  // (SilverBullet's mechanism as it was: a ⋮ beside a card it registered)
  await expect(handle).toHaveClass(/sb-line-handle-shown/);
  await expect(handle).toHaveAttribute("data-widget", label);
  await pointAt(page, ours);
  await expect(handle).not.toHaveClass(/sb-line-handle-shown/);
  // (Its card not registered: SilverBullet registered it, ours took it out)
  expect(await ours.evaluate((widget) => !!widget.closest("[data-sb-widget-menu]"))).toBe(false);
}
