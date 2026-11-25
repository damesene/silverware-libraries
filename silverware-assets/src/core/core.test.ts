import { describe, expect, it } from "vitest";
import { type Asset, type AssetAction, type AssetType, assetsOf, ASSETS_VERSION } from "../../../shared/assets.ts";
import { registerBuiltins } from "../builtin/index.ts";
import { BUILTIN_TYPES } from "../builtin/types.ts";
import { DEFAULT_ASSET_SETTINGS, DEFAULT_LABEL, fullHeight, insertAsFor, labelFor, previewSize, readAssetSettings, storedAssetSettings, validatePreviewFolder } from "../model/settings.ts";
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
    expect(typeFor(types, file("a.zip"))?.name).toBe("archive");
    expect(typeFor(types, file("backup.tar.gz"))?.name).toBe("archive");
    expect(typeFor(types, file("a.7z"))?.name).toBe("archive");
    expect(typeFor(types, file("a.bin"))?.name).toBe("file");
    expect(typeFor(types, { kind: "page", page: "P" })).toBeUndefined();
    const special: AssetType = { name: "special", match: { kind: ["file"], test: (asset) => asset.kind === "file" && asset.path.startsWith("Special/") }, icon: "" };
    expect(typeFor([...types, special], file("Special/a.jpg"))?.name).toBe("special");
  });
});

describe("the view and the action", () => {
  const { settings } = readAssetSettings({ views: { default: "preview", types: { pdf: "card" } }, actions: { types: { image: { click: "open-enlarged" } } } });
  const all = () => true;

  it("takes the embed's own view, else the type's setting, else the default; one that cannot be drawn falls on", () => {
    expect(viewFor("full", "pdf", settings, all)).toBe("full");
    expect(viewFor(undefined, "pdf", settings, all)).toBe("card");
    expect(viewFor(undefined, "image", settings, all)).toBe("preview");
    expect(viewFor("full", "file", settings, (view) => view !== "full" && view !== "preview")).toBe("card");
    expect(viewFor("nonsense", undefined, settings, all)).toBe("preview");
  });

  it("runs the type's action where it fits, else the default's; none fitting: none", () => {
    const openTab: AssetAction = { name: "open-tab", fits: (asset) => "url" in asset, run: () => undefined };
    const openEnlarged: AssetAction = { name: "open-enlarged", fits: (_asset, can) => can.views.includes("full"), run: () => undefined };
    const actions = (name: string) => ({ "open-tab": openTab, "open-enlarged": openEnlarged })[name];
    expect(actionFor("click", "image", settings, actions, file("a.png"), { views: ["card", "preview", "full"] })?.name).toBe("open-enlarged");
    expect(actionFor("click", "image", settings, actions, file("a.png"), { views: ["card"] })?.name).toBe("open-tab");
    expect(actionFor("click", "page", settings, actions, { kind: "page", page: "P" }, { views: ["card"] })).toBeUndefined();
  });
});

describe("the settings", () => {
  it("give a preview's size for a type: its own sides, else all files' (the width none: as wide as it fits)", () => {
    const { settings } = readAssetSettings({ preview: { height: 160, width: 300, types: { pdf: { height: 400 }, image: { width: 1, height: 120 }, video: "big" } } });
    expect(previewSize(settings, "pdf")).toEqual({ width: 300, height: 400 });
    // (A side out of bounds: none, all files' then)
    expect(previewSize(settings, "image")).toEqual({ width: 300, height: 120 });
    expect(previewSize(settings, "file")).toEqual({ width: 300, height: 160 });
    expect(previewSize(readAssetSettings({}).settings, "pdf")).toEqual({ height: 160 });
    // Kept and read back alike
    expect(readAssetSettings(storedAssetSettings(settings)).settings.preview).toEqual(settings.preview);
  });

  it("write the former settings as none, so a save takes their lines out of Library/Config: where a file stands, a view's before they were kept by view", () => {
    const stored = storedAssetSettings(readAssetSettings({}).settings);
    for (const key of ["originals", "anchor", "heights", "previews", "labels", "originalLabels", "linkIcons"]) expect(key in stored && stored[key] === undefined, key).toBe(true);
  });

  it("keep each view's own by view: a preview's and a full file's height and label, a card's and a link's fields, kept and read back", () => {
    const { settings } = readAssetSettings({ full: { height: 640, types: { pdf: { height: 900 }, xlsx: { height: 5 }, docx: "tall" }, labels: { default: { above: ["alt"] } } }, card: { fields: ["name", "size", "colour"] }, link: { fields: [] } });
    // A document's height shown full: a type's own (one out of bounds or no number: none), else all files'
    expect([fullHeight(settings, "pdf"), fullHeight(settings, "xlsx"), fullHeight(settings, "docx")]).toEqual([900, 640, 640]);
    expect([settings.full.height, labelFor(settings, "pdf", "full").above, settings.card.fields, settings.link.fields]).toEqual([640, [{ field: "alt", on: true }], ["name", "size"], []]);
    // (None given: a link shows its icon, a card its icon and name)
    expect([DEFAULT_ASSET_SETTINGS.link.fields, DEFAULT_ASSET_SETTINGS.card.fields]).toEqual([["icon"], ["icon", "name"]]);
    expect(readAssetSettings(storedAssetSettings(settings)).settings).toEqual(settings);
    // None shown, as Library/Config gives it back: an empty Lua table is an object, not a list
    const back = readAssetSettings({ card: { fields: {} }, link: { fields: {} } }).settings;
    expect([back.card.fields, back.link.fields]).toEqual([[], []]);
  });

  it("give a preview's label: the icon and the alt text above by default, a type's own whole, read leniently, kept and read back", () => {
    const defaults = readAssetSettings({}).settings;
    expect(labelFor(defaults, "pdf")).toEqual(DEFAULT_LABEL);
    expect(DEFAULT_LABEL.above.filter((part) => part.on).map((part) => part.field)).toEqual(["icon", "alt"]);
    const { settings } = readAssetSettings({
      preview: {
        labels: {
          default: { above: [{ field: "name", on: true }], below: [{ field: "size" }, "modified", { field: "colour" }, { field: "name", on: true }] },
          types: { pdf: { above: [], below: [{ field: "alt", on: true }] } },
        },
      },
    });
    // (A field's name alone, or one without `on`: on; one unknown dropped, one given twice kept where it is first, one missing added under it, off)
    expect(settings.preview.labels.default).toEqual({
      above: [{ field: "name", on: true }],
      below: [
        { field: "size", on: true },
        { field: "modified", on: true },
        { field: "icon", on: false },
        { field: "alt", on: false },
      ],
    });
    expect(labelFor(settings, "pdf")).toEqual({
      above: [],
      below: [
        { field: "alt", on: true },
        { field: "icon", on: false },
        { field: "name", on: false },
        { field: "size", on: false },
        { field: "modified", on: false },
      ],
    });
    expect(labelFor(settings, "image")).toBe(settings.preview.labels.default);
    expect(readAssetSettings(storedAssetSettings(settings)).settings.preview.labels).toEqual(settings.preview.labels);
  });

  it("are the defaults where none are set, and say what they could not read", () => {
    expect(readAssetSettings(undefined)).toEqual({ settings: DEFAULT_ASSET_SETTINGS, problems: [] });
    const { settings, problems } = readAssetSettings({ views: { default: "huge", types: { pdf: "tiny", image: "card" } }, card: { fields: ["name", "colour"] }, preview: { height: -1 }, full: { height: 300 } });
    expect(settings.views).toEqual({ default: "full", types: { image: "card" } });
    expect(settings.card.fields).toEqual(["name"]);
    expect([settings.preview.height, settings.full.height]).toEqual([160, 300]);
    expect(problems).toEqual(['"huge" is no view (card, preview or full)', '"tiny" is no view (card, preview or full), for pdf']);
  });

  it("keep previews in the folder given, its slashes at either end taken off; one SilverBullet cannot read, the default", () => {
    expect(readAssetSettings({ previewFolder: "/Files/previews/" }).settings.previewFolder).toBe("Files/previews");
    expect(readAssetSettings({ previewFolder: "previews" }).settings.previewFolder).toBe("previews");
    for (const folder of ["", "a//b", ".hidden", "a/../b", "pre:views"]) {
      const { settings, problems } = readAssetSettings({ previewFolder: folder });
      expect(settings.previewFolder, folder).toBe(DEFAULT_ASSET_SETTINGS.previewFolder);
      expect(problems, folder).toHaveLength(1);
    }
    expect(validatePreviewFolder("_silverware-assets-previews")).toBeUndefined();
  });

  it("insert files through the dialog unless turned off, each as shown unless set (a type's own over all files'), and say what they could not read", () => {
    expect(readAssetSettings({}).settings.insert).toEqual({ enabled: true, as: { default: "shown", types: {} } });
    const { settings, problems } = readAssetSettings({ insert: { enabled: false, as: { default: "link", types: { image: "preview", pdf: "huge" } } } });
    expect(settings.insert).toEqual({ enabled: false, as: { default: "link", types: { image: "preview" } } });
    expect(insertAsFor(settings, "image")).toBe("preview");
    expect(insertAsFor(settings, "zip")).toBe("link");
    expect(problems).toEqual(['"huge" is no way to insert a file (shown, link, card, preview or full), for pdf']);
    expect(readAssetSettings(storedAssetSettings(settings)).settings.insert).toEqual(settings.insert);
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
    expect(problems).toEqual(["Silverware Assets: a type has no name; not registered"]);
  });

  it("tells who listens as a type or an action is registered, replaced or taken off; not for one refused, nor one not registered any more", () => {
    const registry = new AssetRegistry(() => undefined);
    let told = 0;
    const stop = registry.onChange(() => told++);
    const pdf: AssetType = { name: "pdf", match: { kind: ["file"], ext: ["pdf"] }, icon: "<svg/>" };
    const off = registry.api().types.register(pdf);
    expect(told).toBe(1);
    registry.api().types.register({ ...pdf });
    expect(told).toBe(2);
    // (Replaced by another: its own taking off takes nothing)
    off();
    expect(told).toBe(2);
    registry.api().types.register({ name: "", match: { kind: ["file"] }, icon: "" } as AssetType);
    expect(told).toBe(2);
    stop();
    registry.api().types.register(pdf);
    expect(told).toBe(2);
  });

  it("gives the built-in type back as a plugin's of its name is taken off (Silverware Assets PDF's `pdf`: the browser's viewer again)", () => {
    const registry = new AssetRegistry(() => undefined);
    registerBuiltins(registry);
    const builtin = registry.types.get("pdf");
    expect(builtin?.views?.preview).toBeDefined();
    const plugin: AssetType = { name: "pdf", match: { kind: ["file"], ext: ["pdf"] }, icon: "<svg/>" };
    const off = registry.api().types.register(plugin);
    expect(registry.types.get("pdf")).toBe(plugin);
    off();
    expect(registry.types.get("pdf")).toBe(builtin);
  });

  it("says why a type is wrong", () => {
    expect(validateAssetType({ name: "x", match: { kind: [] }, icon: "" })).toBe("the type x matches no kind of asset");
    expect(validateAssetType({ name: "x", match: { kind: ["file"] }, icon: "", views: { big: () => null } })).toBe('the type x renders a view "big" (preview or full only)');
  });

  it("is reached through assetsOf where its version is this, a stand-in else", () => {
    const registry = new AssetRegistry(() => undefined);
    expect(assetsOf(registry.api()).version).toBe(ASSETS_VERSION);
    const standIn = assetsOf({ version: 99 });
    expect(standIn.types.register(BUILTIN_TYPES[0]!)()).toBeUndefined();
  });
});
