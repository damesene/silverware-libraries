// One markdown drawn on every surface that draws it, compared with the page (docs/silverware-look-compare.md): the page
// (SilverBullet's editor), a grid's cell (SilverBullet's rendering, Silverware Layout's rules), the cell edited and a
// database's peek, read and edited (Silverware Editor's field). Nothing stored: what a SilverBullet version changes in
// its page's look, the others follow or this fails, naming the surface and the property. Each block is read relative
// to the text's own start on its surface (a paragraph's), so where a surface lies and its padding never count.
// Measurements fail; pixels are attached to the report (each block cropped on each surface, its share of pixels
// differing from the page's), not compared yet.
import type { Locator, Page } from "@playwright/test";
import { cellField, expect, fieldReady, gridsDrawn, item, peekField, root, type Space, test } from "../helpers.ts";

// The markdown: a paragraph whose text's start is each surface's origin, its blocks, a last line for the caret
// Text drawn alike wherever it lies: glyphs on whole pixels (a surface's text at 271.3 px and the page's at 271 px drawn
// the same), smoothed one way, colours in one profile, so that the crops differ by what is drawn, not by where
// A window as tall as the markdown on every surface (zoomed too): the page's editor draws only the lines in view
test.use({ viewport: { width: 1200, height: 4000 }, launchOptions: { args: ["--disable-font-subpixel-positioning", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] } });

// The share of a block's pixels differing from the page's past which the run warns (a test's annotation `warning`,
// told by scripts/ui-tests-summary.ts: GitHub's warning on the run, the console's yellow line), the test passing: a
// grid's or a peek's block drawn as the page's differs in none to 2 % (a table narrower in the peek)
const PIXELS_TOLD = 0.05;

// (An image's file beside the pages: a size of its own, drawn alike everywhere)
const PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#888"/></svg>';

/** The markdown, its files by their path from the space's root (`folder`: the test's) */
const fixture = (folder: string) =>
  [
    "Start",
    "# First level",
    "## Second level",
    "### Third level",
    "Some **bold**, *slanted*, `mono`, ==marked== and [a link](https://example.com) here",
    "- one\n- two\n  - nested",
    "1. first\n2. second",
    "- [ ] open\n- [x] done",
    "| Head | Name |\n|---|---|\n| Body | 2 |",
    "Text with #looktag here",
    "> Quoted one\n> Quoted two",
    '```csharp\nreturn "text";\nvar count = 1;\n```',
    "Above rule",
    "---",
    "Below rule",
    "Before files",
    `![[${folder}/pic.svg|||{ view: preview }]]`,
    `![[${folder}/pic.svg|||{ view: card }]]`,
    `A link to [[${folder}/pic.svg]] here`,
    "After files",
    "End",
  ].join("\n\n");

// The blocks cropped for the pixels: the words of their first and last lines
const BLOCKS = {
  bullets: ["one", "nested"],
  numbers: ["first", "second"],
  tasks: ["open", "done"],
  table: ["Head", "Body"],
  hashtag: ["Text with", "Text with"],
  quote: ["Quoted one", "Quoted two"],
  code: ["return", "count"],
  files: ["Before files", "After files"],
} as const;

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
  // A ground drawing nothing
  const clear = /^(transparent|rgba\(0, 0, 0, 0\))$/;
  // A cell's text, its room and its ground (its own, else its row's or its part's)
  const cellOf = (word: string) => {
    const cell = exact(word).parentElement!.closest("th, td")!;
    const s = style(cell);
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
      if (!clear.test(s.backgroundColor) || parseFloat(s.borderTopLeftRadius) > 0) return s;
    }
    return style(exact("#looktag").parentElement!);
  })();
  // A word's text: its font, its colour, its ground (the first of it and the boxes round it within its line drawing one)
  // and a line drawn through or under it (its own or a box's round it)
  // (A word's line: an editor's, a rendering's block round it before a paragraph, a quote's `<p>` in its `<blockquote>`)
  const LINE = "li, td, th, h1, h2, h3, blockquote, pre, .cm-line";
  const textOf = (word: string) => {
    const own = exact(word).parentElement!;
    const line = own.closest(LINE) ?? own.closest("p");
    const boxes: Element[] = [];
    for (let at: Element | null = own; at; at = at.parentElement) {
      boxes.push(at);
      if (at === line) break;
    }
    const s = style(own);
    return {
      font: [s.fontSize, s.fontWeight, s.fontStyle, s.fontFamily],
      color: s.color,
      ground: boxes.map((one) => style(one).backgroundColor).find((ground) => !clear.test(ground)) ?? "none",
      decoration: boxes.map((one) => style(one).textDecorationLine).find((decoration) => decoration !== "none") ?? "none",
    };
  };
  // A file drawn by Silverware Assets (the first of a view): its box rounded, its corners, line, shadow
  const fileOf = (selector: string) => {
    const element = (scope as ParentNode).querySelector(selector);
    if (!element) return "none";
    const box = element.getBoundingClientRect();
    const s = style(element);
    return [Math.round(box.width), Math.round(box.height), s.borderTopLeftRadius, s.borderTopWidth, s.borderTopColor, s.boxShadow];
  };
  const origin = left("Start");
  const place = (word: string) => Math.round(left(word) - origin);
  // A task's box against its text: its middle from where its text starts, and from its line's middle
  const boxPlace = (word: string) => {
    const box = lineOf(word).querySelector('input[type="checkbox"]')!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(exact(word));
    const text = range.getClientRects()[0]!;
    return { x: Math.round(box.left + box.width / 2 - left(word)), y: Math.round(box.top + box.height / 2 - (text.top + text.height / 2)) };
  };
  const [openBox, doneBox] = [boxPlace("open"), boxPlace("done")];
  // How far a line is under the one before it (the text's rhythm): its text's top from the other's
  const topOf = (word: string) => {
    const range = document.createRange();
    range.selectNodeContents(exact(word));
    return range.getClientRects()[0]!.top;
  };
  const under = (word: string, above: string) => Math.round(topOf(word) - topOf(above));
  return {
    places: {
      one: place("one"),
      nested: place("nested"),
      first: place("first"),
      second: place("second"),
      open: place("open"),
      done: place("done"),
      "open's box across": openBox.x,
      "open's box down": openBox.y,
      "done's box across": doneBox.x,
      "done's box down": doneBox.y,
      "two under one": under("two", "one"),
      "nested under two": under("nested", "two"),
      "second under first": under("second", "first"),
      "done under open": under("done", "open"),
      "Body under Head": under("Body", "Head"),
      "Second level under First level": under("Second level", "First level"),
      "Third level under Second level": under("Third level", "Second level"),
      "Some under Third level": under("Some", "Third level"),
      "Quoted one": place("Quoted one"),
      "Quoted two under Quoted one": under("Quoted two", "Quoted one"),
      return: place("return"),
      "count under return": under("count", "return"),
      "Below rule under Above rule": under("Below rule", "Above rule"),
    },
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
      "heading 1": textOf("First level"),
      "heading 2": textOf("Second level"),
      "heading 3": textOf("Third level"),
      bold: textOf("bold"),
      italic: textOf("slanted"),
      "inline code": textOf("mono"),
      highlight: textOf("marked"),
      link: textOf("a link"),
      quote: textOf("Quoted one"),
      code: textOf("return"),
      "code's string": textOf('"text"').color,
      "a file's preview": fileOf('[data-swa-view="preview"]'),
      "a file's card": fileOf(".swa-card"),
      "a card's icon": fileOf(".swa-card :is(svg, img)"),
      "a link's icon": fileOf(".swa-link-icon"),
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
  return { x: Math.max(0, Math.floor(origin - 4)), y: Math.max(0, Math.floor(top - 4)), width: 460, height: Math.ceil(bottom - top + 8) };
}

/**
 * How much of what two crops draw differs, as the browser decodes them, as Playwright's own comparison tells
 * (pixelmatch's: a smoothed edge no difference): each crop's ink, how far each pixel is from its ground (its first
 * pixel: a panel's ground a shade off the page's is no difference); the crops laid over each other where they match
 * best, within `SHIFT` pixels (one drawn a pixel lower is no difference); a pixel differs where no pixel within one of
 * it in the other has ink near its own. The share of the pixels with ink in either. Colours are the measurements'
 */
function differing([a, b]: readonly [string, string]): Promise<number> {
  const image = (data: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const one = new Image();
      one.onload = () => resolve(one);
      one.onerror = reject;
      one.src = `data:image/png;base64,${data}`;
    });
  const SHIFT = 3;
  // (A pixel with ink: a fifth of the fullest; two inks near: a third of the fullest apart at most)
  const INKED = 0.2;
  const NEAR = 0.35;
  const inks = (one: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = one.width;
    canvas.height = one.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(one, 0, 0);
    const data = context.getImageData(0, 0, one.width, one.height).data;
    const ink = new Float32Array(one.width * one.height);
    for (let i = 0; i < ink.length; i++) ink[i] = (Math.abs(data[i * 4]! - data[0]!) + Math.abs(data[i * 4 + 1]! - data[1]!) + Math.abs(data[i * 4 + 2]! - data[2]!)) / 765;
    return { ink, width: one.width, height: one.height, at: (x: number, y: number) => (x >= 0 && y >= 0 && x < one.width && y < one.height ? ink[y * one.width + x]! : 0) };
  };
  type Inks = ReturnType<typeof inks>;
  // (Of p's inked pixels, how many have no ink near theirs in q within a pixel, q shifted by dx, dy)
  const unmatched = (p: Inks, q: Inks, dx: number, dy: number) => {
    let inked = 0;
    let differ = 0;
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++) {
        const value = p.at(x, y);
        if (value < INKED) continue;
        inked++;
        let near = false;
        for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1 && !near; ox++) near = Math.abs(q.at(x + dx + ox, y + dy + oy) - value) <= NEAR;
        if (!near) differ++;
      }
    return [inked, differ] as const;
  };
  return Promise.all([image(a), image(b)]).then(([first, second]) => {
    const [p, q] = [inks(first), inks(second)];
    let best = 1;
    for (let dy = -SHIFT; dy <= SHIFT; dy++)
      for (let dx = -SHIFT; dx <= SHIFT; dx++) {
        const [inkedP, differP] = unmatched(p, q, dx, dy);
        const [inkedQ, differQ] = unmatched(q, p, -dx, -dy);
        const share = inkedP + inkedQ ? (differP + differQ) / (inkedP + inkedQ) : 0;
        best = Math.min(best, share);
      }
    return best;
  });
}

/**
 * Two values read alike: equal, or colours a channel's step or two apart (SilverBullet 2.12.1 draws a number in its
 * markup's grey, its bullets in one a step lighter; no eye tells them apart), arrays alike item by item
 */
function alike(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((one, i) => alike(one, b[i]));
  // (An object's parts alike part by part: a colour in it as near as one alone)
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>];
    const keys = Object.keys(x);
    return keys.length === Object.keys(y).length && keys.every((key) => key in y && alike(x[key], y[key]));
  }
  const rgb = (value: unknown) => (typeof value === "string" ? /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/.exec(value)?.slice(1).map((n) => Number(n ?? 1)) : undefined);
  const [x, y] = [rgb(a), rgb(b)];
  if (x && y) return x.every((n, i) => Math.abs(n - y[i]!) <= (i === 3 ? 0.01 : 2));
  return JSON.stringify(a) === JSON.stringify(b);
}

type Surface = { readonly name: string; readonly target: Locator; readonly shadow: boolean };

/** A surface read: its look, and its blocks' crops (the pointer away first: no handle, grip or "…" over them) */
async function read(page: Page, surface: Surface): Promise<{ look: Look; crops: Readonly<Record<string, Buffer>> }> {
  await page.mouse.move(1, 1);
  // (Its files drawn by Silverware Assets, as it does a moment after the text: a preview, a card, a link's icon)
  for (const selector of ['[data-swa-view="preview"]', ".swa-card", ".swa-link-icon"]) await expect(surface.target.locator(selector).first()).toBeVisible();
  // (The code block highlighted in its language, which an editor (the page's, a field's, the one a grid's rendered cell
  // asks) loads as the block is first drawn: its string a node of its own)
  await expect(surface.target.locator("span", { hasText: /^"text"$/ }).first()).toBeVisible();
  const look = await surface.target.evaluate(readLook, surface.shadow);
  const crops: Record<string, Buffer> = {};
  for (const [block, [first, last]] of Object.entries(BLOCKS)) {
    const clip = await surface.target.evaluate(blockClip, [surface.shadow, first, last] as const);
    crops[block] = await page.screenshot({ clip, caret: "hide", animations: "disabled" });
  }
  return { look, crops };
}

test("one markdown on the page, in a grid's cell, the cell edited and a database's peek, read and edited: drawn alike", async ({ page, space }) => {
  await compareSurfaces(page, space);
});

test("the same, the text zoomed on this device (Silverware Layout's font zoom): drawn alike, a task's box by its text", async ({ page, space }) => {
  // (This device's zoom, as Ctrl + scroll keeps it: shared by every page opened)
  await page.addInitScript(() => localStorage.setItem("silverware.layout.fontZoom", "30"));
  await compareSurfaces(page, space);
  expect(await page.locator("#sb-main .cm-content").evaluate((content) => getComputedStyle(content).fontSize)).toBe("30px");
});

/**
 * Differences known and not yet mended, each surface's measurements of a key left out with why (docs/silverware-look-
 * compare.md, *Known differences*), told in the report where they show; each taken out of here as it is mended. The
 * pixels still tell them
 */
const FIELDS = ["grid edited", "peek", "peek edited"];
type Part = "font" | "color" | "ground" | "decoration";
const KNOWN: readonly { readonly surfaces: readonly string[]; readonly keys: readonly string[]; readonly parts?: readonly Part[]; readonly why: string }[] = [
  // A field and a grid's rendered cell: a rule's line a line's height, as 2.12.1 draws it; edge's editor draws it 1 px
  // (its CodeMirror, not its rules: nothing to read)
  { surfaces: [...FIELDS, "grid"], keys: ["Below rule under Above rule"], why: "a rule's line a line high, as on 2.12.1; 1 px on edge" },
  // A grid's cell rendered: SilverBullet's rendering, Silverware Layout's rules on it
];

/** The fixture opened on every surface, read, its pixels attached, each surface's measurements compared with the page's */
async function compareSurfaces(page: Page, space: Space): Promise<void> {
  const markdown = fixture(space.folder);
  await space.open(
    {
      Plain: `# Plain\n\n${markdown}\n`,
      Grid: `# Grid\n\n<grid>\n<cell>\n\n${markdown}\n\n</cell>\n</grid>\n\nAfter\n`,
      Db: "# Db\n\n```silverware-database\nid: look\nview: list\n```\n",
      "Db/db-look": root("look", "Look"),
      "Db/db-look/Sample": `${item("Todo", "a0")}\n${markdown}\n`,
    },
    "Plain",
    { "pic.svg": PICTURE },
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
      // (Past the share a run tells: a warning, the test passing; its crops in the report)
      if (share > PIXELS_TOLD) test.info().annotations.push({ type: "warning", description: `${block} on the ${surface.name} differs from the page's in ${(share * 100).toFixed(1)} % of its pixels (crops "${block} - page" and "${block} - ${surface.name}" in the report)` });
    }
  }

  // The measurements: every surface as the page (places within 2 px: an em rounds otherwise by surface; a task's box
  // down within 3: SilverBullet 2.12.1 sits it on the text's baseline, a little lower than its line's middle as the font
  // grows, where a grid's cell puts it, as SilverBullet after it does)
  // (A known difference left out, told in the report: where it shows, its values and why; where it no longer does on
  // this SilverBullet, that too, to take it out once it shows on none)
  const tell = (type: string, surface: string, key: string, text: string) => test.info().annotations.push({ type, description: `${surface}: ${key}: ${text}` });
  const knownOf = (surface: string, key: string) => KNOWN.filter((entry) => entry.surfaces.includes(surface) && entry.keys.includes(key));
  for (const surface of others) {
    for (const [key, value] of Object.entries(surface.look.places)) {
      const within = key.endsWith("box down") ? 3 : 2;
      const onPage = reference!.look.places[key]!;
      const differs = Math.abs(value - onPage) > within;
      // (A place is no part of a look: entries of a part do not hold it)
      const known = knownOf(surface.name, key).filter((entry) => !entry.parts);
      if (known.length) tell(differs ? "known difference" : "known difference not shown", surface.name, key, `${value} px, the page ${onPage} px (${known.map((entry) => entry.why).join("; ")})`);
      else expect.soft(Math.abs(value - onPage), `${surface.name}: where "${key}" starts (${value} px, the page ${onPage} px)`).toBeLessThanOrEqual(within);
    }
    for (const [key, value] of Object.entries(surface.look.looks)) {
      const onPage = reference!.look.looks[key];
      const known = knownOf(surface.name, key);
      // (Known of a part alone: the other parts compared still)
      const whole = known.find((entry) => !entry.parts);
      const parts = new Set(known.flatMap((entry) => entry.parts ?? []));
      const split = (look: unknown, keep: boolean) => (parts.size && look && typeof look === "object" && !Array.isArray(look) ? Object.fromEntries(Object.entries(look).filter(([part]) => parts.has(part as Part) === keep)) : look);
      const without = (look: unknown) => split(look, false);
      // (Shown or not by what is known of it alone: its known parts, or all of it)
      const shown = whole ? !alike(value, onPage) : !alike(split(value, true), split(onPage, true));
      if (known.length) tell(shown ? "known difference" : "known difference not shown", surface.name, key, `${JSON.stringify(value)}, the page ${JSON.stringify(onPage)} (${known.map((entry) => entry.why).join("; ")})`);
      if (whole) continue;
      if (!alike(without(value), without(onPage))) expect.soft(without(value), `${surface.name}: ${key}`).toEqual(without(onPage));
    }
  }
}
