// The CSS of what shared/ draws, one template each, written into the style page of every plugin drawing it (its base
// in place of `__base__`), between its marks; the rest of the page the plugin's own. Run by scripts/build.mjs: `build`
// writes the blocks, `--check` fails where a page's block differs from its template (edited by hand, or the template
// changed and npm run build not run).
import { readFile, writeFile } from "node:fs/promises";

/** Each shared style: its template, its marks' name, the pages it goes into with their base */
export const SHARED_STYLES = [
  {
    template: "shared/menu.css",
    mark: "shared-menu",
    pages: [
      { page: "silverware-table/silverware-table-style.md", base: "swt" },
      { page: "silverware-chart/silverware-chart-style.md", base: "swc" },
      { page: "silverware-database/silverware-database-style.md", base: "swd" },
      { page: "silverware-layout/silverware-layout-style.md", base: "swl" },
      { page: "silverware-assets/silverware-assets-style.md", base: "swa" },
    ],
  },
  {
    // Joined buttons, one pressed: a menu's segmented entry (where shared/menu.css is) and segmentedControl
    template: "shared/segments.css",
    mark: "shared-segments",
    pages: [
      { page: "silverware-table/silverware-table-style.md", base: "swt" },
      { page: "silverware-chart/silverware-chart-style.md", base: "swc" },
      { page: "silverware-database/silverware-database-style.md", base: "swd" },
      { page: "silverware-layout/silverware-layout-style.md", base: "swl" },
      { page: "silverware-assets/silverware-assets-style.md", base: "swa" },
    ],
  },
  {
    template: "shared/diffview.css",
    mark: "shared-diff",
    pages: [
      { page: "silverware-tags/silverware-tags-style.md", base: "swg" },
      { page: "silverware-database/silverware-database-style.md", base: "swd" },
    ],
  },
  {
    // (The pages of the plugins drawing their own icons through shared/icons.ts, as each moves onto it)
    template: "shared/icons.css",
    mark: "shared-icons",
    pages: [
      { page: "silverware-toolbar/silverware-toolbar-style.md", base: "swb-own" },
      { page: "silverware-database/silverware-database-style.md", base: "swd-own" },
    ],
  },
];

const begin = (mark) => `/* <${mark}> generated from its template by scripts/sharedstyles.mjs (npm run build): edit the template, not this */`;
const end = (mark) => `/* </${mark}> */`;

/** The block a page holds for a style, made from its template */
export function sharedBlock(template, mark, base) {
  return `${begin(mark)}\n${template.replaceAll("__base__", base).trim()}\n${end(mark)}`;
}

/** A page's text with its block of a style made anew, or why it cannot be (its marks missing) */
export function withSharedBlock(text, mark, block) {
  const from = text.indexOf(begin(mark));
  const to = text.indexOf(end(mark));
  if (from < 0 || to < from) return { problem: `no marks ${begin(mark)} … ${end(mark)}` };
  return { text: text.slice(0, from) + block + text.slice(to + end(mark).length) };
}

/** Writes (or, `check`, compares) every page's blocks; the number of pages that differ (`check`) or cannot be written */
export async function sharedStyles(check) {
  let wrong = 0;
  for (const { template, mark, pages } of SHARED_STYLES) {
    const css = (await readFile(template, "utf8")).replaceAll("\r\n", "\n");
    for (const { page, base } of pages) {
      const text = (await readFile(page, "utf8")).replaceAll("\r\n", "\n");
      const made = withSharedBlock(text, mark, sharedBlock(css, mark, base));
      if ("problem" in made) {
        console.error(`${page}: ${made.problem}`);
        wrong++;
      } else if (made.text !== text) {
        if (check) {
          console.error(`${page}: its ${mark} block differs from ${template}: run npm run build`);
          wrong++;
        } else await writeFile(page, made.text);
      }
    }
  }
  return wrong;
}
