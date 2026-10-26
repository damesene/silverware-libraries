// What the toolbar's interaction tests share: the toolbar playground opened
// (a CodeMirror editor of markdown, as SilverBullet's; its page starts from the
// sample in each test's browser context), the page's text, a selection made
// in it, the toolbar and the popup.
import { test as base, expect, type Locator, type Page } from "@playwright/test";

export { expect };

type View = {
  state: { doc: { toString(): string }; selection: { main: { from: number; to: number } } };
  dispatch(spec: unknown): void;
  focus(): void;
};

/** Tests get `page` with the toolbar playground open; an error in the page (thrown or logged) fails the test */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/toolbar.html");
    await expect(page.locator(".cm-content")).toBeVisible();
    await use(page);
    expect(errors, "errors in the page").toEqual([]);
  },
});

/** The page's text */
export const text = (page: Page): Promise<string> =>
  page.evaluate(() => (window as unknown as { playgroundView: View }).playgroundView.state.doc.toString());

/** The editor's selection, as the text it holds */
export const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const view = (window as unknown as { playgroundView: View }).playgroundView;
    const { from, to } = view.state.selection.main;
    return view.state.doc.toString().slice(from, to);
  });

/** Selects text of the page, as the keyboard would (the editor focused): from `needle`'s start, `length` characters (its own length by default) */
export async function select(page: Page, needle: string, length = needle.length, occurrence = 0): Promise<void> {
  await page.evaluate(
    ([needle, length, occurrence]) => {
      const view = (window as unknown as { playgroundView: View }).playgroundView;
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
  await page.evaluate(
    ([needle, offset]) => {
      const view = (window as unknown as { playgroundView: View }).playgroundView;
      const from = view.state.doc.toString().indexOf(needle);
      if (from < 0) throw new Error(`not in the page: ${needle}`);
      const at = offset < 0 ? from + needle.length + offset : from + offset;
      view.focus();
      view.dispatch({ selection: { anchor: at } });
    },
    [needle, offset] as const,
  );
}

export const bar = (page: Page): Locator => page.locator(".swb-bar.swb-visible");
export const barButton = (page: Page, action: string): Locator => bar(page).locator(`[data-swb-action="${action}"]`);
export const popup = (page: Page): Locator => page.locator(".swb-popup.swb-visible");
