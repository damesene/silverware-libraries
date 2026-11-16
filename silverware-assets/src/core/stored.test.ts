// Previews kept in the space: where, named by their file's version (a file replaced: another), of the kinds kept, made
// anew where asked, those of files gone or changed found.
import { describe, expect, it } from "vitest";
import { type FileFacts, forgetPreviews, movedPreviews, orphanedPreviews, type PreviewFiles, previewPath, storedPreview } from "./stored.ts";

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
// The previews' folder, the settings' default
const F = "_silverware-assets-previews";

describe("previews kept in the space", () => {
  it("are kept in one folder at the space's top, the file's path under it, its version and kind in the name", () => {
    expect(previewPath(F, "Projects/Report.pdf", "50-7", "image/webp")).toBe("_silverware-assets-previews/Projects/Report.pdf.50-7.webp");
    expect(previewPath(F, "a.docx", "1-2", "text/html")).toBe("_silverware-assets-previews/a.docx.1-2.html");
    expect(previewPath(F, "a.pdf", "1-2", "image/gif")).toBeUndefined();
  });

  it("is read for the file's version alone: replaced, whatever its time, none", async () => {
    const { files, state } = filesOf({ "a.pdf": PDF, "_silverware-assets-previews/a.pdf.50-7.webp": { modified: 60, size: 1 } });
    const stored = storedPreview(files, F, "a.pdf");
    expect((await stored.read("image/webp"))?.type).toBe("image/webp");
    expect(await stored.read("image/png")).toBeUndefined();
    // (A copy that kept an older time, of another size)
    state.facts["a.pdf"] = { modified: 40, size: 9 };
    expect(await stored.read("image/webp")).toBeUndefined();
  });

  it("is written for the file's version by its blob's kind, a kind not kept refused, a file not known neither", async () => {
    const { files, state } = filesOf({ "a.pdf": PDF });
    expect(await storedPreview(files, F, "a.pdf").write(new Blob(["x"], { type: "image/png" }))).toBeUndefined();
    expect(state.data.has("_silverware-assets-previews/a.pdf.50-7.png")).toBe(true);
    expect(await storedPreview(files, F, "a.pdf").write(new Blob(["x"], { type: "image/gif" }))).toMatch(/not kept/);
    expect(await storedPreview(files, F, "gone.pdf").write(new Blob(["x"], { type: "image/png" }))).toMatch(/not known/);
  });

  it("of files gone or of their versions gone are found among the space's files, nothing else of the folder (the user's)", () => {
    // (A version as a file's facts give it: its time in ms and its size)
    const now = { modified: 1731600000000, size: 7 };
    const listed = [
      { name: "a.pdf", facts: now },
      { name: `${F}/a.pdf.1731600000000-7.webp` },
      { name: `${F}/a.pdf.1731500000000-7.webp` },
      { name: `${F}/Old/b.docx.1731600000000-2.html` },
      { name: `${F}/a.pdf.webp` },
      { name: `${F}/notes.txt` },
      { name: `${F}/photo.png` },
      // (The user's, named like a version by chance: a date, a file of no extension)
      { name: `${F}/scan.2024-11.png` },
      { name: `${F}/plan.1731600000000-2.html` },
      { name: "c.pdf.1731600000000-2.webp" },
    ];
    expect(orphanedPreviews(listed, F)).toEqual([`${F}/a.pdf.1731500000000-7.webp`, `${F}/Old/b.docx.1731600000000-2.html`]);
  });

  it("asked anew reads nothing kept; forgotten, none of its kinds is left", async () => {
    const { files, state } = filesOf({ "a.pdf": PDF, "_silverware-assets-previews/a.pdf.50-7.webp": PDF, "_silverware-assets-previews/a.pdf.50-7.html": PDF });
    const anew = storedPreview(files, F, "a.pdf", true);
    expect(anew.anew).toBe(true);
    expect(await anew.read("image/webp")).toBeUndefined();
    await forgetPreviews(files, F, "a.pdf");
    expect(Object.keys(state.facts)).toEqual(["a.pdf"]);
  });

  it("move as their folder is renamed, each under the new one as it was under the old, the folder's other files left; the same folder, none", () => {
    const paths = ["a.pdf", `${F}/a.pdf.1731600000000-2.webp`, `${F}/Old/b.docx.1731600000000-2.html`, `${F}/notes.md`, `${F}/photo.png`, "other/x.png"];
    expect(movedPreviews(paths, F, "previews")).toEqual([
      { from: `${F}/a.pdf.1731600000000-2.webp`, to: "previews/a.pdf.1731600000000-2.webp" },
      { from: `${F}/Old/b.docx.1731600000000-2.html`, to: "previews/Old/b.docx.1731600000000-2.html" },
    ]);
    expect(movedPreviews(paths, F, F)).toEqual([]);
  });

  it("moved into a folder within the old one: those already there left, none a folder deeper", () => {
    const paths = ["previews/a.pdf.1731600000000-2.webp", "previews/old/b.pdf.1731600000000-2.webp"];
    expect(movedPreviews(paths, "previews", "previews/old")).toEqual([{ from: "previews/a.pdf.1731600000000-2.webp", to: "previews/old/a.pdf.1731600000000-2.webp" }]);
  });
});
