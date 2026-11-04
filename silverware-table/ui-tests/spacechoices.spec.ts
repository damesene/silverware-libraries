// A choice list of the space: a space-lua block's silverware.table.defineChoices
// gives a list from a query, which a #choice-<name> column of any table takes
// (its values checked, offered in the editor), read anew as a page is indexed.
// SilverBullet only: the playground has no Space Lua.
import { bodyRows, cell, expect, reload, setOtherPage, setPage, target, test } from "./helpers.ts";

const SCRIPT = [
  "```space-lua",
  "silverware.table.defineChoices(\"projects\", function()",
  "  return query[[from p = index.tag \"project\" select p.name]]",
  "end)",
  "```",
  "",
].join("\n");

const PAGE = ["| Task | Project #choice-projects |", "|---|---|", "| A | UiTests/Alpha |", "| B | UiTests/Beta |", ""].join("\n");

test.describe("Lists of the space", () => {
  test.skip(target !== "silverbullet", "Space Lua: SilverBullet only");

  test("a column takes a list a query gives, read anew once a page is indexed", async ({ page }) => {
    await setOtherPage(page, "UiTests/Alpha", "#project\n");
    await setOtherPage(page, "UiTests/ChoicesScript", SCRIPT);
    await reload(page);
    await setPage(page, PAGE);
    await expect(bodyRows(page)).toHaveCount(2);
    await expect(cell(page, 1, 1)).not.toHaveClass(/swt-type-invalid/);
    await expect(cell(page, 2, 1)).toHaveClass(/swt-type-invalid/);
    // A page of the tag made: the query gives it, the cell no longer marked
    await setOtherPage(page, "UiTests/Beta", "#project\n");
    await expect(cell(page, 2, 1)).not.toHaveClass(/swt-type-invalid/, { timeout: 10_000 });
    // The editor offers the list's values
    await cell(page, 1, 1).dblclick();
    const choices = page.locator(".swt-choices .swt-choice");
    await expect(choices).toHaveCount(2);
    expect((await choices.allTextContents()).sort()).toEqual(["UiTests/Alpha", "UiTests/Beta"]);
  });
});
