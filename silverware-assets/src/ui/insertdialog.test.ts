// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Dialogs } from "../../../shared/dialog.ts";
import type { View } from "../model/settings.ts";
import { COSTLY_BYTES, type InsertChoice, type InsertDialogHost, openInsertDialog, type InsertFile } from "./insertdialog.ts";

const dialogs = () => new Dialogs(document, { base: "swa-dialog", closeIcon: "×" });
const fileOf = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

function host(existing: string[] = [], more: Partial<InsertDialogHost> = {}): InsertDialogHost & { drawn: [string, View][] } {
  const drawn: [string, View][] = [];
  return {
    folder: "Notes",
    maxBytes: 1000,
    touch: false,
    now: () => new Date(2026, 10, 15, 13, 9, 48),
    existing: async () => new Set(existing.map((path) => path.toLowerCase())),
    typeOf: (file) =>
      file.type.startsWith("image/")
        ? { name: "image", icon: "<svg></svg>", can: () => true, configured: "preview", insertAs: "shown", costly: false }
        : file.name.endsWith(".docx")
          ? { name: "docx", icon: "<svg></svg>", can: () => true, configured: "full", insertAs: "shown", costly: true }
          : { name: "zip", icon: "<svg></svg>", can: (view) => view === "card", configured: "full", insertAs: "link", costly: false },
    drawSample: (container, _file, path, view) => {
      drawn.push([path, view]);
      container.textContent = `${view}: ${path}`;
    },
    drawn,
    ...more,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const rows = () => [...document.querySelectorAll<HTMLElement>(".swa-insert-row")];
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>(".swa-dialog button")].find((one) => one.textContent === text)!;
const choice = (row: HTMLElement, text: string) => [...row.querySelectorAll<HTMLButtonElement>(".swa-insert-choice")].find((one) => one.textContent === text)!;

function open(files: InsertFile[], given = host()): { result: Promise<readonly InsertChoice[] | undefined>; given: ReturnType<typeof host> } {
  const result = new Promise<readonly InsertChoice[] | undefined>((resolve) => openInsertDialog(document, dialogs(), files, given, resolve));
  return { result, given: given as ReturnType<typeof host> };
}

afterEach(() => document.body.replaceChildren());

describe("the insert dialog", () => {
  it("offers each file's path in the page's folder (a clipboard's named by the time), as the settings insert it, drawn so", async () => {
    const { result, given } = open([
      { file: fileOf("image.png", "image/png"), source: "clipboard" },
      { file: fileOf("Report.zip", "application/zip"), source: "drop" },
    ]);
    await settle();
    expect(rows().map((row) => row.querySelector<HTMLInputElement>(".swa-insert-path")!.value)).toEqual(["Notes/2026-11-15_13-09-48.png", "Notes/Report.zip"]);
    // (As shown: the image's view as set; the zip a link, as its setting says; its views it cannot be drawn in off)
    expect(rows().map((row) => row.querySelector('[aria-checked="true"]')!.textContent)).toEqual(["Preview", "Link"]);
    expect(choice(rows()[1]!, "Full").getAttribute("aria-disabled")).toBe("true");
    // (Drawn as it comes, again once the names taken are known: under its name then)
    expect(given.drawn.at(-1)).toEqual(["Notes/2026-11-15_13-09-48.png", "preview"]);
    expect(rows()[1]!.querySelector(".swa-insert-link")!.textContent).toBe("Notes/Report.zip");
    button("Insert").click();
    expect(await result).toEqual([
      { file: expect.any(File), path: "Notes/2026-11-15_13-09-48.png", as: "preview", configured: "preview" },
      { file: expect.any(File), path: "Notes/Report.zip", as: "link", configured: "full" },
    ]);
  });

  it("asks each file's name alone for another plugin's upload: no choice of how it is shown, each drawn as the first view its type has", async () => {
    const { result, given } = open(
      [
        { file: fileOf("photo.png", "image/png"), source: "drop" },
        { file: fileOf("Report.zip", "application/zip"), source: "drop" },
      ],
      host([], { nameOnly: true }),
    );
    await settle();
    expect(document.querySelector(".swa-dialog-subtitle, .swa-dialog .swa-dialog-head")?.textContent).toContain("Its name in the space");
    expect(document.querySelector(".swa-dialog")?.textContent).not.toContain("how it is put in the page");
    expect(rows().every((row) => row.querySelector<HTMLElement>(".swa-insert-choices")!.hidden)).toBe(true);
    expect(document.querySelector<HTMLElement>(".swa-insert-all")!.hidden).toBe(true);
    // (The image its preview, the zip its card: not a link's name, which says nothing of what is uploaded)
    expect(given.drawn.slice(-2)).toEqual([
      ["Notes/photo.png", "preview"],
      ["Notes/Report.zip", "card"],
    ]);
    button("Add 2").click();
    expect((await result)?.map((one) => one.path)).toEqual(["Notes/photo.png", "Notes/Report.zip"]);
  });

  it("takes a batch's names apart, keeps both of one taken in the space or replaces it as chosen", async () => {
    const { result } = open(
      [
        { file: fileOf("photo.jpg", "image/jpeg"), source: "drop" },
        { file: fileOf("photo.jpg", "image/jpeg"), source: "drop" },
      ],
      host(["Notes/photo.jpg"]),
    );
    await settle();
    const notes = () => rows().map((row) => row.querySelector(".swa-insert-row-note")!.textContent);
    expect(notes()[0]).toContain("inserted as “Notes/photo-1.jpg”");
    expect(notes()[1]).toContain("inserted as “Notes/photo-2.jpg”");
    choice(rows()[0]!, "Replace it").click();
    expect(notes()[0]).toContain("replaced");
    button("Insert").click();
    expect((await result)!.map((one) => one.path)).toEqual(["Notes/photo.jpg", "Notes/photo-1.jpg"]);
  });

  it("keeps Insert off until the names taken in the space are known, says where they could not be", async () => {
    let answer: (paths: ReadonlySet<string>) => void = () => undefined;
    open([{ file: fileOf("photo.jpg", "image/jpeg"), source: "drop" }], host([], { existing: () => new Promise((resolve) => (answer = resolve)) }));
    await settle();
    expect(button("Insert").disabled).toBe(true);
    expect(document.querySelector(".swa-dialog-note")!.textContent).toContain("Looking for files");
    answer(new Set(["notes/photo.jpg"]));
    await settle();
    expect(button("Insert").disabled).toBe(false);
    expect(rows()[0]!.querySelector(".swa-insert-row-note")!.textContent).toContain("Notes/photo-1.jpg");
    document.body.replaceChildren();
    open([{ file: fileOf("photo.jpg", "image/jpeg"), source: "drop" }], host([], { existing: () => Promise.reject(new Error("no listing")) }));
    await settle();
    expect(button("Insert").disabled).toBe(false);
    expect(document.querySelector(".swa-dialog-note")!.textContent).toContain("could not be listed");
  });

  it("keeps the focus on a note's choice as it is drawn again, and offers a folder's name cleaned too", async () => {
    open([{ file: fileOf("photo.jpg", "image/jpeg"), source: "drop" }], host(["Notes/photo.jpg"]));
    await settle();
    choice(rows()[0]!, "Replace it").focus();
    choice(rows()[0]!, "Replace it").click();
    expect((document.activeElement as HTMLElement).textContent).toBe("Replace it");
    const field = rows()[0]!.querySelector<HTMLInputElement>(".swa-insert-path")!;
    field.value = "Q1: plan/a#b.jpg";
    field.dispatchEvent(new Event("input"));
    expect(rows()[0]!.querySelector(".swa-insert-row-note")!.textContent).toContain('the name has a "#" in it');
    rows()[0]!.querySelector<HTMLButtonElement>(".swa-insert-fix")!.click();
    // (A folder's colon is SilverBullet's to take: kept)
    expect(field.value).toBe("Q1: plan/ab.jpg");
  });

  it("says why SilverBullet would refuse a name typed, Insert off until it is fixed by the name offered", async () => {
    open([{ file: fileOf("a.png", "image/png"), source: "drop" }]);
    await settle();
    const field = rows()[0]!.querySelector<HTMLInputElement>(".swa-insert-path")!;
    field.value = "Notes/a#b.png";
    field.dispatchEvent(new Event("input"));
    expect(rows()[0]!.querySelector(".swa-insert-row-note")!.textContent).toContain('the name has a "#" in it');
    expect(button("Insert").disabled).toBe(true);
    rows()[0]!.querySelector<HTMLButtonElement>(".swa-insert-fix")!.click();
    expect(field.value).toBe("Notes/ab.png");
    expect(button("Insert").disabled).toBe(false);
  });

  it("leaves a file too large out, sets every row by the choice for all (one set by hand too), draws a large costly file on a click", async () => {
    const given = host([], { maxBytes: COSTLY_BYTES * 2 });
    const { result } = open(
      [
        { file: fileOf("a.png", "image/png"), source: "drop" },
        { file: fileOf("b.png", "image/png"), source: "drop" },
        { file: fileOf("big.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", COSTLY_BYTES + 1), source: "drop" },
        { file: fileOf("huge.png", "image/png", COSTLY_BYTES * 2 + 1), source: "drop" },
      ],
      given,
    );
    await settle();
    expect(rows()[3]!.hasAttribute("data-swa-left-out")).toBe(true);
    expect(rows()[3]!.querySelector(".swa-insert-row-note")!.textContent).toContain("Too large");
    // (The large document held: drawn on a click)
    expect(rows()[2]!.querySelector(".swa-insert-held")).not.toBeNull();
    rows()[2]!.querySelector<HTMLButtonElement>(".swa-insert-held button")!.click();
    expect(given.drawn.at(-1)).toEqual(["Notes/big.docx", "full"]);
    const all = document.querySelector<HTMLElement>(".swa-insert-all")!;
    const allChecked = () => all.querySelector('[aria-checked="true"]')?.textContent;
    expect(all.hidden).toBe(false);
    // (The rows differ, the images' previews and the document shown full: none chosen for all; all the same: that one)
    expect(allChecked()).toBeUndefined();
    [...all.querySelectorAll<HTMLButtonElement>(".swa-insert-choice")].find((one) => one.textContent === "Card")!.click();
    expect(allChecked()).toBe("Card");
    choice(rows()[1]!, "Full").click();
    expect(allChecked()).toBeUndefined();
    [...all.querySelectorAll<HTMLButtonElement>(".swa-insert-choice")].find((one) => one.textContent === "Card")!.click();
    button("Insert").click();
    expect((await result)!.map((one) => [one.path, one.as])).toEqual([
      ["Notes/a.png", "card"],
      ["Notes/b.png", "card"],
      ["Notes/big.docx", "card"],
    ]);
  });

  it("offers an image of the web linked at its address (by default) or kept; one too large for the space linked alone", async () => {
    const url = "https://example.com/pics/cat.png";
    const { result } = open([
      { file: fileOf("image.png", "image/png"), source: "clipboard", url },
      { file: fileOf("huge.png", "image/png", 2000), source: "clipboard", url: "https://example.com/huge.png" },
      { file: fileOf("own.png", "image/png"), source: "drop" },
    ]);
    await settle();
    const kept = (row: HTMLElement) => row.querySelector(".swa-insert-kept [aria-checked=\"true\"]")?.textContent;
    // (The first name to type focused: the file of no address's)
    expect(document.activeElement).toBe(rows()[2]!.querySelector(".swa-insert-path"));
    // (Linked by default, its address in place of its name; too large: its space's choice off; a file of no address: no choice)
    expect(rows().map(kept)).toEqual(["Linked from the web", "Linked from the web", undefined]);
    expect(rows()[0]!.querySelector<HTMLInputElement>(".swa-insert-path")!.hidden).toBe(true);
    expect(rows()[0]!.querySelector(".swa-insert-address")!.textContent).toBe(url);
    expect(rows()[1]!.hasAttribute("data-swa-left-out")).toBe(false);
    expect(rows()[1]!.querySelector(".swa-insert-row-note")!.textContent).toContain("Too large for the space");
    expect(choice(rows()[1]!, "In the space").getAttribute("aria-disabled")).toBe("true");
    // Kept in the space: its name to type again
    choice(rows()[0]!, "In the space").click();
    expect(rows()[0]!.querySelector<HTMLInputElement>(".swa-insert-path")!.hidden).toBe(false);
    button("Insert").click();
    expect((await result)!.map((one) => [one.path, one.url])).toEqual([
      ["Notes/2026-11-15_13-09-48.png", undefined],
      ["huge.png", "https://example.com/huge.png"],
      ["Notes/own.png", undefined],
    ]);
  });

  it("shows the choice for all the rows share as it opens; focuses the first name to type, else a linked row's choice", async () => {
    open([
      { file: fileOf("huge.png", "image/png", 2000), source: "clipboard", url: "https://example.com/huge.png" },
      { file: fileOf("b.png", "image/png"), source: "drop" },
      { file: fileOf("c.png", "image/png"), source: "drop" },
    ]);
    await settle();
    expect(document.querySelector('.swa-insert-all [aria-checked="true"]')?.textContent).toBe("Preview");
    expect(document.activeElement).toBe(rows()[1]!.querySelector(".swa-insert-path"));
    document.body.replaceChildren();
    open([{ file: fileOf("image.png", "image/png"), source: "clipboard", url: "https://example.com/cat.png" }]);
    await settle();
    expect(document.activeElement?.textContent).toBe("Linked from the web");
  });

  it("gives nothing as it is cancelled; opened empty to upload, files picked in it (Camera on a touch screen alone)", async () => {
    const cancelled = open([{ file: fileOf("a.png", "image/png"), source: "drop" }]);
    button("Cancel").click();
    expect(await cancelled.result).toBeUndefined();
    open([], host([], { touch: true }));
    expect(button("Files…")).toBeDefined();
    expect(button("Camera…")).toBeDefined();
    expect(button("Insert").disabled).toBe(true);
    document.body.replaceChildren();
    open([], host());
    expect(button("Camera…")).toBeUndefined();
  });
});
