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

  it("holds a plain click in the text back from what follows links while on; Ctrl held, or a widget's, or off: not", async () => {
    let on = true;
    stops.push(watchSyntaxMode(document, async () => on));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute("data-swl-syntax-shown")).toBe(true));
    document.body.innerHTML = '<div id="sb-main"><div class="cm-content"><div class="cm-line"><span class="link">![[a.png]]</span></div><div class="sb-lua-directive-block"><button>Run</button></div></div></div>';
    const followed: string[] = [];
    document.querySelector(".cm-content")!.addEventListener("click", (event) => void followed.push((event.target as Element).textContent ?? ""));
    const click = (selector: string, init: MouseEventInit = {}) => document.querySelector(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ...init }));
    click(".link");
    click(".link", { ctrlKey: true });
    click("button");
    expect(followed).toEqual(["![[a.png]]", "Run"]);
    on = false;
    document.querySelector(".cm-content")!.append(Object.assign(document.createElement("div"), { className: "sb-inline-content" }));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute("data-swl-syntax-shown")).toBe(false));
    click(".link");
    expect(followed).toHaveLength(3);
  });
});
