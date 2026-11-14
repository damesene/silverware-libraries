// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL, readLabel } from "../model/settings.ts";
import { drawLabelLine, labelTexts } from "./label.ts";

describe("a preview's label", () => {
  it("shows the type's icon and the alt text above by default, the name where there is none", () => {
    expect(labelTexts(DEFAULT_LABEL, { name: "cat.png", icon: "<svg></svg>", alt: "My cat" })).toEqual({ above: [{ field: "icon", text: "<svg></svg>" }, { field: "alt", text: "My cat" }], below: [] });
    expect(labelTexts(DEFAULT_LABEL, { name: "cat.png", alt: " " })).toEqual({ above: [{ field: "alt", text: "cat.png" }], below: [] });
  });

  it("draws the icon as a card does, left out of the tooltip", () => {
    const line = drawLabelLine(document, "above", [
      { field: "icon", text: "<svg></svg>" },
      { field: "alt", text: "My cat" },
    ])!;
    expect(line.querySelector(".swa-label-icon .swa-icon svg")).not.toBeNull();
    expect(line.title).toBe("My cat");
  });

  it("shows each property on in its place and order; the alt text not repeating the name shown too; one without a value left out", () => {
    const label = readLabel({ above: [{ field: "name" }, { field: "alt" }], below: [{ field: "modified" }, { field: "size" }] });
    expect(labelTexts(label, { name: "a.pdf", alt: "Report", size: "2 MB", modified: "Nov 14, 2026" })).toEqual({
      above: [
        { field: "name", text: "a.pdf" },
        { field: "alt", text: "Report" },
      ],
      below: [
        { field: "modified", text: "Nov 14, 2026" },
        { field: "size", text: "2 MB" },
      ],
    });
    // (No alt text: the name once; the size not known yet: left out)
    expect(labelTexts(label, { name: "a.pdf", modified: "Nov 14, 2026" })).toEqual({ above: [{ field: "name", text: "a.pdf" }], below: [{ field: "modified", text: "Nov 14, 2026" }] });
  });

  it("is drawn as a line of its texts, none where it has none", () => {
    const line = drawLabelLine(document, "below", [
      { field: "size", text: "2 MB" },
      { field: "modified", text: "Nov 14, 2026" },
    ])!;
    expect(line.className).toBe("swa-own swa-label swa-label-below");
    expect(line.title).toBe("2 MB · Nov 14, 2026");
    expect([...line.children].map((one) => one.className)).toEqual(["swa-label-size", "swa-label-modified"]);
    expect(drawLabelLine(document, "above", [])).toBeUndefined();
  });
});
