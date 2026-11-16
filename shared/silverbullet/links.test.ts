// A link pressed in a plugin's field followed as SilverBullet follows one: where it goes from a page, how it is opened.
import { describe, expect, it, vi } from "vitest";
import { followLink, linkTarget, refHref } from "./links.ts";

describe("a link pressed in a field", () => {
  it("goes where SilverBullet goes: a wiki link from the space's root, a markdown link from the page's folder, its section kept", () => {
    expect(linkTarget("[[Notes/Plan#Steps|the plan]]", "Work/Today")).toEqual({ ref: "Notes/Plan#Steps" });
    expect(linkTarget("[[/photo.png]]", "Work/Today")).toEqual({ ref: "photo.png" });
    expect(linkTarget("[the report](files/report%202.pdf)", "Work/Today")).toEqual({ ref: "Work/files/report 2.pdf" });
    expect(linkTarget("[up](../Other#Part)", "Work/Today")).toEqual({ ref: "Other#Part" });
    expect(linkTarget("[part](#Part)", "Work/Today")).toEqual({ ref: "Work/Today#Part" });
    expect(linkTarget("[site](https://example.com/a?b=1)", "Work/Today")).toEqual({ url: "https://example.com/a?b=1" });
    expect(linkTarget("[mail](mailto:a@example.com)", "Work/Today")).toEqual({ url: "mailto:a@example.com" });
    // (A URL that runs or reads is never opened by a press)
    expect(linkTarget("[x](javascript:void0)", "Work/Today")).toBeUndefined();
    expect(linkTarget("[x](data:text/html,hi)", "Work/Today")).toBeUndefined();
    expect(linkTarget("[x](file:///etc/passwd)", "Work/Today")).toBeUndefined();
    expect(linkTarget("[[a]] and [[b]]", "Work/Today")).toBeUndefined();
    expect(linkTarget("plain", "Work/Today")).toBeUndefined();
  });

  it("is followed in place, in a new tab by its address where asked; a URL of the web always in a tab", () => {
    const navigate = vi.fn();
    const openTab = vi.fn();
    expect(followLink("[[Notes/Plan#Steps]]", "Work", { newTab: false }, { navigate, openTab })).toBe(true);
    expect(followLink("[[Notes/My plan#Steps]]", "Work", { newTab: true }, { navigate, openTab })).toBe(true);
    expect(followLink("[site](https://example.com)", "Work", { newTab: false }, { navigate, openTab })).toBe(true);
    expect(followLink("no link", "Work", { newTab: false }, { navigate, openTab })).toBe(false);
    expect(navigate.mock.calls).toEqual([["Notes/Plan#Steps"]]);
    expect(openTab.mock.calls).toEqual([["Notes/My%20plan#Steps"], ["https://example.com"]]);
    expect(refHref("a b/c.png")).toBe("a%20b/c.png");
  });
});
