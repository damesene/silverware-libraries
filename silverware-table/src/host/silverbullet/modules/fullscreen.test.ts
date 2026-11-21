// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { OVER_WINDOW_ATTRIBUTE, overWindowShown } from "../../../../../shared/overwindow.ts";
import { cell, clickOn, controller, editor, flush, key, PAGE, setup, text, useTablePage } from "../../../testing/page.ts";

describe("Full screen", () => {
  useTablePage();

  const widget = () => editor.querySelector<HTMLElement>(".sb-table-widget")!;
  // An item of the table's ⋯ menu (the toolbar shows its icon only with the toolbarNames setting)
  const icon = (label: string) => {
    cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    if (!document.querySelector(".swt-menu")) document.querySelector<HTMLElement>(".swt-bar .swt-bar-more")!.click();
    return Array.from(document.querySelectorAll<HTMLButtonElement>(".swt-menu .swt-menu-item")).find((b) => b.textContent === label);
  };

  it("shows the table over the whole window from its toolbar icon (marked so for the other plugins), the same icon closes it", async () => {
    await setup(PAGE);
    icon("Full screen")!.click();
    expect([widget().classList.contains("swt-fullscreen"), overWindowShown(document)]).toEqual([true, true]);
    const exit = icon("Exit full screen")!;
    exit.click();
    expect([widget().classList.contains("swt-fullscreen"), overWindowShown(document)]).toEqual([false, false]);
    expect(icon("Full screen")).toBeDefined();
  });

  it("stays over the window while the table is edited (rendered anew), and Esc closes it, but not a cell editor's", async () => {
    await setup(PAGE);
    icon("Full screen")!.click();
    clickOn(cell(1, 1));
    const field = editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
    // Esc in the cell editor ends the edit only
    key(field, "Escape");
    expect(widget().classList.contains("swt-fullscreen")).toBe(true);
    clickOn(cell(1, 1));
    editor.querySelector<HTMLInputElement>(".swt-cell-editor")!.value = "7";
    key(editor.querySelector(".swt-cell-editor")!, "Enter");
    for (let i = 0; i < 4; i++) await flush();
    await controller.scan();
    expect(text).toContain("| Pear | 7 |");
    expect(widget().classList.contains("swt-fullscreen")).toBe(true);
    // (The mark on the table rendered anew, none left on the one it replaced)
    expect([...document.querySelectorAll(`[${OVER_WINDOW_ATTRIBUTE}]`)]).toEqual([widget()]);
    key(editor.querySelector(".swt-cell-editor")!, "Escape");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(widget().classList.contains("swt-fullscreen")).toBe(false);
  });

  it("leaves no mark as it ends while the table rendered anew is not enhanced yet", async () => {
    await setup(PAGE);
    icon("Full screen")!.click();
    clickOn(cell(1, 1));
    editor.querySelector<HTMLInputElement>(".swt-cell-editor")!.value = "7";
    key(editor.querySelector(".swt-cell-editor")!, "Enter");
    await flush();
    // (Taken for it at once, as it was put into the page)
    expect(text).toContain("| Pear | 7 |");
    expect(overWindowShown(document)).toBe(true);
    controller.stop();
    expect(overWindowShown(document)).toBe(false);
  });
});
