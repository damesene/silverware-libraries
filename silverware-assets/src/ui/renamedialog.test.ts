// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Dialogs } from "../../../shared/dialog.ts";
import { DIALOG_LOOK } from "./dialoglook.ts";
import { openRenameDialog, type RenameResult } from "./renamedialog.ts";

afterEach(() => document.body.replaceChildren());

describe("the Rename dialog", () => {
  it("gives a file of the web a title alone, said why; Esc gives nothing back", async () => {
    const given: (RenameResult | undefined)[] = [];
    const dialogs = new Dialogs(document, DIALOG_LOOK);
    openRenameDialog(document, dialogs, { of: "embed", title: "", untitled: "cat.png", why: "A file of the web: its name is the site's." }, (result) => given.push(result));
    const dialog = document.querySelector<HTMLElement>(".swa-rename-window")!;
    expect(dialog.querySelector('input[aria-label="File name"]')).toBeNull();
    expect(dialog.textContent).toContain("A file of the web: its name is the site's.");
    const title = dialog.querySelector<HTMLInputElement>('input[aria-label="Title"]')!;
    // A title that cannot be written: said, Save refused
    title.value = "a | b";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    expect(dialog.querySelector<HTMLButtonElement>(".swa-dialog-save")!.disabled).toBe(true);
    expect(dialog.textContent).toContain("This title cannot be written: a title holds none of |.");
    title.value = "  A cat ";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>(".swa-dialog-save")!.click();
    expect(given).toEqual([{ title: "A cat" }]);
    openRenameDialog(document, dialogs, { of: "embed", title: "", untitled: "cat.png", why: "A file of the web: its name is the site's." }, (result) => given.push(result));
    document.querySelector(".swa-rename-window")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect.poll(() => given.length).toBe(2);
    expect(given[1]).toBeUndefined();
  });
});
