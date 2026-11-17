// @vitest-environment jsdom
// A blank line of a cell clicked: found by height, between what is drawn above it and the line after it. jsdom lays
// nothing out: the boxes are given.
import { afterEach, describe, expect, it } from "vitest";
import { blankLineAt } from "./cellpoint.ts";
import { keepBlankLines } from "./view.ts";

/** Each element's box, by its top and bottom; text by the range round it */
function laidOut(boxes: Map<Element, readonly [number, number]>, text: readonly [number, number]): void {
  const rect = ([top, bottom]: readonly [number, number]) => ({ top, bottom, left: 0, right: 100, x: 0, y: top, width: 100, height: bottom - top, toJSON: () => ({}) }) as DOMRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return rect(boxes.get(this) ?? [0, 0]);
  };
  Range.prototype.getBoundingClientRect = () => rect(text);
}

const elementRect = Element.prototype.getBoundingClientRect;
const rangeRect = Range.prototype.getBoundingClientRect;
afterEach(() => {
  Element.prototype.getBoundingClientRect = elementRect;
  Range.prototype.getBoundingClientRect = rangeRect;
});

describe("a blank line clicked", () => {
  it("lies under the text drawn above it, an item's text left unwrapped too, not over it", () => {
    // An item's text, a blank line, a list nested in the item (its margin between)
    const content = "- first\n\n  - b";
    const cell = document.createElement("div");
    cell.innerHTML = '<ul><li>first<ul data-pos="11"><li data-pos="11">b</li></ul></li></ul>';
    keepBlankLines(document, cell, content);
    const nested = cell.querySelector('ul[data-pos="11"]')!;
    laidOut(new Map([[cell, [0, 100]], [nested, [50, 75]], [nested.firstElementChild!, [50, 75]]]), [0, 20]);
    // On the text: no blank line; under it, in the blank line or the margin: the blank line's start
    expect(blankLineAt(content, cell, 10)).toBeUndefined();
    expect(blankLineAt(content, cell, 22)).toBe(content.indexOf("\n\n") + 1);
    expect(blankLineAt(content, cell, 45)).toBe(content.indexOf("\n\n") + 1);
  });
});
