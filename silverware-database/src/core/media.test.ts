// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fittedSize, mediaHost, type MediaSource } from "./media.ts";

const BOX = { width: 84, height: 28, min: 14 };
const store = (folder?: string) => ({ filesFolderOf: () => folder });

function made(source: MediaSource, folder?: string) {
  const told: string[] = [];
  const media = mediaHost(source, store(folder), { notify: (message) => void told.push(message) }, document)!;
  return { media, told };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("a host's files", () => {
  it("are none without a source: values of files then shown as their names", () => {
    expect(mediaHost(undefined, store(), { notify: () => undefined }, document)).toBeUndefined();
  });

  it("draw an image of the space or the web as itself, lazily, by its name", () => {
    const { media } = made({ url: (path) => `.fs/${path}` });
    const image = media.draw("Photos/cat.png", BOX);
    expect(image.dataset.swdMedia).toBe("image");
    expect(image.title).toBe("cat.png");
    const img = image.querySelector("img")!;
    expect([img.getAttribute("src"), img.getAttribute("alt"), img.getAttribute("loading"), img.getAttribute("decoding")]).toEqual([".fs/Photos/cat.png", "cat.png", "lazy", "async"]);
    expect(media.draw("https://example.com/pics/dog.jpg?x=1", BOX).querySelector("img")!.getAttribute("src")).toBe("https://example.com/pics/dog.jpg?x=1");
    // (No address of the space's files: its icon and name)
    expect(made({}).media.draw("Photos/cat.png", BOX).dataset.swdMedia).toBe("file");
  });

  it("set each file's box on it, zoomed with the content, an image sized in it so once loaded", () => {
    const { media } = made({ url: (path) => `.fs/${path}` });
    const image = media.draw("cat.png", BOX);
    expect([image.style.getPropertyValue("--swd-media-width"), image.style.getPropertyValue("--swd-media-height")]).toEqual(["calc(84px * var(--sw-content-scale, 1))", "calc(28px * var(--sw-content-scale, 1))"]);
    const img = image.querySelector("img")!;
    Object.defineProperties(img, { naturalWidth: { value: 160 }, naturalHeight: { value: 100 } });
    img.dispatchEvent(new Event("load"));
    expect([img.style.width, img.style.height]).toEqual(["calc(45px * var(--sw-content-scale, 1))", "calc(28px * var(--sw-content-scale, 1))"]);
    expect(media.draw("report.pdf", BOX).style.getPropertyValue("--swd-media-height")).toBe("calc(28px * var(--sw-content-scale, 1))");
  });

  it("draw another file as its icon and name, its preview in their place once it comes; none: as they were", async () => {
    let answer!: (preview: HTMLElement | null) => void;
    const asked: [string, number][] = [];
    const { media } = made({
      preview: (target, box) => {
        asked.push([target, box.width]);
        return new Promise((resolve) => (answer = resolve));
      },
    });
    const file = media.draw("Docs/report.pdf", BOX);
    document.body.append(file);
    expect(file.dataset.swdMedia).toBe("file");
    expect(file.querySelector(".swd-media-name")!.textContent).toBe("report.pdf");
    expect(asked).toEqual([["Docs/report.pdf", 84]]);
    answer(Object.assign(document.createElement("canvas"), { className: "test-preview" }));
    await vi.waitFor(() => expect(file.dataset.swdMedia).toBe("preview"));
    expect(file.querySelector(".test-preview")).not.toBeNull();
    const other = media.draw("Docs/plan.docx", BOX);
    answer(null);
    await Promise.resolve();
    expect(other.dataset.swdMedia).toBe("file");
    expect(other.querySelector(".swd-media-name")!.textContent).toBe("plan.docx");
  });

  it("end a preview's drawing once its file has left the page, looked at a moment after files are drawn", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const { media } = made({ preview: (_target, _box, signal) => (signals.push(signal), new Promise(() => undefined)) });
    const kept = media.draw("a.pdf", BOX);
    document.body.append(kept);
    media.draw("gone.pdf", BOX);
    await vi.advanceTimersByTimeAsync(1000);
    expect(signals.map((one) => one.aborted)).toEqual([false, true]);
    kept.remove();
    media.draw("b.pdf", BOX).remove();
    await vi.advanceTimersByTimeAsync(1000);
    expect(signals.map((one) => one.aborted)).toEqual([true, true, true]);
  });

  it("open a file and list the space's files where the source does, a failure said; none listed where it lists none", async () => {
    const opened: string[] = [];
    const { media, told } = made({
      open: (target) => {
        if (target === "bad.png") throw new Error("no viewer");
        opened.push(target);
      },
      files: () => Promise.reject(new Error("offline")),
    });
    media.open("a.png");
    media.open("bad.png");
    expect(opened).toEqual(["a.png"]);
    expect(await media.files()).toEqual([]);
    expect(told).toEqual(['"bad.png" could not be opened: no viewer', "The space's files could not be listed: offline"]);
    expect(await made({}).media.files()).toEqual([]);
    expect(await made({ files: () => ["a.png"] }).media.files()).toEqual(["a.png"]);
  });

  it("upload into the database's folder of files the store gives; said and nothing uploaded where it gives none; no upload where the source has none", async () => {
    const given: [unknown, string][] = [];
    const upload = async (files: unknown, folder: string) => (given.push([files, folder]), [`${folder}/a.png`]);
    const { media } = made({ upload }, "Databases/db-ab12/files");
    const drop = { files: [new File(["x"], "a.png")], source: "drop" as const };
    expect(await media.upload!("ab12", drop)).toEqual(["Databases/db-ab12/files/a.png"]);
    expect(given).toEqual([[drop, "Databases/db-ab12/files"]]);
    const none = made({ upload });
    expect(await none.media.upload!("ab12")).toBeUndefined();
    expect(none.told).toEqual(["This database keeps no files of its own: none uploaded"]);
    expect(made({}).media.upload).toBeUndefined();
    expect(made({}).media.remove).toBeUndefined();
  });

  it("delete files as the source does, every one left where it fails", async () => {
    expect(await made({ remove: async (paths) => paths.slice(1) }).media.remove!(["a.png", "b.png"])).toEqual(["b.png"]);
    expect(await made({ remove: () => Promise.reject(new Error("no")) }).media.remove!(["a.png", "b.png"])).toEqual(["a.png", "b.png"]);
  });
});

describe("an image's size in its box", () => {
  it("fits at its proportions; one too narrow or too low cropped to the least, across the box", () => {
    expect(fittedSize({ width: 160, height: 100 }, BOX)).toEqual({ width: 45, height: 28, cropped: false });
    expect(fittedSize({ width: 100, height: 100 }, BOX)).toEqual({ width: 28, height: 28, cropped: false });
    // (A panorama: fitted it would be 84 × 6, cropped to 84 × 14)
    expect(fittedSize({ width: 800, height: 60 }, BOX)).toEqual({ width: 84, height: 14, cropped: true });
    // (A strip standing: fitted 4 × 28, cropped to 14 × 28)
    expect(fittedSize({ width: 60, height: 400 }, BOX)).toEqual({ width: 14, height: 28, cropped: true });
    expect(fittedSize({ width: 0, height: 0 }, BOX)).toEqual({ width: 84, height: 28, cropped: false });
  });
});
