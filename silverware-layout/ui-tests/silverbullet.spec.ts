// What Silverware Layout takes of SilverBullet's page, checked against SilverBullet itself: where a new version changes
// one, the test names it (the other tests would fail somewhere further on, or not at all where the playground stands in
// for SilverBullet). docs/silverware-layout.md, probes 1 to 3 and *Steps*.
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers.ts";

const PAGE = `# Table\n\nSome text.\n\n| Name | Amount |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n\nSome text.\n`;
// The room a widget leaves the editor's pane, each side together (core/widgetwidth.ts' PANE_GUTTER)
const GUTTER = 40;

test.use({ viewport: { width: 1000, height: 800 } });

/** The table's bar pressed and moved by `dx`, not let go */
async function dragTable(page: Page, dx: number): Promise<void> {
  const table = page.locator(".sb-table-widget");
  await expect(table).toBeVisible();
  const b = (await table.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = (await bar.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + dx / 2, at.y + at.height / 2, { steps: 5 });
  await page.mouse.move(at.x + dx, at.y + at.height / 2, { steps: 5 });
}

test("SilverBullet's page as Silverware Layout takes it: the editor's text, its pane a size container, the scroller a stacking context the guides lie in", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  const found = await page.evaluate(() => {
    const editor = document.querySelector("#sb-editor");
    const scroller = document.querySelector(".cm-scroller");
    const content = scroller?.querySelector(".cm-content");
    const style = scroller ? getComputedStyle(scroller) : undefined;
    // (What makes an element a stacking context, those SilverBullet could use)
    const stacking =
      !!style &&
      ((style.position !== "static" && style.zIndex !== "auto") ||
        Number(style.opacity) < 1 ||
        style.transform !== "none" ||
        style.isolation === "isolate" ||
        /paint|layout|strict|content/.test(style.contain));
    return {
      editor: !!editor,
      // The pane's width a widget is held to (100cqw in the style page)
      container: editor ? getComputedStyle(editor).containerType : "",
      content: !!content,
      stacking,
      // The text's width, SilverBullet's own variable on the root
      editorWidth: getComputedStyle(document.documentElement).getPropertyValue("--editor-width").trim(),
    };
  });
  expect(found.editor, "#sb-editor, the editor's pane").toBe(true);
  expect(found.container, "#sb-editor a size container (container-type)").toMatch(/size/);
  expect(found.content, ".cm-content in .cm-scroller").toBe(true);
  expect(found.stacking, ".cm-scroller a stacking context (the guides at z-index -1 in it lie under the widgets)").toBe(true);
  expect(found.editorWidth, "--editor-width on the root").not.toBe("");

  // A drag's guides in the scroller, under the table: the table's own box drawn over a guide crossing it
  await dragTable(page, 60);
  const guides = page.locator(".cm-scroller .swl-handle-guide");
  await expect(guides.first()).toBeAttached();
  expect(await page.locator(".swl-handle-guide-fixed").count(), "no guide over the window: the scroller found").toBe(0);
  const under = await page.evaluate(() => {
    const table = document.querySelector(".sb-table-widget")!.getBoundingClientRect();
    // A guide crossing the table: hit-tested as if it took the pointer, it must not be what is on top there
    const guide = [...document.querySelectorAll<HTMLElement>(".swl-handle-guide")].find((line) => {
      const x = line.getBoundingClientRect().left;
      return x > table.left + 2 && x < table.right - 2;
    });
    if (!guide) return "no guide crossing the table";
    guide.style.pointerEvents = "auto";
    guide.style.width = "3px";
    const x = guide.getBoundingClientRect().left + 1;
    const top = document.elementFromPoint(x, table.top + table.height / 2);
    guide.style.pointerEvents = guide.style.width = "";
    return top === guide ? "the guide over the table" : "under";
  });
  expect(under).toBe("under");
  await page.mouse.up();
});

test("a widget dragged wider than the editor is held at the editor's width less its gutter", async ({ page, space }) => {
  await space.open({ Page: PAGE }, "Page");
  await dragTable(page, 600);
  const pane = await page.evaluate(() => document.querySelector("#sb-editor")!.getBoundingClientRect().width);
  await expect.poll(async () => Math.round((await page.locator(".sb-table-widget").boundingBox())!.width)).toBe(Math.round(pane - GUTTER));
  // Centred on the text, within what the scroller shows (its scrollbar not covered)
  const b = (await page.locator(".sb-table-widget").boundingBox())!;
  const content = (await page.locator(".cm-content").boundingBox())!;
  expect(Math.abs(b.x + b.width / 2 - (content.x + content.width / 2))).toBeLessThanOrEqual(1);
  const shown = await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller")!;
    const box = scroller.getBoundingClientRect();
    return { left: box.left, right: box.left + scroller.clientWidth };
  });
  expect(b.x).toBeGreaterThanOrEqual(shown.left);
  expect(b.x + b.width).toBeLessThanOrEqual(shown.right);
  await page.keyboard.press("Escape");
});
