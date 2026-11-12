import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error: a script of the build (plain JavaScript), its functions tested as they are
import { SHARED_STYLES, sharedBlock, withSharedBlock } from "../scripts/sharedstyles.mjs";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");

describe("the shared menu's style", () => {
  it("styles every class the shared menu draws", () => {
    // The classes renderMenu gives, by the base (`${p}-…`); not those that are an attribute's or an id's prefix
    const drawn = new Set([...read("shared/menu.ts").matchAll(/\$\{p\}-([a-z-]*[a-z])(?![a-z-]*\})/g)].map((m) => m[1]!));
    for (const prefix of ["list", "menu-row", "menu-name-problem-"]) drawn.delete(prefix);
    expect(drawn.size).toBeGreaterThan(25);
    // (Its segmented entry's buttons are styled by shared/segments.css, which goes wherever the menu's style goes)
    const template = read("shared/menu.css") + read("shared/segments.css");
    const missing = [...drawn].filter((name) => !template.includes(`.__base__-${name}`));
    expect(missing).toEqual([]);
  });

  it("has its segmented entry's buttons styled wherever the menu is", () => {
    const pagesOf = (mark: string) => (SHARED_STYLES.find((style: { mark: string }) => style.mark === mark).pages as { page: string; base: string }[]).map((one) => `${one.page} ${one.base}`);
    const segments = pagesOf("shared-segments");
    for (const page of pagesOf("shared-menu")) expect(segments, page).toContain(page);
  });

  it("is written into every plugin drawing the menu, as its template makes it", () => {
    const [menu] = SHARED_STYLES.filter((style: { mark: string }) => style.mark === "shared-menu");
    const css = read(menu.template);
    for (const { page, base } of menu.pages as { page: string; base: string }[]) {
      const text = read(page);
      const block = sharedBlock(css, menu.mark, base);
      expect(text.includes(block), page).toBe(true);
      expect(text.includes("__base__"), page).toBe(false);
    }
  });

  it("writes a block between its marks only, and says so where a page has none", () => {
    const begin = "/* <m> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */";
    const page = `before\n${begin}\nold\n/* </m> */\nafter`;
    expect(withSharedBlock(page, "m", sharedBlock(".__base__-x {}", "m", "swq")).text).toBe(`before\n${begin}\n.swq-x {}\n/* </m> */\nafter`);
    expect(withSharedBlock("no marks", "m", "x")).toHaveProperty("problem");
  });
});
