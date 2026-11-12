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

test("the dialog: a width in % shown at once and saved into the frontmatter, Default takes _layout off", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await expect(dialog).toBeVisible();
  const own = dialog.locator(".swl-dialog-card").first();
  await own.locator(".swl-dialog-amount").fill("90");
  await own.getByRole("radio", { name: "Percent of the editor's pane" }).click();
  await expect.poll(() => widthSet(page)).toBe("90%");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => space.saved("Page")).toBe('---\n_layout:\n  width: "90%"\n---\n# Page\n\nSome text.\n');
  expect(await widthSet(page)).toBe("90%");

  await runCommand(page, PAGE_LAYOUT);
  await expect(own.locator(".swl-dialog-amount")).toHaveValue("90");
  await expect(own.getByRole("radio", { name: "Percent of the editor's pane" })).toHaveAttribute("aria-checked", "true");
  await own.getByRole("button", { name: "Default" }).click();
  await expect.poll(() => widthSet(page)).toBe("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\nSome text.\n");
});

test("Cancel puts the page back as it was, writing nothing", async ({ page, space }) => {
  await space.open({ Page: wide("Some text.") }, "Page");
  await expect.poll(() => widthSet(page)).toBe("1100px");
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.locator(".swl-dialog-card").first().locator(".swl-dialog-amount").fill("700");
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
  await dialog.locator(".swl-dialog-card").nth(1).locator(".swl-dialog-amount").fill("1000");
  await expect.poll(() => widthSet(page)).toBe("1000px");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await space.config()) ?? "").toContain('"silverware.layout.textWidth"');
  expect(await space.config()).toContain('"1000px"');
  expect(await widthSet(page)).toBe("1000px");
  expect(await space.saved("Page")).toBe("# Page\n\nSome text.\n");
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
