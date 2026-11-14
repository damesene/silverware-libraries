import { describe, expect, it } from "vitest";
import { documentUrl, silverBulletPlatform } from "./platform.ts";

describe("SilverBullet's platform", () => {
  it("gives a file's URL as SilverBullet serves it", () => {
    expect(documentUrl("Pics/my cat.png")).toBe(".fs/Pics/my%20cat.png");
    expect(documentUrl("/a.pdf")).toBe(".fs/a.pdf");
  });

  it("lists the pages' names, as Space Lua hands them over", async () => {
    const api = { getCurrentPage: () => "P", getText: () => "", replaceRange: () => undefined, readPage: () => "", writePage: () => undefined };
    expect(await silverBulletPlatform({ ...api, listPages: () => [{ name: "A" }, "B", { other: 1 }] }).space.list()).toEqual(["A", "B"]);
    expect(await silverBulletPlatform({ ...api, listPages: () => ({ 1: { name: "C" } }) }).space.list()).toEqual(["C"]);
  });
});
