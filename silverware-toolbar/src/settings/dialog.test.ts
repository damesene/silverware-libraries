// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Bridge } from "../bridge.ts";
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
