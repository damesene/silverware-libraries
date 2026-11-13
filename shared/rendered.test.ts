// The contract of markdown rendered outside the editor: the API as handed over where it is of this version, else a
// stand-in that has nothing drawn and tells nothing.
import { describe, expect, it } from "vitest";
import { RENDERED_VERSION, renderedOf } from "./rendered.ts";

describe("renderedOf", () => {
  it("gives the API handed over where it is of this version", () => {
    const api = { version: RENDERED_VERSION, items: () => [], ranges: () => [{ from: 1, to: 2 }], onChange: () => () => undefined };
    expect(renderedOf(api)).toBe(api);
  });

  it("gives a stand-in for none, another version, or what is no API", () => {
    for (const given of [undefined, null, 3, { version: RENDERED_VERSION + 1, items: () => [], ranges: () => [], onChange: () => () => undefined }, { version: RENDERED_VERSION }]) {
      const rendered = renderedOf(given);
      expect(rendered.items()).toEqual([]);
      expect(rendered.ranges("text")).toEqual([]);
      expect(typeof rendered.onChange(() => undefined)).toBe("function");
    }
  });
});
