// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViewHost } from "../core/view.ts";
import type { Item, ItemKey } from "../model/database.ts";
import { givenFiles, takeFiles, uploadInto } from "./takefiles.ts";

/** What a drop or a paste carries: files, and HTML beside them where given */
function carrying(files: readonly File[], more: Readonly<Record<string, string>> = {}): DataTransfer {
  const types = [...(files.length ? ["Files"] : []), ...Object.keys(more)];
  return { files: files as unknown as FileList, types, getData: (type: string) => more[type] ?? "" } as unknown as DataTransfer;
}
const event = (type: string, data: DataTransfer, key: "dataTransfer" | "clipboardData") => Object.assign(new Event(type, { bubbles: true, cancelable: true }), { [key]: data });
const photo = new File(["x"], "photo.png", { type: "image/png" });

afterEach(() => document.body.replaceChildren());

describe("files taken on a value of files", () => {
  it("read what an event carries: its files and what came beside them; none without a file", () => {
    expect(givenFiles(carrying([photo], { "text/html": "<img src=x>", "text/uri-list": "https://a.png" }), "drop")).toEqual({ files: [photo], source: "drop", html: "<img src=x>", uriList: "https://a.png" });
    expect(givenFiles(carrying([], { "text/plain": "words" }), "clipboard")).toBeUndefined();
    expect(givenFiles(null, "drop")).toBeUndefined();
  });

  it("are dropped and pasted on the element marked as taking them, lit while dragged over; a text pasted left alone", () => {
    const cell = document.createElement("td");
    const inner = document.createElement("span");
    cell.append(inner);
    document.body.append(cell);
    const taken: [string, Element][] = [];
    takeFiles(cell, (given, at) => void taken.push([given.source, at]), { paste: true });
    expect(cell.hasAttribute("data-silverware-takes-files")).toBe(true);
    const over = event("dragover", carrying([photo]), "dataTransfer");
    inner.dispatchEvent(over);
    expect([over.defaultPrevented, cell.classList.contains("swd-files-over")]).toEqual([true, true]);
    const drop = event("drop", carrying([photo]), "dataTransfer");
    inner.dispatchEvent(drop);
    expect([drop.defaultPrevented, cell.classList.contains("swd-files-over")]).toEqual([true, false]);
    const text = event("paste", carrying([], { "text/plain": "words" }), "clipboardData");
    cell.dispatchEvent(text);
    expect(text.defaultPrevented).toBe(false);
    cell.dispatchEvent(event("paste", carrying([photo]), "clipboardData"));
    expect(taken).toEqual([
      ["drop", inner],
      ["clipboard", cell],
    ]);
    // (A card takes no paste)
    const card = document.createElement("article");
    takeFiles(card, () => void taken.push(["card", card]));
    const pasted = event("paste", carrying([photo]), "clipboardData");
    card.dispatchEvent(pasted);
    expect(pasted.defaultPrevented).toBe(false);
  });

  it("upload into the item's database, the files added at the end of its value as it is once written; said where nothing can upload or the value is no list of files", async () => {
    const writes: unknown[][] = [];
    const told: string[] = [];
    let item: Item = { key: "a" as ItemKey, name: "Holiday", values: { photos: ["[[a.png]]"] }, rank: "a0", revision: "1" };
    const host = (upload?: () => Promise<readonly string[] | undefined>) =>
      ({
        database: { id: "trips" },
        update: async (one: Item, key: string, value: unknown) => (writes.push([one.revision, key, value]), { problem: "", cause: "unchanged" }),
        notify: (message: string) => void told.push(message),
        current: async () => item,
        ...(upload ? { media: { upload: async (database: string) => (database === "trips" ? upload() : undefined) } } : {}),
      }) as unknown as ViewHost;
    let answer!: (targets: readonly string[]) => void;
    uploadInto(host(() => new Promise((resolve) => (answer = resolve))), item, "photos", "Photos");
    // (The item changed while the files were written, by another place: added to it as the store has it then)
    item = { ...item, revision: "2", values: { photos: ["[[a.png]]", "[[b.png]]"] } };
    answer(["files/c.png", "b.png"]);
    await vi.waitFor(() => expect(writes).toEqual([["2", "photos", ["[[a.png]]", "[[b.png]]", "[[files/c.png]]"]]]));
    uploadInto(host(), item, "photos", "Photos");
    item = { ...item, values: { photos: "plain words" } };
    uploadInto(host(async () => ["d.png"]), item, "photos", "Photos");
    await vi.waitFor(() => expect(told).toHaveLength(2));
    expect(told).toEqual(["Photos: uploading files needs Silverware Assets", "Photos of Holiday: its value is no list of files: the files uploaded are not added (d.png)"]);
    expect(writes).toHaveLength(1);
  });
});
