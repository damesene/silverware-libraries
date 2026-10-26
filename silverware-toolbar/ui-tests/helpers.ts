/// <reference types="node" />
// What the toolbar's interaction tests share: the toolbar's sample page opened,
// its text, a selection or the caret set in it, the toolbar and the popup.
//
// Against one of two targets (SW_TARGET, set by playwright.config.ts), as the
// table's tests (silverware-table/ui-tests/helpers.ts):
// - playground: the toolbar playground (a CodeMirror editor of markdown, as
//   SilverBullet's; its page starts from the sample in each test's browser
//   context, its settings the playground's store).
// - silverbullet: a real SilverBullet with the committed silverware-toolbar.js
//   deployed: each test a page of its own in its worker's space, the sample
//   written into it; SilverBullet's editor is the same CodeMirror
//   (`client.editorView`). The settings dialog saves into the space's CONFIG
//   page, which is put back once the test is done.
import { readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { silverbulletServer } from "../../scripts/silverbullet-servers.ts";

export { expect };

const target = process.env.SW_TARGET === "silverbullet" ? "silverbullet" : "playground";
const sample = readFileSync(join(import.meta.dirname, "../../playground/toolbar-sample.md"), "utf8");
const server = () => silverbulletServer(test.info().parallelIndex, process.env.SW_SB_SPACE ?? "");

type View = {
  state: { doc: { toString(): string }; selection: { main: { from: number; to: number } } };
  dispatch(spec: unknown): void;
  focus(): void;
};

/** Tests get `page` with the toolbar's sample open; an error in the page (thrown or logged) fails the test */
export const test = base.extend({
  // Against SilverBullet, its worker's server
  baseURL: async ({ baseURL }, use) => {
    await use(target === "silverbullet" ? `http://127.0.0.1:${server().port}/` : baseURL);
  },
  page: async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const name = `UiToolbar/${testInfo.testId}`;
    const config = join(server().space, "CONFIG.md");
    try {
      if (target === "silverbullet") {
        const path = join(server().space, `${name}.md`);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, sample);
        await page.goto(`/${name}`);
      } else await page.goto("/toolbar.html");
      await ready(page);
      await use(page);
      expect(errors, "errors in the page").toEqual([]);
    } finally {
      if (target === "silverbullet") {
        // Closed first, so the page saves nothing after it is gone; the settings a test saved go with it
        await page.close();
        await rm(join(server().space, `${name}.md`), { force: true });
        await writeFile(config, "");
      }
    }
  },
});

/** Waits for the page's editor: in SilverBullet its client and widgets too */
export async function ready(page: Page): Promise<void> {
  await expect(page.locator(".cm-content")).toBeVisible();
  await page.waitForFunction(() => {
    const w = window as unknown as { playgroundView?: unknown; client?: { editorView?: unknown } };
    return !!(w.playgroundView ?? w.client?.editorView);
  });
  if (target === "silverbullet") await page.evaluate(() => (window as unknown as { client: { widgetsReady?: Promise<unknown> } }).client.widgetsReady);
}

/** The page's text */
export const text = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const w = window as unknown as { playgroundView?: View; client?: { editorView: View } };
    return (w.playgroundView ?? w.client!.editorView).state.doc.toString();
  });

/** The editor's selection, as the text it holds */
export const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const w = window as unknown as { playgroundView?: View; client?: { editorView: View } };
    const view = w.playgroundView ?? w.client!.editorView;
    const { from, to } = view.state.selection.main;
    return view.state.doc.toString().slice(from, to);
  });

/** Selects text of the page, as the keyboard would (the editor focused): from `needle`'s start, `length` characters (its own length by default) */
export async function select(page: Page, needle: string, length = needle.length, occurrence = 0): Promise<void> {
  await ready(page);
  await page.evaluate(
    ([needle, length, occurrence]) => {
      const w = window as unknown as { playgroundView?: View; client?: { editorView: View } };
      const view = w.playgroundView ?? w.client!.editorView;
      const doc = view.state.doc.toString();
      let from = -1;
      for (let i = 0; i <= occurrence; i++) from = doc.indexOf(needle, from + 1);
      if (from < 0) throw new Error(`not in the page: ${needle}`);
      view.focus();
      view.dispatch({ selection: { anchor: from, head: from + length } });
    },
    [needle, length, occurrence] as const,
  );
}

/** Puts the caret in the page's text (the editor focused): `offset` characters after `needle`'s start (negative: before its end) */
export async function caret(page: Page, needle: string, offset: number): Promise<void> {
  await ready(page);
  await page.evaluate(
    ([needle, offset]) => {
      const w = window as unknown as { playgroundView?: View; client?: { editorView: View } };
      const view = w.playgroundView ?? w.client!.editorView;
      const from = view.state.doc.toString().indexOf(needle);
      if (from < 0) throw new Error(`not in the page: ${needle}`);
      const at = offset < 0 ? from + needle.length + offset : from + offset;
      view.focus();
      view.dispatch({ selection: { anchor: at } });
    },
    [needle, offset] as const,
  );
}

/**
 * Runs `action`, which asks a question to confirm, and answers it (`yes`: OK):
 * the browser's confirm in the playground, SilverBullet's own dialog there
 * (`editor.confirm`, which the browser's dialog event misses)
 */
export async function answerConfirm(page: Page, yes: boolean, action: () => Promise<void>): Promise<void> {
  if (target === "silverbullet") {
    await action();
    const prompt = page.locator("dialog.sb-modal-box .sb-prompt");
    await prompt.locator(".sb-prompt-buttons button", { hasText: yes ? "Ok" : "Cancel" }).click();
    await expect(prompt).toHaveCount(0);
    return;
  }
  const asked = new Promise<void>((resolve) =>
    page.once("dialog", (dialog) => {
      resolve();
      void (yes ? dialog.accept() : dialog.dismiss());
    }),
  );
  await action();
  await asked;
}

/** Where a line of the page's text is on screen, once the editor shows it (boundingBox alone does not wait) */
export async function lineBox(page: Page, hasText: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const line = page.locator(".cm-line", { hasText });
  await expect(line).toBeVisible();
  return (await line.boundingBox())!;
}

export const bar = (page: Page): Locator => page.locator(".swb-bar.swb-visible");
export const barButton = (page: Page, action: string): Locator => bar(page).locator(`[data-swb-action="${action}"]`);
export const popup = (page: Page): Locator => page.locator(".swb-popup.swb-visible");
export const gestureButton = (page: Page): Locator => bar(page).locator(".swb-gesture");

/**
 * A gesture button added at the end of the second row through the settings
 * dialog, as a user adds one (Add, Gesture button, its actions searched: a
 * swipe left out takes None, the first offered), and saved; the text selected
 * again after
 */
export async function addGesture(page: Page, tap: string, up: string | undefined, down?: string, needle = "some text"): Promise<void> {
  await select(page, needle);
  await bar(page).locator(".swb-more").click();
  await popup(page).locator(".swb-search-field").fill("settings");
  await page.keyboard.press("Enter");
  const dialog = page.locator(".swb-settings");
  await dialog.locator('[data-swb-tab="favorites"]').click();
  await dialog.locator('[data-swb-row="1"] .swb-settings-add').click();
  const field = dialog.locator(".swb-settings-pick-field");
  await field.fill("gesture");
  await page.keyboard.press("Enter");
  await expect(field).toHaveAttribute("placeholder", "Search an action for Click");
  await field.fill(tap);
  await page.keyboard.press("Enter");
  for (const [slot, name] of [["Swipe up", up], ["Swipe down", down]] as const) {
    await expect(field).toHaveAttribute("placeholder", `Search an action for ${slot}`);
    await field.fill(name ?? "");
    await page.keyboard.press("Enter");
  }
  await expect(field).toHaveCount(0);
  await dialog.locator(".swb-settings-save").click();
  await expect(dialog).toHaveCount(0);
  await select(page, needle);
  await expect(gestureButton(page)).toBeVisible();
}
