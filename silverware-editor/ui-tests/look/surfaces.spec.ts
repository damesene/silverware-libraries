// One markdown drawn on every surface that draws it, compared with the page (docs/silverware-look-compare.md): the page
// (SilverBullet's editor), a grid's cell (SilverBullet's rendering, Silverware Layout's rules), the cell edited and a
// database's peek, read and edited (Silverware Editor's field). Nothing stored: what a SilverBullet version changes in
// its page's look, the others follow or this fails, naming the surface and the property. Each block is read relative
// to the text's own start on its surface (a paragraph's), so where a surface lies and its padding never count.
// Measurements fail; pixels are attached to the report (each block cropped on each surface, its share of pixels
// differing from the page's), not compared yet.
import type { Locator, Page } from "@playwright/test";
import { cellField, expect, fieldReady, gridsDrawn, item, peekField, root, test } from "../helpers.ts";

// The markdown: a paragraph whose text's start is each surface's origin, its blocks, a last line for the caret
const FIXTURE = [
  "Start",
  "- one\n- two\n  - nested",
  "1. first\n2. second",
  "- [ ] open\n- [x] done",
  "| Head | Name |\n|---|---|\n| Body | 2 |",
  "Text with #looktag here",
  "End",
].join("\n\n");

// The blocks cropped for the pixels: the words of their first and last lines
const BLOCKS = { bullets: ["one", "nested"], numbers: ["first", "second"], tasks: ["open", "done"], table: ["Head", "Body"], hashtag: ["Text with", "Text with"] } as const;

type Read = Readonly<Record<string, unknown>>;
type Look = { readonly places: Readonly<Record<string, number>>; readonly looks: Read };

/**
 * A surface's look of the fixture, read in the page: where each list's text starts (px from the paragraph's text), the
 * marks' colours, a done task's line, a task's box, the table's card, header and cells, a hashtag. `shadow`: the
 * surface's nodes are in its element's shadow root (Silverware Editor's field)
 */
function readLook(element: HTMLElement, shadow: boolean): Look {
  const scope: Node = shadow ? element.shadowRoot! : element;
  const texts: Text[] = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
  const exact = (word: string) => {
    const found = texts.find((node) => node.textContent?.trim() === word) ?? texts.find((node) => node.textContent?.includes(word));
    if (!found) throw new Error(`"${word}" not drawn`);
    return found;
  };
  const left = (word: string) => {
    const node = exact(word);
    const range = document.createRange();
    const at = node.textContent!.indexOf(word);
    range.setStart(node, at);
    range.setEnd(node, at + 1);
    return range.getBoundingClientRect().left;
  };
  const style = (target: Element, pseudo?: string) => getComputedStyle(target, pseudo);
  // A word's line: a rendered list's item, an editor's line
  const lineOf = (word: string) => exact(word).parentElement!.closest("li, .cm-line")!;
  // A line's mark's colour: a bullet's or a number's text where an editor writes it, else the item's `::before`
  const markOf = (word: string) => {
    const line = lineOf(word);
    const mark = texts.find((node) => line.contains(node) && /^\s*(•|\d+\.)\s*$/.test(node.textContent ?? ""));
    return mark ? style(mark.parentElement!).color : style(line, "::before").color;
  };
  const struck = (word: string) => {
    const line = lineOf(word);
    for (let at: Element | null = exact(word).parentElement; at; at = at.parentElement) {
      if (style(at).textDecorationLine.includes("line-through")) return true;
      if (at === line) break;
    }
    return false;
  };
  const boxOf = (word: string) => {
    const box = lineOf(word).querySelector('input[type="checkbox"]');
    if (!box) return "none";
    const s = style(box);
    return [Math.round(parseFloat(s.width)), Math.round(parseFloat(s.height)), s.borderTopLeftRadius, s.borderTopColor, s.backgroundColor, style(box, "::after").content];
  };
  // A cell's text, its room and its ground (its own, else its row's or its part's)
  const cellOf = (word: string) => {
    const cell = exact(word).parentElement!.closest("th, td")!;
    const s = style(cell);
    const clear = /^(transparent|rgba\(0, 0, 0, 0\))$/;
    const grounds = [cell, cell.parentElement!, cell.parentElement!.parentElement!].map((one) => style(one).backgroundColor);
    return [s.fontSize, s.fontWeight, s.color, grounds.find((ground) => !clear.test(ground)) ?? "none", s.paddingTop, s.paddingLeft];
  };
  // The table's card: the first of it and the boxes round it with corners, a line or a shadow
  const cardOf = (word: string) => {
    let at: Element | null = exact(word).parentElement!.closest("table");
    for (let i = 0; at && i < 4; i++, at = at.parentElement) {
      const s = style(at);
      if (parseFloat(s.borderTopLeftRadius) > 0 || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== "none") return [s.borderTopLeftRadius, s.borderTopWidth, s.borderTopColor, s.boxShadow];
    }
    return "none";
  };
  // A hashtag's pill: the element round its text drawing a ground or corners (the page's text is in one inside it)
  const tag = (() => {
    let at: Element | null = exact("#looktag").parentElement;
    for (let i = 0; at && i < 3; i++, at = at.parentElement) {
      const s = style(at);
      if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(s.backgroundColor) || parseFloat(s.borderTopLeftRadius) > 0) return s;
    }
    return style(exact("#looktag").parentElement!);
  })();
  const origin = left("Start");
  const place = (word: string) => Math.round(left(word) - origin);
  return {
    places: { one: place("one"), nested: place("nested"), first: place("first"), second: place("second"), open: place("open"), done: place("done") },
    looks: {
      bullet: markOf("one"),
      number: markOf("first"),
      doneStruck: struck("done"),
      openStruck: struck("open"),
      openBox: boxOf("open"),
      doneBox: boxOf("done"),
      tableCard: cardOf("Head"),
      tableHead: cellOf("Head"),
      tableCell: cellOf("Body"),
      hashtag: [tag.color, tag.backgroundColor, tag.borderTopLeftRadius],
    },
  };
}

/** A block's crop on a surface: from the paragraph's text's start, the block's first line's top to its last line's bottom */
function blockClip(element: HTMLElement, [shadow, first, last]: readonly [boolean, string, string]): { x: number; y: number; width: number; height: number } {
  const scope: Node = shadow ? element.shadowRoot! : element;
  const texts: Text[] = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
  const box = (word: string) => {
    const node = texts.find((one) => one.textContent?.trim() === word) ?? texts.find((one) => one.textContent?.includes(word));
    const range = document.createRange();
    range.selectNodeContents(node!);
    return range.getBoundingClientRect();
  };
  const start = texts.find((one) => one.textContent?.trim() === "Start")!;
  start.parentElement!.scrollIntoView({ block: "nearest" });
  (texts.find((one) => one.textContent?.includes(first))!.parentElement as HTMLElement).scrollIntoView({ block: "center" });
  const origin = (() => {
    const range = document.createRange();
    range.selectNodeContents(start);
    return range.getBoundingClientRect().left;
  })();
  const top = box(first).top;
  const bottom = Math.max(box(last).bottom, box(first).bottom);
  return { x: Math.max(0, Math.floor(origin - 4)), y: Math.max(0, Math.floor(top - 4)), width: 300, height: Math.ceil(bottom - top + 8) };
}

/** The share of pixels two images differ in (each channel's difference summed past a threshold), as the browser decodes them */
function differing([a, b]: readonly [string, string]): Promise<number> {
  const image = (data: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const one = new Image();
      one.onload = () => resolve(one);
      one.onerror = reject;
      one.src = `data:image/png;base64,${data}`;
    });
  return Promise.all([image(a), image(b)]).then(([first, second]) => {
    const width = Math.min(first.width, second.width);
    const height = Math.min(first.height, second.height);
    const pixels = (one: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.drawImage(one, 0, 0);
      return context.getImageData(0, 0, width, height).data;
    };
    const [p, q] = [pixels(first), pixels(second)];
    let differ = 0;
    for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i]! - q[i]!) + Math.abs(p[i + 1]! - q[i + 1]!) + Math.abs(p[i + 2]! - q[i + 2]!) > 96) differ++;
    return differ / (width * height);
  });
}

/**
 * Two values read alike: equal, or colours a channel's step or two apart (SilverBullet 2.12.1 draws a number in its
 * markup's grey, its bullets in one a step lighter; no eye tells them apart), arrays alike item by item
 */
function alike(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((one, i) => alike(one, b[i]));
  const rgb = (value: unknown) => (typeof value === "string" ? /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/.exec(value)?.slice(1).map((n) => Number(n ?? 1)) : undefined);
  const [x, y] = [rgb(a), rgb(b)];
  if (x && y) return x.every((n, i) => Math.abs(n - y[i]!) <= (i === 3 ? 0.01 : 2));
  return JSON.stringify(a) === JSON.stringify(b);
}

type Surface = { readonly name: string; readonly target: Locator; readonly shadow: boolean };

/** A surface read: its look, and its blocks' crops (the pointer away first: no handle, grip or "…" over them) */
async function read(page: Page, surface: Surface): Promise<{ look: Look; crops: Readonly<Record<string, Buffer>> }> {
  await page.mouse.move(1, 1);
  const look = await surface.target.evaluate(readLook, surface.shadow);
  const crops: Record<string, Buffer> = {};
  for (const [block, [first, last]] of Object.entries(BLOCKS)) {
    const clip = await surface.target.evaluate(blockClip, [surface.shadow, first, last] as const);
    crops[block] = await page.screenshot({ clip, caret: "hide", animations: "disabled" });
  }
  return { look, crops };
}

test("one markdown on the page, in a grid's cell, the cell edited and a database's peek, read and edited: drawn alike", async ({ page, space }) => {
  await space.open(
    {
      Plain: `# Plain\n\n${FIXTURE}\n`,
      Grid: `# Grid\n\n<grid>\n<cell>\n\n${FIXTURE}\n\n</cell>\n</grid>\n\nAfter\n`,
      Db: "# Db\n\n```silverware-database\nid: look\nview: list\n```\n",
      "Db/db-look": root("look", "Look"),
      "Db/db-look/Sample": `${item("Todo", "a0")}\n${FIXTURE}\n`,
    },
    "Plain",
  );
  const surfaces: { name: string; look: Look; crops: Readonly<Record<string, Buffer>> }[] = [];
  const take = async (surface: Surface) => surfaces.push({ name: surface.name, ...(await read(page, surface)) });

  // The page, its caret on the last line (no block's marks shown)
  await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { length: number } }; dispatch(spec: unknown): void } } }).client.editorView;
    view.dispatch({ selection: { anchor: view.state.doc.length } });
  });
  await take({ name: "page", target: page.locator("#sb-main .cm-content"), shadow: false });

  // A grid's cell, then edited, its caret on the last line
  await space.goTo("Grid");
  await gridsDrawn(page);
  const cell = page.locator("#sb-main .swl-grid-cell").first();
  await take({ name: "grid", target: cell, shadow: false });
  await cell.getByText("End", { exact: true }).click();
  await expect(cellField(page).locator(".cm-content")).toBeVisible();
  await page.keyboard.press("Control+End");
  await take({ name: "grid edited", target: cellField(page), shadow: true });
  await page.keyboard.press("Escape");

  // A database's peek (Silverware Editor is loaded when the browser is idle: a peek opened before has a plain field,
  // closed and opened again until its editor shows), then edited, its caret on the last line
  await space.goTo("Db");
  await expect(async () => {
    if (await page.locator(".swd-peek").count()) await page.keyboard.press("Escape");
    await page.locator(".swd-list-name", { hasText: "Sample" }).click();
    await expect(peekField(page).locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect.poll(() => fieldReady(peekField(page))).toBe(true);
  await take({ name: "peek", target: peekField(page), shadow: true });
  await peekField(page).getByText("End", { exact: true }).click();
  await page.keyboard.press("Control+End");
  await take({ name: "peek edited", target: peekField(page), shadow: true });

  // The pixels, attached: each block's crop on each surface, and how much of it differs from the page's
  const [reference, ...others] = surfaces;
  for (const surface of surfaces) for (const [block, crop] of Object.entries(surface.crops)) await test.info().attach(`${block} - ${surface.name}`, { body: crop, contentType: "image/png" });
  for (const surface of others) {
    for (const [block, crop] of Object.entries(surface.crops)) {
      const share = await page.evaluate(differing, [reference!.crops[block]!.toString("base64"), crop.toString("base64")] as const);
      test.info().annotations.push({ type: "pixels differing from the page", description: `${block}, ${surface.name}: ${(share * 100).toFixed(1)} %` });
    }
  }

  // The measurements: every surface as the page (places within 2 px: an em rounds otherwise by surface)
  for (const surface of others) {
    for (const [key, value] of Object.entries(surface.look.places)) {
      expect.soft(Math.abs(value - reference!.look.places[key]!), `${surface.name}: where "${key}" starts (${value} px, the page ${reference!.look.places[key]} px)`).toBeLessThanOrEqual(2);
    }
    for (const [key, value] of Object.entries(surface.look.looks)) if (!alike(value, reference!.look.looks[key])) expect.soft(value, `${surface.name}: ${key}`).toEqual(reference!.look.looks[key]);
  }
});
