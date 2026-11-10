// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Bridge } from "../bridge.ts";
import { gesturesModule } from "../modules/gestures.ts";
import { snippetsModule } from "../modules/snippets.ts";
import { SettingsDialog } from "./dialog.ts";

const bridge = (uiOptions: Record<string, unknown>): Bridge => ({
  getSelection: () => ({ from: 0, to: 0, text: "" }),
  setSelection: () => undefined,
  replaceRange: () => undefined,
  getText: () => "",
  flash: () => undefined,
  getConfig: (_path, fallback) => fallback,
  getUiOption: (name: string) => uiOptions[name],
});

/** A touch screen (the main pointer coarse), as a phone */
function byFinger(coarse: boolean): void {
  window.matchMedia = ((query: string) => ({ matches: coarse && query.includes("coarse"), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

async function opened(uiOptions: Record<string, unknown>): Promise<SettingsDialog> {
  const dialog = new SettingsDialog({ doc: document, bridge: bridge(uiOptions), actions: () => [], kinds: () => [], canSave: false, save: async () => undefined, saved: () => undefined });
  await dialog.open();
  return dialog;
}

afterEach(() => document.body.replaceChildren());

describe("The settings dialog's General tab", () => {
  it("says SilverBullet's keyboard bar is on first, above the settings, on a touch screen", async () => {
    byFinger(true);
    const dialog = await opened({ keyboardBar: true });
    const general = document.querySelector('[data-swb-panel="general"]')!;
    expect(general.firstElementChild?.classList.contains("swb-settings-advice")).toBe(true);
    expect(general.firstElementChild?.textContent).toContain("SilverBullet's keyboard bar is on");
    dialog.close();
  });

  it("says nothing of it where it is off, or with a mouse", async () => {
    byFinger(true);
    let dialog = await opened({ keyboardBar: false });
    expect(document.querySelector(".swb-settings-advice")).toBeNull();
    dialog.close();
    byFinger(false);
    dialog = await opened({ keyboardBar: true });
    expect(document.querySelector(".swb-settings-advice")).toBeNull();
    dialog.close();
  });
});

describe("The settings dialog's Favorites tab", () => {
  it("marks a kind's item whose needed slot holds a snippet without its text, and the slot, until its text is typed in the slot's panel", async () => {
    byFinger(false);
    const kinds = () => [...gesturesModule().itemKinds!(), ...snippetsModule().itemKinds!()];
    const favorites = [[{ type: "gesture", tap: { type: "snippet", icon: "💬" } }]];
    const dialog = new SettingsDialog({
      doc: document,
      bridge: { ...bridge({}), getConfig: (path, fallback) => (path === "silverware.toolbar.favorites" ? favorites : fallback) },
      actions: () => [],
      kinds,
      canSave: false,
      save: async () => undefined,
      saved: () => undefined,
    });
    await dialog.open();
    const item = document.querySelector<HTMLElement>('[data-swb-panel="favorites"] [data-swb-item="0:0"]')!;
    const slot = item.querySelector<HTMLElement>('[data-swb-slot="tap"]')!;
    expect(item.title).toBe("Click: No text yet: the toolbar leaves it out");
    expect(slot.classList.contains("swb-settings-unknown")).toBe(true);
    expect(slot.textContent).toContain("💬");
    slot.click();
    const field = document.querySelector<HTMLTextAreaElement>('[data-swb-look] [data-swb-field="text"] textarea')!;
    field.value = "%%{s}%%";
    field.dispatchEvent(new Event("input"));
    const again = document.querySelector<HTMLElement>('[data-swb-panel="favorites"] [data-swb-item="0:0"]')!;
    expect(again.title).toBe("");
    expect(again.querySelector('[data-swb-slot="tap"]')!.classList.contains("swb-settings-unknown")).toBe(false);
    dialog.close();
  });
});

describe("The settings dialog's saving", () => {
  it("writes what the migrations changed and the toolbar did not write back, with the version, as it saves any favourites", async () => {
    byFinger(false);
    const touch = [[{ id: "formats.bold" }], [{ id: "formats.code" }]];
    let saved: Readonly<Record<string, unknown>> | undefined;
    const dialog = new SettingsDialog({
      doc: document,
      bridge: { ...bridge({}), getConfig: (path, fallback) => (path === "silverware.toolbar.favorites-touch" ? touch : fallback) },
      actions: () => [],
      kinds: () => [],
      canSave: true,
      save: async (values) => void (saved = values),
      saved: () => undefined,
    });
    await dialog.open();
    // Click's: an item removed
    document.querySelector<HTMLElement>('[data-swb-panel="favorites"] [data-swb-item="1:0"] .swb-settings-remove')!.click();
    document.querySelector<HTMLElement>(".swb-settings-save")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saved?.["silverware.toolbar.favorites-touch"]).toEqual([[{ id: "formats.bold" }, { type: "separator" }, { id: "formats.code" }]]);
    expect(saved?.["silverware.toolbar.settings-version"]).toBe(2);
    dialog.close();
  });
});
