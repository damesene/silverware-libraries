// @vitest-environment jsdom
// Embedded media decorated over a host of memory: frames as SilverBullet draws an embed (an <img> of `.fs/<path>`, or
// "Unsupported content"), the page's text kept here. No SilverBullet is needed to find an embed drawn in the page,
// choose its view and run a click's action.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssetType } from "../../../shared/assets.ts";
import { readEmbeds } from "../../../shared/markdown/embed.ts";
import { registerBuiltins } from "./builtin/index.ts";
import { AssetRegistry } from "./core/registry.ts";
import { AssetDecorator, type AssetHost, type DrawnEmbed, type EmbedWrite } from "./decorate.ts";
import { type AssetSettings, readAssetSettings } from "./model/settings.ts";

function setUp(text: string, settings: unknown = {}) {
  const state = { text, opened: [] as string[], writes: [] as EmbedWrite[], forms: [] as string[], problems: [] as string[], ranges: [] as { from: number; to: number }[] };
  const host: AssetHost = {
    watch: () => undefined,
    renderedRanges: () => state.ranges,
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

describe("embedded media decorated", () => {
  it("leaves an image as the host drew it, its type and view marked", async () => {
    const { decorator } = setUp("![[cat.png|A cat|200]]");
    const one = frame("cat.png");
    await decorator.decorate([one]);
    expect(one.frame.getAttribute("data-swl-asset")).toBe("image");
    expect(one.frame.getAttribute("data-swl-asset-view")).toBe("embed");
    expect(one.native!.classList.contains("swl-asset-native-hidden")).toBe(false);
  });

  it("shows a file the host cannot draw as a card, its click opening it in a tab", async () => {
    const { state, decorator } = setUp("![[Docs/archive.zip]]");
    const one = frame("Docs/archive.zip", false);
    await decorator.decorate([one]);
    expect(one.frame.getAttribute("data-swl-asset-view")).toBe("icon");
    const card = one.frame.querySelector<HTMLElement>(".swl-asset-card")!;
    expect(card.textContent).toBe("archive.zip");
    expect(card.querySelector("svg")).not.toBeNull();
    // The host's words that it could not draw it: hidden behind the card
    expect(one.frame.querySelector(".p")!.classList.contains("swl-asset-native-hidden")).toBe(true);
    card.click();
    expect(state.opened).toEqual([".fs/Docs/archive.zip"]);
  });

  it("shows a file's size and date on its card where the user shows them, as the host tells them", async () => {
    const { decorator } = setUp("![[archive.zip]]", { card: ["icon", "name", "size", "modified"] });
    const one = frame("archive.zip", false);
    await decorator.decorate([one]);
    await vi.waitFor(() => expect(one.frame.querySelector(".swl-asset-card-meta")).not.toBeNull());
    expect(one.frame.querySelector(".swl-asset-card-size")!.textContent).toBe("2.5 MB");
    expect(one.frame.querySelector(".swl-asset-card-modified")!.textContent).toMatch(/2026/);
    // Not shown where the user shows them not
    const { decorator: plain } = setUp("![[archive.zip]]");
    const other = frame("archive.zip", false);
    await plain.decorate([other]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(other.frame.querySelector(".swl-asset-card-meta")).toBeNull();
  });

  it("takes the embed's own view, then the user's per type, the second of two alike by its order", async () => {
    const { decorator } = setUp("![[cat.png]] ![[cat.png|||{ view: icon }]]", { views: { types: { image: "preview" } } });
    const [first, second] = [frame("cat.png"), frame("cat.png")];
    await decorator.decorate([first!, second!]);
    expect(first!.frame.getAttribute("data-swl-asset-view")).toBe("preview");
    expect(second!.frame.getAttribute("data-swl-asset-view")).toBe("icon");
    expect(second!.native!.classList.contains("swl-asset-native-hidden")).toBe(true);
  });

  it("draws a type's own preview, and where it fails the host's drawing with an error mark", async () => {
    const { registry, decorator } = setUp("![[a.pdf|||{ view: preview }]] ![[b.png|||{ view: preview }]]");
    registry.types.register({ name: "image", match: { kind: ["file"], mime: "image/*" }, icon: "<svg/>", views: { preview: () => { throw new Error("no thumbnail"); } } } as AssetType);
    const pdf = frame("a.pdf");
    const png = frame("b.png");
    // (jsdom lays nothing out: the frame's width as a browser would give it)
    Object.defineProperty(pdf.frame, "clientWidth", { value: 600 });
    await decorator.decorate([pdf, png]);
    await vi.waitFor(() => expect(pdf.frame.querySelector(".swl-asset-pdf")).not.toBeNull());
    expect(pdf.native!.classList.contains("swl-asset-native-hidden")).toBe(true);
    await vi.waitFor(() => expect(png.frame.querySelector(".swl-asset-failed")).not.toBeNull());
    expect(png.frame.querySelector(".swl-asset-failed")!.getAttribute("title")).toBe("no thumbnail");
    expect(png.native!.classList.contains("swl-asset-native-hidden")).toBe(false);
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
        embed: (context) => {
          expect(context.metadata.number("zoom")).toBe(2);
          written = context.metadata.write({ zoom: 3 });
          refused = context.metadata.write({ view: "icon" });
          return document.createElement("canvas");
        },
      },
    });
    const one = frame("a.thing", false);
    await decorator.decorate([one]);
    await vi.waitFor(() => expect(one.frame.querySelector("canvas")).not.toBeNull());
    await written;
    expect(await refused).toBe('"view" is Silverware Layout\'s own key');
    expect(state.writes).toEqual([{ text: readEmbeds(state.text)[0]!.text, occurrence: 0, of: 1, changes: { metadata: { zoom: "3" } } }]);
  });
});

describe("an asset's menu", () => {
  it("shows its views, the one shown checked, writes the one chosen, the settings' own as none", async () => {
    const { state, decorator } = setUp("![[cat.png|A cat|200]]", { views: { types: { image: "embed" } } });
    const one = frame("cat.png");
    await decorator.decorate([one]);
    const more = one.frame.querySelector<HTMLButtonElement>(".swl-asset-more")!;
    more.click();
    const items = [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")];
    expect(items.map((item) => [item.textContent?.trim(), item.getAttribute("aria-checked")])).toEqual([
      ["Show as a card", "false"],
      ["Show as a preview", "false"],
      ["Show as the original", "true"],
      ["Open in a new tab", null],
      ["Show in a side panel", null],
      ["Show enlarged", null],
      ["Show as a link", null],
    ]);
    items[0]!.click();
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    expect(state.writes[0]!.changes).toEqual({ metadata: { view: "icon" } });
    expect(document.querySelector(".swl-asset-menu-holder")).toBeNull();
    more.click();
    [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")][2]!.click();
    await vi.waitFor(() => expect(state.writes).toHaveLength(2));
    expect(state.writes[1]!.changes).toEqual({ metadata: { view: null } });
    // Shown as a link: the embed written as one
    more.click();
    [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")].at(-1)!.click();
    await vi.waitFor(() => expect(state.forms).toEqual(["link ![[cat.png|A cat|200]] 0/1"]));
  });
});

describe("a link's menu", () => {
  it("opens from its icon with what can be done with the file, the link's own click not followed", async () => {
    const { state, decorator } = setUp("");
    const element = Object.assign(document.createElement("a"), { textContent: "report.pdf", href: "report.pdf" });
    let followed = 0;
    element.addEventListener("click", () => followed++);
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "report.pdf", style: "wiki" }]);
    const icon = element.querySelector<HTMLElement>(".swl-asset-link-icon")!;
    icon.click();
    expect(followed).toBe(0);
    const items = [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")];
    expect(items.map((item) => item.textContent?.trim())).toEqual(["Open in a new tab", "Show in a side panel", "Show enlarged", "Show as embedded"]);
    items[0]!.click();
    expect(state.opened).toEqual([".fs/report.pdf"]);
    // Shown in the side panel: the file's viewer, as the browser draws a PDF
    icon.click();
    [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")][1]!.click();
    await vi.waitFor(() => expect(document.querySelector(".swl-asset-peek object")?.getAttribute("data")).toBe(".fs/report.pdf"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
});

describe("an asset's width, as Silverware Layout's widget", () => {
  it("is read in pixels from its embed, written there (its height taken off), staying at the start by default", async () => {
    const { assetProvider } = await import("./provider.ts");
    const { state, decorator } = setUp("![[cat.png|A cat|200x100]] ![[b.png|B|50%]] ![[c.zip]]");
    const [cat, half, zip] = [frame("cat.png"), frame("b.png"), frame("c.zip", false)];
    await decorator.decorate([cat!, half!, zip!]);
    const provider = assetProvider(decorator);
    expect(cat!.frame.matches(provider.selector)).toBe(true);
    expect(zip!.frame.matches(provider.selector)).toBe(false);
    expect(provider.read(cat!.frame)).toEqual({ width: "200" });
    expect(provider.read(half!.frame)).toEqual({});
    expect(provider.anchor!(cat!.frame)).toBe("start");
    await provider.write(cat!.frame, { width: "320" });
    expect(state.writes.at(-1)!.changes).toEqual({ width: "320", height: null });
    Object.defineProperty(cat!.frame, "getBoundingClientRect", { value: () => ({ width: 412.4 }) });
    await provider.write(cat!.frame, { width: "full" });
    expect(state.writes.at(-1)!.changes).toEqual({ width: "412", height: null });
    await provider.write(cat!.frame, { width: null });
    expect(state.writes.at(-1)!.changes).toEqual({ width: null, height: null });
  });

  it("is centred where the user sets it so", async () => {
    const { assetProvider } = await import("./provider.ts");
    const { decorator } = setUp("![[cat.png]]", { anchor: "center" });
    const cat = frame("cat.png");
    await decorator.decorate([cat]);
    expect(assetProvider(decorator).anchor!(cat.frame)).toBe("center");
  });
});

describe("the same file outside a grid and in it", () => {
  it("finds a medium rendered outside the editor by its place, the host's widget among the embeds outside such a block", async () => {
    // The grid's embed after the one outside: the grid drawn (and decorated) first
    const text = "![[cat.png|A]]\n\n<grid>\n<column>\n\n![[cat.png|A]]\n\n</column>\n</grid>";
    const { state, decorator } = setUp(text);
    const inGrid = text.lastIndexOf("![[cat.png");
    state.ranges = [{ from: inGrid, to: inGrid + 14 }];
    const gridFrame = { ...frame("cat.png"), position: () => inGrid };
    await decorator.decorate([gridFrame]);
    const widget = frame("cat.png");
    await decorator.decorate([widget]);
    // A view chosen on each writes its own embed
    for (const [one, view] of [[gridFrame, 0], [widget, 1]] as const) {
      one.frame.querySelector<HTMLButtonElement>(".swl-asset-more")!.click();
      [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")][view]!.click();
    }
    await vi.waitFor(() => expect(state.writes).toHaveLength(2));
    expect(state.writes.map((write) => [write.occurrence, write.changes])).toEqual([
      [1, { metadata: { view: "icon" } }],
      [0, { metadata: { view: "preview" } }],
    ]);
  });

  it("leaves a medium rendered outside the editor whose place is not known yet", async () => {
    const { decorator } = setUp("![[cat.png]]");
    const unplaced = { ...frame("cat.png"), position: () => undefined };
    await decorator.decorate([unplaced]);
    expect(unplaced.frame.hasAttribute("data-swl-asset")).toBe(false);
  });
});

describe("links to files decorated", () => {
  const link = (target: string) => {
    const element = Object.assign(document.createElement("a"), { textContent: target });
    document.body.append(element);
    return { element, target, style: "wiki" as const };
  };

  it("give a link to a file its type's icon before its text, once, none to a page; none where the user shows none", async () => {
    const { decorator } = setUp("");
    const pdf = link("report.pdf");
    const page = link("Notes");
    await decorator.decorateLinks([pdf, page]);
    expect(pdf.element.getAttribute("data-swl-asset-link")).toBe("pdf");
    expect(pdf.element.firstElementChild?.classList.contains("swl-asset-link-icon")).toBe(true);
    expect(pdf.element.textContent).toBe("report.pdf");
    expect(page.element.querySelector(".swl-asset-link-icon")).toBeNull();
    await decorator.decorateLinks([pdf]);
    expect(pdf.element.querySelectorAll(".swl-asset-link-icon")).toHaveLength(1);
    const { decorator: off } = setUp("", { linkIcons: false });
    const plain = link("report.pdf");
    await off.decorateLinks([plain]);
    expect(plain.element.querySelector(".swl-asset-link-icon")).toBeNull();
  });
});

describe("a link shown as embedded", () => {
  const menuItem = (icon: HTMLElement, label: string) => {
    icon.click();
    [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")].find((item) => item.textContent?.trim() === label)!.click();
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
    menuItem(drawn[1]!.element.querySelector(".swl-asset-link-icon")!, "Show as embedded");
    // The second drawn in the editor: the page's third link (the grid's is none of the editor's)
    await vi.waitFor(() => expect(state.forms).toEqual(["embed [[a.pdf]] 2/3"]));
  });

  it("writes one rendered outside the editor by its place", async () => {
    const text = "[[a.pdf]] then [[a.pdf]]";
    const { state, decorator } = setUp(text);
    const element = Object.assign(document.createElement("a"), { textContent: "a.pdf" });
    document.body.append(element);
    await decorator.decorateLinks([{ element, target: "a.pdf", style: "wiki", position: () => text.lastIndexOf("[[") }]);
    menuItem(element.querySelector(".swl-asset-link-icon")!, "Show as embedded");
    await vi.waitFor(() => expect(state.forms).toEqual(["embed [[a.pdf]] 1/2"]));
  });
});

