// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readAssetSettings, storedAssetSettings } from "../model/settings.ts";
import { mediaTab } from "./mediatab.ts";

const input = (settings: unknown = {}) => ({
  settings: readAssetSettings(settings).settings,
  types: [
    { name: "image", icon: "<svg></svg>" },
    { name: "pdf", icon: "<svg></svg>" },
  ],
  actions: [{ name: "open-tab", label: "Open in a new tab" }],
});

describe("the Assets tab", () => {
  it("shows the settings, says it changed as a field changes, saves the settings as the tab has them", async () => {
    let saved: unknown;
    const tab = mediaTab(document, input({ views: { types: { pdf: "icon" } } }), async (settings) => void (saved = settings));
    expect(tab.title).toBe("Assets");
    expect(tab.changed()).toBe(false);
    const selects = [...tab.panel.querySelectorAll<HTMLSelectElement>("select")];
    const label = (select: HTMLSelectElement) => select.getAttribute("aria-label");
    expect(selects.map(label)).toEqual([
      "All files: shown as",
      "All files: a click",
      "All files: a Shift+click",
      "Width dragged",
      "image: shown as",
      "image: a click",
      "image: a Shift+click",
      "pdf: shown as",
      "pdf: a click",
      "pdf: a Shift+click",
    ]);
    expect(selects[7]!.value).toBe("icon");
    selects[4]!.value = "preview";
    selects[7]!.value = "*";
    selects[2]!.value = "";
    expect(tab.changed()).toBe(true);
    await tab.save();
    expect(saved).toMatchObject({
      views: { default: "embed", types: { image: "preview" } },
      actions: { default: { click: "open-tab", "shift+click": "" }, types: {} },
      anchor: "start",
    });
    // What a card shows: its icon, its size and its date, each a box
    const boxes = [...tab.panel.querySelectorAll<HTMLInputElement>(".swa-settings-checks input")];
    expect(boxes.map((box) => [box.parentElement!.textContent, box.checked])).toEqual([["Its icon", true], ["Its size", false], ["Its date", false], ["Links to files show the file's icon", true]]);
    boxes[0]!.checked = false;
    boxes[2]!.checked = true;
    await tab.save();
    expect((saved as { card: unknown }).card).toEqual(["name", "modified"]);
    // A preview's height: a number typed within its bounds, else as it was
    const height = tab.panel.querySelector<HTMLInputElement>(`input[aria-label="A preview's height (px)"]`)!;
    expect(height.value).toBe("160");
    height.value = "240";
    await tab.save();
    expect((saved as { heights: unknown }).heights).toEqual({ preview: 240, embed: 480 });
    height.value = "5";
    await tab.save();
    expect((saved as { heights: { preview: number } }).heights.preview).toBe(160);
    // As kept and read back: the Shift+click to nothing
    const back = readAssetSettings(storedAssetSettings(saved as never)).settings;
    expect(back.actions.default).toEqual({ click: "open-tab" });
    expect(back.views.types).toEqual({ image: "preview" });
  });
});
