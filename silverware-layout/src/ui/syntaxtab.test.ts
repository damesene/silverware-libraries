// @vitest-environment jsdom
// The settings dialog's Markdown tab: a line on top, a section per setting under its heading (what SilverBullet does,
// the box, what on and off give), each box saved as its setting.
import { describe, expect, it } from "vitest";
import type { SyntaxModeSettings } from "../model/settings.ts";
import { syntaxTab } from "./syntaxtab.ts";

describe("the Markdown tab", () => {
  it("says on top that the settings change SilverBullet's own behaviour, then a section per setting", () => {
    const tab = syntaxTab(document, { hideGrids: true, clickPlacesCursor: true }, async () => undefined);
    expect(tab.panel.querySelector(".swl-syntax-lead")!.textContent).toBe("These settings change how SilverBullet itself behaves. Turn one off to get SilverBullet's own behaviour back.");
    const sections = [...tab.panel.querySelectorAll(".swl-syntax-section")].map((section) => ({
      heading: section.querySelector("h3")!.textContent,
      box: section.querySelector("label")!.textContent,
      notes: [...section.querySelectorAll(".swl-syntax-note")].map((note) => note.textContent),
    }));
    expect(sections).toEqual([
      { heading: "Links shown as markdown", box: "A click only places the cursor; Ctrl+click opens the link", notes: ["On: a click puts the cursor in the link, to edit it.", "Off (SilverBullet's own): a click opens it."] },
      {
        heading: "Plain markdown view",
        box: "Hide grids in this view",
        notes: ["On: <grid> and <cell> stay plain text, like the rest of the page.", "Off (SilverBullet's own): the grid is drawn under its markdown."],
      },
    ]);
    // (Headed as the dialog's rows are named)
    expect(tab.panel.querySelector("h3")!.classList.contains("swl-dialog-row-name")).toBe(true);
  });

  it("saves each box as its setting, changed only where one differs from what is saved", async () => {
    let saved: SyntaxModeSettings | undefined;
    const tab = syntaxTab(document, { hideGrids: true, clickPlacesCursor: true }, async (settings) => {
      saved = settings;
      return undefined;
    });
    expect(tab.changed()).toBe(false);
    const [clicks, hide] = [...tab.panel.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    hide!.checked = false;
    expect(tab.changed()).toBe(true);
    await tab.save();
    expect(saved).toEqual({ hideGrids: false, clickPlacesCursor: true });
    clicks!.checked = false;
    await tab.save();
    expect(saved).toEqual({ hideGrids: false, clickPlacesCursor: false });
  });
});
