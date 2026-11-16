// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL, type PreviewLabel, readLabel } from "../model/settings.ts";
import { labelEditor, placedPart, shownAgain, shownIn, steppedTo } from "./labeleditor.ts";

const fields = (label: PreviewLabel) => ({ above: label.above.map((part) => `${part.field}${part.on ? "" : "-"}`), below: label.below.map((part) => `${part.field}${part.on ? "" : "-"}`) });
const IMAGE = { name: "image", icon: "<svg></svg>" };

describe("a preview's label edited", () => {
  it("puts a property in a place (shown there, before the one shown at the index) or hides it where it is; shows a hidden one where it was", () => {
    // (The default: the icon and the alt text shown above, the name hidden above, the size and the date hidden below)
    expect(fields(placedPart(DEFAULT_LABEL, "size", { place: "above", index: 0 }))).toEqual({ above: ["size", "icon", "alt", "name-"], below: ["modified-"] });
    expect(fields(placedPart(DEFAULT_LABEL, "name", { place: "below", index: 0 }))).toEqual({ above: ["icon", "alt"], below: ["name", "size-", "modified-"] });
    // (Past those shown: after the last shown, before those hidden)
    expect(fields(placedPart(DEFAULT_LABEL, "modified", { place: "above", index: 5 }))).toEqual({ above: ["icon", "alt", "modified", "name-"], below: ["size-"] });
    expect(fields(placedPart(DEFAULT_LABEL, "alt", { place: "off", index: 0 }))).toEqual({ above: ["icon", "alt-", "name-"], below: ["size-", "modified-"] });
    expect(fields(shownAgain(DEFAULT_LABEL, "size"))).toEqual({ above: ["icon", "alt", "name-"], below: ["size", "modified-"] });
  });

  it("steps a property shown by Alt+arrows: ← → among those shown, past an end into the other place; ↑ ↓ to the other place", () => {
    // (The alt text and the name shown above, the size below; the icon and the date hidden)
    const label = readLabel({ above: ["alt", "name"], below: ["size"] });
    expect(shownIn(label, "above")).toEqual(["alt", "name"]);
    expect(steppedTo(label, "alt", "ArrowRight")).toEqual({ place: "above", index: 1 });
    expect(steppedTo(label, "name", "ArrowRight")).toEqual({ place: "below", index: 0 });
    expect(steppedTo(label, "size", "ArrowLeft")).toEqual({ place: "above", index: 2 });
    expect(steppedTo(label, "alt", "ArrowLeft")).toBeUndefined();
    expect(steppedTo(label, "size", "ArrowRight")).toBeUndefined();
    expect(steppedTo(label, "alt", "ArrowDown")).toEqual({ place: "below", index: 0 });
    expect(steppedTo(label, "size", "ArrowUp")).toEqual({ place: "above", index: 2 });
    expect(steppedTo(label, "alt", "ArrowUp")).toBeUndefined();
  });

  it("draws the properties shown as their values in the sample's lines, those hidden as chips of a row over it; keys show, move and hide them", () => {
    const changes: PreviewLabel[] = [];
    const editor = labelEditor(document, (label) => changes.push(label), "Nov 14, 2026");
    let told = 0;
    editor.element.addEventListener("change", () => told++);
    document.body.append(editor.element);
    editor.show(DEFAULT_LABEL, IMAGE);
    const fieldsIn = (place: string) => [...editor.element.querySelectorAll(`[data-swa-place="${place}"] > [data-swa-field]`)].map((one) => one.getAttribute("data-swa-field"));
    const line = (place: string) => [...editor.element.querySelectorAll(`[data-swa-place="${place}"] .swa-sample-value:not(.swa-label-icon)`)].map((one) => one.textContent);
    expect(fieldsIn("off")).toEqual(["name", "size", "modified"]);
    // (The type's icon first above, drawn)
    expect(fieldsIn("above")).toEqual(["icon", "alt"]);
    expect(editor.element.querySelector('[data-swa-field="icon"] .swa-label-icon svg')).not.toBeNull();
    expect(line("above")).toEqual(["Sunset over the lake"]);
    expect(line("below")).toEqual([]);
    // (A property shown: its value, its name over it, its ×; the row outside the sample's ground)
    const alt = editor.element.querySelector<HTMLElement>('.swa-sample-item[data-swa-field="alt"]')!;
    expect(alt.querySelector(".swa-sample-tag")!.textContent).toBe("Alt text");
    expect(alt.getAttribute("aria-label")).toBe("Alt text: Sunset over the lake");
    expect(editor.element.querySelector('.swa-sample-stage [data-swa-place="off"]')).toBeNull();
    // Space/Enter on the size's chip (a click of no pointer): shown where it was, under the box
    editor.element.querySelector<HTMLButtonElement>('.swa-sample-chip[data-swa-field="size"]')!.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    expect(line("below")).toEqual(["2.4 MB"]);
    expect(told).toBe(1);
    // Alt+↓ on the alt text: under the preview, first; focused again
    const item = (field: string) => editor.element.querySelector<HTMLElement>(`.swa-sample-item[data-swa-field="${field}"]`)!;
    item("alt").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true }));
    expect(fieldsIn("below")).toEqual(["alt", "size"]);
    expect(document.activeElement?.getAttribute("data-swa-field")).toBe("alt");
    // Delete hides it, its × the size: back in the row
    item("alt").dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(fieldsIn("off")).toEqual(["alt", "name", "modified"]);
    expect(changes.at(-1)!.below.find((part) => part.field === "alt")).toEqual({ field: "alt", on: false });
    item("size").querySelector<HTMLButtonElement>(".swa-sample-remove")!.click();
    expect(fieldsIn("below")).toEqual([]);
    editor.element.remove();
  });
});
