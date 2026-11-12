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
// (By what each holds, not by its place: All pages is over This page)
const row = (page: import("@playwright/test").Page, name: "page" | "all") => page.locator(`.swl-dialog [data-swl-row="${name}"]`);

test("the dialog: a width typed in % shown at once and saved into the frontmatter (typing makes it the page's own); ↺ takes _layout off", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await expect(dialog).toBeVisible();
  const own = row(page, "page");
  // All pages' width followed: said under it, no ↺
  await expect(own).toHaveClass(/swl-dialog-follows/);
  await expect(own.locator(".swl-dialog-row-note")).toHaveText("Uses all pages' width");
  await own.getByRole("radio", { name: "Percent of the editor's width" }).click();
  await own.locator(".swl-dialog-amount").fill("90");
  await expect(own).not.toHaveClass(/swl-dialog-follows/);
  await expect.poll(() => widthSet(page)).toBe("90%");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => space.saved("Page")).toBe('---\n_layout:\n  width: "90%"\n---\n# Page\n\nSome text.\n');
  expect(await widthSet(page)).toBe("90%");

  await runCommand(page, PAGE_LAYOUT);
  await expect(own.locator(".swl-dialog-amount")).toHaveValue("90");
  await expect(own.getByRole("radio", { name: "Percent of the editor's width" })).toHaveAttribute("aria-checked", "true");
  await own.getByRole("button", { name: "Use all pages' width" }).click();
  await expect.poll(() => widthSet(page)).toBe("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nSome text.\n");
});

test("the dialog's slider, moved near a guide, takes the guide's width and makes it the page's own", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const own = row(page, "page");
  await expect(own.locator(".swl-dialog-tick")).toHaveText(["900", "1200", "Full"]);
  await own.locator(".swl-dialog-slider").evaluate((slider: HTMLInputElement) => {
    slider.value = "894";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(own.locator(".swl-dialog-amount")).toHaveValue("900");
  await expect(own).not.toHaveClass(/swl-dialog-follows/);
  await expect.poll(() => widthSet(page)).toBe("900px");
});

test("a slider held stays where it was pressed (the dialog all but gone round it): a press near its edge still on it, and it drags", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  await page.locator(".swl-dialog").getByRole("tab", { name: "Font" }).click();
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
  await row(page, "page").locator(".swl-dialog-amount").fill("700");
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
  await row(page, "all").locator(".swl-dialog-amount").fill("1000");
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

test("Preview held on the Guides tab: the guides as typed on the page (one added, unsaved), the dialog all but gone; let go, the dialog back and no guide", async ({ page, space }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Guides" }).click();
  await dialog.getByRole("button", { name: "+ Add guide" }).click();
  await page.keyboard.type("1000");
  const preview = dialog.getByRole("button", { name: "Preview" });
  const box = (await preview.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(dialog).toHaveClass(/swl-dialog-sliding/);
  // (In the order typed: the one added last; sorted only as the tab is shown again)
  await expect(page.locator(".swl-handle-guide-label")).toHaveText(["Page width", "900 px", "1200 px", "1000 px", "Full width"]);
  // Under the page's widgets, in its scroller, as a drag's
  expect(await page.locator(".cm-scroller .swl-handle-guide").count()).toBe(10);
  await page.mouse.up();
  await expect(dialog).not.toHaveClass(/swl-dialog-sliding/);
  await expect(page.locator(".swl-handle-guide")).toHaveCount(0);
  // Held by Space as well
  await preview.focus();
  await page.keyboard.down(" ");
  await expect(page.locator(".swl-handle-guide-label").first()).toHaveText("Page width");
  await page.keyboard.up(" ");
  await expect(page.locator(".swl-handle-guide")).toHaveCount(0);
});

test("a guide's slider dragged: its number follows, the guides shown on the page as it moves, the dialog all but gone; let go, both back", async ({ page, space }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Guides" }).click();
  const row = dialog.locator(".swl-dialog-guide-row").first();
  const slider = row.locator(".swl-dialog-guide-slider");
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await expect(dialog).toHaveClass(/swl-dialog-sliding/);
  const amount = Number(await row.locator(".swl-dialog-guide-amount").inputValue());
  await expect(page.locator(".swl-handle-guide-label", { hasText: `${amount} px` })).toHaveCount(1);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 });
  const moved = Number(await row.locator(".swl-dialog-guide-amount").inputValue());
  expect(moved).toBeLessThan(amount);
  await expect(page.locator(".swl-handle-guide-label", { hasText: `${moved} px` })).toHaveCount(1);
  await page.mouse.up();
  await expect(dialog).not.toHaveClass(/swl-dialog-sliding/);
  await expect(page.locator(".swl-handle-guide")).toHaveCount(0);
});

test("Default guides on the Guides tab: asked in SilverBullet's dialog; Cancel keeps the guides, Ok puts the default ones back", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Guides" }).click();
  const amounts = dialog.locator(".swl-dialog-guide-amount");
  const reset = dialog.getByRole("button", { name: "Default guides" });
  // The default ones already: nothing to put back
  await expect(reset).toBeDisabled();
  await amounts.first().fill("600");
  await expect(reset).toBeEnabled();
  const prompt = page.locator("dialog.sb-modal-box .sb-prompt");
  await reset.click();
  await expect(prompt).toContainText("Put the default guides back (900 px, 1200 px, Full width)?");
  await prompt.locator(".sb-prompt-buttons button", { hasText: "Cancel" }).click();
  await expect(prompt).toHaveCount(0);
  expect(await amounts.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["600", "1200"]);
  await reset.click();
  await prompt.locator(".sb-prompt-buttons button", { hasText: "Ok" }).click();
  await expect.poll(() => amounts.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["900", "1200"]);
  await expect(reset).toBeDisabled();
  // The Page layout dialog still open, nothing saved yet
  await expect(dialog).toBeVisible();
});

test("a pane narrower than the setting's least gets no width, and gets it back wider", async ({ page, space }) => {
  await space.open({ Page: wide("Some text.") }, "Page");
  await expect.poll(() => widthSet(page)).toBe("1100px");
  await page.setViewportSize({ width: 500, height: 800 });
  await expect.poll(() => widthSet(page)).toBe("");
  // The Page width tab says why: the widths show on a wider screen
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await expect(dialog.getByRole("note")).toHaveText("Widths apply on screens wider than 600 px. On this one, the text fills the screen.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.setViewportSize({ width: 1400, height: 800 });
  await expect.poll(() => widthSet(page)).toBe("1100px");
  await runCommand(page, PAGE_LAYOUT);
  await expect(dialog.getByRole("note")).toHaveCount(0);
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
