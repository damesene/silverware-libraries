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
      bridge: { ...bridge({}), getConfig: (path, fallback) => (path === "silverware.toolbar.favorites" ? [{ name: "Mine", useFor: ["click", "touch"], rows: favorites }] : fallback) },
      actions: () => [],
      kinds,
      canSave: false,
      save: async () => undefined,
      saved: () => undefined,
    });
    await dialog.open();
    const panel = () => document.querySelector('[data-swb-panel="toolbars"]')!;
    const item = () => panel().querySelector<HTMLElement>('[data-swb-item="0:0"]')!;
    expect(item().title).toBe("Click: No text yet: the toolbar leaves it out");
    expect(item().classList.contains("swb-settings-unknown")).toBe(true);
    // Its slots in its panel (Enter on it)
    item().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const slot = panel().querySelector<HTMLElement>('[data-swb-look] [data-swb-slot="tap"]')!;
    expect(slot.classList.contains("swb-settings-unknown")).toBe(true);
    expect(slot.textContent).toContain("💬");
    slot.click();
    const field = document.querySelector<HTMLTextAreaElement>('[data-swb-look] [data-swb-field="text"] textarea')!;
    field.value = "%%{s}%%";
    field.dispatchEvent(new Event("input"));
    // As it is typed: the item's warning gone, what it holds said again
    expect(item().title).toBe("Gesture button (Click: Text snippet)");
    expect(item().classList.contains("swb-settings-unknown")).toBe(false);
    // Back in its item's panel: the slot's gone too
    panel().querySelector<HTMLElement>("[data-swb-look] .swb-settings-look-close")!.click();
    expect(panel().querySelector('[data-swb-look] [data-swb-slot="tap"]')!.classList.contains("swb-settings-unknown")).toBe(false);
    dialog.close();
  });
});

describe("The settings dialog's saving", () => {
  it("writes the toolbars as { name, useFor, placement, show, rows } with the model's version, as it saves any", async () => {
    byFinger(false);
    let saved: Readonly<Record<string, unknown>> | undefined;
    const dialog = new SettingsDialog({ doc: document, bridge: bridge({}), actions: () => [], kinds: () => [], canSave: true, save: async (values) => void (saved = values), saved: () => undefined });
    await dialog.open();
    // Float (Click's, the one edited first): its first row's item removed
    document.querySelector<HTMLElement>('[data-swb-panel="toolbars"] [data-swb-item="0:0"] .swb-settings-remove')!.click();
    document.querySelector<HTMLElement>(".swb-settings-save")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const lists = saved?.["silverware.toolbar.favorites"] as { name: string; useFor?: string[]; rows: unknown[] }[];
    expect(lists.map((list) => [list.name, list.useFor])).toEqual([["Float", ["click"]], ["Docked", ["touch"]]]);
    expect(lists[0]!.rows).toHaveLength(3);
    expect(saved?.["silverware.toolbar.version"]).toBe(2);
    dialog.close();
  });

  it("makes, renames, uses and deletes lists: a new one used for nothing, a name taken refused, Click given to it, deleted back to the first", async () => {
    byFinger(false);
    let saved: Readonly<Record<string, unknown>> | undefined;
    const confirm = () => true;
    const dialog = new SettingsDialog({ doc: document, bridge: { ...bridge({}), confirm }, actions: () => [], kinds: () => [], canSave: true, save: async (values) => void (saved = values), saved: () => undefined });
    await dialog.open();
    const panel = () => document.querySelector('[data-swb-panel="toolbars"]')!;
    panel().querySelector<HTMLElement>(".swb-settings-toolbar-new")!.click();
    expect([...panel().querySelectorAll(".swb-settings-toolbar-tab-name")].map((tab) => tab.textContent)).toEqual(["Float", "Docked", "Toolbar"]);
    const name = panel().querySelector<HTMLInputElement>(".swb-settings-toolbar-name")!;
    name.value = "docked";
    name.dispatchEvent(new Event("change"));
    expect(panel().querySelector(".swb-settings-toolbar-problem")!.textContent).toBe("Another toolbar is named docked");
    name.value = "Writing";
    name.dispatchEvent(new Event("change"));
    panel().querySelector<HTMLElement>('.swb-settings-toolbar-use[data-swb-use="click"]')!.click();
    expect(panel().querySelector('.swb-settings-toolbar-use[data-swb-use="click"]')!.getAttribute("aria-pressed")).toBe("true");
    document.querySelector<HTMLElement>(".swb-settings-save")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const lists = saved?.["silverware.toolbar.favorites"] as { name: string; useFor?: string[] }[];
    expect(lists.map((list) => [list.name, list.useFor])).toEqual([["Float", undefined], ["Docked", ["touch"]], ["Writing", ["click"]]]);
    dialog.close();
  });
});

describe("The settings dialog's item panel", () => {
  it("follows its item as one before it is removed, and goes with its own", async () => {
    byFinger(false);
    const favorites = [[{ id: "formats.bold" }, { id: "formats.italic" }, { id: "formats.code" }]];
    const dialog = new SettingsDialog({
      doc: document,
      bridge: { ...bridge({}), getConfig: (path, fallback) => (path === "silverware.toolbar.favorites" ? [{ name: "Mine", useFor: ["click", "touch"], rows: favorites }] : fallback) },
      actions: () => [],
      kinds: () => [],
      canSave: false,
      save: async () => undefined,
      saved: () => undefined,
    });
    await dialog.open();
    const panel = () => document.querySelector('[data-swb-panel="toolbars"]')!;
    // Code's panel: under it
    panel().querySelector<HTMLElement>('[data-swb-item="0:2"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(panel().querySelector("[data-swb-look]")?.getAttribute("data-swb-look")).toBe("0:2");
    // Bold removed: Code now at 1, its panel with it
    panel().querySelector<HTMLElement>('[data-swb-item="0:0"] .swb-settings-remove')!.click();
    expect(panel().querySelector("[data-swb-look]")?.getAttribute("data-swb-look")).toBe("0:1");
    expect(panel().querySelector('[data-swb-item="0:1"]')!.nextElementSibling?.classList.contains("swb-settings-detail")).toBe(true);
    // Code removed: its panel gone
    panel().querySelector<HTMLElement>('[data-swb-item="0:1"] .swb-settings-remove')!.click();
    expect(panel().querySelector("[data-swb-look]")).toBeNull();
    dialog.close();
  });
});
