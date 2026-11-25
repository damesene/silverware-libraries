// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { positionOf } from "./position.ts";


describe("an element's place in the page's text", () => {
  it("is what SilverBullet's editor says, a whole number from 0; none where it says none, errs or no function was handed over", async () => {
    const element = document.createElement("div");
    expect(await positionOf((node: Element) => (node === element ? 60 : undefined))!(element)).toBe(60);
    expect(await positionOf(async () => 12)!(element)).toBe(12);
    expect(await positionOf(() => null)!(element)).toBeUndefined();
    expect(await positionOf(() => -1)!(element)).toBeUndefined();
    expect(await positionOf(() => 1.5)!(element)).toBeUndefined();
    expect(await positionOf(() => { throw new Error("gone"); })!(element)).toBeUndefined();
    expect(positionOf(undefined)).toBeUndefined();
  });

});
