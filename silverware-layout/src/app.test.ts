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
    confirm: async () => true,
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

    const narrow = plainPage(500);
    const small = new LayoutApp(document, narrow.page, new Registry(() => undefined));
    await small.start(memoryStore({ Wide: { amount: 1100, unit: "px" } }).api);
    expect(narrow.shown.at(-1)).toBeUndefined();
    expect(document.documentElement.hasAttribute("data-swl-narrow")).toBe(true);
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
    const amount = document.querySelector<HTMLInputElement>(".swl-dialog-width-row .swl-dialog-amount")!;
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

  it("saves from its dialog through the store: the page's own width, the default", async () => {
    const { page, shown } = plainPage();
    const { api, store } = memoryStore({ Page: undefined });
    const app = new LayoutApp(document, page, new Registry(() => undefined));
    await app.start(api);
    await app.openDialog();
    const rows = document.querySelectorAll<HTMLElement>(".swl-dialog-width-row");
    const type = (row: HTMLElement, value: string) => {
      const amount = row.querySelector<HTMLInputElement>(".swl-dialog-amount")!;
      amount.value = value;
      amount.dispatchEvent(new Event("input"));
    };
    type(rows[0]!, "1000");
    type(rows[1]!, "850");
    expect(shown.at(-1)).toEqual({ amount: 1000, unit: "px" });
    document.querySelector<HTMLButtonElement>(".swl-dialog-save")!.click();
    await expect.poll(() => store.saved).toEqual(["textWidth 850", "page Page"]);
    expect(shown.at(-1)).toEqual({ amount: 1000, unit: "px" });
  });
});
