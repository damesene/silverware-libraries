// @vitest-environment jsdom
// SilverBullet's embeds as the assets find them (2.12.1, probed 2026-11-13): its widget's medium or its words that it
// could not draw one; and media and links drawn outside the editor (a grid's cell) as the one drawing them tells
// (shared/rendered.ts), each medium framed to be decorated alike.
import { afterEach, describe, expect, it, vi } from "vitest";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import { type Rendered, RENDERED_VERSION, type RenderedItem } from "../../../../shared/rendered.ts";
import type { Bridge } from "../../bridge.ts";
import { drawnLink, drawnTarget, silverBulletAssetHost } from "./assets.ts";
import { silverBulletPlatform } from "./platform.ts";

const bridge = { getText: () => "", getCurrentPage: () => "P", replaceRange: () => undefined, readPage: () => "", writePage: () => undefined, listPages: () => [], flash: () => undefined } as unknown as Bridge;

/** What is drawn outside the editor, told as a test says: its items and ranges, told again by `tell` */
function renderedOf(items: RenderedItem[] = [], ranges: { from: number; to: number }[] = []) {
  const listeners = new Set<(items: readonly RenderedItem[]) => void>();
  const rendered: Rendered = {
    version: RENDERED_VERSION,
    items: () => items,
    ranges: () => ranges,
    onChange: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  const tell = (next: RenderedItem[]) => {
    items = next;
    for (const listener of listeners) listener(next);
  };
  return { rendered, tell };
}
const hostOf = (rendered: Rendered = renderedOf().rendered) => silverBulletAssetHost(bridge, pageWriter(silverBulletPlatform(bridge)), document, rendered);

/** A cell as a grid draws it, its elements as the one drawing tells of them */
function cellOf(html: string) {
  const cell = Object.assign(document.createElement("div"), { innerHTML: html });
  document.body.append(cell);
  return cell;
}

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
    // A run of spaces in its words kept by a no-break one (2.12.1): read as the target's spaces
    widget.innerHTML = '<span class="p"><b>Error:</b> Unsupported content: Two\u00a0 spaces/archive.zip</span>';
    expect(drawnTarget(widget)?.target).toBe("Two  spaces/archive.zip");
    widget.innerHTML = "<p>An embedded page</p>";
    expect(drawnTarget(widget)).toBeUndefined();
  });

  it("finds SilverBullet's widgets, and puts each medium told of outside the editor in a frame of its own", async () => {
    const { rendered, tell } = renderedOf();
    const host = hostOf(rendered);
    const found: string[][] = [];
    const widget = Object.assign(document.createElement("div"), { className: "sb-inline-content", innerHTML: '<img src=".fs/a.png">' });
    document.body.append(widget);
    stops.push(host.watch((drawn) => found.push(drawn.map((one) => `${one.frame.className}:${one.target}:${one.position?.() ?? "-"}`))));
    expect(found).toEqual([["sb-inline-content:a.png:-"]]);
    const cell = cellOf('<span class="p"><img src=".fs/b.png"></span>');
    const medium = cell.querySelector("img")!;
    tell([{ kind: "embed", element: medium, target: "b.png", style: "wiki", position: 40, room: cell }]);
    expect(found[1]).toEqual(["swa-frame:b.png:40"]);
    expect(cell.querySelector(".swa-frame > img")).toBe(medium);
  });

  it("frames the place of an embed SilverBullet's HTML draws none of, no medium of the host's in it", () => {
    const cell = cellOf('<span class="p"><span class="swl-embed" data-swl-embed="archive.zip">![[archive.zip]]</span></span>');
    const place = cell.querySelector<HTMLElement>(".swl-embed")!;
    const { rendered } = renderedOf([{ kind: "embed", element: place, target: "archive.zip", style: "wiki", position: 47, room: cell }]);
    const found: string[][] = [];
    stops.push(hostOf(rendered).watch((drawn) => found.push(drawn.map((one) => `${one.target}:${one.native ? "native" : "none"}:${one.position?.()}:${one.room?.() === cell}`))));
    expect(found).toEqual([["archive.zip:none:47:true"]]);
  });
});

describe("what is drawn outside the editor, told again", () => {
  it("offers its media again with their places as told last, one frame each, and gives its ranges", () => {
    const cell = cellOf('<span class="p"><img src=".fs/b.png"></span>');
    const medium = cell.querySelector("img")!;
    const { rendered, tell } = renderedOf([], [{ from: 61, to: 85 }]);
    const host = hostOf(rendered);
    const found: (number | undefined)[][] = [];
    stops.push(host.watch((drawn) => found.push(drawn.map((one) => one.position?.()))));
    tell([{ kind: "embed", element: medium, target: "b.png", style: "wiki", position: 61, room: cell }]);
    tell([{ kind: "embed", element: medium, target: "b.png", style: "wiki", position: 70, room: cell }]);
    expect(found).toEqual([[61], [70]]);
    expect(cell.querySelectorAll(".swa-frame")).toHaveLength(1);
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
    const host = hostOf();
    const a = (target: string, style: "wiki" | "markdown" = "wiki") => host.linkAsset({ element: document.createElement("a"), target, style }, "Notes/Page");
    expect(a("Docs/report.pdf")).toMatchObject({ kind: "file", path: "Docs/report.pdf" });
    expect(a("report.pdf", "markdown")).toMatchObject({ kind: "file", path: "Notes/report.pdf" });
    expect(a("report.pdf#page=2")).toMatchObject({ path: "report.pdf" });
    expect(a("Other page")).toBeUndefined();
    expect(a("Other.md", "markdown")).toBeUndefined();
    expect(a("https://example.com/a.pdf", "markdown")).toBeUndefined();
  });

  it("offers each link once, a link in the editor by its widget, one outside it as told with its place", async () => {
    const cell = cellOf('<span class="p"><a class="wiki-link" data-ref="a.pdf" href="/a.pdf">a.pdf</a></span>');
    const link = cell.querySelector("a")!;
    const { rendered, tell } = renderedOf();
    const offered: { target: string; position?: () => number | undefined }[][] = [];
    stops.push(hostOf(rendered).watchLinks((links) => offered.push([...links])));
    const found = () => offered.map((links) => links.map((one) => `${one.target}:${one.position?.() ?? "-"}`));
    const editor = Object.assign(document.createElement("div"), { className: "cm-content", innerHTML: '<a class="sb-wiki-link" href="b.pdf">b.pdf</a>' });
    document.body.append(editor);
    await vi.waitFor(() => expect(found()).toEqual([["b.pdf:-"]]));
    tell([{ kind: "link", element: link, target: "a.pdf", style: "wiki", position: 12, room: cell }]);
    tell([{ kind: "link", element: link, target: "a.pdf", style: "wiki", position: 15, room: cell }]);
    // (Offered once, its place the one told last)
    expect(found()).toEqual([["b.pdf:-"], ["a.pdf:15"]]);
    // (Its icon put into the link: no new link)
    editor.querySelector("a")!.prepend(document.createElement("span"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(offered).toHaveLength(2);
  });
});

