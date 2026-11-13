// @vitest-environment jsdom
// SilverBullet's markdown shown as written: the root marked while its UI option says so, asked again as SilverBullet
// draws its widgets anew (switching the mode rebuilds the editor).
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchSyntaxMode } from "./syntaxmode.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.documentElement.removeAttribute("data-swl-syntax-shown");
  document.body.replaceChildren();
});

describe("SilverBullet's markdown shown as written", () => {
  it("marks the root while the option is on, asked again as widgets are drawn anew", async () => {
    let on = true;
    stops.push(watchSyntaxMode(document, async () => on));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute("data-swl-syntax-shown")).toBe(true));
    on = false;
    document.body.append(Object.assign(document.createElement("div"), { className: "sb-inline-content" }));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute("data-swl-syntax-shown")).toBe(false));
  });

  it("leaves the root unmarked where the option cannot be read", async () => {
    stops.push(watchSyntaxMode(document, () => Promise.reject(new Error("no such option"))));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.documentElement.hasAttribute("data-swl-syntax-shown")).toBe(false);
  });
});
