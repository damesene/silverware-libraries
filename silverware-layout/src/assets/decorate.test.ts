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
  const state = { text, opened: [] as string[], writes: [] as EmbedWrite[], problems: [] as string[] };
  const host: AssetHost = {
    watch: () => undefined,
    pageText: async () => state.text,
    pageName: async () => "Notes/Page",
    resolved: (embed) => embed.target,
    assetOf: (embed) => ({ kind: "file", path: embed.target, url: `.fs/${embed.target}`, ...(embed.alt ? { alt: embed.alt } : {}) }),
    settings: async (): Promise<AssetSettings> => readAssetSettings(settings).settings,
    writeEmbed: async (write) => void state.writes.push(write),
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
