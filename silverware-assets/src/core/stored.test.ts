// Previews kept in the space: where, named by their file's version (a file replaced: another), of the kinds kept, made
// anew where asked, those of files gone or changed found.
import { describe, expect, it } from "vitest";
import { type FileFacts, forgetPreviews, orphanedPreviews, type PreviewFiles, previewPath, storedPreview } from "./stored.ts";

/** Files in memory, each its facts */
function filesOf(facts: Record<string, FileFacts>) {
  const state = { facts: { ...facts }, data: new Map<string, Uint8Array>(Object.keys(facts).map((path) => [path, new Uint8Array([1])])) };
  const files: PreviewFiles = {
    facts: async (path) => state.facts[path],
    read: async (path) => state.data.get(path),
    write: async (path, bytes) => {
      state.data.set(path, bytes);
      state.facts[path] = { modified: 100, size: bytes.length };
    },
    remove: async (path) => {
      state.data.delete(path);
      delete state.facts[path];
    },
  };
  return { files, state };
}

const PDF = { modified: 50, size: 7 };

describe("previews kept in the space", () => {
  it("are kept in one folder at the space's top, the file's path under it, its version and kind in the name", () => {
    expect(previewPath("Projects/Report.pdf", "50-7", "image/webp")).toBe("_silverware-asset-preview/Projects/Report.pdf.50-7.webp");
    expect(previewPath("a.docx", "1-2", "text/html")).toBe("_silverware-asset-preview/a.docx.1-2.html");
    expect(previewPath("a.pdf", "1-2", "image/gif")).toBeUndefined();
  });

  it("is read for the file's version alone: replaced, whatever its time, none", async () => {
    const { files, state } = filesOf({ "a.pdf": PDF, "_silverware-asset-preview/a.pdf.50-7.webp": { modified: 60, size: 1 } });
    const stored = storedPreview(files, "a.pdf");
    expect((await stored.read("image/webp"))?.type).toBe("image/webp");
    expect(await stored.read("image/png")).toBeUndefined();
    // (A copy that kept an older time, of another size)
    state.facts["a.pdf"] = { modified: 40, size: 9 };
    expect(await stored.read("image/webp")).toBeUndefined();
  });

  it("is written for the file's version by its blob's kind, a kind not kept refused, a file not known neither", async () => {
    const { files, state } = filesOf({ "a.pdf": PDF });
    expect(await storedPreview(files, "a.pdf").write(new Blob(["x"], { type: "image/png" }))).toBeUndefined();
    expect(state.data.has("_silverware-asset-preview/a.pdf.50-7.png")).toBe(true);
    expect(await storedPreview(files, "a.pdf").write(new Blob(["x"], { type: "image/gif" }))).toMatch(/not kept/);
    expect(await storedPreview(files, "gone.pdf").write(new Blob(["x"], { type: "image/png" }))).toMatch(/not known/);
  });

  it("of files gone or of their versions gone are found among the space's files", () => {
    const listed = [
      { name: "a.pdf", facts: PDF },
      { name: "_silverware-asset-preview/a.pdf.50-7.webp" },
      { name: "_silverware-asset-preview/a.pdf.40-7.webp" },
      { name: "_silverware-asset-preview/Old/b.docx.1-2.html" },
      { name: "_silverware-asset-preview/a.pdf.webp" },
      { name: "_silverware-asset-preview/notes.txt" },
      { name: "c.pdf.1-2.webp" },
    ];
    expect(orphanedPreviews(listed)).toEqual(["_silverware-asset-preview/a.pdf.40-7.webp", "_silverware-asset-preview/Old/b.docx.1-2.html", "_silverware-asset-preview/a.pdf.webp"]);
  });

  it("asked anew reads nothing kept; forgotten, none of its kinds is left", async () => {
    const { files, state } = filesOf({ "a.pdf": PDF, "_silverware-asset-preview/a.pdf.50-7.webp": PDF, "_silverware-asset-preview/a.pdf.50-7.html": PDF });
    const anew = storedPreview(files, "a.pdf", true);
    expect(anew.anew).toBe(true);
    expect(await anew.read("image/webp")).toBeUndefined();
    await forgetPreviews(files, "a.pdf");
    expect(Object.keys(state.facts)).toEqual(["a.pdf"]);
  });
});
