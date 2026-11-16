// @vitest-environment jsdom
// Silverware Assets PDF's preview where pdf.js is not loaded (as in a test: it is a file beside the built bundle, not beside
// src/), and the sizes it draws by. The pages drawn are tested in SilverBullet (ui-tests/).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSETS_VERSION, type Assets, type AssetType, type RenderContext } from "../../shared/assets.ts";
import { init } from "./index.ts";
import { fittedScale, pdfPreview } from "./preview.ts";

describe("a PDF's preview", () => {
  // (A file's version and its body answered here, not by the network: jsdom's page is at localhost, where a server of
  // the machine's may answer or not; what fails is the renderer's loading alone, as named)
  beforeEach(() => vi.stubGlobal("fetch", async () => new Response("not a document")));
  afterEach(() => vi.unstubAllGlobals());
  it("is drawn to fit its box, its proportions kept, as sharp as the screen's pixels", () => {
    expect(fittedScale({ width: 200, height: 300 }, { width: 400, height: 160 }, 1)).toBeCloseTo(160 / 300);
    expect(fittedScale({ width: 600, height: 300 }, { width: 300, height: 160 }, 2)).toBeCloseTo((300 / 600) * 2);
  });

  it("is a box of its room at once, the browser's viewer in it where pdf.js cannot be loaded", async () => {
    const preview = pdfPreview(document, "/doc.pdf", "doc.pdf", { width: 300, height: 160 }, new AbortController().signal);
    expect(preview.dataset.swaPdfState).toBe("drawing");
    // (As the content's scale makes it: shared/contentscale.ts)
    expect(preview.style.getPropertyValue("--swa-pdf-box-height")).toBe("calc(160px * var(--sw-content-scale, 1))");
    await vi.waitFor(() => expect(preview.dataset.swaPdfState).toBe("viewer"), { timeout: 5_000 });
    expect(preview.querySelector("object")!.getAttribute("data")).toBe("/doc.pdf");
  });

  it("is left as it is once its render ended (drawn anew, another view)", async () => {
    const control = new AbortController();
    const preview = pdfPreview(document, "/other.pdf", "other.pdf", { width: 300, height: 160 }, control.signal);
    control.abort();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(preview.dataset.swaPdfState).toBe("drawing");
    expect(preview.children.length).toBe(0);
  });
});

describe("Silverware Assets PDF", () => {
  it("registers its type with Silverware Assets' API once while the same API is handed over, again with another", () => {
    const registered: AssetType[] = [];
    const off = vi.fn();
    const api = (): Assets => ({ version: ASSETS_VERSION, types: { register: (type) => (registered.push(type), off) }, actions: { register: () => () => undefined } });
    const assets = api();
    init({ assets });
    expect(registered.map((type) => type.name)).toEqual(["pdf"]);
    expect(registered[0]!.match.ext).toEqual(["pdf"]);
    // (Space Lua loaded again, the same API: the type kept, no file drawn anew)
    init({ assets });
    expect(registered).toHaveLength(1);
    expect(off).not.toHaveBeenCalled();
    init({ assets: api() });
    expect(off).toHaveBeenCalledTimes(1);
    expect(registered).toHaveLength(2);
    // (Without Silverware Assets: nothing registered, nothing thrown)
    expect(() => init({})).not.toThrow();
  });

  it("draws a preview only where it has room and a URL, and no original of its own (the browser's viewer, Assets')", () => {
    const registered: AssetType[] = [];
    init({ assets: { version: ASSETS_VERSION, types: { register: (type: AssetType) => (registered.push(type), () => undefined) }, actions: { register: () => () => undefined } } });
    expect(registered).toHaveLength(1);
    const type = registered.at(-1)!;
    const context = (width: number): RenderContext => ({
      asset: { kind: "file", path: "a.pdf", url: ".fs/a.pdf" },
      viewport: { width, height: 160, onChange: () => undefined },
      metadata: { values: {}, number: () => undefined, boolean: () => undefined, text: () => undefined, write: async () => undefined },
      signal: new AbortController().signal,
      placement: "block",
    });
    expect(type.views!.preview!(context(20))).toBeNull();
    expect((type.views!.preview!(context(300)) as HTMLElement).className).toBe("swa-pdf-preview");
    expect(type.views!.embed).toBeUndefined();
  });
});
