// @vitest-environment jsdom
// The settings window: its tabs, Save only once something changed, each changed tab saved, closed after; a problem
// said and the window kept; the Markdown tab's boxes.
import { afterEach, describe, expect, it } from "vitest";
import { markdownTab, SettingsWindow } from "./settingswindow.ts";

afterEach(() => document.body.replaceChildren());

const store = { canSave: true, confirm: async () => true };
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>(".swa-dialog button")].find((one) => one.textContent === text)!;

describe("the settings window", () => {
  it("saves the tabs that changed on Save, then closes", async () => {
    const saved: unknown[] = [];
    const tab = markdownTab(document, { hideAssets: true }, async (settings) => void saved.push(settings));
    new SettingsWindow(document).open([tab], store);
    expect(document.querySelector(".swa-dialog-tab")?.textContent).toBe("Markdown");
    expect(button("Save").disabled).toBe(true);
    const boxes = tab.panel.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    boxes[0]!.checked = false;
    boxes[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(button("Save").disabled).toBe(false);
    button("Save").click();
    await expect.poll(() => saved).toEqual([{ hideAssets: false }]);
    await expect.poll(() => document.querySelector(".swa-dialog")).toBeNull();
  });

  it("says why a tab was not saved, the window kept", async () => {
    const tab = markdownTab(document, { hideAssets: true }, async () => "Library/Config is read-only");
    new SettingsWindow(document).open([tab], store);
    const box = tab.panel.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    button("Save").click();
    await expect.poll(() => document.querySelector(".swa-dialog-note")?.textContent).toBe("Not saved: Library/Config is read-only");
    expect(document.querySelector(".swa-dialog")).not.toBeNull();
  });

  it("changes nothing where settings cannot be saved", () => {
    const tab = markdownTab(document, { hideAssets: true }, async () => undefined);
    new SettingsWindow(document).open([tab], { ...store, canSave: false });
    expect(tab.panel.querySelector<HTMLInputElement>("input")!.disabled).toBe(true);
    expect(button("Save").disabled).toBe(true);
  });
});
