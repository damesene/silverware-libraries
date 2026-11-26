// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// viewer's init page again, which leaves its registration with Silverware Assets' API as it was (the same API: its
// init returns early). After it a preview is drawn as before, once.
import { appendToPage, BLUE, expect, pdfOf, RED, reloadSpaceLua, test } from "./helpers.ts";

test("after System: Reload a preview is drawn once, for an embed there before and one put in after", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n` }, "Page", { "doc.pdf": pdfOf([RED, BLUE]) });
  const embeds = page.locator("#sb-main [data-swa-type='pdf'][data-swa-view='preview']");
  const shown = embeds.locator(".swa-pdf-preview[data-swa-pdf-state='page'] > img");
  await expect(shown).toHaveCount(1);
  await reloadSpaceLua(page);
  await appendToPage(page, `\nAgain\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n`);
  await expect(shown).toHaveCount(2);
  await expect(embeds).toHaveCount(2);
});
