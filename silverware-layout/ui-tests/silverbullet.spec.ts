// What Silverware Layout takes of SilverBullet's page (its host, src/host/silverbullet/dom.ts), checked against
// SilverBullet itself: where a new version changes one, the test names it (the other tests would fail somewhere further
// on, or not at all where the playground stands in for SilverBullet). docs/silverware-layout.md, probes 1 to 3.
import type { Page } from "@playwright/test";
import { embedOf, expectWidgetMenuKept } from "../../scripts/silverbullet-widgetmenu.ts";
import { boxOf, expect, gridsDrawn, test } from "./helpers.ts";

const PAGE = `# Table\n\nSome text.\n\n| Name | Amount |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n\nSome text.\n`;
// The room a widget leaves the editor's pane, each side together (core/widgetwidth.ts' PANE_GUTTER)
const GUTTER = 40;

test.use({ viewport: { width: 1000, height: 800 } });

/** The table's bar pressed and moved by `dx`, not let go */
async function dragTable(page: Page, dx: number): Promise<void> {
  const table = page.locator(".sb-table-widget");
  await expect(table).toBeVisible();
  const b = await boxOf(table);
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const at = await boxOf(bar);
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x + dx / 2, at.y + at.height / 2, { steps: 5 });
  // (The drag begun: the bar pressed, not the table drawn anew under it meanwhile)
  await expect(page.locator(".swl-handle")).toHaveClass(/swl-handle-dragging/);
  await page.mouse.move(at.x + dx, at.y + at.height / 2, { steps: 5 });
}

test("SilverBullet's page as Silverware Layout takes it: its content and editor found and marked, its pane's width given, the scroller a stacking context the guides lie in", async ({ page, space }) => {
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
      // The pane's width a widget is held to, as Silverware Layout gives it to its style page
      paneWidth: Math.round(editor?.getBoundingClientRect().width ?? 0),
      paneGiven: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--swl-pane-width")) || 0),
      content: !!content,
      // Silverware Layout's marks, which its style page reads (no rule of it names SilverBullet's elements)
      contentMarked: !!content?.hasAttribute("data-swl-content"),
      editorMarked: !!document.querySelector("#sb-main .cm-editor")?.hasAttribute("data-swl-editor"),
      stacking,
      // The text's width, SilverBullet's own variable on the root
      editorWidth: getComputedStyle(document.documentElement).getPropertyValue("--editor-width").trim(),
    };
  });
  expect(found.editor, "#sb-editor, the editor's pane").toBe(true);
  expect(found.paneGiven, "--swl-pane-width, the pane's width").toBe(found.paneWidth);
  expect(found.content, ".cm-content in .cm-scroller").toBe(true);
  expect(found.contentMarked, ".cm-content marked data-swl-content").toBe(true);
  expect(found.editorMarked, "#sb-main .cm-editor marked data-swl-editor").toBe(true);
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
  await expect.poll(async () => Math.round((await page.locator(".sb-table-widget").boundingBox())?.width ?? Number.NaN)).toBe(Math.round(pane - GUTTER));
  // Centred on the text, within what the scroller shows (its scrollbar not covered)
  const b = await boxOf(page.locator(".sb-table-widget"));
  // (The text's middle, its padding left out each side: SilverBullet after 2.12.1 pads it 28 px left and 20 right)
  const textMiddle = await page.locator(".cm-content").evaluate((content) => {
    const box = content.getBoundingClientRect();
    const style = getComputedStyle(content);
    const left = parseFloat(style.paddingLeft);
    return box.left + left + (box.width - left - parseFloat(style.paddingRight)) / 2;
  });
  expect(Math.abs(b.x + b.width / 2 - textMiddle)).toBeLessThanOrEqual(1);
  const shown = await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller")!;
    const box = scroller.getBoundingClientRect();
    return { left: box.left, right: box.left + scroller.clientWidth };
  });
  expect(b.x).toBeGreaterThanOrEqual(shown.left);
  expect(b.x + b.width).toBeLessThanOrEqual(shown.right);
  await page.keyboard.press("Escape");
});

test("the box SilverBullet draws a grid in lets out what lies outside the grid: its cell grips' upper halves above it whole (the style page's `.swl-grid-widget :has(> .swl-grid)`)", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nAbove\n\n<grid>\n<cell>\n\nLeft\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nBelow\n" }, "Page");
  await gridsDrawn(page);
  // Every box between SilverBullet's frame and the grid shows what lies outside it: none of them scrolls it away (a
  // new SilverBullet putting another such box there fails here, by name)
  const clipping = await page.locator("#sb-main .swl-grid").evaluate((grid) => {
    const frame = grid.closest(".swl-grid-widget");
    const boxes: string[] = [];
    for (let box = grid.parentElement; box && box !== frame?.parentElement; box = box.parentElement) {
      const style = getComputedStyle(box);
      if (style.overflowX !== "visible" || style.overflowY !== "visible") boxes.push(`${box.tagName.toLowerCase()}.${[...box.classList].join(".")} ${style.overflowX}/${style.overflowY}`);
    }
    return boxes;
  });
  expect(clipping).toEqual([]);
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  await cell.hover();
  const grip = cell.locator(".swl-grid-cell-grip");
  await expect(grip).toHaveCSS("opacity", "1");
  expect(await grip.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + 1) === element;
  })).toBe(true);
});

test("what SilverBullet places by the text, moved with it at the left (src/host/silverbullet/dom.ts' ALONG_TEXT): its title's box starts where the text does, its notifications' box ends where the text ends", async ({ page, space }) => {
  await space.open({ Page: "---\n_layout:\n  align: left\n---\n# Page\n\nSome text.\n" }, "Page");
  type Client = { ui: { flashNotification(message: string, type: string, options: { timeout: number }): void } };
  // (Found and marked: the title now, the notifications as one shows)
  await expect(page.locator("#sb-top .main .inner")).toHaveAttribute("data-swl-along-text", "");
  await page.evaluate(() => (window as unknown as { client: Client }).client.ui.flashNotification("Placed by the text", "info", { timeout: 0 }));
  await expect(page.locator(".sb-notifications")).toHaveAttribute("data-swl-along-text", "");
  const edges = () =>
    page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const text = box("#sb-main .cm-content");
      return { textLeft: Math.round(text.left), textRight: Math.round(text.right), title: Math.round(box("#sb-top .main .inner").left), notifications: Math.round(box(".sb-notifications").right) };
    });
  // (Its pane wider than the text: at the left, the text is not where SilverBullet centres it)
  await expect.poll(async () => (await edges()).textLeft).toBeLessThan(40);
  await expect.poll(async () => {
    const at = await edges();
    return Math.abs(at.title - at.textLeft);
  }).toBeLessThan(2);
  // (SilverBullet keeps its notifications 20 px within the text's edges)
  await expect.poll(async () => {
    const at = await edges();
    return Math.abs(at.notifications - (at.textRight - 20));
  }).toBeLessThan(20);
});

test("SilverBullet's ⋮ beside a widget (its edge): kept from a grid, shown beside a widget not ours (shared/silverbullet/widgetmenu.ts)", async ({ page, space }) => {
  const grid = "<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n";
  await space.open({ Page: `# Page\n\n${embedOf(`${space.folder}/Other`)}\n\nBetween\n\n${grid}\nBelow\n`, Other: "# Other\n\nEmbedded.\n" }, "Page");
  await gridsDrawn(page);
  await expectWidgetMenuKept(page, page.locator("#sb-main .sb-markdown-widget, #sb-main [data-sb-widget-menu]").first(), "Embed", page.locator("#sb-main .swl-grid"));
});
