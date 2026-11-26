// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// viewer's init page again, which leaves its registration with Silverware Assets' API as it was (the same API: its
// init returns early). After it a preview is drawn as before, once.
import { appendToPage, expect, reloadSpaceLua, test, xlsxOf } from "./helpers.ts";

test("after System: Reload a preview is drawn once, for an embed there before and one put in after", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/book.xlsx|||{ view: preview }]]\n` }, "Page", { "book.xlsx": await xlsxOf((workbook) => void workbook.addWorksheet("Sheet").addRow(["Monthly budget"])) });
  const embeds = page.locator("#sb-main [data-swa-type='xlsx'][data-swa-view='preview']");
  const shown = embeds.locator(".swa-xlsx-preview[data-swa-xlsx-state='sheet'] table.swa-xlsx-sheet");
  await expect(shown).toHaveCount(1);
  await reloadSpaceLua(page);
  await appendToPage(page, `\nAgain\n\n![[${space.folder}/book.xlsx|||{ view: preview }]]\n`);
  await expect(shown).toHaveCount(2);
  await expect(embeds).toHaveCount(2);
});
