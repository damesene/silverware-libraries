// @vitest-environment jsdom
// Silverware Assets DOCX's preview and reader where docx-preview is not loaded (as in a test: it is a file beside the built
// bundle, not beside src/), and the sizes they draw by. The document drawn is tested in SilverBullet (ui-tests/).
import { describe, expect, it, vi } from "vitest";
import { ASSET_WIDE_ATTRIBUTE, ASSETS_VERSION, type AssetType } from "../../shared/assets.ts";
import { init } from "./index.ts";
import { pageSize } from "./load.ts";
import { docxPreview, previewScale } from "./preview.ts";
import { docxReader, fittedZoom } from "./reader.ts";

describe("a document's page", () => {
  it("is sized by docx-preview's inline width and least height, in pt or px", () => {
    const page = document.createElement("section");
    page.style.width = "612pt";
    page.style.minHeight = "792pt";
    expect(pageSize(page)).toEqual({ width: 816, height: 1056 });
    page.style.width = "";
    expect(pageSize(page)).toBeUndefined();
  });

  it("is drawn in a preview at the scale fitting its room, and in a reader as wide as the reader less its gaps, times the zoom", () => {
    expect(previewScale({ width: 816, height: 1056 }, { width: 400, height: 160 })).toBeCloseTo(160 / 1056);
    expect(fittedZoom(840, 816, 1)).toBeCloseTo(1);
    expect(fittedZoom(840, 816, 2)).toBeCloseTo(2);
  });
});


describe("where docx-preview cannot be loaded", () => {
  it("a preview stays its icon and name, its title saying why", async () => {
    const preview = docxPreview(document, "/a.docx", "a.docx", "<svg/>", { width: 200, height: 160 }, new AbortController().signal);
    expect(preview.querySelector(".swa-docx-preview-name")!.textContent).toBe("a.docx");
    await vi.waitFor(() => expect(preview.dataset.swaDocxState).toBe("failed"));
    expect(preview.title).toMatch(/^a\.docx: /);
  });

  it("a reader, as wide as its line, says it cannot show the document", async () => {
    const reader = docxReader(document, "/b.docx", "b.docx", 480, new AbortController().signal);
    expect(reader.hasAttribute(ASSET_WIDE_ATTRIBUTE)).toBe(true);
    expect(reader.style.height).toBe("calc(480px * var(--sw-content-scale, 1))");
    await vi.waitFor(() => expect(reader.dataset.swaDocxState).toBe("failed"));
    expect(reader.querySelector(".swa-docx-reader-failed")!.textContent).toMatch(/^This document cannot be shown here/);
  });
});

describe("Silverware Assets DOCX", () => {
  it("registers its type with Silverware Assets' API once while the same API is handed over, again with another", () => {
    const registered: AssetType[] = [];
    const off = vi.fn();
    const api = () => ({ version: ASSETS_VERSION, types: { register: (type: AssetType) => (registered.push(type), off) }, actions: { register: () => () => undefined } });
    const assets = api();
    init({ assets });
    init({ assets });
    expect(registered.map((type) => type.name)).toEqual(["docx"]);
    expect(registered[0]!.match.ext).toEqual(["docx"]);
    init({ assets: api() });
    expect(registered).toHaveLength(2);
    expect(off).toHaveBeenCalledTimes(1);
    expect(() => init({})).not.toThrow();
  });
});
