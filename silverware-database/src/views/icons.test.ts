// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ItemLooks } from "../core/view.ts";
import type { Property } from "../model/database.ts";
import { propertyIcon } from "./icons.ts";

// The looks as the core gives them: an icon of the user's drawn in a span of the class given (its value as text here)
const looks: Pick<ItemLooks, "ownIcon"> = {
  ownIcon: (value, className) => {
    const span = document.createElement("span");
    span.className = className;
    span.dataset.own = value;
    return span;
  },
};
const property = (icon?: string) => ({ key: "status", label: "Status", type: "select", ...(icon ? { icon } : {}) }) as unknown as Property;

describe("A property's icon", () => {
  it("its own (an emoji, an icon of Silverware Icons) drawn by the looks, as an item's is", () => {
    for (const own of ["🚀", "lucide:rocket"]) {
      const made = propertyIcon(document, looks, property(own), { name: "select" }, "swd-prop-icon");
      expect([made.dataset.own, made.className]).toEqual([own, "swd-prop-icon swd-prop-own-icon"]);
    }
  });

  it("else its type's: a custom type's icon of Silverware Icons drawn by the looks, a built-in one's by name", () => {
    expect(propertyIcon(document, looks, property(), { name: "mine", icon: "lucide:star" }, "swd-prop-icon").dataset.own).toBe("lucide:star");
    const builtIn = propertyIcon(document, looks, property(), { name: "select" }, "swd-prop-icon");
    expect([builtIn.dataset.own, builtIn.querySelector("svg") !== null]).toEqual([undefined, true]);
  });
});
