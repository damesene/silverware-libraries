import { describe, expect, it } from "vitest";
import { type Asset, type AssetAction, type AssetType, assetsOf, ASSETS_VERSION } from "../../../../shared/assets.ts";
import { registerBuiltins } from "../builtin/index.ts";
import { BUILTIN_TYPES } from "../builtin/types.ts";
import { DEFAULT_ASSET_SETTINGS, readAssetSettings } from "../model/settings.ts";
import { actionFor, extOf, mimeOf, typeFor, viewFor } from "./choose.ts";
import { AssetRegistry, validateAssetType } from "./registry.ts";

const file = (path: string, mime?: string): Asset => ({ kind: "file", path, url: `.fs/${path}`, ...(mime ? { mime } : {}) });

describe("an asset's type", () => {
  it("reads its extension and MIME type, the host's first", () => {
    expect(extOf(file("Pics/Cat.PNG"))).toBe("png");
    expect(extOf({ kind: "web", url: "https://x.dev/a.pdf?x=1#p" })).toBe("pdf");
    expect(mimeOf(file("a.png"))).toBe("image/png");
    expect(mimeOf(file("a.bin", "image/heic"))).toBe("image/heic");
    expect(mimeOf({ kind: "page", page: "P" })).toBe("");
  });

  it("is the most specific type matching, the later of those as specific; the built-in file takes the rest", () => {
    const photo: AssetType = { name: "photo", match: { kind: ["file"], ext: ["jpg"] }, icon: "" };
    const types = [...BUILTIN_TYPES, photo];
    expect(typeFor(types, file("a.png"))?.name).toBe("image");
    expect(typeFor(types, file("a.jpg"))?.name).toBe("photo");
    expect(typeFor(types, file("a.pdf"))?.name).toBe("pdf");
    expect(typeFor(types, file("a.zip"))?.name).toBe("file");
    expect(typeFor(types, { kind: "page", page: "P" })).toBeUndefined();
    const special: AssetType = { name: "special", match: { kind: ["file"], test: (asset) => asset.kind === "file" && asset.path.startsWith("Special/") }, icon: "" };
    expect(typeFor([...types, special], file("Special/a.jpg"))?.name).toBe("special");
  });
});

describe("the view and the action", () => {
  const { settings } = readAssetSettings({ views: { default: "preview", types: { pdf: "icon" } }, actions: { types: { image: { click: "popover" } } } });
  const all = () => true;

  it("takes the embed's own view, else the type's setting, else the default; one that cannot be drawn falls on", () => {
    expect(viewFor("embed", "pdf", settings, all)).toBe("embed");
    expect(viewFor(undefined, "pdf", settings, all)).toBe("icon");
    expect(viewFor(undefined, "image", settings, all)).toBe("preview");
    expect(viewFor("embed", "file", settings, (view) => view !== "embed" && view !== "preview")).toBe("icon");
    expect(viewFor("nonsense", undefined, settings, all)).toBe("preview");
  });

  it("runs the type's action where it fits, else the default's; none fitting: none", () => {
    const openTab: AssetAction = { name: "open-tab", fits: (asset) => "url" in asset, run: () => undefined };
    const popover: AssetAction = { name: "popover", fits: (_asset, can) => can.views.includes("embed"), run: () => undefined };
    const actions = (name: string) => ({ "open-tab": openTab, popover })[name];
    expect(actionFor("click", "image", settings, actions, file("a.png"), { views: ["icon", "preview", "embed"] })?.name).toBe("popover");
    expect(actionFor("click", "image", settings, actions, file("a.png"), { views: ["icon"] })?.name).toBe("open-tab");
    expect(actionFor("click", "page", settings, actions, { kind: "page", page: "P" }, { views: ["icon"] })).toBeUndefined();
  });
});

describe("the settings", () => {
  it("are the defaults where none are set, and say what they could not read", () => {
    expect(readAssetSettings(undefined)).toEqual({ settings: DEFAULT_ASSET_SETTINGS, problems: [] });
    const { settings, problems } = readAssetSettings({ views: { default: "huge", types: { pdf: "tiny", image: "icon" } }, card: ["name", "colour"], heights: { preview: -1, embed: 300 } });
    expect(settings.views).toEqual({ default: "embed", types: { image: "icon" } });
    expect(settings.card).toEqual(["name"]);
    expect(settings.heights).toEqual({ preview: 160, embed: 300 });
    expect(problems).toEqual(['"huge" is no view (icon, preview or embed)', '"tiny" is no view (icon, preview or embed), for pdf']);
  });
});

describe("the registry", () => {
  it("registers by name, replaces one of the same name, keeps another's over a built-in, unregisters its own", () => {
    const problems: string[] = [];
    const registry = new AssetRegistry((message) => problems.push(message));
    const mine: AssetType = { name: "image", match: { kind: ["file"], mime: "image/*" }, icon: "<svg/>" };
    const off = registry.api().types.register(mine);
    registerBuiltins(registry);
    expect(registry.types.get("image")).toBe(mine);
    expect(registry.types.get("pdf")?.name).toBe("pdf");
    expect(registry.actions.get("open-tab")?.name).toBe("open-tab");
    off();
    expect(registry.types.get("image")).toBeUndefined();
    registry.api().types.register({ name: "", match: { kind: ["file"] }, icon: "" } as AssetType);
    expect(problems).toEqual(["Silverware Layout: a type has no name; not registered"]);
  });

  it("says why a type is wrong", () => {
    expect(validateAssetType({ name: "x", match: { kind: [] }, icon: "" })).toBe("the type x matches no kind of asset");
    expect(validateAssetType({ name: "x", match: { kind: ["file"] }, icon: "", views: { big: () => null } })).toBe('the type x renders a view "big" (preview or embed only)');
  });

  it("is reached through assetsOf where its version is this, a stand-in else", () => {
    const registry = new AssetRegistry(() => undefined);
    expect(assetsOf(registry.api()).version).toBe(ASSETS_VERSION);
    const standIn = assetsOf({ version: 99 });
    expect(standIn.types.register(BUILTIN_TYPES[0]!)()).toBeUndefined();
  });
});
