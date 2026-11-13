import { describe, expect, it } from "vitest";
import type { Bridge } from "../../bridge.ts";
import { documentUrl, silverBulletPlatform } from "./platform.ts";

const bridge = (linkStyle?: string) => ({ ...(linkStyle === undefined ? {} : { linkStyle: () => linkStyle }) }) as unknown as Bridge;

describe("SilverBullet's platform", () => {
  it("gives SilverBullet's link style, wiki where none is set or handed over", async () => {
    expect(await silverBulletPlatform(bridge("markdown")).space.linkStyle()).toBe("markdown");
    expect(await silverBulletPlatform(bridge("wikilink")).space.linkStyle()).toBe("wiki");
    expect(await silverBulletPlatform(bridge()).space.linkStyle()).toBe("wiki");
  });

  it("gives a file's URL as SilverBullet serves it", () => {
    expect(documentUrl("Pics/my cat.png")).toBe(".fs/Pics/my%20cat.png");
    expect(documentUrl("/a.pdf")).toBe(".fs/a.pdf");
    expect(silverBulletPlatform(bridge()).space.documentUrl("x.png")).toBe(".fs/x.png");
  });
});
