// @vitest-environment jsdom
// SilverBullet's embeds as the assets find them (2.12.1, probed 2026-11-13): its widget's medium or its words that it
// could not draw one; and media in markdown rendered outside the editor (a grid's cell), framed to be decorated alike.
import { afterEach, describe, expect, it, vi } from "vitest";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import { drawnLink, drawnTarget, silverBulletAssetHost } from "./assets.ts";
import { silverBulletPlatform } from "./platform.ts";

const bridge = { getText: () => "", getCurrentPage: () => "P", replaceRange: () => undefined, readPage: () => "", writePage: () => undefined, listPages: () => [], flash: () => undefined } as unknown as Bridge;

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

describe("SilverBullet's embeds found", () => {
  it("reads a widget's target from its medium or from what it could not draw", () => {
    const widget = document.createElement("div");
    widget.innerHTML = '<img src=".fs/Pics/my%20cat.png" alt="Cat">';
    expect(drawnTarget(widget)?.target).toBe("Pics/my cat.png");
    widget.innerHTML = '<span class="p"><b>Error:</b> Unsupported content: archive.zip</span>';
    expect(drawnTarget(widget)).toEqual({ target: "archive.zip", native: undefined });
    widget.innerHTML = "<p>An embedded page</p>";
    expect(drawnTarget(widget)).toBeUndefined();
  });

  it("finds SilverBullet's widgets and, in a block rendered outside the editor, puts each medium in a frame of its own", async () => {
    const host = silverBulletAssetHost(bridge, pageWriter(silverBulletPlatform(bridge)), document);
    const found: string[][] = [];
    const widget = Object.assign(document.createElement("div"), { className: "sb-inline-content", innerHTML: '<img src=".fs/a.png">' });
    document.body.append(widget);
    stops.push(host.watch((drawn) => found.push(drawn.map((one) => `${one.frame.className}:${one.target}`))));
    expect(found).toEqual([["sb-inline-content:a.png"]]);
    const cell = Object.assign(document.createElement("div"), { innerHTML: '<span class="p"><img src=".fs/b.png" data-pos="0"></span>' });
    cell.setAttribute("data-swl-rendered", "");
    document.body.append(cell);
    await vi.waitFor(() => expect(found).toHaveLength(2));
    expect(found[1]).toEqual(["swl-asset-frame:b.png"]);
    expect(cell.querySelector(".swl-asset-frame > img")).not.toBeNull();
  });

  it("frames the place of an embed SilverBullet's HTML draws none of, its target its own", async () => {
    const host = silverBulletAssetHost(bridge, pageWriter(silverBulletPlatform(bridge)), document);
    const found: string[][] = [];
    stops.push(host.watch((drawn) => found.push(drawn.map((one) => `${one.target}:${one.native ? "native" : "none"}:${one.position?.()}`))));
    const cell = Object.assign(document.createElement("div"), { innerHTML: '<span class="p"><span class="swl-embed" data-swl-embed="archive.zip" data-pos="7"></span></span>' });
    cell.setAttribute("data-swl-rendered", "");
    cell.setAttribute("data-swl-pos", "40");
    document.body.append(cell);
    await vi.waitFor(() => expect(found).toEqual([["archive.zip:none:47"]]));
  });
});

describe("a block rendered outside the editor given its place later", () => {
  it("offers its media again, their places known now", async () => {
    const host = silverBulletAssetHost(bridge, pageWriter(silverBulletPlatform(bridge)), document);
    const found: (number | undefined)[][] = [];
    stops.push(host.watch((drawn) => found.push(drawn.map((one) => one.position?.()))));
    const cell = Object.assign(document.createElement("div"), { innerHTML: '<span class="p"><img src=".fs/b.png"></span>' });
    cell.setAttribute("data-swl-rendered", "");
    document.body.append(cell);
    await vi.waitFor(() => expect(found).toEqual([[undefined]]));
    cell.setAttribute("data-swl-pos", "61");
    cell.setAttribute("data-swl-end", "85");
    await vi.waitFor(() => expect(found).toEqual([[undefined], [61]]));
    expect(host.renderedRanges()).toEqual([{ from: 61, to: 85 }]);
  });
});

describe("SilverBullet's links found", () => {
  it("reads a link's target and form as SilverBullet draws it, in the editor and in a cell", () => {
    const of = (html: string) => drawnLink(Object.assign(document.createElement("div"), { innerHTML: html }).firstElementChild as HTMLElement);
    expect(of('<a class="sb-wiki-link" href="Docs/a.pdf">a</a>')).toMatchObject({ target: "Docs/a.pdf", style: "wiki" });
    expect(of('<a class="sb-link" href="../a.pdf">a</a>')).toMatchObject({ target: "../a.pdf", style: "markdown" });
    expect(of('<a class="wiki-link" href="/a.pdf" data-ref="a.pdf">a</a>')).toMatchObject({ target: "a.pdf", style: "wiki" });
  });

  it("makes a file of the space of a link to one, resolved as SilverBullet resolves it; a page or a site none", () => {
    const host = silverBulletAssetHost(bridge, pageWriter(silverBulletPlatform(bridge)), document);
    const a = (target: string, style: "wiki" | "markdown" = "wiki") => host.linkAsset({ element: document.createElement("a"), target, style }, "Notes/Page");
    expect(a("Docs/report.pdf")).toMatchObject({ kind: "file", path: "Docs/report.pdf" });
    expect(a("report.pdf", "markdown")).toMatchObject({ kind: "file", path: "Notes/report.pdf" });
    expect(a("report.pdf#page=2")).toMatchObject({ path: "report.pdf" });
    expect(a("Other page")).toBeUndefined();
    expect(a("Other.md", "markdown")).toBeUndefined();
    expect(a("https://example.com/a.pdf", "markdown")).toBeUndefined();
  });

  it("offers each link once, the icon put into it no new one", async () => {
    const host = silverBulletAssetHost(bridge, pageWriter(silverBulletPlatform(bridge)), document);
    const found: string[][] = [];
    stops.push(host.watchLinks((links) => found.push(links.map((one) => one.target))));
    const cell = Object.assign(document.createElement("div"), { innerHTML: '<span class="p"><a class="wiki-link" data-ref="a.pdf" href="/a.pdf">a.pdf</a></span>' });
    cell.setAttribute("data-swl-rendered", "");
    document.body.append(cell);
    await vi.waitFor(() => expect(found).toEqual([["a.pdf"]]));
    cell.querySelector("a")!.prepend(document.createElement("span"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(found).toEqual([["a.pdf"]]);
  });
});

