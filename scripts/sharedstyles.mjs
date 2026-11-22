// The CSS of what shared/ draws, one template each, written into the style page of every plugin drawing it (its base
// in place of `__base__`), between its marks; the rest of the page the plugin's own. Run by scripts/build.mjs: `build`
// writes the blocks, `--check` fails where a page's block differs from its template (edited by hand, or the template
// changed and npm run build not run).
import { readFile, writeFile } from "node:fs/promises";

/** Each shared style: its template, its marks' name, the pages it goes into with their base */
export const SHARED_STYLES = [
  {
    // (Each page's own boxes that scroll, `__scrolls__`: the plugin's, never SilverBullet's page)
    template: "shared/scrollbar.css",
    mark: "shared-scrollbar",
    pages: [
      { page: "silverware-table/silverware-table-style.md", base: "swt", scrolls: ".sb-table-widget.swt-table, .swt-view-scroll, .swt-sheet-board, .swt-dialog-body, .swt-settings-body, .swt-choices, .swt-choices-preview-values, .swt-filter-values, .swt-functions-list, .swt-functions-detail, .swt-formula-choices, .swt-formulafield-choices, .swt-result-box, .swt-excel-skipped, .swt-cell-popup .swt-cell-popup-field, .swt-menu" },
      { page: "silverware-database/silverware-database-style.md", base: "swd", scrolls: ".swd-peek, .swd-peek-props-box, .swd-place-body, .swd-place.swd-over-window, .swd-table-box, .swd-board, .swd-tl-box, .swd-cal-undated-items, .swd-files-list, .swd-editor-list, .swd-floated, .swd-suggest, .swd-menu, .swd-settings-body, .swd-conflict-body" },
      { page: "silverware-assets/silverware-assets-style.md", base: "swa", scrolls: ".swa-panel-body, .swa-dialog-body, .swa-insert-suggest, .swa-upload-progress-rows, .swa-menu" },
      { page: "silverware-toolbar/silverware-toolbar-style.md", base: "swb", scrolls: ".swb-list, .swb-settings-body, .swb-settings-pick-list" },
      { page: "silverware-tags/silverware-tags-style.md", base: "swg", scrolls: ".swg-detail, .swg-dialog-body, .swg-review, .swg-settings-body, .swg-tags, .swg-tree-box-list, .swg-views" },
      { page: "silverware-chart/silverware-chart-style.md", base: "swc", scrolls: ".swc-settings-body, .swc-menu" },
      { page: "silverware-layout/silverware-layout-style.md", base: "swl", scrolls: ".swl-dialog-body, .swl-menu" },
      { page: "silverware-icons/silverware-icons-style.md", base: "swi", scrolls: ".swi-picker .swi-groups, .swi-picker .swi-list" },
      { page: "silverware-assets-docx/silverware-assets-docx-style.md", base: "swa-docx", scrolls: ".swa-docx-reader-scroll" },
      { page: "silverware-assets-xlsx/silverware-assets-xlsx-style.md", base: "swa-xlsx", scrolls: ".swa-xlsx-reader-scroll" },
    ],
  },
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
    // A formula's field (shared/formulafield.ts)
    template: "shared/formulafield.css",
    mark: "shared-formulafield",
    pages: [
      { page: "silverware-table/silverware-table-style.md", base: "swt" },
      { page: "silverware-database/silverware-database-style.md", base: "swd" },
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
    // A document's reader (shared/docreader.ts): Silverware Assets DOCX's and XLSX's
    template: "shared/docreader.css",
    mark: "shared-reader",
    pages: [
      { page: "silverware-assets-docx/silverware-assets-docx-style.md", base: "swa-docx" },
      { page: "silverware-assets-xlsx/silverware-assets-xlsx-style.md", base: "swa-xlsx" },
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
export function sharedBlock(template, mark, base, scrolls = "") {
  return `${begin(mark)}\n${template.replaceAll("__base__", base).replaceAll("__scrolls__", scrolls).trim()}\n${end(mark)}`;
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
    for (const { page, base, scrolls } of pages) {
      const text = (await readFile(page, "utf8")).replaceAll("\r\n", "\n");
      const made = withSharedBlock(text, mark, sharedBlock(css, mark, base, scrolls));
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
