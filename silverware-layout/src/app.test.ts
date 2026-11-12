// @vitest-environment jsdom
// The app over a page of no host's (a PageHost of plain elements) and a store of memory: Silverware Layout needs no
// SilverBullet to show a page's width and font size, follow the pages opened and save from its dialog.
import { afterEach, describe, expect, it } from "vitest";
import { LayoutApp, type LayoutStore } from "./app.ts";
import { Registry } from "./core/registry.ts";
import type { PageHost } from "./host/page.ts";
import { DEFAULT_GUIDES, type Settings } from "./model/settings.ts";
import { type Width } from "./model/width.ts";

const SETTINGS: Settings = { textWidth: undefined, minPaneWidth: 600, guides: DEFAULT_GUIDES, fontSize: undefined, fontZoom: true };

/** A page of plain elements: its pane 1200 px wide (jsdom lays nothing out), its text width kept as shown */
function plainPage(paneWidth = 1200) {
  document.body.innerHTML = `<div class="pane"><div class="editor"><div class="content"><p>Some text.</p></div></div></div>`;
  const pane = document.querySelector<HTMLElement>(".pane")!;
  pane.getBoundingClientRect = () => ({ width: paneWidth, height: 800, top: 0, left: 0, right: paneWidth, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
  const shown: (Width | undefined)[] = [];
  const page: PageHost = {
    content: () => document.querySelector<HTMLElement>(".content") ?? undefined,
    editor: () => document.querySelector<HTMLElement>(".editor") ?? undefined,
    pane: () => pane,
    view: () => ({ top: 0, bottom: 800 }),
    guideLayer: () => undefined,
    showTextWidth: (width) => void shown.push(width),
    themeTextWidth: () => 760,
  };
  return { page, shown };
}

/** A store of memory: the pages' own widths by name, the settings and this device's zoom as saved */
function memoryStore(pages: Record<string, Width | undefined>, settings: Partial<Settings> = {}) {
  const store = {
    open: Object.keys(pages)[0]!,
    settings: { ...SETTINGS, ...settings },
    zoom: undefined as number | undefined,
    saved: [] as string[],
    // What a confirmation is answered
    answer: true,
  };
  const api: LayoutStore = {
    canSaveSettings: true,
    readSettings: async () => store.settings,
    readPage: async () => ({ page: store.open, width: pages[store.open] }),
    savePageWidth: async (page, width) => {
      pages[page] = width;
      store.saved.push(`page ${page}`);
      return undefined;
    },
    saveTextWidth: async (width) => void store.saved.push(`textWidth ${width?.amount}`),
    saveGuides: async (guides) => void store.saved.push(`guides ${guides.join(" ")}`),
    saveFont: async (size, zoom) => void store.saved.push(`font ${size} ${zoom}`),
    readZoom: () => store.zoom,
    keepZoom: (size) => void (store.zoom = size),
    confirm: async () => store.answer,
    flash: () => undefined,
  };
  return { store, api };
}

afterEach(() => {
  document.documentElement.removeAttribute("style");
  for (const name of document.documentElement.getAttributeNames()) document.documentElement.removeAttribute(name);
});

describe("Silverware Layout's app over a page of no host's", () => {
  it("shows the page's own width, else the default, the pane's width given to the style page; none in a narrow pane", async () => {
    const { page, shown } = plainPage();
    const { api, store } = memoryStore({ Wide: { amount: 1100, unit: "px" }, Plain: undefined }, { textWidth: { amount: 900, unit: "px" } });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    expect(shown.at(-1)).toEqual({ amount: 1100, unit: "px" });
    expect(document.documentElement.style.getPropertyValue("--swl-pane-width")).toBe("1200px");
    expect(document.documentElement.hasAttribute("data-swl-narrow")).toBe(false);
    // Another page opened, its width known as it opens
    store.open = "Plain";
    app.pageLoaded("Plain", undefined);
    expect(shown.at(-1)).toEqual({ amount: 900, unit: "px" });

    // (No notice on a wide pane)
    await app.openDialog();
    expect(document.querySelector(".swl-dialog-notice")).toBeNull();

    const narrow = plainPage(500);
    const small = new LayoutApp(document, narrow.page, new Registry(() => undefined));
    await small.start(memoryStore({ Wide: { amount: 1100, unit: "px" } }).api);
    expect(narrow.shown.at(-1)).toBeUndefined();
    expect(document.documentElement.hasAttribute("data-swl-narrow")).toBe(true);
    // The Page width tab says the widths show on a wider screen
    await small.openDialog();
    expect(document.querySelector(".swl-dialog-notice")!.textContent).toBe("Widths apply on screens wider than 600 px. On this one, the text fills the screen.");
  });

  it("a page read later than another was opened is dropped: the page opened last is shown", async () => {
    const { page, shown } = plainPage();
    const { api, store } = memoryStore({ Wide: { amount: 1100, unit: "px" }, Other: { amount: 700, unit: "px" } });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    const slow = app.pageOpened();
    store.open = "Other";
    app.pageLoaded("Other", { amount: 700, unit: "px" });
    await slow;
    expect(shown.at(-1)).toEqual({ amount: 700, unit: "px" });
  });

  it("shows the font size (this device's zoom over the setting), the editor marked for the style page; Font zoom off: the setting's", async () => {
    const { page } = plainPage();
    const { api, store } = memoryStore({ Page: undefined }, { fontSize: 20 });
    store.zoom = 24;
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    const root = document.documentElement;
    expect(root.getAttribute("data-swl-font-size")).toBe("24");
    expect(root.style.getPropertyValue("--swl-font-size")).toBe("24px");
    expect(document.querySelector(".editor")!.hasAttribute("data-swl-editor")).toBe(true);
    // The widgets' content marked as the widgets are laid out
    expect(document.querySelector(".content")!.hasAttribute("data-swl-content")).toBe(true);
    store.settings = { ...store.settings, fontZoom: false };
    await app.start(api);
    expect(root.getAttribute("data-swl-font-size")).toBe("20");
  });

  it("closes its dialog as another page opens under it, the page put back: its Save would write into the other", async () => {
    const { page, shown } = plainPage();
    const { api, store } = memoryStore({ First: undefined, Second: { amount: 700, unit: "px" } });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const amount = document.querySelector<HTMLInputElement>('[data-swl-row="page"] .swl-dialog-amount')!;
    amount.value = "1000";
    amount.dispatchEvent(new Event("input"));
    expect(shown.at(-1)).toEqual({ amount: 1000, unit: "px" });
    store.open = "Second";
    app.pageLoaded("Second", { amount: 700, unit: "px" });
    expect(document.querySelector(".swl-dialog")).toBeNull();
    expect(shown.at(-1)).toEqual({ amount: 700, unit: "px" });
    expect(store.saved).toEqual([]);
  });

  it("a guide in % of the pane: typed in its row, its unit switched (the number converted), saved as a percent", async () => {
    const { page } = plainPage();
    const { api, store } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    // 1200 px in a pane of 1200 px is 100 %: switched, the row says it in %
    const rows = () => [...document.querySelectorAll<HTMLElement>(".swl-dialog-guide-row")];
    const second = rows()[1]!;
    second.querySelector<HTMLButtonElement>('[aria-label="Percent of the editor\'s width"]')!.click();
    expect(second.querySelector<HTMLInputElement>(".swl-dialog-guide-amount")!.value).toBe("100");
    const amount = second.querySelector<HTMLInputElement>(".swl-dialog-guide-amount")!;
    amount.value = "80";
    amount.dispatchEvent(new Event("input"));
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.saved).toEqual(["guides 900 80% full"]);
    // 5 % is no guide: said, Save off
    await app.openDialog();
    const again = rows().find((row) => row.querySelector<HTMLInputElement>(".swl-dialog-guide-amount")!.value === "80")!;
    const field = again.querySelector<HTMLInputElement>(".swl-dialog-guide-amount")!;
    field.value = "5";
    field.dispatchEvent(new Event("input"));
    expect(document.querySelector(".swl-dialog-note")!.textContent).toBe("A guide is a whole number of 10 to 100 %");
    expect(document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.disabled).toBe(true);
  });

  it("this device's zoom set by its slider or typed, kept for the device on Save; ↺ the size of all pages again, none kept", async () => {
    const { page } = plainPage();
    const { api, store } = memoryStore({ Page: undefined }, { fontSize: 18 });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const slider = document.querySelector<HTMLInputElement>('[aria-label="This device\'s font size"]')!;
    const amount = document.querySelector<HTMLInputElement>('[aria-label="This device\'s font size in px"]')!;
    const row = slider.closest(".swl-dialog-device")!;
    // The size of all pages followed: the field empty, that size its placeholder, said under it
    expect([amount.value, amount.placeholder]).toEqual(["", "18"]);
    expect(row.querySelector(".swl-dialog-row-note")!.textContent).toBe("Uses the size of all pages");
    slider.value = "22";
    slider.dispatchEvent(new Event("input"));
    expect(amount.value).toBe("22");
    expect(row.querySelector(".swl-dialog-row-note")!.textContent).toBe("");
    expect(document.documentElement.getAttribute("data-swl-font-size")).toBe("22");
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.zoom).toBe(22);
    // Typed, then ↺: the size of all pages again, no zoom kept
    await app.openDialog();
    const typed = document.querySelector<HTMLInputElement>('[aria-label="This device\'s font size in px"]')!;
    typed.value = "26";
    typed.dispatchEvent(new Event("input"));
    expect(document.documentElement.getAttribute("data-swl-font-size")).toBe("26");
    document.querySelector<HTMLButtonElement>('[aria-label="Use the size of all pages"]')!.click();
    expect(typed.value).toBe("");
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.zoom).toBeUndefined();
  });

  it("a row following another moves with it: This page with All pages, This device with the font size; ↺ shown only on a value of its own", async () => {
    const { page } = plainPage();
    const { api } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const thisPage = document.querySelector<HTMLElement>('[data-swl-row="page"]');
    const allPages = document.querySelector<HTMLElement>('[data-swl-row="all"]');
    // All pages over this page
    expect([...document.querySelectorAll<HTMLElement>(".swl-dialog-width-row")].map((row) => row.dataset.swlRow)).toEqual(["all", "page"]);
    expect(thisPage!.classList.contains("swl-dialog-follows")).toBe(true);
    expect(thisPage!.querySelector(".swl-dialog-row-note")!.textContent).toBe("Uses all pages' width");
    const all = allPages!.querySelector<HTMLInputElement>(".swl-dialog-slider")!;
    all.value = "1000";
    all.dispatchEvent(new Event("input"));
    expect(allPages!.classList.contains("swl-dialog-follows")).toBe(false);
    expect(thisPage!.querySelector<HTMLInputElement>(".swl-dialog-slider")!.value).toBe("1000");
    expect(thisPage!.querySelector<HTMLInputElement>(".swl-dialog-amount")!.placeholder).toBe("1000");
    // ↺ on all pages: the theme's width again
    allPages!.querySelector<HTMLButtonElement>('[aria-label="Use your theme\'s width"]')!.click();
    expect(allPages!.classList.contains("swl-dialog-follows")).toBe(true);
    expect(allPages!.querySelector<HTMLInputElement>(".swl-dialog-amount")!.value).toBe("");
    // The font's size typed: This device's slider and placeholder with it
    const font = document.querySelector<HTMLInputElement>(".swl-dialog-font-row .swl-dialog-amount")!;
    font.value = "22";
    font.dispatchEvent(new Event("input"));
    expect(document.querySelector<HTMLInputElement>('[aria-label="This device\'s font size"]')!.value).toBe("22");
    expect(document.querySelector<HTMLInputElement>('[aria-label="This device\'s font size in px"]')!.placeholder).toBe("22");
  });

  it("Preview held: the guides as typed drawn on the page, the dialog all but gone; let go, both back", async () => {
    const { page } = plainPage();
    const { api } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const dialog = document.querySelector(".swl-dialog")!;
    const preview = document.querySelector<HTMLButtonElement>(".swl-dialog-preview")!;
    preview.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    expect(dialog.classList.contains("swl-dialog-sliding")).toBe(true);
    // The page's width and the guides, a line each side (jsdom lays nothing out: every guide is "reached")
    expect([...document.querySelectorAll(".swl-handle-guide-label")].map((label) => label.textContent)).toContain("Page width");
    expect(document.querySelectorAll(".swl-handle-guide").length).toBeGreaterThan(2);
    window.dispatchEvent(new Event("pointerup"));
    expect(dialog.classList.contains("swl-dialog-sliding")).toBe(false);
    expect(document.querySelectorAll(".swl-handle-guide")).toHaveLength(0);
  });

  it("Default guides: asked; declined, the guides as they were; confirmed, the default ones in the rows, saved on Save; off while they are the default", async () => {
    const { page } = plainPage();
    const { api, store } = memoryStore({ Page: undefined }, { guides: [600, "75%"] });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const values = () => [...document.querySelectorAll<HTMLInputElement>(".swl-dialog-guide-amount")].map((input) => input.value);
    const reset = document.querySelector<HTMLButtonElement>(".swl-dialog-guides-reset")!;
    expect(values()).toEqual(["600", "75"]);
    store.answer = false;
    reset.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(values()).toEqual(["600", "75"]);
    store.answer = true;
    reset.click();
    await expect.poll(values).toEqual(["900", "1200"]);
    expect(document.querySelector<HTMLInputElement>(".swl-dialog-full input")!.checked).toBe(true);
    expect(reset.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.saved).toEqual(["guides 900 1200 full"]);
  });

  it("where settings cannot be saved, the guides, all pages' width and the Ctrl + scroll box cannot be changed; Preview still shows", async () => {
    const { page } = plainPage();
    const { api } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start({ ...api, canSaveSettings: false });
    await app.openDialog();
    const guides = document.querySelector(".swl-dialog-guides")!;
    const enabled = [...guides.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")].filter((control) => !control.disabled);
    expect(enabled.map((control) => control.className)).toEqual(["swl-dialog-preview"]);
    const all = document.querySelector('[data-swl-row="all"]')!;
    expect([...all.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")].every((control) => control.disabled)).toBe(true);
    expect(document.querySelector<HTMLInputElement>(".swl-dialog-zoom input")!.disabled).toBe(true);
  });

  it("a slider held as the dialog closes (Esc meanwhile): let go, the page stays as it was put back", async () => {
    const { page, shown } = plainPage();
    const { api } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const slider = document.querySelector<HTMLInputElement>('[data-swl-row="page"] .swl-dialog-slider')!;
    slider.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    slider.value = "1000";
    slider.dispatchEvent(new Event("input"));
    expect(shown.at(-1)).toEqual({ amount: 1000, unit: "px" });
    document.querySelector<HTMLButtonElement>(".swl-dialog-cancel")!.click();
    expect(shown.at(-1)).toBeUndefined();
    window.dispatchEvent(new Event("pointerup"));
    expect(shown.at(-1)).toBeUndefined();
  });

  it("the guides' sliders share the room of the guides as typed: a wider one typed widens it, taken out narrows it", async () => {
    const { page } = plainPage();
    const { api } = memoryStore({ Page: undefined }, { guides: [900, 3000, "full"] });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const sliders = () => [...document.querySelectorAll<HTMLInputElement>(".swl-dialog-guide-slider")].map((slider) => slider.max);
    expect(sliders()).toEqual(["3000", "3000"]);
    const rows = document.querySelectorAll<HTMLElement>(".swl-dialog-guide-row");
    rows[1]!.querySelector<HTMLButtonElement>(".swl-dialog-remove")!.click();
    expect(sliders()).toEqual(["1200"]);
    const input = rows[0]!.querySelector<HTMLInputElement>(".swl-dialog-guide-amount")!;
    input.value = "2500";
    input.dispatchEvent(new Event("input"));
    expect(sliders()).toEqual(["2500"]);
    expect(rows[0]!.querySelector<HTMLInputElement>(".swl-dialog-guide-slider")!.value).toBe("2500");
  });

  it("a guide's slider: its number follows it; held, the guides on the page, drawn again as it moves; let go, none", async () => {
    const { page } = plainPage();
    const { api } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const row = document.querySelectorAll<HTMLElement>(".swl-dialog-guide-row")[0]!;
    const slider = row.querySelector<HTMLInputElement>(".swl-dialog-guide-slider")!;
    expect(slider.value).toBe("900");
    slider.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector(".swl-dialog")!.classList.contains("swl-dialog-sliding")).toBe(true);
    const labels = () => [...document.querySelectorAll(".swl-handle-guide-label")].map((label) => label.textContent);
    expect(labels()).toContain("900 px");
    slider.value = "700";
    slider.dispatchEvent(new Event("input"));
    expect(row.querySelector<HTMLInputElement>(".swl-dialog-guide-amount")!.value).toBe("700");
    expect(labels()).toContain("700 px");
    expect(labels()).not.toContain("900 px");
    window.dispatchEvent(new Event("pointerup"));
    expect(document.querySelectorAll(".swl-handle-guide")).toHaveLength(0);
  });

  it("with the dialog open, Ctrl + scroll and Ctrl+0 set its This device (anywhere: its ground lies over the page), kept on Save", async () => {
    const { page } = plainPage();
    const { api, store } = memoryStore({ Page: undefined }, { fontSize: 18 });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const zoomed = document.querySelector<HTMLInputElement>('[aria-label="This device\'s font size in px"]')!;
    const wheel = (deltaY: number) => document.querySelector(".swl-dialog-backdrop")!.dispatchEvent(new WheelEvent("wheel", { deltaY, ctrlKey: true, bubbles: true, cancelable: true }));
    wheel(-100);
    wheel(-100);
    expect(zoomed.value).toBe("20");
    expect(document.documentElement.getAttribute("data-swl-font-size")).toBe("20");
    // Ctrl+0: the size of all pages again
    document.querySelector(".swl-dialog")!.dispatchEvent(new KeyboardEvent("keydown", { key: "0", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(zoomed.value).toBe("");
    wheel(-100);
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.zoom).toBe(19);
  });

  it("a slider held: the dialog marked sliding, the controls held marked; let go, neither", async () => {
    const { page } = plainPage();
    const { api } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const dialog = document.querySelector(".swl-dialog")!;
    const slider = document.querySelector<HTMLInputElement>(".swl-dialog-width-row .swl-dialog-slider")!;
    slider.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(dialog.classList.contains("swl-dialog-sliding")).toBe(true);
    expect(slider.closest(".swl-dialog-width-controls")!.classList.contains("swl-dialog-held")).toBe(true);
    window.dispatchEvent(new Event("pointerup"));
    expect(dialog.classList.contains("swl-dialog-sliding")).toBe(false);
    expect(document.querySelectorAll(".swl-dialog-held")).toHaveLength(0);
  });

  it("saves from its dialog through the store: the page's own width, the default", async () => {
    const { page, shown } = plainPage();
    const { api, store } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const row = (name: string) => document.querySelector<HTMLElement>(`[data-swl-row="${name}"]`)!;
    const type = (row: HTMLElement, value: string) => {
      const amount = row.querySelector<HTMLInputElement>(".swl-dialog-amount")!;
      amount.value = value;
      amount.dispatchEvent(new Event("input"));
    };
    type(row("page"), "1000");
    type(row("all"), "850");
    expect(shown.at(-1)).toEqual({ amount: 1000, unit: "px" });
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.saved).toEqual(["textWidth 850", "page Page"]);
    expect(shown.at(-1)).toEqual({ amount: 1000, unit: "px" });
  });
});
