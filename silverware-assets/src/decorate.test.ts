// @vitest-environment jsdom
// Embedded media decorated over a host of memory: frames as SilverBullet draws an embed (an <img> of `.fs/<path>`, or
// "Unsupported content"), the page's text kept here. No SilverBullet is needed to find an embed drawn in the page,
// choose its view and run a click's action.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssetType, RenderContext } from "../../shared/assets.ts";
import { readEmbeds } from "../../shared/markdown/embed.ts";
import { registerBuiltins } from "./builtin/index.ts";
import { AssetRegistry } from "./core/registry.ts";
import { AssetDecorator, type AssetHost, type DrawnEmbed, type EmbedWrite } from "./decorate.ts";
import { type AssetSettings, readAssetSettings } from "./model/settings.ts";

function setUp(text: string, settings: unknown = {}, own: Pick<AssetHost, "placeOf" | "contextOf" | "positionOf" | "deleteFile" | "removeEmbed" | "linkToText" | "confirm" | "previewFiles" | "renameFile" | "filePaths" | "writeLinkText"> = {}) {
  const state = { text, opened: [] as string[], writes: [] as EmbedWrite[], forms: [] as string[], problems: [] as string[], ranges: [] as { from: number; to: number }[] };
  const host: AssetHost = {
    watch: () => undefined,
    renderedRanges: () => state.ranges,
    ...own,
    pageText: async () => state.text,
    pageName: async () => "Notes/Page",
    resolved: (embed) => embed.target,
    assetOf: (embed) => ({ kind: "file", path: embed.target, url: `.fs/${embed.target}`, ...(embed.alt ? { alt: embed.alt } : {}) }),
    settings: async (): Promise<AssetSettings> => readAssetSettings(settings).settings,
    writeEmbed: async (write) => void state.writes.push(write),
    embedToLink: async (write) => void state.forms.push(`link ${write.text} ${write.occurrence}/${write.of}`),
    linkToEmbed: async (write) => void state.forms.push(`embed ${write.text} ${write.occurrence}/${write.of}`),
    fileInfo: async (asset) => (asset.kind === "file" && asset.path.endsWith(".zip") ? { size: 2_621_440, modified: "2026-11-13T10:00:00Z" } : undefined),
    linkAsset: (link) => (/\.[a-z]+$/.test(link.target) ? { kind: "file", path: link.target, url: `.fs/${link.target}` } : undefined),
    open: (url) => void state.opened.push(url),
    problem: (message) => void state.problems.push(message),
  };
  const registry = new AssetRegistry((message) => state.problems.push(message));
  registerBuiltins(registry);
  return { state, registry, decorator: new AssetDecorator(document, host, registry) };
}

/** A frame as SilverBullet draws an embed: its medium, or the words it could not draw it with */
function frame(target: string, medium = true): DrawnEmbed {
  const element = document.createElement("div");
  element.className = "sb-inline-content";
  let native: HTMLElement | undefined;
  if (medium) {
    native = document.createElement("img");
    native.setAttribute("src", `.fs/${target}`);
    element.append(native);
  } else element.append(Object.assign(document.createElement("span"), { className: "p", textContent: `Error: Unsupported content: ${target}` }));
  document.body.append(element);
  return { frame: element, target, native };
}

afterEach(() => document.body.replaceChildren());

/** The open menu's "Show as" row: each way's name and whether it is the one shown */
const showAsRow = () => [...document.querySelectorAll<HTMLButtonElement>(".swa-popup .swa-segment")].map((one) => [one.getAttribute("aria-label"), one.getAttribute("aria-checked")]);
/** A way of showing it chosen in the open menu's row, by its name */
const chooseShowAs = (name: string) => [...document.querySelectorAll<HTMLButtonElement>(".swa-popup .swa-segment")].find((one) => one.getAttribute("aria-label")?.startsWith(name))!.click();

describe("a file drawn in an editor's field", () => {
  it("is drawn again by a type registered after it was drawn (another plugin's, in place of the built-in one)", async () => {
    const { registry, decorator } = setUp("", { views: { types: { pdf: "preview" } } });
    const container = document.createElement("div");
    document.body.append(container);
    const control = new AbortController();
    decorator.editorEmbed("![[doc.pdf]]", "P")!.draw(container, control.signal);
    await vi.waitFor(() => expect(container.querySelector("[data-swa-type='pdf']")).not.toBeNull());
    expect(container.querySelector(".test-own-preview")).toBeNull();
    registry.types.register({
      name: "pdf",
      match: { kind: ["file"], ext: ["pdf"] },
      icon: "<svg/>",
      views: { preview: () => Object.assign(document.createElement("div"), { className: "test-own-preview" }) },
    } as AssetType);
    await vi.waitFor(() => expect(container.querySelector(".test-own-preview")).not.toBeNull());
    // (Its field gone: no more drawing)
    control.abort();
  });

  it("is drawn as in the page, read-only: its view and label, no menu, no action of a click, its drawing ended with the field's", async () => {
    const { state, decorator } = setUp("", { views: { types: { image: "preview" } } });
    expect(decorator.editorEmbed("![[cat.png]] and text", "P")).toBeUndefined();
    const drawn = decorator.editorEmbed("![[cat.png|A cat|200]]", "P")!;
    expect(drawn.key).toBe(decorator.editorEmbed("![[cat.png|A cat|200]]", "P")!.key);
    const container = document.createElement("div");
    document.body.append(container);
    const control = new AbortController();
    drawn.draw(container, control.signal);
    const frame = container.querySelector<HTMLElement>(".swa-frame")!;
    expect(frame.querySelector("img")!.getAttribute("src")).toBe(".fs/cat.png");
    expect(frame.querySelector("img")!.style.width).toBe("200px");
    await vi.waitFor(() => expect(frame.getAttribute("data-swa-view")).toBe("preview"));
    expect(frame.querySelector(".swa-more")).toBeNull();
    frame.querySelector("img")!.click();
    expect(state.opened).toEqual([]);
    // A card alike: no menu's way in
    const card = decorator.editorEmbed("![[archive.zip]]", "P")!;
    card.draw(container, control.signal);
    await vi.waitFor(() => expect(container.querySelector(".swa-card")).not.toBeNull());
    expect(container.querySelector(".swa-card [role=button]")).toBeNull();
    control.abort();
  });
});

describe("a link to a file in an editor's field", () => {
  /** A link's icon drawn into a container of the field's, its markdown edited by `replace` (none: read-only) */
  const drawIcon = (decorator: AssetDecorator, markdown: string, replace?: (markdown: string) => boolean, part: "linkIcon" | "linkAfter" = "linkIcon") => {
    const container = document.createElement("span");
    document.body.append(container);
    const control = new AbortController();
    decorator.fieldDrawing("P")[part]!(markdown)!.draw(container, control.signal, replace ? { replace } : undefined);
    return { container, control };
  };

  it("is given its type's icon alone: none for a page's link, for text around it, or for a file no type takes", async () => {
    const { decorator } = setUp("");
    const icon = decorator.fieldDrawing("P").linkIcon!;
    expect(icon("[[Notes]]")).toBeUndefined();
    expect(icon("[[a.pdf]] and text")).toBeUndefined();
    expect(icon("[[a.pdf]]")!.key).toBe(icon("[[a.pdf]]")!.key);
    // A picture alone, given the markdown to edit or not: no menu from it (the arrow after the text has it)
    const { container, control } = drawIcon(decorator, "[the doc](a.pdf)", () => true);
    await vi.waitFor(() => expect(container.querySelector(".swa-link-icon svg")).not.toBeNull());
    container.querySelector<HTMLElement>(".swa-link-icon")!.click();
    expect(document.querySelector(".swa-popup")).toBeNull();
    control.abort();
    // Read-only (no markdown to edit): the arrow, no menu
    const after = drawIcon(decorator, "[the doc](a.pdf)", undefined, "linkAfter");
    await vi.waitFor(() => expect(after.container.querySelector(".swa-link-marker")).not.toBeNull());
    after.container.querySelector<HTMLElement>(".swa-link-marker")!.click();
    expect(document.querySelector(".swa-popup")).toBeNull();
    after.control.abort();
  });

  it("opens its file's menu as in the page, what it changes written into the field: an embed of a view, its markdown copied, its file deleted and the link as its text", async () => {
    const deleted: string[] = [];
    const { decorator } = setUp("", {}, { deleteFile: async (path) => void deleted.push(path), confirm: async () => true });
    const written: string[] = [];
    const { container, control } = drawIcon(decorator, "[[Docs/a.pdf|The doc]]", (markdown) => (written.push(markdown), true), "linkAfter");
    await vi.waitFor(() => expect(container.querySelector(".swa-link-marker")).not.toBeNull());
    const open = () => container.querySelector<HTMLElement>(".swa-link-marker")!.click();
    open();
    expect(showAsRow().find(([, checked]) => checked === "true")?.[0]).toBe("Link");
    chooseShowAs("Preview");
    expect(written.at(-1)).toBe("![[Docs/a.pdf|The doc||{ view: preview }]]");
    open();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((item) => item.textContent?.includes("Delete file"))!.click();
    await vi.waitFor(() => expect(deleted).toEqual(["Docs/a.pdf"]));
    expect(written.at(-1)).toBe("The doc");
    control.abort();
  });
});

describe("embedded media decorated", () => {
  it("leaves an image as the host drew it, its type and view marked", async () => {
    const { decorator } = setUp("![[cat.png|A cat|200]]");
    const one = frame("cat.png");
    await decorator.decorate([one]);
    expect(one.frame.getAttribute("data-swa-type")).toBe("image");
    expect(one.frame.getAttribute("data-swa-view")).toBe("full");
    expect(one.native!.classList.contains("swa-native-hidden")).toBe(false);
  });

  it("puts a box in the place of a picture whose file could not be loaded, its name there unless its label names it; gone as it loads after all", async () => {
    const { decorator } = setUp("![[gone.png|||{ view: preview }]] ![[Photo.png|A photo|300x200]] ![[late.png]]");
    const [preview, full, late] = [frame("gone.png"), frame("Photo.png"), frame("late.png")];
    await decorator.decorate([preview!, full!, late!]);
    for (const one of [preview!, full!]) one.native!.dispatchEvent(new Event("error"));
    // A preview: its label names the file (the alt text falls back to the name), the box says why alone
    expect(preview!.frame.hasAttribute("data-swa-missing")).toBe(true);
    expect(preview!.native!.classList.contains("swa-native-hidden")).toBe(true);
    expect(preview!.frame.querySelector(".swa-missing")!.textContent).toBe("gone.pngFile not found");
    expect(preview!.frame.hasAttribute("data-swa-label-named")).toBe(true);
    // Shown full: no label, the box of its embed's size, naming its file (not its alt text); its "…" there
    expect(full!.frame.hasAttribute("data-swa-label-named")).toBe(false);
    const box = full!.frame.querySelector<HTMLElement>(".swa-missing")!;
    expect(box.textContent).toBe("Photo.pngFile not found");
    expect([box.style.width, box.style.height]).toEqual(["calc(300px * var(--sw-content-scale, 1))", "calc(200px * var(--sw-content-scale, 1))"]);
    expect(full!.frame.querySelector(".swa-more")).not.toBeNull();
    // Failed, then loaded after all: the box gone, the picture shown
    late!.native!.dispatchEvent(new Event("error"));
    expect(late!.frame.querySelectorAll(".swa-missing")).toHaveLength(1);
    late!.native!.dispatchEvent(new Event("load"));
    expect(late!.frame.querySelector(".swa-missing")).toBeNull();
    expect(late!.frame.hasAttribute("data-swa-missing")).toBe(false);
    expect(late!.native!.classList.contains("swa-native-hidden")).toBe(false);
    // Drawn again: no box until it fails again, then one; loaded after all, none, the picture shown (what the drawing
    // before listened to ended with it, else it would have taken away a box it did not draw, or left its own)
    await decorator.decorate([preview!]);
    expect(preview!.frame.querySelector(".swa-missing")).toBeNull();
    preview!.native!.dispatchEvent(new Event("error"));
    expect(preview!.frame.querySelectorAll(".swa-missing")).toHaveLength(1);
    preview!.native!.dispatchEvent(new Event("load"));
    expect(preview!.frame.querySelector(".swa-missing")).toBeNull();
    expect(preview!.frame.hasAttribute("data-swa-missing")).toBe(false);
    expect(preview!.native!.classList.contains("swa-native-hidden")).toBe(false);
  });

  it("tells a picture that failed before it was decorated by decoding it: a box for it, none for one that decodes (an SVG of no size of its own)", async () => {
    const { decorator } = setUp("![[gone.png]] ![[drawing.svg]]");
    const [gone, svg] = [frame("gone.png"), frame("drawing.svg")];
    // (Done loading, of no size, before the decorator watches it: jsdom loads no picture, the browser's state stubbed)
    for (const [one, decodes] of [[gone!, false], [svg!, true]] as const)
      Object.defineProperties(one.native!, { complete: { value: true }, naturalWidth: { value: 0 }, decode: { value: () => (decodes ? Promise.resolve() : Promise.reject(new Error("broken"))) } });
    await decorator.decorate([gone!, svg!]);
    await vi.waitFor(() => expect(gone!.frame.querySelector(".swa-missing")).not.toBeNull());
    expect(svg!.frame.querySelector(".swa-missing")).toBeNull();
  });

  it("tells a video missing by its own error alone, not a source's that another may follow", async () => {
    const { decorator } = setUp("![[clip.mp4]]");
    const one = frame("clip.mp4", false);
    const video = document.createElement("video");
    video.setAttribute("src", ".fs/clip.mp4");
    one.frame.replaceChildren(video);
    await decorator.decorate([{ ...one, native: video }]);
    // (A <source>'s error: no error of the element's own)
    video.dispatchEvent(new Event("error"));
    expect(one.frame.querySelector(".swa-missing")).toBeNull();
    Object.defineProperty(video, "error", { value: { code: 4 } });
    video.dispatchEvent(new Event("error"));
    expect(one.frame.querySelector(".swa-missing")).not.toBeNull();
  });

  it("shows a file the host cannot draw as a card, its click opening it in a tab", async () => {
    const { state, decorator } = setUp("![[Docs/archive.zip]]");
    const one = frame("Docs/archive.zip", false);
    await decorator.decorate([one]);
    expect(one.frame.getAttribute("data-swa-view")).toBe("card");
    const card = one.frame.querySelector<HTMLElement>(".swa-card")!;
    expect(card.textContent).toBe("archive.zip");
    expect(card.querySelector("svg")).not.toBeNull();
    // The host's words that it could not draw it: hidden behind the card
    expect(one.frame.querySelector(".p")!.classList.contains("swa-native-hidden")).toBe(true);
    card.click();
    expect(state.opened).toEqual([".fs/Docs/archive.zip"]);
  });

  it("shows a file's size and date on its card where the user shows them, as the host tells them", async () => {
    const { decorator } = setUp("![[archive.zip]]", { card: { fields: ["icon", "name", "size", "modified"] } });
    const one = frame("archive.zip", false);
    await decorator.decorate([one]);
    await vi.waitFor(() => expect(one.frame.querySelector(".swa-card-meta")).not.toBeNull());
    expect(one.frame.querySelector(".swa-card-size")!.textContent).toBe("2.5 MB");
    expect(one.frame.querySelector(".swa-card-modified")!.textContent).toMatch(/2026/);
    // Not shown where the user shows them not
    const { decorator: plain } = setUp("![[archive.zip]]");
    const other = frame("archive.zip", false);
    await plain.decorate([other]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(other.frame.querySelector(".swa-card-meta")).toBeNull();
  });

  it("takes the embed's own view, then the user's per type, the second of two alike by its order", async () => {
    const { decorator } = setUp("![[cat.png]] ![[cat.png|||{ view: card }]]", { views: { types: { image: "preview" } } });
    const [first, second] = [frame("cat.png"), frame("cat.png")];
    await decorator.decorate([first!, second!]);
    expect(first!.frame.getAttribute("data-swa-view")).toBe("preview");
    expect(second!.frame.getAttribute("data-swa-view")).toBe("card");
    expect(second!.native!.classList.contains("swa-native-hidden")).toBe(true);
  });

  it("draws a type's own preview, and where it fails the host's drawing with an error mark", async () => {
    const { registry, decorator } = setUp("![[a.pdf|||{ view: preview }]] ![[b.png|||{ view: preview }]]");
    registry.types.register({ name: "image", match: { kind: ["file"], mime: "image/*" }, icon: "<svg/>", views: { preview: () => { throw new Error("no thumbnail"); } } } as AssetType);
    const pdf = frame("a.pdf");
    const png = frame("b.png");
    // (jsdom lays nothing out: the frame's width as a browser would give it)
    Object.defineProperty(pdf.frame, "clientWidth", { value: 600 });
    await decorator.decorate([pdf, png]);
    await vi.waitFor(() => expect(pdf.frame.querySelector(".swa-pdf")).not.toBeNull());
    expect(pdf.native!.classList.contains("swa-native-hidden")).toBe(true);
    await vi.waitFor(() => expect(png.frame.querySelector(".swa-failed")).not.toBeNull());
    expect(png.frame.querySelector(".swa-failed")!.getAttribute("title")).toBe("no thumbnail");
    expect(png.native!.classList.contains("swa-native-hidden")).toBe(false);
  });

  it("gives a type's preview the height of its type's own preview where it has one, all files' else", async () => {
    const { registry, decorator } = setUp("![[a.pdf|||{ view: preview }]] ![[b.thing|||{ view: preview }]]", { preview: { height: 160, types: { pdf: { height: 300 } } } });
    const heights: Record<string, number> = {};
    const renderer = (name: string) => (context: RenderContext) => ((heights[name] = context.viewport.height), document.createElement("div"));
    registry.types.register({ name: "pdf", match: { kind: ["file"], ext: ["pdf"] }, icon: "<svg/>", views: { preview: renderer("pdf") } } as AssetType);
    registry.types.register({ name: "thing", match: { kind: ["file"], ext: ["thing"] }, icon: "<svg/>", views: { preview: renderer("thing") } } as AssetType);
    await decorator.decorate([frame("a.pdf"), frame("b.thing")]);
    await vi.waitFor(() => expect(heights).toEqual({ pdf: 300, thing: 160 }));
  });

  it("lays its layer over a document's viewer a preview puts in after it was drawn (a page a reader could not draw: the browser's viewer in its place)", async () => {
    const { registry, decorator } = setUp("![[a.pdf|||{ view: preview }]]");
    let box: HTMLElement | undefined;
    registry.types.register({ name: "pdf", match: { kind: ["file"], ext: ["pdf"] }, icon: "<svg/>", views: { preview: () => (box = document.createElement("div")) } } as AssetType);
    const pdf = frame("a.pdf");
    await decorator.decorate([pdf]);
    await vi.waitFor(() => expect(box?.isConnected).toBe(true));
    expect(pdf.frame.querySelector(":scope > .swa-shield")).toBeNull();
    box!.append(document.createElement("object"));
    await vi.waitFor(() => expect(pdf.frame.querySelector(":scope > .swa-shield")).not.toBeNull());
  });

  it("writes a type's metadata through the host, the reserved keys refused", async () => {
    const { state, registry, decorator } = setUp("![[a.thing|||{ zoom: 2 }]]");
    let written: Promise<string | undefined> | undefined;
    let refused: Promise<string | undefined> | undefined;
    registry.types.register({
      name: "thing",
      match: { kind: ["file"], ext: ["thing"] },
      icon: "<svg/>",
      views: {
        full: (context) => {
          expect(context.metadata.number("zoom")).toBe(2);
          written = context.metadata.write({ zoom: 3 });
          refused = context.metadata.write({ view: "card" });
          return document.createElement("canvas");
        },
      },
    });
    const one = frame("a.thing", false);
    await decorator.decorate([one]);
    await vi.waitFor(() => expect(one.frame.querySelector("canvas")).not.toBeNull());
    await written;
    expect(await refused).toBe('"view" is Silverware Assets\' own key');
    expect(state.writes).toEqual([{ text: readEmbeds(state.text)[0]!.text, occurrence: 0, of: 1, changes: { metadata: { zoom: "3" } } }]);
  });
});

describe("an asset's menu", () => {
  it("hands a preview kept in the space to a type that keeps one; Regenerate preview takes it away and draws it anew", async () => {
    const times: Record<string, number> = { "doc.pdf": 1, "_silverware-assets-previews/doc.pdf.1-1.webp": 2 };
    const previewFiles = {
      facts: async (path: string) => (path in times ? { modified: times[path]!, size: 1 } : undefined),
      read: async (path: string) => (path in times ? new Uint8Array([1]) : undefined),
      write: async () => undefined,
      remove: async (path: string) => void delete times[path],
    };
    const { registry, decorator } = setUp("![[doc.pdf]]", { views: { types: { pdf: "preview" } } }, { previewFiles });
    const given: { anew?: boolean; kept?: string }[] = [];
    registry.types.register({
      name: "pdf",
      match: { kind: ["file"], ext: ["pdf"] },
      icon: "<svg/>",
      storesPreview: true,
      views: {
        preview: async (context) => {
          given.push({ ...(context.stored?.anew ? { anew: true } : {}), kept: (await context.stored?.read("image/webp"))?.type ?? "none" });
          return document.createElement("div");
        },
      },
    } as AssetType);
    const one = frame("doc.pdf", false);
    await decorator.decorate([one]);
    await vi.waitFor(() => expect(given).toEqual([{ kept: "image/webp" }]));
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((item) => item.textContent?.trim() === "Regenerate preview")!.click();
    await vi.waitFor(() => expect(given).toEqual([{ kept: "image/webp" }, { anew: true, kept: "none" }]));
    expect(times["_silverware-assets-previews/doc.pdf.1-1.webp"]).toBeUndefined();
    // Previews not kept, as the settings say: none handed over, no Regenerate preview
    const { registry: offRegistry, decorator: off } = setUp("![[doc.pdf]]", { views: { types: { pdf: "preview" } }, storePreviews: false }, { previewFiles });
    const offGiven: string[] = [];
    offRegistry.types.register({
      name: "pdf",
      match: { kind: ["file"], ext: ["pdf"] },
      icon: "<svg/>",
      storesPreview: true,
      views: { preview: (context) => (offGiven.push(context.stored ? "stored" : "none"), document.createElement("div")) },
    } as AssetType);
    const other = frame("doc.pdf", false);
    await off.decorate([other]);
    await vi.waitFor(() => expect(offGiven).toEqual(["none"]));
    other.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    const labels = [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].map((item) => item.textContent?.trim());
    expect(labels).not.toContain("Regenerate preview");
  });

  it("copies its embed's whole markdown, its metadata too, as the page has it", async () => {
    const markdown = "![[cat.png|A cat|200|{ view: full, align: right }]]";
    const { decorator } = setUp(`# A\n\n${markdown}\n`);
    const one = frame("cat.png");
    await decorator.decorate([one]);
    const copied: string[] = [];
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async (text: string) => void copied.push(text) }, configurable: true });
    try {
      one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
      [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((item) => item.textContent?.trim() === "Copy markdown")!.click();
      await vi.waitFor(() => expect(copied).toEqual([markdown]));
    } finally {
      Reflect.deleteProperty(window.navigator, "clipboard");
    }
  });

  it("shows its views, the one shown checked, writes the one chosen, the settings' own as none", async () => {
    const { state, decorator } = setUp("![[cat.png|A cat|200]]", { views: { types: { image: "full" } } });
    const one = frame("cat.png");
    await decorator.decorate([one]);
    const more = one.frame.querySelector<HTMLButtonElement>(".swa-more")!;
    more.click();
    // What changes the page first, one row of the ways it can be shown, the one shown on, the settings' own named
    expect(showAsRow()).toEqual([
      ["Link", "false"],
      ["Card", "false"],
      ["Preview", "false"],
      ["Full (default)", "true"],
    ]);
    // Rename… with that row (it changes the page too), then opening it, then the file itself, its copies first
    expect([...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].map((item) => item.textContent?.trim())).toEqual([
      "Rename…",
      "Open in a new tab",
      "Open in side panel",
      "Open enlarged",
      "Copy image",
      "Copy markdown",
      "Download",
    ]);
    chooseShowAs("Card");
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    expect(state.writes[0]!.changes).toEqual({ metadata: { view: "card" } });
    expect(document.querySelector(".swa-popup")).toBeNull();
    more.click();
    chooseShowAs("Full");
    await vi.waitFor(() => expect(state.writes).toHaveLength(2));
    expect(state.writes[1]!.changes).toEqual({ metadata: { view: null } });
    // Shown as a link: the embed written as one
    more.click();
    chooseShowAs("Link");
    await vi.waitFor(() => expect(state.forms).toEqual(["link ![[cat.png|A cat|200]] 0/1"]));
  });
});

describe("a file deleted from its menu", () => {
  it("asks plainly, then deletes the file and takes its embed out of the page; asked and declined, nothing", async () => {
    const done: string[] = [];
    let answer = false;
    const questions: string[] = [];
    const { decorator } = setUp("Top\n\n![[Docs/report.pdf]]\n", {}, {
      confirm: async (question) => (questions.push(question), answer),
      deleteFile: async (path) => void done.push(`deleted ${path}`),
      removeEmbed: async (write) => void done.push(`removed ${write.text} ${write.occurrence}/${write.of}`),
    });
    const one = frame("Docs/report.pdf");
    await decorator.decorate([one]);
    const deleteItem = () => {
      one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
      const item = [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((element) => element.textContent?.trim() === "Delete file…")!;
      // (Apart from the rest, in the danger colour)
      expect(item.classList.contains("swa-danger")).toBe(true);
      item.click();
    };
    deleteItem();
    await vi.waitFor(() => expect(questions).toHaveLength(1));
    expect(questions[0]).toContain('Delete the file "Docs/report.pdf" from your space?');
    expect(questions[0]).toContain("The file itself is deleted, not only this embed: it cannot be brought back.");
    expect(done).toEqual([]);
    answer = true;
    deleteItem();
    await vi.waitFor(() => expect(done).toEqual(["deleted Docs/report.pdf", "removed ![[Docs/report.pdf]] 0/1"]));
  });

  it("deletes a file's previews kept in the space with it, of the version it had", async () => {
    const kept: Record<string, true> = { "_silverware-assets-previews/report.pdf.5-3.webp": true, "_silverware-assets-previews/report.pdf.4-3.webp": true };
    let fileThere = true;
    const done: string[] = [];
    const { decorator } = setUp("![[report.pdf]]\n", {}, {
      confirm: async () => true,
      deleteFile: async (path) => {
        fileThere = false;
        done.push(`deleted ${path}`);
      },
      removeEmbed: async () => undefined,
      previewFiles: {
        facts: async (path) => (path === "report.pdf" ? (fileThere ? { modified: 5, size: 3 } : undefined) : kept[path] ? { modified: 1, size: 1 } : undefined),
        read: async () => undefined,
        write: async () => undefined,
        remove: async (path) => void (delete kept[path], done.push(`removed ${path}`)),
      },
    });
    const one = frame("report.pdf");
    await decorator.decorate([one]);
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((element) => element.textContent?.trim() === "Delete file…")!.click();
    await vi.waitFor(() => expect(done).toEqual(["deleted report.pdf", "removed _silverware-assets-previews/report.pdf.5-3.webp"]));
    // (Another version's left to Clean up previews)
    expect(Object.keys(kept)).toEqual(["_silverware-assets-previews/report.pdf.4-3.webp"]);
  });

  it("deletes nothing where its embed is no longer in the page: found before the file goes, as the host may draw it anew after", async () => {
    const done: string[] = [];
    const { state, decorator } = setUp("![[Docs/report.pdf]]\n", {}, {
      confirm: async () => true,
      deleteFile: async (path) => void done.push(`deleted ${path}`),
      removeEmbed: async (write) => void done.push(`removed ${write.text}`),
    });
    const one = frame("Docs/report.pdf");
    await decorator.decorate([one]);
    state.text = "Gone\n";
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((element) => element.textContent?.trim() === "Delete file…")!.click();
    await vi.waitFor(() => expect(state.problems).toEqual(["Silverware Assets: the file was not deleted: this file was not found in the page"]));
    expect(done).toEqual([]);
  });

  it("offers no Delete where the host deletes no file, or cannot take its embed out after", async () => {
    const items = async (own: Parameters<typeof setUp>[2]) => {
      const { decorator } = setUp("![[report.pdf]]", {}, own);
      const one = frame("report.pdf");
      await decorator.decorate([one]);
      one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
      const labels = [...document.querySelectorAll(".swa-popup .swa-menu-item")].map((item) => item.textContent?.trim());
      document.body.click();
      return labels;
    };
    expect(await items({})).not.toContain("Delete file…");
    expect(await items({ confirm: async () => true, deleteFile: async () => undefined })).not.toContain("Delete file…");
  });
});

describe("Rename… in a file's menu", () => {
  /** The open menu's Rename…, pressed: its dialog */
  const openRename = () => {
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((item) => item.textContent?.trim() === "Rename…")!.click();
    return document.querySelector<HTMLElement>(".swa-rename-window")!;
  };
  const field = (dialog: HTMLElement, label: string) => dialog.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const typed = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const save = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>(".swa-dialog-save")!.click();

  it("renames an embed's file, its previews kept of its version taken away, then writes its title to the embed rewritten to the new name", async () => {
    const kept: Record<string, true> = { "_silverware-assets-previews/Pics/cat.png.5-3.webp": true };
    const done: string[] = [];
    // (The page as SilverBullet's rename leaves it: every reference to the file rewritten; a later embed of it too)
    const page = { text: "" };
    const { state, decorator } = setUp("![[Pics/cat.png|A cat]] and ![[Pics/cat.png|Again]]\n", {}, {
      renameFile: async (from, to) => {
        done.push(`renamed ${from} to ${to}`);
        page.text = page.text.replaceAll(from, to);
      },
      filePaths: async () => ["Pics/cat.png", "Pics/dog.png"],
      previewFiles: {
        facts: async (path) => (path === "Pics/cat.png" ? { modified: 5, size: 3 } : kept[path] ? { modified: 1, size: 1 } : undefined),
        read: async () => undefined,
        write: async () => undefined,
        remove: async (path) => void (delete kept[path], done.push(`removed ${path}`)),
      },
    });
    Object.defineProperty(page, "text", { get: () => state.text, set: (text: string) => void (state.text = text) });
    const one = frame("Pics/cat.png");
    await decorator.decorate([one]);
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    const dialog = openRename();
    // Its title as written, its file's name without its folder and extension (shown beside it)
    expect([field(dialog, "Title").value, field(dialog, "File name").value]).toEqual(["A cat", "cat"]);
    expect([...dialog.querySelectorAll(".swa-rename-fixed")].map((one) => one.textContent)).toEqual(["Pics/", ".png"]);
    // A name another file has: refused, said under it
    typed(field(dialog, "File name"), "Dog");
    await vi.waitFor(() => expect(dialog.textContent).toContain('"Pics/dog.png" is another file'));
    expect(dialog.querySelector<HTMLButtonElement>(".swa-dialog-save")!.disabled).toBe(true);
    // The name made of the title, by the link under the field
    typed(field(dialog, "Title"), "Kočka: venku");
    dialog.querySelector<HTMLButtonElement>(".swa-rename-from-title")!.click();
    expect(field(dialog, "File name").value).toBe("Kočka venku");
    save(dialog);
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    expect(done).toEqual(["renamed Pics/cat.png to Pics/Kočka venku.png", "removed _silverware-assets-previews/Pics/cat.png.5-3.webp"]);
    // (Its title written after: to the first embed of the file by its new name, the second left as it is)
    expect(state.writes).toEqual([{ text: "![[Pics/Kočka venku.png|A cat]]", occurrence: 0, of: 1, changes: { alt: "Kočka: venku" } }]);
    expect(document.querySelector(".swa-rename-window")).toBeNull();
  });

  it("writes nothing, its previews kept, where the file was not renamed", async () => {
    const removed: string[] = [];
    const { state, decorator } = setUp("![[cat.png|A cat]]\n", {}, {
      renameFile: async () => "SilverBullet did not rename it (its notification says why)",
      previewFiles: { facts: async () => ({ modified: 5, size: 3 }), read: async () => undefined, write: async () => undefined, remove: async (path) => void removed.push(path) },
    });
    const one = frame("cat.png");
    await decorator.decorate([one]);
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    const dialog = openRename();
    typed(field(dialog, "Title"), "A dog");
    typed(field(dialog, "File name"), "dog");
    await vi.waitFor(() => expect(dialog.querySelector<HTMLButtonElement>(".swa-dialog-save")!.disabled).toBe(false));
    save(dialog);
    await vi.waitFor(() => expect(state.problems).toEqual(["Silverware Assets: the file was not renamed: SilverBullet did not rename it (its notification says why)"]));
    expect([state.writes, removed]).toEqual([[], []]);
  });

  it("in a field, sets an embed's title alone: its file is renamed from the page", async () => {
    const renamed: string[] = [];
    const { decorator } = setUp("", {}, { renameFile: async (from) => void renamed.push(from) });
    const container = document.createElement("div");
    document.body.append(container);
    let text = "![[cat.png|A cat]]";
    const control = new AbortController();
    decorator.editorEmbed(text, "P")!.draw(container, control.signal, { replace: (markdown) => ((text = markdown), true) });
    const more = await vi.waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>(".swa-more");
      if (!button) throw new Error("not drawn yet");
      return button;
    });
    more.click();
    const dialog = openRename();
    expect(field(dialog, "File name")).toBeNull();
    expect(dialog.textContent).toContain("Its file is renamed from its menu in the page, not while this is edited.");
    // (The field's companion: its focus there is not the field left)
    expect(dialog.querySelector("[data-silverware-editor-companion]")).not.toBeNull();
    typed(field(dialog, "Title"), "A dog");
    save(dialog);
    expect([text, renamed]).toEqual(["![[cat.png|A dog]]", []]);
    control.abort();
  });

  it("takes an embed's title off, its file left as it is; Cancel writes nothing", async () => {
    const renamed: string[] = [];
    const { state, decorator } = setUp("![[cat.png|A cat]]\n", {}, { renameFile: async (from) => void renamed.push(from) });
    const one = frame("cat.png");
    await decorator.decorate([one]);
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    let dialog = openRename();
    dialog.querySelector<HTMLButtonElement>(".swa-dialog-cancel")!.click();
    expect(document.querySelector(".swa-rename-window")).toBeNull();
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    dialog = openRename();
    dialog.querySelector<HTMLButtonElement>(".swa-rename-clear")!.click();
    // (Its placeholder what shows without one: the file's name)
    expect(field(dialog, "Title").placeholder).toBe("cat.png");
    save(dialog);
    await vi.waitFor(() => expect(state.writes.map((write) => write.changes)).toEqual([{ alt: null }]));
    expect(renamed).toEqual([]);
  });

  it("sets a link's text in the page where its host writes one, its file's name beside", async () => {
    const texts: string[] = [];
    const { decorator } = setUp("See [[report.pdf|the report]] here.\n", {}, {
      writeLinkText: async (write) => void texts.push(`${write.text} ${write.occurrence}/${write.of}: ${write.shown}`),
      renameFile: async () => undefined,
    });
    const element = Object.assign(document.createElement("a"), { textContent: "the report", href: "report.pdf" });
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "report.pdf", style: "wiki" }]);
    element.querySelector<HTMLElement>(".swa-link-marker")!.click();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((item) => item.textContent?.trim() === "Rename…")!.click();
    // (Opened once the link is found in the page, its text as written now)
    const dialog = await vi.waitFor(() => {
      const shown = document.querySelector<HTMLElement>(".swa-rename-window");
      if (!shown) throw new Error("no Rename dialog yet");
      return shown;
    });
    expect([field(dialog, "Text").value, field(dialog, "File name").value]).toEqual(["the report", "report"]);
    typed(field(dialog, "Text"), "the numbers");
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => expect(texts).toEqual(["[[report.pdf|the report]] 0/1: the numbers"]));
  });
});

describe("a link's menu", () => {
  it("stays open as the links are decorated again with the same (the files drawn again for a type registered), its arrow the same", async () => {
    const { decorator } = setUp("See [[report.pdf]] here.\n");
    const element = Object.assign(document.createElement("a"), { textContent: "report.pdf", href: "report.pdf" });
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "report.pdf", style: "wiki" }]);
    const arrow = element.querySelector<HTMLElement>(".swa-link-marker")!;
    arrow.click();
    expect(document.querySelector(".swa-popup")).not.toBeNull();
    await decorator.redecorateAll();
    expect(element.querySelector(".swa-link-marker")).toBe(arrow);
    expect(document.querySelector(".swa-popup")).not.toBeNull();
  });

  it("opens from its arrow after the link was out of the page as others were decorated, and back (a grid's cell taken over)", async () => {
    const { decorator } = setUp("See [[report.pdf]] and [[other.pdf]] here.\n");
    const cell = document.createElement("div");
    const element = Object.assign(document.createElement("a"), { textContent: "report.pdf", href: "report.pdf" });
    let followed = 0;
    element.addEventListener("click", () => followed++);
    cell.append(element);
    document.body.append(cell);
    await decorator.decorateLinks([{ element, target: "report.pdf", style: "wiki" }]);
    cell.remove();
    const other = Object.assign(document.createElement("a"), { textContent: "other.pdf", href: "other.pdf" });
    document.body.append(other);
    await decorator.decorateLinks([{ element: other, target: "other.pdf", style: "wiki" }]);
    document.body.append(cell);
    element.querySelector<HTMLElement>(".swa-link-marker")!.click();
    expect(document.querySelector(".swa-popup")).not.toBeNull();
    expect(followed).toBe(0);
  });

  it("keeps its arrow as a type registered replaces the link's own, its menu opened by it as of that type", async () => {
    const { registry, decorator } = setUp("See [[report.pdf]] here.\n");
    const element = Object.assign(document.createElement("a"), { textContent: "report.pdf", href: "report.pdf" });
    let followed = 0;
    element.addEventListener("click", () => followed++);
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "report.pdf", style: "wiki" }]);
    const arrow = element.querySelector<HTMLElement>(".swa-link-marker")!;
    registry.types.register({ name: "pdf", match: { kind: ["file"], ext: ["pdf"] }, icon: "<svg class='own-pdf'/>" } as AssetType);
    await decorator.redecorateAll();
    // (The same element: a press on it as it is decorated again stays its own)
    expect(element.querySelectorAll(".swa-link-marker")).toHaveLength(1);
    expect(element.querySelector(".swa-link-marker")).toBe(arrow);
    expect(element.querySelector(".own-pdf")).not.toBeNull();
    arrow.click();
    expect(document.querySelector(".swa-popup")).not.toBeNull();
    expect(followed).toBe(0);
  });

  it("offers an image's preview, as an embed of it has one (the browser's drawing, smaller), and writes the embed shown so", async () => {
    const { state, decorator } = setUp("See [[cat.png]] here.\n");
    const element = Object.assign(document.createElement("a"), { textContent: "cat.png", href: "cat.png" });
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "cat.png", style: "wiki" }]);
    element.querySelector<HTMLElement>(".swa-link-marker")!.click();
    const preview = [...document.querySelectorAll<HTMLButtonElement>(".swa-popup .swa-segment")].find((one) => one.getAttribute("aria-label")?.startsWith("Preview"))!;
    expect(preview.getAttribute("aria-disabled")).not.toBe("true");
    preview.click();
    await vi.waitFor(() => expect(state.forms).toEqual(["embed [[cat.png]] 0/1"]));
  });

  it("opens from the arrow after it with what can be done with the file, the link's own click not followed; its icon a picture alone", async () => {
    const { state, decorator } = setUp("");
    const element = Object.assign(document.createElement("a"), { textContent: "report.pdf", href: "report.pdf" });
    let followed = 0;
    element.addEventListener("click", () => followed++);
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "report.pdf", style: "wiki" }]);
    // (Its icon part of the link: a click on it follows the link, as on its text; no menu)
    element.querySelector<HTMLElement>(".swa-link-icon")!.click();
    expect([document.querySelector(".swa-popup"), followed]).toEqual([null, 1]);
    const arrow = element.querySelector<HTMLElement>(".swa-link-marker")!;
    arrow.click();
    expect(followed).toBe(1);
    // Its row: a link the way it is shown, an embed of each view a choice
    expect(showAsRow()).toEqual([
      ["Link", "true"],
      ["Card", "false"],
      ["Preview", "false"],
      ["Full (default)", "false"],
    ]);
    const items = [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")];
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Open in a new tab", "Open in side panel", "Open enlarged", "Copy markdown", "Download"]);
    items[0]!.click();
    expect(state.opened).toEqual([".fs/report.pdf"]);
    // Shown in the side panel: the file's viewer, as the browser draws a PDF
    arrow.click();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")][1]!.click();
    await vi.waitFor(() => expect(document.querySelector(".swa-side-panel object")?.getAttribute("data")).toBe(".fs/report.pdf"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
});

describe("an asset's width, as Silverware Layout's widget", () => {
  it("is read in pixels or a share from its embed, written there (its height taken off)", async () => {
    const { assetProvider } = await import("./provider.ts");
    const { state, decorator } = setUp("![[cat.png|A cat|200x100]] ![[b.png|B|50%]] ![[c.zip]]");
    const [cat, half, zip] = [frame("cat.png"), frame("b.png"), frame("c.zip", false)];
    await decorator.decorate([cat!, half!, zip!]);
    const provider = assetProvider(decorator);
    expect(cat!.frame.matches(provider.selector)).toBe(true);
    expect(zip!.frame.matches(provider.selector)).toBe(false);
    expect(provider.read(cat!.frame)).toEqual({ width: "200" });
    // (A share, outside a grid's cell, left to SilverBullet as it reads it: no width of Layout's; in a cell, its own,
    // read in the grid's test)
    expect(provider.read(half!.frame)).toEqual({});
    await provider.write(cat!.frame, { width: "320" });
    expect(state.writes.at(-1)!.changes).toEqual({ width: "320", height: null });
    await provider.write(cat!.frame, { width: "75%" });
    expect(state.writes.at(-1)!.changes).toEqual({ width: "75%", height: null });
    Object.defineProperty(cat!.frame, "getBoundingClientRect", { value: () => ({ width: 412.4 }) });
    await provider.write(cat!.frame, { width: "full" });
    expect(state.writes.at(-1)!.changes).toEqual({ width: "412", height: null });
    await provider.write(cat!.frame, { width: null });
    expect(state.writes.at(-1)!.changes).toEqual({ width: null, height: null });
  });

  it("keeps where it stands in its embed's metadata, Silverware Layout's entry: read, written, taken off; its kinds Preview and Full", async () => {
    const { assetProvider } = await import("./provider.ts");
    const { state, decorator } = setUp("![[cat.png|||{ align: right }]]\n\n![[a.png|A|60x40|{ view: preview }]]");
    const [cat, a] = [frame("cat.png"), frame("a.png")];
    await decorator.decorate([cat, a]);
    const provider = assetProvider(decorator);
    expect(provider.read(cat.frame)).toEqual({ align: "right" });
    expect(provider.kinds!.map((kind) => [kind.id, kind.align])).toEqual([["preview", "left"], ["full", "left"]]);
    expect([provider.kindOf!(cat.frame), provider.kindOf!(a.frame)]).toEqual(["full", "preview"]);
    await provider.write(a.frame, { align: "center" });
    expect(state.writes.at(-1)!.changes).toEqual({ metadata: { align: "center" } });
    await provider.write(cat.frame, { align: null });
    expect(state.writes.at(-1)!.changes).toEqual({ metadata: { align: null } });
  });

  it("gives Silverware Layout a preview to place, not to widen (its size the settings'), a full file to widen; no card", async () => {
    const { assetProvider } = await import("./provider.ts");
    const { decorator } = setUp("![[a.png|A|60x40|{ view: preview }]]\n\n![[b.png|B|300]]\n\n![[c.zip]]");
    const [a, b, c] = [frame("a.png"), frame("b.png"), frame("c.zip", false)];
    await decorator.decorate([a, b, c]);
    const provider = assetProvider(decorator);
    expect([a, b, c].map((one) => one.frame.matches(provider.selector))).toEqual([true, true, false]);
    expect([provider.resizable!(a.frame), provider.resizable!(b.frame)]).toEqual([false, true]);
    expect([provider.read(a.frame), provider.read(b.frame)]).toEqual([{}, { width: "300" }]);
  });
});

describe("the same file outside a grid and in it", () => {
  it("finds a medium rendered outside the editor by its place, the host's widget among the embeds outside such a block", async () => {
    // The grid's embed after the one outside: the grid drawn (and decorated) first
    const text = "![[cat.png|A]]\n\n<grid>\n<cell>\n\n![[cat.png|A]]\n\n</cell>\n</grid>";
    const { state, decorator } = setUp(text);
    const inGrid = text.lastIndexOf("![[cat.png");
    state.ranges = [{ from: inGrid, to: inGrid + 14 }];
    const gridFrame = { ...frame("cat.png"), position: () => inGrid };
    await decorator.decorate([gridFrame]);
    const widget = frame("cat.png");
    await decorator.decorate([widget]);
    // A view chosen on each writes its own embed
    for (const [one, view] of [[gridFrame, 0], [widget, 1]] as const) {
      one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
      chooseShowAs(["Card", "Preview"][view]!);
    }
    await vi.waitFor(() => expect(state.writes).toHaveLength(2));
    expect(state.writes.map((write) => [write.occurrence, write.changes])).toEqual([
      [1, { metadata: { view: "card" } }],
      [0, { metadata: { view: "preview" } }],
    ]);
  });

  it("finds the editor's widget by where it is in the page where the one above it is not drawn (scrolled away)", async () => {
    // The same image at the top and at the end; only the one at the end drawn, far down the page
    const text = `![[cat.png]]\n\n${"Text.\n\n".repeat(50)}![[cat.png]]\n`;
    const { state, decorator } = setUp(text, {}, { placeOf: () => 0.95 });
    const bottom = frame("cat.png");
    await decorator.decorate([bottom]);
    bottom.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    chooseShowAs("Card");
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    // The second of the two
    expect(state.writes[0]!.occurrence).toBe(1);
  });

  it("takes the host's word for where a widget is where an embed of its file starts there, else finds it as without it", async () => {
    const text = "# Notes\n\n![[cat.png]]\n\nMiddle\n\n![[cat.png]]\n\n![[dog.png]]\n";
    const second = text.lastIndexOf("![[cat.png]]");
    const choose = async (positionOf: (element: HTMLElement) => number | undefined) => {
      document.body.replaceChildren();
      const { state, decorator } = setUp(text, {}, { positionOf, contextOf: () => ({ before: ["Notes"], after: ["Middle"] }) });
      const one = frame("cat.png");
      await decorator.decorate([one]);
      one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
      chooseShowAs("Card");
      await vi.waitFor(() => expect(state.writes).toHaveLength(1));
      return state.writes[0]!.occurrence;
    };
    // Its word: the second, though the text around says the first
    expect(await choose(() => second)).toBe(1);
    // A place where no embed of its file starts (another file's, none): not taken, the text around decides
    expect(await choose(() => text.indexOf("![[dog.png]]"))).toBe(0);
    expect(await choose(() => 5)).toBe(0);
    expect(await choose(() => undefined)).toBe(0);
  });

  it("finds the editor's widget by the text drawn around it, over where it seems to be in the page", async () => {
    const text = "# Notes\n\n![[cat.png]]\n\nMiddle\n\n![[cat.png]]\n\nThe end\n";
    const { state, decorator } = setUp(text, {}, { placeOf: () => 0.05, contextOf: () => ({ before: ["Middle"], after: ["The end"] }) });
    const one = frame("cat.png");
    await decorator.decorate([one]);
    one.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    chooseShowAs("Card");
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    // The second, whose lines around it are those drawn, though its place says the top
    expect(state.writes[0]!.occurrence).toBe(1);
  });

  it("writes the editor's widget to its embed as the page is now, after the same file's in a grid was written", async () => {
    // Both read alike at first (one text twice); then the grid's written its view, the page's not drawn again
    const before = "![[cat.png]]\n\n<grid>\n<cell>\n\n![[cat.png]]\n\n</cell>\n</grid>";
    const { state, decorator } = setUp(before);
    const inGrid = before.lastIndexOf("![[cat.png");
    state.ranges = [{ from: before.indexOf("<grid>"), to: before.length }];
    const gridFrame = { ...frame("cat.png"), position: () => inGrid };
    const widget = frame("cat.png");
    await decorator.decorate([gridFrame, widget]);
    state.text = before.replace("\n\n![[cat.png]]\n\n</cell>", "\n\n![[cat.png|||{ view: card }]]\n\n</cell>");
    widget.frame.querySelector<HTMLButtonElement>(".swa-more")!.click();
    chooseShowAs("Preview");
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    // Its text now once in the page: the first of one, not of two (which the page writer would refuse as changed)
    expect(state.writes.map((write) => [write.text, write.occurrence, write.of])).toEqual([["![[cat.png]]", 0, 1]]);
    expect(state.problems).toEqual([]);
  });

  it("leaves a medium rendered outside the editor whose place is not known yet", async () => {
    const { decorator } = setUp("![[cat.png]]");
    const unplaced = { ...frame("cat.png"), position: () => undefined };
    await decorator.decorate([unplaced]);
    expect(unplaced.frame.hasAttribute("data-swa-type")).toBe(false);
  });
});

describe("links to files decorated", () => {
  const link = (target: string) => {
    const element = Object.assign(document.createElement("a"), { textContent: target });
    document.body.append(element);
    return { element, target, style: "wiki" as const };
  };

  it("give a link to a file its type's icon before its text and its menu's arrow after it, once each, none to a page; the icon hidden where the user hides it", async () => {
    const { decorator } = setUp("");
    const pdf = link("report.pdf");
    const page = link("Notes");
    await decorator.decorateLinks([pdf, page]);
    expect(pdf.element.getAttribute("data-swa-link")).toBe("pdf");
    expect(pdf.element.firstElementChild?.classList.contains("swa-link-icon")).toBe(true);
    expect(pdf.element.lastElementChild?.classList.contains("swa-link-marker")).toBe(true);
    expect(pdf.element.textContent).toBe("report.pdf");
    expect(page.element.querySelector(".swa-link-icon")).toBeNull();
    await decorator.decorateLinks([pdf]);
    expect(pdf.element.querySelectorAll(".swa-link-icon")).toHaveLength(1);
    const { decorator: off } = setUp("", { link: { fields: [] } });
    const plain = link("report.pdf");
    await off.decorateLinks([plain]);
    expect(plain.element.querySelector(".swa-link-icon")).toBeNull();
    // (Its menu's way in: last, after the text, a button of its own; decorated again, still one)
    expect(plain.element.lastElementChild?.classList.contains("swa-link-marker")).toBe(true);
    expect(plain.element.lastElementChild?.getAttribute("role")).toBe("button");
    expect(plain.element.textContent).toBe("report.pdf");
    await off.decorateLinks([plain]);
    expect(plain.element.querySelectorAll(".swa-link-marker")).toHaveLength(1);
    // Its menu, from the arrow
    (plain.element.lastElementChild as HTMLElement).click();
    expect([...document.querySelectorAll(".swa-popup .swa-menu-item")].map((item) => item.textContent?.trim())).toContain("Open in a new tab");
    document.body.click();
  });
});

describe("a link shown as embedded", () => {
  // (The link's menu, a view chosen in its row: an embed of the settings' own, as Show as embedded wrote)
  const showAsEmbedded = (icon: HTMLElement) => {
    icon.click();
    chooseShowAs("Full");
  };

  it("writes the link it is: one in the editor by its order among those drawn of its target, outside what is rendered outside the editor", async () => {
    const text = "[[a.pdf]] then <grid> [[a.pdf]] </grid> and [[a.pdf]]";
    const { state, decorator } = setUp(text);
    state.ranges = [{ from: text.indexOf("<grid>"), to: text.indexOf("</grid>") }];
    const drawn = [0, 1].map(() => {
      const element = Object.assign(document.createElement("a"), { textContent: "a.pdf" });
      document.body.append(element);
      return { element, target: "a.pdf", style: "wiki" as const };
    });
    await decorator.decorateLinks(drawn);
    showAsEmbedded(drawn[1]!.element.querySelector(".swa-link-marker")!);
    // The second drawn in the editor: the page's third link (the grid's is none of the editor's)
    await vi.waitFor(() => expect(state.forms).toEqual(["embed [[a.pdf]] 2/3"]));
  });

  it("writes one rendered outside the editor by its place", async () => {
    const text = "[[a.pdf]] then [[a.pdf]]";
    const { state, decorator } = setUp(text);
    const element = Object.assign(document.createElement("a"), { textContent: "a.pdf" });
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "a.pdf", style: "wiki", position: () => text.lastIndexOf("[[") }]);
    showAsEmbedded(element.querySelector(".swa-link-marker")!);
    await vi.waitFor(() => expect(state.forms).toEqual(["embed [[a.pdf]] 1/2"]));
  });
});


describe("a card's menu", () => {
  it("opens from a small arrow after the card's name, no \"…\" over it, its icon a picture alone; a click on the card still runs its action", async () => {
    const { state, decorator } = setUp("![[archive.zip]]");
    const one = frame("archive.zip", false);
    await decorator.decorate([one]);
    expect(one.frame.querySelector(".swa-more")).toBeNull();
    // (Its icon's click the card's own: the file opened, no menu)
    one.frame.querySelector<HTMLElement>(".swa-card .swa-icon")!.click();
    expect([document.querySelector(".swa-popup"), state.opened]).toEqual([null, [".fs/archive.zip"]]);
    state.opened.length = 0;
    const icon = one.frame.querySelector<HTMLElement>(".swa-card > .swa-menu-marker:last-child")!;
    icon.click();
    // (Its row: a card the way it is shown; full, which a zip has none of, not to be chosen)
    expect(showAsRow().map(([name, on]) => `${name} ${on}`)).toEqual(["Link false", "Card true", "Preview false", "Full (default) false"]);
    expect([...document.querySelectorAll<HTMLButtonElement>(".swa-popup .swa-segment")].at(-1)!.getAttribute("aria-disabled")).toBe("true");
    expect([...document.querySelectorAll(".swa-popup .swa-menu-item")].map((item) => item.textContent?.trim())).toContain("Open in a new tab");
    // (The arrow's click the menu's alone: no file opened by it)
    expect(state.opened).toEqual([]);
    icon.click();
    one.frame.querySelector<HTMLElement>(".swa-card-name")!.click();
    expect(state.opened).toEqual([".fs/archive.zip"]);
  });

  it("opens, where the card shows no icon, from a small arrow after its name within the card (no \"…\" beside it, cut off where the card fills its line)", async () => {
    const { state, decorator } = setUp("![[archive.zip]]", { card: { fields: ["name"] } });
    const one = frame("archive.zip", false);
    await decorator.decorate([one]);
    expect(one.frame.querySelector(".swa-more")).toBeNull();
    const marker = one.frame.querySelector<HTMLElement>(".swa-card > .swa-menu-marker:last-child")!;
    expect(marker.getAttribute("role")).toBe("button");
    marker.click();
    expect([...document.querySelectorAll(".swa-popup .swa-menu-item")].map((item) => item.textContent?.trim())).toContain("Open in a new tab");
    // (Its click the menu's alone; the card's name still the card's action)
    expect(state.opened).toEqual([]);
    marker.click();
    one.frame.querySelector<HTMLElement>(".swa-card-name")!.click();
    expect(state.opened).toEqual([".fs/archive.zip"]);
  });
});

describe("Download", () => {
  it("is a click's action too, as the settings give it: the file saved under its own name", async () => {
    const { decorator } = setUp("![[Docs/archive.zip|The archive]]", { actions: { default: { click: "download" } } });
    const one = frame("Docs/archive.zip", false);
    await decorator.decorate([one]);
    const saved: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(`${this.download} ${this.getAttribute("href")}`);
    });
    try {
      one.frame.querySelector<HTMLElement>(".swa-card")!.click();
      await vi.waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]).toMatch(/^archive\.zip .*Docs\/archive\.zip$/);
    } finally {
      click.mockRestore();
    }
  });

  it("saves a file under its path's last part, not its alt text", async () => {
    const { downloadName } = await import("./builtin/actions.ts");
    expect(downloadName({ kind: "file", path: "Docs/My%20report.pdf", url: ".fs/Docs/My%20report.pdf" })).toBe("My report.pdf");
    expect(downloadName({ kind: "web", url: "https://example.com/a/b.pdf?x=1#p" })).toBe("b.pdf");
    expect(downloadName({ kind: "web", url: "https://example.com/" })).toBe("download");
  });
});

describe("another plugin's files (the API's drawPreview, showFile, deleteFiles)", () => {
  const box = { width: 84, height: 28 };

  it("draws an image as the browser does, nothing for a file no type previews, and nothing once aborted", async () => {
    const { decorator } = setUp("");
    const image = await decorator.drawPreview("Photos/cat.png", "Notes/Page", box, new AbortController().signal);
    expect(image?.localName).toBe("img");
    expect(image?.getAttribute("src")).toBe(".fs/Photos/cat.png");
    // (No frame, label nor menu: the element alone, the caller's to place)
    expect(image?.closest(".swa-frame")).toBeNull();
    expect(await decorator.drawPreview("archive.zip", "Notes/Page", box, new AbortController().signal)).toBeNull();
    expect(await decorator.drawPreview("notes.txt", "Notes/Page", box, new AbortController().signal)).toBeNull();
    expect(await decorator.drawPreview("  ", "Notes/Page", box, new AbortController().signal)).toBeNull();
    const control = new AbortController();
    control.abort();
    expect(await decorator.drawPreview("cat.png", "Notes/Page", box, control.signal)).toBeNull();
  });

  it("draws a type's preview that keeps one in the space only from the one kept, in the box given; none kept, none made", async () => {
    const times: Record<string, number> = { "kept.pdf": 1, "_silverware-assets-previews/kept.pdf.1-1.webp": 2, "new.pdf": 1 };
    const previewFiles = {
      facts: async (path: string) => (path in times ? { modified: times[path]!, size: 1 } : undefined),
      read: async (path: string) => (path in times ? new Uint8Array([1]) : undefined),
      write: async () => undefined,
      remove: async () => undefined,
    };
    const { registry, decorator } = setUp("", {}, { previewFiles });
    const given: { width: number; height: number; kept: string }[] = [];
    registry.types.register({
      name: "pdf",
      match: { kind: ["file"], ext: ["pdf"] },
      icon: "<svg/>",
      storesPreview: true,
      views: {
        preview: async (context) => {
          given.push({ width: context.viewport.width, height: context.viewport.height, kept: (await context.stored?.read("image/webp"))?.type ?? "none" });
          return Object.assign(document.createElement("div"), { className: "test-kept" });
        },
      },
    } as AssetType);
    const drawn = await decorator.drawPreview("kept.pdf", "Notes/Page", box, new AbortController().signal);
    expect(drawn?.className).toBe("test-kept");
    expect(given).toEqual([{ width: 84, height: 28, kept: "image/webp" }]);
    expect(await decorator.drawPreview("new.pdf", "Notes/Page", box, new AbortController().signal)).toBeNull();
    expect(given).toHaveLength(1);
    // Previews not kept, as the settings say: none drawn
    const { registry: offRegistry, decorator: off } = setUp("", { storePreviews: false }, { previewFiles });
    offRegistry.types.register({ name: "pdf", match: { kind: ["file"], ext: ["pdf"] }, icon: "<svg/>", storesPreview: true, views: { preview: () => document.createElement("div") } } as AssetType);
    expect(await off.drawPreview("kept.pdf", "Notes/Page", box, new AbortController().signal)).toBeNull();
  });

  it("draws nothing of a type costly to draw that keeps no preview, nor where its renderer fails", async () => {
    const { registry, decorator } = setUp("");
    registry.types.register({ name: "sheet", match: { kind: ["file"], ext: ["xlsx"] }, icon: "<svg/>", costly: true, views: { preview: () => document.createElement("div") } } as AssetType);
    registry.types.register({ name: "broken", match: { kind: ["file"], ext: ["bad"] }, icon: "<svg/>", views: { preview: () => Promise.reject(new Error("no")) } } as AssetType);
    expect(await decorator.drawPreview("a.xlsx", "P", box, new AbortController().signal)).toBeNull();
    expect(await decorator.drawPreview("a.bad", "P", box, new AbortController().signal)).toBeNull();
  });

  it("shows a file in the side panel, the one before ended; a file no panel draws opened in a tab", async () => {
    const { state, decorator } = setUp("");
    decorator.showFile("Photos/cat.png", "Notes/Page");
    await vi.waitFor(() => expect(document.querySelector(".swa-side-panel .swa-panel-body img")?.getAttribute("src")).toBe(".fs/Photos/cat.png"));
    decorator.showFile("dog.png", "Notes/Page");
    await vi.waitFor(() => expect(document.querySelector(".swa-side-panel .swa-panel-body img")?.getAttribute("src")).toBe(".fs/dog.png"));
    expect(document.querySelectorAll(".swa-side-panel")).toHaveLength(1);
    decorator.showFile("archive.zip", "Notes/Page");
    expect(state.opened).toEqual([".fs/archive.zip"]);
    expect(state.problems).toEqual([]);
  });

  it("ends a file's drawing in the side panel as the panel closes: shown for another plugin, or from an embed's menu", async () => {
    const { registry, decorator } = setUp("![[a.swatest]]\n", { views: { types: { swatest: "card" } } });
    const signals: AbortSignal[] = [];
    registry.types.register({
      name: "swatest",
      match: { kind: ["file"], ext: ["swatest"] },
      icon: "<svg/>",
      views: { full: (context) => (signals.push(context.signal), Object.assign(document.createElement("div"), { className: "test-full" })) },
    } as AssetType);
    decorator.showFile("a.swatest", "Notes/Page");
    await vi.waitFor(() => expect(document.querySelector(".swa-side-panel .test-full")).not.toBeNull());
    expect(signals[0]!.aborted).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".swa-side-panel")).toBeNull();
    expect(signals[0]!.aborted).toBe(true);
    // From an embed's menu: its panel's end, not the embed's (still drawn in the page)
    const one = frame("a.swatest", false);
    await decorator.decorate([one]);
    await vi.waitFor(() => expect(one.frame.querySelector(".swa-card [role=button]")).not.toBeNull());
    one.frame.querySelector<HTMLElement>(".swa-card [role=button]")!.click();
    [...document.querySelectorAll<HTMLElement>(".swa-popup .swa-menu-item")].find((item) => item.textContent?.trim() === "Open in side panel")!.click();
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[1]!.aborted).toBe(false);
    document.querySelector<HTMLButtonElement>(".swa-side-panel .swa-panel-close")!.click();
    expect(signals[1]!.aborted).toBe(true);
    expect(one.frame.querySelector(".swa-card")).not.toBeNull();
  });

  it("deletes files with their kept previews, nothing asked, and gives back those not deleted; none where the host deletes no file", async () => {
    const kept: Record<string, true> = { "_silverware-assets-previews/a.pdf.5-3.webp": true };
    const there = new Set(["a.pdf", "b.png"]);
    let asked = 0;
    const { decorator } = setUp("", {}, {
      confirm: async () => (asked++, true),
      deleteFile: async (path) => (there.delete(path) ? undefined : "no such file"),
      previewFiles: {
        facts: async (path) => (there.has(path) ? { modified: 5, size: 3 } : kept[path] ? { modified: 1, size: 1 } : undefined),
        read: async () => undefined,
        write: async () => undefined,
        remove: async (path) => void delete kept[path],
      },
    });
    expect(await decorator.deleteFiles(["a.pdf", "gone.pdf", "b.png"])).toEqual(["gone.pdf"]);
    expect([...there]).toEqual([]);
    expect(Object.keys(kept)).toEqual([]);
    expect(asked).toBe(0);
    const { decorator: none } = setUp("");
    expect(await none.deleteFiles(["a.pdf"])).toEqual(["a.pdf"]);
  });
});
