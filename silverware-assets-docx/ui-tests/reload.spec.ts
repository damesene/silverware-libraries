// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// viewer's init page again, which leaves its registration with Silverware Assets' API as it was (the same API: its
// init returns early). After it a preview is drawn as before, once.
import { appendToPage, docxOf, expect, reloadSpaceLua, test } from "./helpers.ts";

test("after System: Reload a preview is drawn once, for an embed there before and one put in after", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.docx|||{ view: preview }]]\n` }, "Page", { "doc.docx": await docxOf([["The first page's words."]]) });
  const embeds = page.locator("#sb-main [data-swa-type='docx'][data-swa-view='preview']");
  const shown = embeds.locator(".swa-docx-preview[data-swa-docx-state='page'] .swa-docx-preview-page");
  await expect(shown).toHaveCount(1);
  await reloadSpaceLua(page);
  await appendToPage(page, `\nAgain\n\n![[${space.folder}/doc.docx|||{ view: preview }]]\n`);
  await expect(shown).toHaveCount(2);
  await expect(embeds).toHaveCount(2);
});
