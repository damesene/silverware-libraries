// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readAssetSettings, storedAssetSettings } from "../model/settings.ts";
import { mediaTabs } from "./mediatab.ts";

/** A preview's sizes as saved: its width and height for all files, each type's (its labels apart) */
const sizesOf = (saved: unknown) => {
  const { width, height, types } = (saved as { preview: { width?: unknown; height: unknown; types: unknown } }).preview;
  return { width, height, types };
};

const input = (settings: unknown = {}) => ({
  settings: readAssetSettings(settings).settings,
  types: [
    { name: "image", label: "Images", icon: "<svg></svg>" },
    { name: "pdf", label: "PDF", icon: "<svg></svg>", document: true },
  ],
  actions: [
    { name: "open-tab", label: "Open in a new tab" },
    { name: "open-enlarged", label: "Open enlarged" },
  ],
});


describe("the assets' settings tabs", () => {
  it("are Files and Appearance; the first says they changed and saves the settings as all of them have them", async () => {
    let saved: unknown;
    let saves = 0;
    const tabs = mediaTabs(document, input({ views: { types: { pdf: "card" } } }), async (settings) => void ((saved = settings), saves++));
    expect(tabs.map((tab) => tab.title)).toEqual(["Files", "Appearance"]);
    const [files, preview] = tabs as [(typeof tabs)[number], (typeof tabs)[number]];
    const changed = () => tabs.map((tab) => tab.changed());
    expect(changed()).toEqual([false, false]);
    // Files: all files' settings one under another (Shown as pressed in its row of choices, the rest picked), the
    // insert dialog's box under Inserted as; then a row per type, closed, saying what it sets of its own
    const named = (label: string) => files.panel.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    const change = (select: HTMLSelectElement, value: string) => ((select.value = value), select.dispatchEvent(new Event("change", { bubbles: true })));
    const lines = [...files.panel.querySelectorAll(".swa-files-line > .swa-files-name")].map((name) => name.textContent);
    expect(lines).toEqual(["Shown as", "Inserted as", "Click", "Shift+click"]);
    expect(named("All files: shown as").value).toBe("full");
    expect([...named("All files: shown as").options].map((option) => option.textContent)).toEqual(["Card", "Preview", "Full"]);
    expect(named("All files: inserted as").selectedOptions[0]!.textContent).toBe("Same as shown");
    expect([...named("All files: inserted as").options].map((option) => option.textContent)).toEqual(["Same as shown", "Link", "Card", "Preview", "Full"]);
    // (The insert dialog's box under Inserted as, apart from its line: the name beside its pick list alone)
    expect(named("All files: inserted as").closest(".swa-files-line")!.textContent).not.toContain("Use the insert dialog");
    expect(named("All files: inserted as").closest(".swa-files-line")!.nextElementSibling!.textContent).toContain("Use the insert dialog");
    const typeRow = (name: string) => files.panel.querySelector<HTMLElement>(`.swa-file-types [data-swa-row-type="${name}"]`)!;
    expect([...files.panel.querySelectorAll(".swa-file-types .swa-type-name")].map((one) => one.textContent)).toEqual(["Images", "PDF"]);
    expect([typeRow("image").querySelector(".swa-type-summary")!.textContent, typeRow("pdf").querySelector(".swa-type-summary")!.textContent]).toEqual(["Like all files", "Shown as Card"]);
    expect(typeRow("pdf").querySelector(".swa-type-mark")!.textContent).toBe("Own");
    // A type opened: its four, "Like all files" saying what that gives; one open at a time
    typeRow("image").querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    expect(named("Images: shown as").value).toBe("*");
    // (Like all files' choice says what it gives, read out too)
    expect(named("Images: shown as").options[0]!.textContent).toBe("Like all files · Full");
    expect(named("Images: click").options[0]!.textContent).toBe("Like all files · Open in a new tab");
    change(named("Images: shown as"), "preview");
    change(named("Images: inserted as"), "link");
    change(named("Images: click"), "open-enlarged");
    expect(typeRow("image").querySelector(".swa-type-mark")!.textContent).toBe("Own");
    // All files' changed: a type's "Like all files" says it
    change(named("All files: click"), "open-enlarged");
    expect(named("Images: Shift+click").options[0]!.textContent).toBe("Like all files · Open in a new tab");
    expect(named("Images: click").options[0]!.textContent).toBe("Like all files · Open enlarged");
    change(named("All files: click"), "open-tab");
    change(named("All files: Shift+click"), "");
    // PDF's own taken back to all files' by its Reset; closed, Images say what they set
    typeRow("pdf").querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    expect(files.panel.querySelectorAll(".swa-file-types .swa-type-open")).toHaveLength(1);
    expect(typeRow("image").querySelector(".swa-type-summary")!.textContent).toBe("Shown as Preview, Inserted as Link, Click Open enlarged");
    [...typeRow("pdf").querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "↺ Reset to all files")!.click();
    expect(typeRow("pdf").querySelector(".swa-type-mark")).toBeNull();
    expect(named("PDF: shown as").value).toBe("*");
    // The dialog turned off
    const insertOn = [...files.panel.querySelectorAll<HTMLLabelElement>(".swa-settings-check")].find((label) => label.textContent?.includes("Use the insert dialog"))!.querySelector("input")!;
    expect(insertOn.checked).toBe(true);
    insertOn.checked = false;
    // (A change in any tab is the first's to tell and to save: one write)
    expect(changed()).toEqual([true, false]);
    await files.save();
    expect(saves).toBe(1);
    expect(saved).toMatchObject({
      views: { default: "full", types: { image: "preview" } },
      actions: { default: { click: "open-tab", "shift+click": "" }, types: { image: { click: "open-enlarged" } } },
      insert: { enabled: false, as: { default: "shown", types: { image: "link" } } },
    });
    // Appearance: a preview first; a card and a link by the switch, one shown at a time
    const look = (name: string) => preview.panel.querySelector<HTMLElement>(`[data-swa-look="${name}"]`)!;
    expect([look("preview").hidden, look("card").hidden, look("link").hidden]).toEqual([false, true, true]);
    preview.panel.querySelector<HTMLButtonElement>('.swa-segment[data-value="card"]')!.click();
    expect([look("preview").hidden, look("card").hidden, look("link").hidden]).toEqual([true, false, true]);
    // A card: its icon shown (its × hides it), its date not (its chip shows it); its name always, its menu's arrow too
    const card = look("card");
    expect([...card.querySelectorAll(".swa-sample-item")].map((one) => one.getAttribute("data-swa-field"))).toEqual(["icon", "marker"]);
    expect(card.querySelector(".swa-card-name")!.textContent).toBe("report.pdf");
    card.querySelector<HTMLButtonElement>('.swa-sample-item[data-swa-field="icon"] .swa-sample-remove')!.click();
    card.querySelector<HTMLButtonElement>('.swa-sample-chip[data-swa-field="modified"]')!.click();
    expect([...card.querySelectorAll(".swa-sample-chip")].map((one) => one.getAttribute("data-swa-field"))).toEqual(["icon", "size"]);
    await files.save();
    expect((saved as { card: unknown }).card).toEqual({ fields: ["name", "modified"] });
    // A link: its icon hidden by its ×
    const link = look("link");
    expect(link.querySelector(".swa-sample-sentence")!.textContent).toContain("report.pdf");
    link.querySelector<HTMLButtonElement>('.swa-sample-item[data-swa-field="icon"] .swa-sample-remove')!.click();
    expect(link.querySelector('.swa-sample-chip[data-swa-field="icon"]')).not.toBeNull();
    await files.save();
    expect((saved as { link: unknown }).link).toEqual({ fields: [] });
    // Previews kept in the space: on by default, turned off on the Files tab, its folder then not to be changed
    const keep = [...files.panel.querySelectorAll<HTMLLabelElement>(".swa-settings-section .swa-settings-check")].find((label) => label.textContent?.includes("Save slow previews"))!.querySelector("input")!;
    const folder = files.panel.querySelector<HTMLInputElement>('input[aria-label="Folder of the saved previews"]')!;
    expect([keep.checked, folder.disabled]).toEqual([true, false]);
    keep.checked = false;
    keep.dispatchEvent(new Event("change", { bubbles: true }));
    expect(folder.disabled).toBe(true);
    await files.save();
    expect((saved as { storePreviews: unknown }).storePreviews).toBe(false);
    // (Its folder, not to be changed meanwhile, kept as it was)
    expect((saved as { previewFolder: unknown }).previewFolder).toBe("_silverware-assets-previews");
    // Preview: a row for all files, open, then one per type (like all files); one open at a time
    // (The preview's view of Appearance: a full file's has rows of its own)
    const previewLook = preview.panel.querySelector<HTMLElement>('[data-swa-look="preview"]')!;
    const row = (name: string) => previewLook.querySelector<HTMLElement>(`[data-swa-row-type="${name}"]`)!;
    const open = (name: string) => row(name).querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    const button = (text: string) => [...previewLook.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === text)!;
    const typed = (input: HTMLInputElement, value: string) => ((input.value = value), input.dispatchEvent(new Event("input", { bubbles: true })));
    expect([...previewLook.querySelectorAll(".swa-type")].map((one) => one.getAttribute("data-swa-row-type"))).toEqual(["*", "image", "pdf"]);
    expect([...previewLook.querySelectorAll(".swa-type-open")].map((one) => one.getAttribute("data-swa-row-type"))).toEqual(["*"]);
    expect(row("pdf").querySelector(".swa-type-mark")).toBeNull();
    // Its size: all files' (a number out of bounds: as it was), a type's own, marked Own, reset
    const field = (label: string) => previewLook.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    expect(field("A preview's height (px)").value).toBe("160");
    expect(field("A preview's width (px)").placeholder).toBe("auto");
    typed(field("A preview's height (px)"), "5");
    typed(field("A preview's width (px)"), "320");
    open("pdf");
    expect([...previewLook.querySelectorAll(".swa-type-open")].map((one) => one.getAttribute("data-swa-row-type"))).toEqual(["pdf"]);
    expect(field("PDF: a preview's width (px)").placeholder).toBe("320");
    typed(field("PDF: a preview's height (px)"), "240");
    expect(row("pdf").querySelector(".swa-type-mark")!.textContent).toBe("Own");
    await files.save();
    expect([sizesOf(saved), (saved as { full: { height: unknown } }).full.height]).toEqual([{ width: 320, height: 160, types: { pdf: { height: 240 } } }, 480]);
    open("pdf");
    open("pdf");
    button("↺ Reset to all files").click();
    expect(row("pdf").querySelector(".swa-type-mark")).toBeNull();
    await files.save();
    expect(sizesOf(saved)).toEqual({ width: 320, height: 160, types: {} });
    // Full, a view of Appearance: a document's height in its rows, all files' and a document type's own (none for
    // images: they have their own size); where a file stands is Silverware Layout's (no alignment here)
    expect(preview.panel.querySelector('select[aria-label*="alignment"]')).toBeNull();
    const fullLook = preview.panel.querySelector<HTMLElement>('[data-swa-look="full"]')!;
    const fullRow = (name: string) => fullLook.querySelector<HTMLElement>(`[data-swa-row-type="${name}"]`)!;
    typed(fullLook.querySelector<HTMLInputElement>('input[aria-label="Document height (px)"]')!, "640");
    fullRow("image").querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    expect(fullLook.querySelector('input[aria-label="Images: document height (px)"]')).toBeNull();
    fullRow("pdf").querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    const pdfHeight = fullLook.querySelector<HTMLInputElement>('input[aria-label="PDF: document height (px)"]')!;
    expect(pdfHeight.placeholder).toBe("640");
    typed(pdfHeight, "900");
    expect(fullRow("pdf").querySelector(".swa-type-mark")!.textContent).toBe("Own");
    await files.save();
    expect(saved).toMatchObject({ preview: { height: 160 }, full: { height: 640, types: { pdf: { height: 900 } } } });
    // Its Reset: the type's height all files' again, not marked
    [...fullRow("pdf").querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "↺ Reset to all files")!.click();
    expect([pdfHeight.value, fullRow("pdf").querySelector(".swa-type-mark")]).toEqual(["", null]);
    await files.save();
    expect((saved as { full: { types: unknown } }).full.types).toEqual({});
    // (All files' row open again, for its label below)
    fullRow("*").querySelector<HTMLButtonElement>(".swa-type-head")!.click();
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
    const labels = (saved as { preview: { labels: { default: { above: unknown[] }; types: Record<string, { below: unknown[] }> } } }).preview.labels;
    expect(labels.default.above).toEqual([{ field: "icon", on: true }, { field: "alt", on: true }, { field: "name", on: true }]);
    expect(labels.types.pdf!.below[0]).toEqual({ field: "size", on: true });
    button("↺ Reset to all files").click();
    expect(row("pdf").querySelector(".swa-type-mark")).toBeNull();
    await files.save();
    expect((saved as { preview: { labels: { types: object } } }).preview.labels.types).toEqual({});
    // A full file's label alike, none shown by default: its alt text turned on for all files
    const full = preview.panel.querySelector<HTMLElement>('[data-swa-look="full"]')!;
    expect([...full.querySelectorAll(".swa-type")].map((one) => one.getAttribute("data-swa-row-type"))).toEqual(["*", "image", "pdf"]);
    expect(full.querySelectorAll(".swa-label-edit .swa-sample-item")).toHaveLength(0);
    full.querySelector<HTMLButtonElement>('.swa-label-edit .swa-sample-chip[data-swa-field="alt"]')!.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    await files.save();
    const fullLabels = (saved as { full: { labels: { default: { above: unknown[]; below: unknown[] } } } }).full.labels;
    expect([...fullLabels.default.above, ...fullLabels.default.below]).toContainEqual({ field: "alt", on: true });
    // As kept and read back: the Shift+click to nothing
    const back = readAssetSettings(storedAssetSettings(saved as never)).settings;
    expect(back.actions.default).toEqual({ click: "open-tab" });
    expect(back.views.types).toEqual({ image: "preview" });
  });

  it("mark a type Own only where it differs from all files, keep the focus on a row's head, take a type's name as it is", async () => {
    // (A type named with a quote: no selector made of it)
    const tabs = mediaTabs(document, { ...input(), types: [{ name: 'my"doc', label: 'my"doc', icon: "<svg></svg>" }] }, async () => undefined);
    const panel = tabs[1]!.panel;
    document.body.append(panel);
    const row = () => [...panel.querySelectorAll<HTMLElement>(".swa-type")].find((one) => one.getAttribute("data-swa-row-type") === 'my"doc')!;
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
    const tabs = mediaTabs(document, input({ preview: { types: { pdf: { width: 300 } } } }), async (settings) => void (saved = settings));
    const panel = tabs[1]!.panel;
    document.body.append(panel);
    const row = () => [...panel.querySelectorAll<HTMLElement>(".swa-type")].find((one) => one.getAttribute("data-swa-row-type") === "pdf")!;
    expect(row().querySelector(".swa-type-mark")).not.toBeNull();
    row().querySelector<HTMLButtonElement>(".swa-type-head")!.click();
    const width = row().querySelector<HTMLInputElement>('input[aria-label="PDF: a preview\'s width (px)"]')!;
    width.value = "5";
    width.dispatchEvent(new Event("input", { bubbles: true }));
    expect(row().querySelector(".swa-type-mark")).not.toBeNull();
    width.value = "";
    width.dispatchEvent(new Event("input", { bubbles: true }));
    expect(row().querySelector(".swa-type-mark")).toBeNull();
    width.value = "5";
    await tabs[0]!.save();
    expect((saved as { preview: { types: object } }).preview.types).toEqual({ pdf: { width: 300 } });
    panel.remove();
  });

  it("clean up the saved previews from the Files tab by the command's own clean-up, its button held meanwhile", async () => {
    let done: () => void = () => undefined;
    let runs = 0;
    const tabs = mediaTabs(document, { ...input(), cleanUp: () => ((runs++), new Promise<void>((resolve) => (done = resolve))) }, async () => undefined);
    // (No type here keeps previews: said so)
    expect(tabs[0]!.panel.textContent).toContain("No type installed makes previews slow enough to save them");
    const keeping = mediaTabs(document, { ...input(), types: [{ name: "pdf", label: "PDF", icon: "", document: true, storesPreview: true }] }, async () => undefined);
    expect(keeping[0]!.panel.textContent).toContain("Previews slow to make (PDF) are made once");
    const button = [...tabs[0]!.panel.querySelectorAll<HTMLButtonElement>("button")].find((one) => one.textContent === "Clean up previews")!;
    button.click();
    expect([runs, button.disabled]).toEqual([1, true]);
    done();
    await expect.poll(() => button.disabled).toBe(false);
    // (None given by the host: no button)
    const without = mediaTabs(document, input(), async () => undefined);
    expect([...without[0]!.panel.querySelectorAll("button")].some((one) => one.textContent === "Clean up previews")).toBe(false);
  });
});
