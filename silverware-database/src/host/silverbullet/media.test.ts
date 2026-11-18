import { describe, expect, it } from "vitest";
import { assetsOf } from "../../../../shared/assets.ts";
import { silverBulletMedia } from "./media.ts";

describe("files in SilverBullet", () => {
  it("without Silverware Assets: an image from the space's files, a file opened as SilverBullet opens one, an address in a tab; no preview, no upload", async () => {
    const navigated: string[] = [];
    const tabs: string[] = [];
    const deleted: string[] = [];
    const media = silverBulletMedia(
      {
        navigate: async (ref) => void navigated.push(ref),
        listDocuments: async () => ["Photos/cat.png"],
        deleteDocument: async (path) => {
          if (path === "locked.png") throw new Error("no");
          deleted.push(path);
        },
      },
      assetsOf(undefined),
      (url) => void tabs.push(url),
    );
    expect(media.url!("Photos/my cat.png")).toBe(".fs/Photos/my%20cat.png");
    expect(media.preview).toBeUndefined();
    expect(media.upload).toBeUndefined();
    media.open!("Docs/report.pdf");
    media.open!("https://example.com/a.pdf");
    expect(navigated).toEqual(["Docs/report.pdf"]);
    expect(tabs).toEqual(["https://example.com/a.pdf"]);
    expect(await media.files!()).toEqual(["Photos/cat.png"]);
    expect(await media.remove!(["a.png", "locked.png"])).toEqual(["locked.png"]);
    expect(deleted).toEqual(["a.png"]);
    // (A SilverBullet handing over no listing nor deletion: none)
    const bare = silverBulletMedia({ navigate: async () => undefined }, assetsOf(undefined), () => undefined);
    expect([bare.files, bare.remove]).toEqual([undefined, undefined]);
  });

  it("with Silverware Assets: its preview, its side panel, its upload into the folder given and its deletion, every target from the space's top", async () => {
    const calls: unknown[][] = [];
    const assets = assetsOf({
      version: 1,
      types: { register: () => () => undefined },
      actions: { register: () => () => undefined },
      drawPreview: async (...args: unknown[]) => (calls.push(["preview", ...args.slice(0, 3)]), null),
      showFile: (...args: unknown[]) => void calls.push(["show", ...args]),
      insertFiles: async (...args: unknown[]) => (calls.push(["insert", ...args]), [{ target: "Databases/db-ab12/files/a.png" }]),
      deleteFiles: async (paths: readonly string[]) => (calls.push(["delete", paths]), []),
    });
    const navigated: string[] = [];
    const media = silverBulletMedia({ navigate: async (ref) => void navigated.push(ref), deleteDocument: async () => undefined }, assets, () => undefined);
    expect(await media.preview!("Docs/report.pdf", { width: 84, height: 28, min: 14 }, new AbortController().signal)).toBeNull();
    media.open!("Docs/report.pdf");
    const drop = { files: [], source: "drop" as const };
    expect(await media.upload!(drop, "Databases/db-ab12/files")).toEqual([{ target: "Databases/db-ab12/files/a.png" }]);
    expect(await media.remove!(["a.png"])).toEqual([]);
    expect(calls).toEqual([
      ["preview", "Docs/report.pdf", "", { width: 84, height: 28 }],
      ["show", "Docs/report.pdf", ""],
      ["insert", drop, { folder: "Databases/db-ab12/files" }],
      ["delete", ["a.png"]],
    ]);
    expect(navigated).toEqual([]);
  });
});
