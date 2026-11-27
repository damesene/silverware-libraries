// Rendering baselines (docs/silverware-core-work.md, step S, item 5): what a part draws, recorded against today's code
// so a rewrite is checked against it. Kept as text, not pictures: its DOM normalized (`domOf`), the look and the
// geometry of its key elements (`lookOf`: computed styles, boxes against the part's own), and what an action leaves
// in place (`keptThrough`). Each baseline is a file of its own beside the spec (`<spec>.baselines/<name>.json`, so
// tests in parallel never write one file; a line an element or a value, so its diff reads), compared by
// `expectBaseline`; written anew only on purpose:
//   SW_BASELINES=update npm run test:ui:sb -- <plugin>/ui-tests/baselines/
// then the diff read and committed. Read once the page's fonts are in (`settledLook`): boxes follow the text's widths.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { devices, expect, type Locator, type Page, test, type TestDetails } from "@playwright/test";

/** How far a box may move or grow, in px, and still be the same (rounding, a font's hinting); the only numbers kept */
const TOLERANCE = 1;

// What an element's attributes say that a user, a theme or an assistive technology sees: kept with their values
const SHOWN = ["role", "hidden", "title", "type", "disabled", "tabindex", "draggable", "placeholder", "href", "contenteditable", "for", "checked", "selected", "open"];

/**
 * An element's subtree, a line an element: its tag, its classes sorted, its attributes that show (`SHOWN`, `aria-*`,
 * `data-*` but the tests' own `data-test-*` and those matching `omit`: another plugin's, which its own baselines
 * keep), the properties its inline style sets (their names: their values are geometry, kept by `lookOf`), its own
 * text trimmed. An SVG is its tag, classes and a short hash of its markup (an icon swapped shows; its paths are its
 * set's). `replace` takes out what differs between runs (a test's folder in a link); an `opaque` attribute's values
 * (an item's key, given in the order the store read the pages) are numbered as they first come in the subtree, `#1`,
 * `#2`…: the same item the same number wherever it is drawn
 */
export async function domOf(target: Locator, options: { replace?: Readonly<Record<string, string>>; omit?: RegExp; opaque?: readonly string[] } = {}): Promise<string[]> {
  const lines = await target.evaluate(
    (root, { shown, omit, opaque }) => {
      const out: string[] = [];
      const omitted = omit ? new RegExp(omit[0], omit[1]) : undefined;
      const numbers = new Map<string, string>();
      const numbered = (name: string, value: string) => {
        if (!opaque.includes(name)) return value;
        const key = `${name}=${value}`;
        if (!numbers.has(key)) numbers.set(key, `#${[...numbers.keys()].filter((one) => one.startsWith(`${name}=`)).length + 1}`);
        return numbers.get(key)!;
      };
      const hash = (text: string) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
        return (h >>> 0).toString(16).padStart(8, "0");
      };
      const walk = (element: Element, depth: number) => {
        const classes = [...element.classList].sort().map((one) => `.${one}`).join("");
        const attrs = [...element.attributes]
          .filter((one) => shown.includes(one.name) || one.name.startsWith("aria-") || one.name.startsWith("data-"))
          .filter((one) => !one.name.startsWith("data-test-") && !omitted?.test(one.name))
          .map((one) => `${one.name}=${JSON.stringify(numbered(one.name, one.value))}`);
        // (Its inline style: what shows with its value, a colour, `display: none`; geometry, its name alone)
        const style = (element as HTMLElement).style;
        if (style?.length) attrs.push(`style=${JSON.stringify([...style].sort().map((one) => (/^(display|visibility|opacity|color|background|border-color|fill|stroke)/.test(one) ? `${one}:${style.getPropertyValue(one)}` : one)).join(","))}`);
        attrs.sort();
        const svg = element.namespaceURI === "http://www.w3.org/2000/svg";
        if (svg) attrs.push(`svg=${hash(element.innerHTML)}`);
        const own = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        out.push(`${"  ".repeat(depth)}${element.tagName.toLowerCase()}${classes}${attrs.length ? ` [${attrs.join(" ")}]` : ""}${own ? ` ${JSON.stringify(own)}` : ""}`);
        if (svg) return;
        for (const child of element.children) walk(child, depth + 1);
      };
      walk(root, 0);
      return out;
    },
    { shown: SHOWN, omit: options.omit ? ([options.omit.source, options.omit.flags] as const) : undefined, opaque: options.opaque ?? [] },
  );
  return lines.map((line) => Object.entries(options.replace ?? {}).reduce((text, [from, to]) => text.split(from).join(to), line));
}

/** The look of an element: what a theme or a layout change would show (not its outline: the focus ring follows where the focus is, which the stability checks read) */
const STYLES = [
  "display",
  "position",
  "visibility",
  "overflow",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "text-align",
  "vertical-align",
  "white-space",
  "text-overflow",
  "text-decoration",
  "color",
  "background-color",
  "background-image",
  "border-top",
  "border-bottom",
  "border-left",
  "border-right",
  "border-radius",
  "box-shadow",
  "padding",
  "margin",
  "gap",
  "align-items",
  "justify-content",
  "flex-wrap",
  "cursor",
  "opacity",
  "z-index",
] as const;

export type Box = readonly [number, number, number, number];

export type Look = Record<string, { readonly box?: Box; readonly style: Record<string, string> } | "none" | Place>;

/** Where a part lies: its box against the window, and against its anchor where it has one (the button it opened from) */
export type Place = { readonly window: Box; readonly anchor?: Box };

/**
 * Where a part's place is read: always against the window (the viewport: it moves as the page scrolls, so for a part
 * laid over the page alone, a menu, a dialog, a panel, a sheet, never one in the page's flow), and against `anchor`
 * where given (one visible element, scoped to its widget: Playwright's locators are strict)
 */
export type PlaceOf = { readonly anchor?: Locator };

/**
 * Each of `parts` (a name, a selector within the target, or "" for the target itself): its computed styles and its box
 * against the target's top left (x, y, width, height, whole px), the first element matching (a selector naming which,
 * `:nth-child`, for another); "none" where none does. A part holding text directly has no width kept (-1: it follows
 * the machine's fonts). With `place`, under `@place` the part's box against the window and its anchor (`Place`): what a
 * menu moved off its button, a dialog no longer centred or a panel shifted shows; without it, nothing of the kind
 * (the baselines recorded before it stay as they are)
 */
export async function lookOf(target: Locator, parts: Readonly<Record<string, string>>, place?: PlaceOf): Promise<Look> {
  const look: Look = await target.evaluate(
    (root, { parts, styles }) => {
      const origin = root.getBoundingClientRect();
      return Object.fromEntries(
        Object.entries(parts).map(([name, selector]) => {
          const element = selector ? root.querySelector(selector) : root;
          if (!element) return [name, "none"];
          const box = element.getBoundingClientRect();
          const css = getComputedStyle(element);
          const style = Object.fromEntries(styles.map((one) => [one, css.getPropertyValue(one)]));
          const texty = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
          const measured = [Math.round(box.left - origin.left), Math.round(box.top - origin.top), texty ? -1 : Math.round(box.width), Math.round(box.height)];
          return [name, { box: measured, style }];
        }),
      );
    },
    { parts, styles: STYLES as readonly string[] },
  );
  if (!place) return look;
  if ("@place" in parts) throw new Error("lookOf: a part named @place takes the place's own key");
  const box = (one: { x: number; y: number; width: number; height: number }) => [Math.round(one.x), Math.round(one.y), Math.round(one.width), Math.round(one.height)] as const;
  const own = await target.boundingBox();
  if (!own) throw new Error("lookOf: the part has no box to place");
  const anchor = place.anchor ? await place.anchor.boundingBox() : undefined;
  if (place.anchor && !anchor) throw new Error("lookOf: the part's anchor has no box");
  const relative: Box | undefined = anchor ? [Math.round(own.x - anchor.x), Math.round(own.y - anchor.y), Math.round(own.width), Math.round(own.height)] : undefined;
  return { ...look, "@place": { window: box(own), ...(relative ? { anchor: relative } : {}) } };
}

/**
 * The look of `parts` once it holds still: the page's fonts in (SilverBullet's own, `fontFamily`, checked loaded: a
 * fallback would move every box after a text), then read until two readings a frame apart are the same (what a
 * change of size or theme lays out, a ResizeObserver's work too, done)
 */
export async function settledLook(page: Page, target: Locator, parts: Readonly<Record<string, string>>, fontFamily: string, place?: PlaceOf): Promise<Look> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // (A face of the page's own of that family loaded: `document.fonts.check` says yes of a family the page has none of)
  await expect.poll(() => page.evaluate((family) => [...document.fonts].some((face) => face.family.replace(/["']/g, "") === family && face.status === "loaded"), fontFamily), `the font ${fontFamily} loaded`).toBe(true);
  let last: Look | undefined;
  let look: Look | undefined;
  await expect
    .poll(async () => {
      last = look;
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      look = await lookOf(target, parts, place);
      return last !== undefined && JSON.stringify(last) === JSON.stringify(look);
    })
    .toBe(true);
  return look!;
}

/** Whether two baselines' values are the same: numbers (boxes alone) within `TOLERANCE`, all else exact */
function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= TOLERANCE;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((one, i) => same(one, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return a === b;
}

/**
 * The value against the baseline of this name kept beside the spec: equal (boxes within a pixel), or, where
 * `SW_BASELINES=update`, written where it is not (a baseline within its tolerance left as it is, so a pixel's
 * jitter makes no diff). A baseline missing fails a run that checks: none is made by one
 */
export async function expectBaseline(name: string, value: unknown): Promise<void> {
  const spec = test.info().file;
  const folder = join(dirname(spec), `${basename(spec, ".spec.ts")}.baselines`);
  const file = join(folder, `${name.replace(/[^\w.-]+/g, "-")}.json`);
  const kept = existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as unknown) : undefined;
  if (process.env.SW_BASELINES === "update") {
    if (kept !== undefined && same(value, kept)) return;
    await mkdir(folder, { recursive: true });
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  expect(kept !== undefined, `the baseline ${file} (written by SW_BASELINES=update)`).toBe(true);
  // (Exact where not equal: the diff shown)
  if (!same(value, kept)) expect(value, `the baseline ${name}`).toEqual(kept);
}

/**
 * Light or dark, as the system asks (`prefers-color-scheme`): SilverBullet 3.0 takes its theme of that scheme (its
 * Light or Dark), marking the root `data-sb-scheme` and `data-theme` (probed 2026-11-26; a `data-theme` set by hand
 * changes no colour), waited for
 */
export async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.waitForFunction((theme) => document.documentElement.getAttribute("data-sb-scheme") === theme, theme);
}

export type Kept = { readonly root: "kept" | "anew"; readonly kept: string[]; readonly anew: string[]; readonly blinked: number };

/**
 * What `action` leaves in place: `within`'s element itself (`root`: the same node, or one drawn anew in its place), and
 * of `items` (a selector within it, each named by `key`: an attribute, `@data-item`, or the text of an element within it, `.swd-table-name`: an item's name, which holds where an opaque key given in the order things were read does not) those that are the same
 * node after it (`kept`) and those put anew (`anew`); `blinked` the nodes taken out and put back meanwhile (a
 * MutationObserver over `within`, a node counted as it comes back: an element replaced by a new one is in `anew`, not
 * here). Read once `settled` holds and then the part has had no change for ten frames (its redraws done)
 */
export async function keptThrough(within: Locator, items: string, key: string, action: () => Promise<void>, settled: () => Promise<void>): Promise<Kept> {
  await within.evaluate(
    (root, { items, key }) => {
      const nameOf = (one: Element) => (key.startsWith("@") ? one.getAttribute(key.slice(1)) : one.querySelector(key)?.textContent?.trim()) ?? "";
      const removed = new Set<Node>();
      const state = {
        root,
        marked: new Map([...root.querySelectorAll(items)].map((one) => [nameOf(one), one])),
        blinked: 0,
        changed: 0,
        observer: new MutationObserver((records) => {
          state.changed++;
          for (const record of records) {
            for (const node of record.removedNodes) removed.add(node);
            for (const node of record.addedNodes) if (removed.has(node)) state.blinked++;
          }
        }),
      };
      state.observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
      (window as unknown as { swTestKept: typeof state }).swTestKept = state;
    },
    { items, key },
  );
  await action();
  await settled();
  // (Quiet: ten frames with no change of the part, its root drawn anew watched too)
  await expect
    .poll(() =>
      within.evaluate(async (root) => {
        const state = (window as unknown as { swTestKept: { root: Element; changed: number } }).swTestKept;
        const quiet = new MutationObserver(() => state.changed++);
        if (root !== state.root) quiet.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
        const before = state.changed;
        for (let frame = 0; frame < 10; frame++) await new Promise((done) => requestAnimationFrame(done));
        quiet.disconnect();
        return state.changed === before;
      }),
    )
    .toBe(true);
  return within.evaluate(
    (root, { items, key }) => {
      const state = (window as unknown as { swTestKept: { root: Element; marked: Map<string, Element>; blinked: number; observer: MutationObserver } }).swTestKept;
      state.observer.disconnect();
      const nameOf = (one: Element) => (key.startsWith("@") ? one.getAttribute(key.slice(1)) : one.querySelector(key)?.textContent?.trim()) ?? "";
      const now = new Map([...root.querySelectorAll(items)].map((one) => [nameOf(one), one]));
      const kept = [...now].filter(([name, one]) => state.marked.get(name) === one).map(([name]) => name).sort();
      const anew = [...now].filter(([name, one]) => state.marked.get(name) !== one).map(([name]) => name).sort();
      return { root: root === state.root ? "kept" : "anew", kept, anew, blinked: state.blinked };
    },
    { items, key },
  );
}

/** A phone: Chrome's Pixel 7, its size, touch and pixel ratio (its browser type left out: a group cannot change it, and it is Chromium either way) */
export const PHONE = (({ defaultBrowserType: _, ...rest }) => rest)(devices["Pixel 7"]);

/** A thing a plugin draws, recorded by `recordParts` */
export type Part<A> = {
  /** The page and what it shows opened, given the test's fixtures: the part's element given */
  readonly open: (args: A) => Promise<Locator>;
  /** Its parts whose look is kept (a name, a selector within the part, "" for the part itself) */
  readonly parts: Readonly<Record<string, string>>;
  /** The font its text is drawn in, waited for loaded (SilverBullet's own: its page's iA-Mono, its interface's Inter, its peek's Lora) */
  readonly font: string;
  /** Where its place is read against (`PlaceOf`: a part laid over the page alone); none: its place not recorded */
  readonly place?: (args: A) => PlaceOf;
  /** Its tests' details, given to `declare` (a page to start on: Silverware Table's `startingOn`) */
  readonly details?: TestDetails;
};

/** What `domOf` is given for a part: from the test's fixtures where it reads them (a test's folder replaced) */
export type DomOptions<A> = { readonly omit?: RegExp; readonly opaque?: readonly string[]; readonly replace?: (args: A) => Readonly<Record<string, string>> };

/**
 * Declares a test of the spec's own: its title, and its body given the fixtures it names. The spec writes it, as
 * Playwright tells a test's fixtures by the names it destructures (`({ page, space }) => …`) and keeps a test's file
 * where `test()` is called (the baselines beside it): `(title, body) => test(title, ({ page, space }) => body({ page, space }))`.
 * A `test()` called in this helper instead would keep its baselines beside scripts/, and Playwright refuses a body
 * whose first parameter is not destructured. Its tests share that line of the spec: pick one by `-g`, not `file:line`
 */
export type Declare<A> = (title: string, body: (args: A) => Promise<void>, details: TestDetails) => void;

/** What `recordParts` takes of the spec's `test`: its groups and their options (a device) */
export type Grouping = { describe(title: string, body: () => void): void; use(options: object): void };

/**
 * A test per device (a desktop, `PHONE`), part and theme: the part opened in its theme (asked for before the page
 * loads, then waited for as SilverBullet takes it), its DOM from the light run (`<name>-<device>-dom`), its look in
 * each (`<name>-<device>-<theme>`), its place where it has one. `group` is the spec's `test` (its groups and their
 * options), each test declared by `declare`
 */
export function recordParts<A extends { page: Page }>(group: Grouping, declare: Declare<A>, parts: Readonly<Record<string, Part<A>>>, dom: DomOptions<A> = {}): void {
  for (const [device, use] of [["desktop", {}], ["phone", PHONE]] as const) {
    group.describe(`on a ${device}`, () => {
      group.use(use);
      for (const [name, { open, parts: shown, font, place, details }] of Object.entries(parts)) {
        for (const theme of ["light", "dark"] as const) {
          declare(`the ${name} opened in the ${theme} theme: its look${theme === "light" ? " and its DOM" : ""}`, async (args) => {
            await args.page.emulateMedia({ colorScheme: theme });
            const part = await open(args);
            await setTheme(args.page, theme);
            if (theme === "light") await expectBaseline(`${name}-${device}-dom`, await domOf(part, { omit: dom.omit, opaque: dom.opaque, replace: dom.replace?.(args) }));
            await expectBaseline(`${name}-${device}-${theme}`, await settledLook(args.page, part, shown, font, place?.(args)));
          }, details ?? {});
        }
      }
    });
  }
}
