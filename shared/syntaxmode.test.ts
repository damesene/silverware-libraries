// @vitest-environment jsdom
// A host's markdown shown as written: the root marked while its UI option says so, asked again as the host draws its
// widgets anew (switching the mode rebuilds the editor); a plain click in the text the cursor's where a plugin asks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type SyntaxModeOptions, watchSyntaxMode } from "./syntaxmode.ts";

type Settings = { readonly hide: boolean; readonly clicks: boolean };
const SHOWN = "data-test-shown";
const CLICKS = "data-test-clicks";
const TEXT_MARK = "data-test-text";

const stops: (() => void)[] = [];
let settings: Settings = { hide: true, clicks: true };
afterEach(() => {
  settings = { hide: true, clicks: true };
  for (const stop of stops.splice(0)) stop();
  document.documentElement.removeAttribute(SHOWN);
  document.documentElement.removeAttribute(CLICKS);
  document.body.replaceChildren();
});

/** The options a plugin gives, its settings read as a test sets them */
function options(shown: () => unknown, read: () => Promise<Settings> | Settings = () => settings, clicks = true): SyntaxModeOptions<Settings> {
  return {
    page: { widgets: ".widget", text: ".text", notText: ".not-text" },
    shown,
    read,
    same: (a, b) => a.hide === b.hide && a.clicks === b.clicks,
    marks: (given) => ({ [SHOWN]: given.hide, [CLICKS]: clicks && given.clicks }),
    ...(clicks ? { placesCursor: (given: Settings) => given.clicks, textMark: TEXT_MARK } : {}),
    initial: { hide: true, clicks: true },
  };
}

describe("a host's markdown shown as written", () => {
  it("marks the root while the option is on, asked again as widgets are drawn anew", async () => {
    let on = true;
    stops.push(watchSyntaxMode(document, options(async () => on)).stop);
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(SHOWN)).toBe(true));
    on = false;
    document.body.append(Object.assign(document.createElement("div"), { className: "widget" }));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(SHOWN)).toBe(false));
  });

  it("leaves the root unmarked where the option cannot be read", async () => {
    stops.push(watchSyntaxMode(document, options(() => Promise.reject(new Error("no such option")))).stop);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.documentElement.hasAttribute(SHOWN)).toBe(false);
  });

  it("holds a plain click in the text back from what follows links while on; Ctrl held, or a widget's, or off: not", async () => {
    let on = true;
    document.body.innerHTML = '<div class="text"><div class="line"><span class="link">![[a.png]]</span></div><div class="not-text"><button>Run</button></div></div>';
    stops.push(watchSyntaxMode(document, options(async () => on)).stop);
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(SHOWN)).toBe(true));
    const followed: string[] = [];
    document.querySelector(".text")!.addEventListener("click", (event) => void followed.push((event.target as Element).textContent ?? ""));
    const click = (selector: string, init: MouseEventInit = {}) => document.querySelector(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ...init }));
    click(".link");
    click(".link", { ctrlKey: true });
    click("button");
    expect(followed).toEqual(["![[a.png]]", "Run"]);
    // (The text's pointer over a link then: the root marked, the text too)
    expect(document.documentElement.hasAttribute(CLICKS)).toBe(true);
    expect(document.querySelector(".text")!.hasAttribute(TEXT_MARK)).toBe(true);
    on = false;
    document.querySelector(".text")!.append(Object.assign(document.createElement("div"), { className: "widget" }));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(SHOWN)).toBe(false));
    click(".link");
    expect(followed).toHaveLength(3);
  });

  it("leaves a click to the host where the plugin places no cursor", async () => {
    document.body.innerHTML = '<div class="text"><span class="link">[[a]]</span></div>';
    stops.push(watchSyntaxMode(document, options(async () => true, () => settings, false)).stop);
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(SHOWN)).toBe(true));
    const followed: string[] = [];
    document.querySelector(".text")!.addEventListener("click", () => void followed.push("followed"));
    document.querySelector(".link")!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(followed).toEqual(["followed"]);
    expect(document.documentElement.hasAttribute(CLICKS)).toBe(false);
  });

  it("does neither where the user turned it off", async () => {
    settings = { hide: false, clicks: false };
    const watcher = watchSyntaxMode(document, options(async () => true));
    stops.push(watcher.stop);
    document.body.innerHTML = '<div class="text"><div class="line"><span class="link">[[a]]</span></div></div>';
    const followed: string[] = [];
    document.querySelector(".text")!.addEventListener("click", () => void followed.push("followed"));
    document.querySelector(".link")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.documentElement.hasAttribute(SHOWN)).toBe(false);
    expect(document.documentElement.hasAttribute(CLICKS)).toBe(false);
    document.querySelector(".link")!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(followed).toEqual(["followed"]);
    // Turned on again: shown at once
    settings = { hide: true, clicks: true };
    watcher.settingsChanged(settings);
    expect(document.documentElement.hasAttribute(SHOWN)).toBe(true);
  });

  it("keeps the settings just saved while the configuration read still gives the ones before", async () => {
    let configured: Settings = { hide: true, clicks: true };
    const watcher = watchSyntaxMode(document, options(async () => true, async () => configured));
    stops.push(watcher.stop);
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(CLICKS)).toBe(true));
    watcher.settingsChanged({ hide: true, clicks: false });
    expect(document.documentElement.hasAttribute(CLICKS)).toBe(false);
    // A press read the configuration still before the save: the saved settings kept
    document.body.innerHTML = '<div class="text"><span class="link">x</span></div>';
    document.querySelector(".link")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.documentElement.hasAttribute(CLICKS)).toBe(false);
    // Then the configuration has them, and is followed again
    configured = { hide: true, clicks: false };
    document.querySelector(".link")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    configured = { hide: true, clicks: true };
    document.querySelector(".link")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await vi.waitFor(() => expect(document.documentElement.hasAttribute(CLICKS)).toBe(true));
  });
});
