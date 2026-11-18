// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Media } from "../core/media.ts";
import type { ViewHost } from "../core/view.ts";
import { textOf, typeOf } from "../domain/listing.ts";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item, ItemKey } from "../model/database.ts";
import { editValue } from "./editors.ts";

const types = new TypeRegistry();
const DATABASE: Database = { id: "trips", name: "Trips", properties: [{ key: "photos", label: "Photos", type: "files", params: {}, readonly: false }] };
const item = (photos?: unknown): Item => ({ key: "page-1" as ItemKey, name: "Holiday", values: photos === undefined ? {} : { photos: photos as string[] }, rank: "a0", revision: "1" });

/** A host for one item, its files the space's given, recording what is written; `upload` the dialog's answer, as it comes */
function setup(options: { readonly media?: boolean; readonly upload?: () => Promise<readonly string[] | undefined> } = {}) {
  const writes: unknown[][] = [];
  const uploads: string[] = [];
  const media: Media = {
    draw: (target) => Object.assign(document.createElement("span"), { className: "swd-media", textContent: target }),
    open: () => undefined,
    files: async () => ["Photos/sunset.jpg", "Photos/sunrise.jpg", "Docs/report.pdf", "Docs/a@2x.png"],
    ...(options.upload ? { upload: (database: string) => (uploads.push(database), options.upload!()) } : {}),
  };
  const host = {
    document,
    database: DATABASE,
    type: (property: Database["properties"][number]) => typeOf(types, property),
    text: (one: Item, key: string) => textOf(one, key, DATABASE, types),
    update: async (one: Item, key: string, value: unknown) => (writes.push([one.values[key], key, value]), { problem: "", cause: "unchanged" }),
    notify: () => undefined,
    ...(options.media === false ? {} : { media }),
  } as unknown as ViewHost;
  const cell = document.createElement("td");
  document.body.append(cell, Object.assign(document.createElement("button"), { className: "outside" }));
  let shown = 0;
  const edit = (value?: unknown) => editValue(host, cell, item(value), "photos", () => void shown++);
  const panel = () => document.querySelector<HTMLElement>(".swd-editor-files")!;
  const names = () => [...panel().querySelectorAll(".swd-files-name")].map((one) => one.textContent);
  const search = () => panel().querySelector<HTMLInputElement>(".swd-editor-search")!;
  const type = async (text: string) => {
    search().value = text;
    search().dispatchEvent(new Event("input"));
  };
  const key = (target: Element, name: string, more: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...more }));
  const leave = () => document.querySelector<HTMLButtonElement>(".outside")!.focus();
  return { writes, uploads, edit, panel, names, search, type, key, leave, shown: () => shown };
}

afterEach(() => document.body.replaceChildren());

describe("a value of files edited", () => {
  it("lists its files, takes one out by ×, moves one by Alt+↓, and writes the list as left, each as it was written", async () => {
    const { writes, edit, panel, names, key, leave } = setup();
    edit(["[[Photos/a.png]]", "[[Photos/b.png|B]]", "https://example.com/c.jpg"]);
    expect(names()).toEqual(["a.png", "b.png", "c.jpg"]);
    expect(document.activeElement).toBe(panel().querySelector(".swd-editor-search"));
    panel().querySelectorAll<HTMLButtonElement>(".swd-files-remove")[0]!.click();
    expect(names()).toEqual(["b.png", "c.jpg"]);
    key(panel().querySelectorAll(".swd-files-grip")[0]!, "ArrowDown", { altKey: true });
    expect(names()).toEqual(["c.jpg", "b.png"]);
    // (The moved one's grip focused again)
    expect(document.activeElement).toBe(panel().querySelectorAll(".swd-files-grip")[1]);
    leave();
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual([["[[Photos/a.png]]", "[[Photos/b.png|B]]", "https://example.com/c.jpg"], "photos", ["https://example.com/c.jpg", "[[Photos/b.png|B]]"]]);
  });

  it("adds a file of the space found by words of its name, or an address typed, by Enter or a press; one there already, or one no link can name, said", async () => {
    const { writes, edit, panel, names, search, type, key } = setup();
    edit(["[[Photos/sunset.jpg]]"]);
    await vi.waitFor(async () => {
      await type("photos sun");
      expect(panel().querySelectorAll(".swd-files-found-item")).toHaveLength(1);
    });
    // (Those added not offered again; each its name, its folder under it)
    expect(panel().querySelector(".swd-files-found-item")!.textContent).toBe("sunrise.jpgPhotos");
    key(search(), "Enter");
    expect(names()).toEqual(["sunset.jpg", "sunrise.jpg"]);
    expect(search().value).toBe("");
    await type("https://example.com/pics/cat.png");
    panel().querySelector<HTMLButtonElement>(".swd-files-found-item")!.click();
    expect(names()).toEqual(["sunset.jpg", "sunrise.jpg", "cat.png"]);
    await type("a@2x");
    panel().querySelector<HTMLButtonElement>(".swd-files-found-item")!.click();
    expect(panel().querySelector(".swd-editor-note")!.textContent).toBe(`"Docs/a@2x.png" cannot be linked: no "@" in a file's name`);
    await type("nothing like it");
    key(search(), "Enter");
    expect(panel().querySelector(".swd-editor-note")!.textContent).toBe("No file of the space has that name: type an address with its https://, or a link ([[folder/name.png]])");
    // (A link typed or pasted: its file, whether the space lists it or not)
    await type("[[Notes/drawing.svg]]");
    key(search(), "Enter");
    expect(names()).toEqual(["sunset.jpg", "sunrise.jpg", "cat.png", "drawing.svg"]);
    // Enter in the search with nothing typed: written
    await type("");
    key(search(), "Enter");
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]![2]).toEqual(["[[Photos/sunset.jpg]]", "[[Photos/sunrise.jpg]]", "https://example.com/pics/cat.png", "[[Notes/drawing.svg]]"]);
  });

  it("writes nothing where the list is left as it was, nor on Esc; every file out takes the value off", async () => {
    const one = setup();
    one.edit(["[[a.png]]"]);
    one.leave();
    await vi.waitFor(() => expect(one.shown()).toBe(1));
    expect(one.writes).toEqual([]);
    one.edit(["[[a.png]]"]);
    one.panel().querySelector<HTMLButtonElement>(".swd-files-remove")!.click();
    one.key(one.panel(), "Escape");
    one.leave();
    expect(one.writes).toEqual([]);
    one.edit(["[[a.png]]"]);
    one.panel().querySelector<HTMLButtonElement>(".swd-files-remove")!.click();
    one.leave();
    await vi.waitFor(() => expect(one.writes).toEqual([[["[[a.png]]"], "photos", undefined]]));
  });

  it("uploads into the item's database, the dialog its companion: the files added once written; those written after it was left added to the value as written then", async () => {
    let answer!: (targets: readonly string[] | undefined) => void;
    const { writes, uploads, edit, panel, names, leave } = setup({ upload: () => new Promise((resolve) => (answer = resolve)) });
    edit(["[[a.png]]"]);
    const upload = panel().querySelector<HTMLButtonElement>(".swd-files-upload")!;
    expect(upload.disabled).toBe(false);
    upload.click();
    expect(uploads).toEqual(["trips"]);
    // (The focus going to a companion of the editor, the dialog: not left)
    const dialog = Object.assign(document.createElement("button"), { textContent: "Insert" });
    dialog.setAttribute("data-silverware-editor-companion", "");
    document.body.append(dialog);
    dialog.focus();
    expect(panel()).not.toBeNull();
    answer(["Databases/db-trips/files/b.png"]);
    await vi.waitFor(() => expect(names()).toEqual(["a.png", "b.png"]));
    expect(document.activeElement).toBe(upload);
    // Again, the popup left before the files are written: added to what it wrote
    upload.click();
    leave();
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    answer(["Databases/db-trips/files/c.png"]);
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual([["[[a.png]]", "[[Databases/db-trips/files/b.png]]"], "photos", ["[[a.png]]", "[[Databases/db-trips/files/b.png]]", "[[Databases/db-trips/files/c.png]]"]]);
  });

  it("without the host's files: an address still added, no search of the space, no upload (said why)", async () => {
    const { edit, panel, names, type, key, search } = setup({ media: false });
    edit([]);
    expect(search().placeholder).toBe("Type an address (https://…)");
    const upload = panel().querySelector<HTMLButtonElement>(".swd-files-upload")!;
    expect([upload.disabled, upload.title]).toEqual([true, "Uploading needs Silverware Assets"]);
    await type("https://example.com/a.png");
    key(search(), "Enter");
    expect(names()).toEqual(["a.png"]);
  });

  it("is a text field where the value does not read as files (kept as it is)", () => {
    const { edit } = setup();
    edit("plain words");
    expect(document.querySelector(".swd-editor-files")).toBeNull();
    expect(document.querySelector<HTMLInputElement>("input.swd-editor")!.value).toBe("plain words");
  });
});
