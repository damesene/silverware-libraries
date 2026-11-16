// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readAssetSettings, storedAssetSettings } from "../model/settings.ts";
import { mediaTabs } from "./mediatab.ts";

const input = (settings: unknown = {}) => ({
  settings: readAssetSettings(settings).settings,
  types: [
    { name: "image", icon: "<svg></svg>" },
    { name: "pdf", icon: "<svg></svg>" },
  ],
  actions: [{ name: "open-tab", label: "Open in a new tab" }],
});

describe("the assets' settings tabs", () => {
  it("are Files and Appearance; the first says they changed and saves the settings as all of them have them", async () => {
    let saved: unknown;
    let saves = 0;
    const tabs = mediaTabs(document, input({ views: { types: { pdf: "icon" } } }), async (settings) => void ((saved = settings), saves++));
    expect(tabs.map((tab) => tab.title)).toEqual(["Files", "Appearance"]);
    const [files, preview] = tabs as [(typeof tabs)[number], (typeof tabs)[number]];
    const changed = () => tabs.map((tab) => tab.changed());
    expect(changed()).toEqual([false, false]);
    // Files: all files' row, then each type's (like all files, or its own)
    const selects = [...files.panel.querySelectorAll<HTMLSelectElement>("select")];
    expect(selects.map((select) => select.getAttribute("aria-label"))).toEqual([
      "All files: shown as",
      "All files: inserted as",
      "All files: click",
      "All files: Shift+click",
      "image: shown as",
      "image: inserted as",
      "image: click",
      "image: Shift+click",
      "pdf: shown as",
      "pdf: inserted as",
      "pdf: click",
      "pdf: Shift+click",
    ]);
    const named = (label: string) => selects.find((select) => select.getAttribute("aria-label") === label)!;
    expect(named("image: shown as").selectedOptions[0]!.textContent).toBe("Like all files");
    expect(named("pdf: shown as").value).toBe("icon");
    // (How a file is inserted: as shown by default, a link among the choices)
    expect(named("All files: inserted as").selectedOptions[0]!.textContent).toBe("Same as shown");
    expect([...named("All files: inserted as").options].map((option) => option.textContent)).toEqual(["Same as shown", "Link", "Card", "Preview", "Original"]);
    named("image: shown as").value = "preview";
    named("pdf: shown as").value = "*";
    named("All files: Shift+click").value = "";
    named("image: inserted as").value = "link";
    // The dialog turned off
    const insertOn = [...files.panel.querySelectorAll<HTMLLabelElement>(".swa-settings-check")].find((label) => label.textContent?.includes("Use the insert dialog"))!.querySelector("input")!;
    expect(insertOn.checked).toBe(true);
    insertOn.checked = false;
    // (A change in any tab is the first's to tell and to save: one write)
    expect(changed()).toEqual([true, false]);
    await files.save();
    expect(saves).toBe(1);
    expect(saved).toMatchObject({
      views: { default: "embed", types: { image: "preview" } },
      actions: { default: { click: "open-tab", "shift+click": "" }, types: {} },
      insert: { enabled: false, as: { default: "shown", types: { image: "link" } } },
    });
    // Appearance: a preview first; a card and a link by the switch, one shown at a time
    const look = (name: string) => preview.panel.querySelector<HTMLElement>(`[data-swa-look="${name}"]`)!;
    expect([look("preview").hidden, look("card").hidden, look("link").hidden]).toEqual([false, true, true]);
    preview.panel.querySelector<HTMLButtonElement>('.swa-segment[data-value="card"]')!.click();
    expect([look("preview").hidden, look("card").hidden, look("link").hidden]).toEqual([true, false, true]);
    // A card: its icon shown (its × hides it), its date not (its chip shows it); its name always
    const card = look("card");
    expect([...card.querySelectorAll(".swa-sample-item")].map((one) => one.getAttribute("data-swa-field"))).toEqual(["icon"]);
    expect(card.querySelector(".swa-card-name")!.textContent).toBe("report.pdf");
    card.querySelector<HTMLButtonElement>('.swa-sample-item[data-swa-field="icon"] .swa-sample-remove')!.click();
    card.querySelector<HTMLButtonElement>('.swa-sample-chip[data-swa-field="modified"]')!.click();
    expect([...card.querySelectorAll(".swa-sample-chip")].map((one) => one.getAttribute("data-swa-field"))).toEqual(["icon", "size"]);
    await files.save();
    expect((saved as { card: unknown }).card).toEqual(["name", "modified"]);
    // A link: its icon hidden by its ×
    const link = look("link");
    expect(link.querySelector(".swa-sample-sentence")!.textContent).toContain("report.pdf");
    link.querySelector<HTMLButtonElement>('.swa-sample-item[data-swa-field="icon"] .swa-sample-remove')!.click();
    expect(link.querySelector('.swa-sample-chip[data-swa-field="icon"]')).not.toBeNull();
    await files.save();
    expect((saved as { linkIcons: unknown }).linkIcons).toBe(false);
    // Previews kept in the space: on by default, turned off on the Files tab
    const keep = [...files.panel.querySelectorAll<HTMLLabelElement>(".swa-settings-section .swa-settings-check")].find((label) => label.textContent?.includes("Save previews"))!.querySelector("input")!;
    expect(keep.checked).toBe(true);
    keep.checked = false;
    await files.save();
    expect((saved as { storePreviews: unknown }).storePreviews).toBe(false);
    // Preview: a row for all files, open, then one per type (like all files); one open at a time
    // (The preview's view of Appearance: the original's has rows of its own)
    const previewLook = preview.panel.querySelector<HTMLElement>('[data-swa-look="preview"]')!;
    const row = (name: string) => previewLook.querySelector<HTMLElement>(`[data-swa-type="${name}"]`)!;
    const open = (name: string) => row(name).querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    const button = (text: string) => [...previewLook.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === text)!;
    const typed = (input: HTMLInputElement, value: string) => ((input.value = value), input.dispatchEvent(new Event("input", { bubbles: true })));
    expect([...previewLook.querySelectorAll(".swa-type")].map((one) => one.getAttribute("data-swa-type"))).toEqual(["*", "image", "pdf"]);
    expect([...previewLook.querySelectorAll(".swa-type-open")].map((one) => one.getAttribute("data-swa-type"))).toEqual(["*"]);
    expect(row("pdf").querySelector(".swa-type-mark")).toBeNull();
    // Its size: all files' (a number out of bounds: as it was), a type's own, marked Own, reset
    const field = (label: string) => previewLook.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    expect(field("A preview's height (px)").value).toBe("160");
    expect(field("A preview's width (px)").placeholder).toBe("auto");
    typed(field("A preview's height (px)"), "5");
    typed(field("A preview's width (px)"), "320");
    open("pdf");
    expect([...previewLook.querySelectorAll(".swa-type-open")].map((one) => one.getAttribute("data-swa-type"))).toEqual(["pdf"]);
    expect(field("pdf: a preview's width (px)").placeholder).toBe("320");
    typed(field("pdf: a preview's height (px)"), "240");
    expect(row("pdf").querySelector(".swa-type-mark")!.textContent).toBe("Own");
    await files.save();
    expect((saved as { heights: unknown }).heights).toEqual({ preview: 160, embed: 480 });
    expect((saved as { previews: unknown }).previews).toEqual({ width: 320, types: { pdf: { height: 240 } } });
    open("pdf");
    open("pdf");
    button("↺ Reset to all files").click();
    expect(row("pdf").querySelector(".swa-type-mark")).toBeNull();
    await files.save();
    expect((saved as { previews: unknown }).previews).toEqual({ width: 320, types: {} });
    // Original, a view of Appearance: a PDF's height (where a file stands is Silverware Layout's: no alignment here)
    expect(preview.panel.querySelector('select[aria-label*="alignment"]')).toBeNull();
    preview.panel.querySelector<HTMLInputElement>(`input[aria-label="An original PDF's height (px)"]`)!.value = "640";
    await files.save();
    expect(saved).toMatchObject({ heights: { preview: 160, embed: 640 } });
    // Its label: all files' (the icon and the alt text above by default), a type's own made from it, changed apart, reset
    // (A property not shown: a chip of the row, shown by Space/Enter; one shown: its value in the sample's line)
    const press = (name: string) => previewLook.querySelector<HTMLButtonElement>(`.swa-label-edit .swa-sample-chip[data-swa-field="${name}"]`)!.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    const item = (place: string, name: string) => previewLook.querySelector<HTMLElement>(`.swa-label-edit [data-swa-place="${place}"] .swa-sample-item[data-swa-field="${name}"]`);
    open("*");
    expect(item("above", "alt")).not.toBeNull();
    press("name");
    open("pdf");
    // (Like all files': shown so, its way back hidden; changed, its own, marked)
    expect(item("above", "name")).not.toBeNull();
    expect(row("pdf").querySelector<HTMLElement>(".swa-type-reset")!.hidden).toBe(true);
    press("size");
    expect(row("pdf").querySelector<HTMLElement>(".swa-type-reset")!.hidden).toBe(false);
    expect(row("pdf").querySelector(".swa-type-mark")!.textContent).toBe("Own");
    await files.save();
    const labels = (saved as { labels: { default: { above: unknown[] }; types: Record<string, { below: unknown[] }> } }).labels;
    expect(labels.default.above).toEqual([{ field: "icon", on: true }, { field: "alt", on: true }, { field: "name", on: true }]);
    expect(labels.types.pdf!.below[0]).toEqual({ field: "size", on: true });
    button("↺ Reset to all files").click();
    expect(row("pdf").querySelector(".swa-type-mark")).toBeNull();
    await files.save();
    expect((saved as { labels: { types: object } }).labels.types).toEqual({});
    // An original's label alike, none shown by default: its alt text turned on for all files
    const original = preview.panel.querySelector<HTMLElement>('[data-swa-look="original"]')!;
    expect([...original.querySelectorAll(".swa-type")].map((one) => one.getAttribute("data-swa-type"))).toEqual(["*", "image", "pdf"]);
    expect(original.querySelectorAll(".swa-label-edit .swa-sample-item")).toHaveLength(0);
    original.querySelector<HTMLButtonElement>('.swa-label-edit .swa-sample-chip[data-swa-field="alt"]')!.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    await files.save();
    const originals = (saved as { originalLabels: { default: { above: unknown[]; below: unknown[] } } }).originalLabels;
    expect([...originals.default.above, ...originals.default.below]).toContainEqual({ field: "alt", on: true });
    // As kept and read back: the Shift+click to nothing
    const back = readAssetSettings(storedAssetSettings(saved as never)).settings;
    expect(back.actions.default).toEqual({ click: "open-tab" });
    expect(back.views.types).toEqual({ image: "preview" });
  });

  it("mark a type Own only where it differs from all files, keep the focus on a row's head, take a type's name as it is", async () => {
    // (A type named with a quote: no selector made of it)
    const tabs = mediaTabs(document, { ...input(), types: [{ name: 'my"doc', icon: "<svg></svg>" }] }, async () => undefined);
    const panel = tabs[1]!.panel;
    document.body.append(panel);
    const row = () => [...panel.querySelectorAll<HTMLElement>(".swa-type")].find((one) => one.getAttribute("data-swa-type") === 'my"doc')!;
    const mark = () => row().querySelector(".swa-type-mark");
    row().querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    // (Opened: its head, drawn anew, keeps the focus)
    expect(document.activeElement).toBe(row().querySelector(".swa-type-head"));
    // A label changed back to all files': not its own
    const chip = (name: string) => row().querySelector<HTMLButtonElement>(`.swa-sample-chip[data-swa-field="${name}"]`)!;
    chip("name").dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    expect(mark()).not.toBeNull();
    row().querySelector<HTMLElement>('.swa-sample-item[data-swa-field="name"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(mark()).toBeNull();
    // A size out of bounds (not kept): not its own; one kept: its own
    const height = row().querySelector<HTMLInputElement>('input[aria-label$="height (px)"]')!;
    height.value = "5";
    height.dispatchEvent(new Event("input", { bubbles: true }));
    expect(mark()).toBeNull();
    height.value = "240";
    height.dispatchEvent(new Event("input", { bubbles: true }));
    expect(mark()).not.toBeNull();
    // Reset: like all files again, the focus on its head
    [...row().querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "↺ Reset to all files")!.click();
    expect(mark()).toBeNull();
    expect(document.activeElement).toBe(row().querySelector(".swa-type-head"));
    panel.remove();
  });

  it("keep a type Own where a size out of bounds is typed over one of its own: the one it had is kept, as saved", async () => {
    let saved: unknown;
    const tabs = mediaTabs(document, input({ previews: { types: { pdf: { width: 300 } } } }), async (settings) => void (saved = settings));
    const panel = tabs[1]!.panel;
    document.body.append(panel);
    const row = () => [...panel.querySelectorAll<HTMLElement>(".swa-type")].find((one) => one.getAttribute("data-swa-type") === "pdf")!;
    expect(row().querySelector(".swa-type-mark")).not.toBeNull();
    row().querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    const width = row().querySelector<HTMLInputElement>('input[aria-label="pdf: a preview\'s width (px)"]')!;
    width.value = "5";
    width.dispatchEvent(new Event("input", { bubbles: true }));
    expect(row().querySelector(".swa-type-mark")).not.toBeNull();
    width.value = "";
    width.dispatchEvent(new Event("input", { bubbles: true }));
    expect(row().querySelector(".swa-type-mark")).toBeNull();
    width.value = "5";
    await tabs[0]!.save();
    expect((saved as { previews: { types: object } }).previews.types).toEqual({ pdf: { width: 300 } });
    panel.remove();
  });
});
