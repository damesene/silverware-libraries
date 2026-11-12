import { expect, PAGE_LAYOUT, runCommand, test, waitForIndexedLayout, widths, widthSet } from "./helpers.ts";

// Frames a page may show at the page before's width: none on an idle machine, one on a busy one (the width is set from
// SilverBullet's editor:pageLoaded, dispatched after the page is shown; docs/silverware-layout.md, probe 2)
const LATE_FRAMES = 1;

const wide = (body: string) => `---\n_layout:\n  width: 1100\n---\n# Wide\n\n${body}\n`;

test("a page's own width in its frontmatter: its text and the top bar at it, a page without at the theme's, the other's width not left as a link is followed", async ({ page, space }) => {
  // Every frame: which page is shown (by its heading: a page's Linked Mentions quote the other) and its text's width
  await page.addInitScript(() => {
    const frames: { page: string; width: number }[] = ((window as unknown as { swlFrames: typeof frames }).swlFrames = []);
    const tick = () => {
      const content = document.querySelector("#sb-main .cm-content");
      const heading = content?.querySelector(".sb-line-h1")?.textContent ?? "";
      frames.push({ page: heading.includes("Wide") ? "wide" : heading.includes("Plain") ? "plain" : "", width: Math.round(content?.getBoundingClientRect().width ?? 0) });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await space.open({ Wide: wide(`Some text [[${space.folder}/Plain]]`), Plain: `# Plain\n\nSome text [[${space.folder}/Wide]]\n` }, "Wide");
  await expect.poll(() => widths(page)).toEqual({ text: 1100, topBar: 1100 });
  // (A page written for the test: its layout in the index once it is indexed, as a page of the space has it)
  await waitForIndexedLayout(page, `${space.folder}/Wide`);

  const framesFrom = () => page.evaluate(() => (window as unknown as { swlFrames: unknown[] }).swlFrames.length);
  const framesSince = (from: number) => page.evaluate((i) => (window as unknown as { swlFrames: { page: string; width: number }[] }).swlFrames.slice(i), from);
  let from = await framesFrom();
  await page.locator("#sb-main .cm-content a, #sb-main .cm-content .sb-wiki-link-page").filter({ hasText: "Plain" }).first().click();
  await expect.poll(() => widths(page)).toEqual({ text: 800, topBar: 800 });
  expect(await widthSet(page)).toBe("");
  expect((await framesSince(from)).filter((f) => f.page === "plain" && f.width !== 800).length).toBeLessThanOrEqual(LATE_FRAMES);

  from = await framesFrom();
  await page.locator("#sb-main .cm-content a, #sb-main .cm-content .sb-wiki-link-page").filter({ hasText: "Wide" }).first().click();
  await expect.poll(() => widths(page)).toEqual({ text: 1100, topBar: 1100 });
  expect((await framesSince(from)).filter((f) => f.page === "wide" && f.width !== 1100).length).toBeLessThanOrEqual(LATE_FRAMES);
});

// The dialog's rows of the Page tab: this page's width, all pages'
const rows = (page: import("@playwright/test").Page) => page.locator(".swl-dialog .swl-dialog-width-row");

test("the dialog: a width typed in % shown at once and saved into the frontmatter (typing makes it the page's own); Default takes _layout off", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await expect(dialog).toBeVisible();
  const own = rows(page).first();
  await expect(own.getByRole("radio", { name: "The width of all pages" })).toHaveAttribute("aria-checked", "true");
  await own.getByRole("radio", { name: "Percent of the editor's width" }).click();
  await own.locator(".swl-dialog-amount").fill("90");
  await expect(own.getByRole("radio", { name: "A width of its own" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => widthSet(page)).toBe("90%");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => space.saved("Page")).toBe('---\n_layout:\n  width: "90%"\n---\n# Page\n\nSome text.\n');
  expect(await widthSet(page)).toBe("90%");

  await runCommand(page, PAGE_LAYOUT);
  await expect(own.locator(".swl-dialog-amount")).toHaveValue("90");
  await expect(own.getByRole("radio", { name: "Percent of the editor's width" })).toHaveAttribute("aria-checked", "true");
  await own.getByRole("radio", { name: "The width of all pages" }).click();
  await expect.poll(() => widthSet(page)).toBe("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nSome text.\n");
});

test("the dialog's slider, moved near a guide, takes the guide's width and makes it the page's own", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const own = rows(page).first();
  await expect(own.locator(".swl-dialog-tick")).toHaveText(["900", "1200", "Full"]);
  await own.locator(".swl-dialog-slider").evaluate((slider: HTMLInputElement) => {
    slider.value = "894";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(own.locator(".swl-dialog-amount")).toHaveValue("900");
  await expect(own.getByRole("radio", { name: "A width of its own" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => widthSet(page)).toBe("900px");
});

test("a slider held stays where it was pressed (the dialog all but gone round it): a press near its edge still on it, and it drags", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const slider = page.locator(".swl-dialog").getByRole("slider", { name: "Font size", exact: true });
  const box = (await slider.boundingBox())!;
  const before = Number(await slider.inputValue());
  // Pressed by its top edge: moved by as little as a few pixels, the press was off it as the browser began to drag
  await page.mouse.move(box.x + box.width * 0.3, box.y + 1);
  await page.mouse.down();
  await expect(page.locator(".swl-dialog")).toHaveClass(/swl-dialog-sliding/);
  const held = (await slider.boundingBox())!;
  expect([held.x, held.y, held.width]).toEqual([box.x, box.y, box.width]);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("swl-dialog-slider"), { x: box.x + box.width * 0.3, y: box.y + 1 })).toBe(true);
  await page.mouse.move(box.x + box.width * 0.6, box.y + 1, { steps: 6 });
  await page.mouse.up();
  expect(Number(await slider.inputValue())).not.toBe(before);
});

test("Cancel puts the page back as it was, writing nothing", async ({ page, space }) => {
  await space.open({ Page: wide("Some text.") }, "Page");
  await expect.poll(() => widthSet(page)).toBe("1100px");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await rows(page).first().locator(".swl-dialog-amount").fill("700");
  await expect.poll(() => widthSet(page)).toBe("700px");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await widthSet(page)).toBe("1100px");
  expect(await space.saved("Page")).toBe(wide("Some text."));
});

test("the default text width saved into CONFIG, applying to a page without its own", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await rows(page).nth(1).locator(".swl-dialog-amount").fill("1000");
  await expect.poll(() => widthSet(page)).toBe("1000px");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await space.config()) ?? "").toContain('"silverware.layout.textWidth"');
  expect(await space.config()).toContain('"1000px"');
  expect(await widthSet(page)).toBe("1000px");
  expect(await space.saved("Page")).toBe("# Page\n\nSome text.\n");
});

test("the guides typed straight in their rows, saved into Silverware Layout's own block of CONFIG, ascending as the tab shows again", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Guides" }).click();
  const amounts = dialog.locator(".swl-dialog-guide-amount");
  await expect(amounts).toHaveCount(2);
  expect(await amounts.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["900", "1200"]);
  // 1200 made 600 stays where it is while the tab shows; one added; Full width off
  await amounts.nth(1).fill("600");
  await dialog.getByRole("button", { name: "+ Add guide" }).click();
  await expect(amounts.nth(2)).toBeFocused();
  await page.keyboard.type("1500");
  await dialog.getByRole("checkbox", { name: "Full width" }).uncheck();
  expect(await amounts.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["900", "600", "1500"]);
  // A guide no width says why, Save off
  await amounts.nth(2).fill("50");
  await expect(dialog.locator(".swl-dialog-note")).toHaveText("A guide is a whole number of 200 to 10000 px");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await amounts.nth(2).fill("1500");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await space.config()) ?? "").toContain('config.set("silverware.layout.guides", { "900px", "600px", "1500px" })');
  expect(await space.config()).toContain("-- managed-by: silverware-layout");
  await runCommand(page, PAGE_LAYOUT);
  await dialog.getByRole("tab", { name: "Guides" }).click();
  expect(await amounts.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["600", "900", "1500"]);
  await expect(dialog.getByRole("checkbox", { name: "Full width" })).not.toBeChecked();
});

test("a pane narrower than the setting's least gets no width, and gets it back wider", async ({ page, space }) => {
  await space.open({ Page: wide("Some text.") }, "Page");
  await expect.poll(() => widthSet(page)).toBe("1100px");
  await page.setViewportSize({ width: 500, height: 800 });
  await expect.poll(() => widthSet(page)).toBe("");
  await page.setViewportSize({ width: 1400, height: 800 });
  await expect.poll(() => widthSet(page)).toBe("1100px");
});

test("a width typed into the frontmatter applies as the page is edited", async ({ page, space }) => {
  await space.open({ Page: wide("Some text.") }, "Page");
  await expect.poll(() => widthSet(page)).toBe("1100px");
  await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { toString(): string } }; dispatch(spec: unknown): void } } }).client.editorView;
    const at = view.state.doc.toString().indexOf("1100");
    view.dispatch({ changes: { from: at, to: at + 4, insert: "900" } });
  });
  await expect.poll(() => widthSet(page)).toBe("900px");
});
