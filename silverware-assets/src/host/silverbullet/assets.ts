// What the assets ask of SilverBullet (src/assets/decorate.ts, `AssetHost`): its embeds drawn (2.12.1, probed
// 2026-11-13: `.sb-inline-content` in the editor's content, its <img>, <video>, <audio> or <object> loading `.fs/<path>`,
// or "Error: Unsupported content: <name>"; an embedded page's markdown is no medium and is left alone), its button bar
// hidden (as on a grid: inline and important), a target resolved as SilverBullet resolves it, a file's URL, the
// settings, an embed written through the page writer. What is drawn outside the editor (a grid's cells) is told by
// the one drawing it (shared/rendered.ts: its media, its links, their places), never read from its HTML.
import type { Asset } from "../../../../shared/assets.ts";
import { type Embed, type EmbedChanges, resolvedTarget } from "../../../../shared/markdown/embed.ts";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import type { Rendered, RenderedItem } from "../../../../shared/rendered.ts";
import { ASSETS_PATH } from "../../model/settings.ts";
import { documentUrl } from "../../../../shared/silverbullet/platform.ts";

const FRAME = ".sb-inline-content";
// A medium drawn outside the editor (a grid's cell) is a plain element: put in a frame of Silverware Assets' own, to
// be decorated as SilverBullet's widget is
const OWN_FRAME = "swa-frame";
const MEDIA = "img, video, audio, object";
const BARS = ".button-bar, .sb-widget-menu-bar";
// (The frame's whole text: a page embedded there whose own embed failed says it deeper, after its words)
const UNSUPPORTED = /^(?:Error:\s*)?Unsupported content:\s*(.+)$/;
// Links as SilverBullet draws them in the editor (2.12.1, probed 2026-11-13): a wiki link's widget `a.sb-wiki-link`
// (its href the target as written; a widget, so an element put in it is no edit of the text). A markdown link there
// (`a.sb-link`) is the editor's own text, marked: left alone, as CodeMirror would take an element put in it for an
// edit. Those drawn outside the editor (a grid's cell) are told (`Rendered`)
const LINKS = ".cm-content a.sb-wiki-link";
// The editor's content: as tall as the whole page
const CONTENT = ".cm-content";
// A file of the space's name: an extension of its own, not a page's (`.md`)
const FILE_NAME = /\.(?!md$)[a-z0-9]{1,8}$/i;
const WEB = /^[a-z][a-z0-9+.-]*:/i;

/** A link drawn (src/assets/decorate.ts' `DrawnLink`) */
type Link = { readonly element: HTMLElement; readonly target: string; readonly style: "wiki" | "markdown"; readonly position?: () => number | undefined };
type FormWrite = { readonly text: string; readonly occurrence: number; readonly of: number };

/** A link's target and form as SilverBullet drew it; none for an element of Silverware Assets' own */
export function drawnLink(element: HTMLElement): Link | undefined {
  if (element.closest(".swa-own, .swa-card")) return undefined;
  if (element.matches("a.sb-wiki-link")) return { element, target: element.getAttribute("href") ?? "", style: "wiki" };
  if (element.matches("a.wiki-link[data-ref]")) return { element, target: element.getAttribute("data-ref") ?? "", style: "wiki" };
  const href = element.getAttribute("href");
  return href ? { element, target: href, style: "markdown" } : undefined;
}

/** An embed drawn (src/assets/decorate.ts' `DrawnEmbed`, named apart: the host knows no area) */
type Drawn = {
  readonly frame: HTMLElement;
  readonly target: string;
  readonly native: HTMLElement | undefined;
  readonly position?: () => number | undefined;
  readonly room?: () => HTMLElement | undefined;
};
type Write = { readonly text: string; readonly occurrence: number; readonly of: number; readonly changes: EmbedChanges };

// How deep in its frame SilverBullet puts an embed's medium, at most (its widget's div, its content's)
const MEDIUM_DEPTH = 2;

/** How many elements lie between a frame and an element in it */
function depthIn(frame: HTMLElement, element: HTMLElement): number {
  let depth = 0;
  for (let at = element.parentElement; at && at !== frame; at = at.parentElement) depth++;
  return depth;
}

/** The target an embed's frame was drawn of: its medium's path in the space (or its URL), or the name it could not draw */
export function drawnTarget(frame: HTMLElement): { readonly target: string; readonly native: HTMLElement | undefined } | undefined {
  // (The frame's own medium, in its content (2.12.1, probed 2026-11-14: `div > div.content > img`); one deeper is in a
  // page embedded there, the other page's)
  const native = [...frame.querySelectorAll<HTMLElement>(MEDIA)].find((medium) => depthIn(frame, medium) <= MEDIUM_DEPTH);
  const source = native?.getAttribute("src") ?? native?.getAttribute("data");
  if (source) {
    const path = source.replace(/^\.?\/?\.fs\//, "");
    let target = path;
    try {
      target = decodeURIComponent(path);
    } catch {
      // (As written)
    }
    return { target, native };
  }
  // (Its words keep a run of spaces by no-break ones, `a\u00a0 b` for `a  b`, 2.12.1: the target's spaces again)
  const unsupported = UNSUPPORTED.exec(frame.textContent?.replace(/\u00a0/g, " ").trim() ?? "");
  return unsupported ? { target: unsupported[1]!.trim(), native: undefined } : undefined;
}

export function silverBulletAssetHost(bridge: Bridge, writer: PageWriter, doc: Document, rendered: Rendered) {
  // What is drawn outside the editor, as last told: each element's item (its place, its room)
  const told = new WeakMap<HTMLElement, RenderedItem>();
  const remember = (items: readonly RenderedItem[]) => {
    for (const item of items) told.set(item.element, item);
  };
  return {
    // (The function given back stops it)
    watch: (drawn: (embeds: readonly Drawn[]) => void): (() => void) => {
      const seen = new WeakSet<HTMLElement>();
      const look = (root: ParentNode) => {
        const found: Drawn[] = [];
        const frames = new Set<HTMLElement>();
        if (root instanceof HTMLElement && root.matches(FRAME)) frames.add(root);
        if (root instanceof HTMLElement) {
          const around = root.closest<HTMLElement>(FRAME);
          if (around) frames.add(around);
        }
        root.querySelectorAll<HTMLElement>(FRAME).forEach((frame) => frames.add(frame));
        for (const frame of frames) {
          if (seen.has(frame)) continue;
          const target = drawnTarget(frame);
          // (Its content comes after the frame: looked at again as it does)
          if (!target) continue;
          seen.add(frame);
          for (const bar of frame.parentElement?.querySelectorAll<HTMLElement>(BARS) ?? []) bar.style.setProperty("display", "none", "important");
          found.push({ frame, ...target });
        }
        if (found.length) drawn(found);
      };
      // Media drawn outside the editor, as told: each in a frame of its own (once), offered with its place as told last
      const offer = (items: readonly RenderedItem[]) => {
        remember(items);
        const found: Drawn[] = [];
        for (const item of items) {
          if (item.kind !== "embed") continue;
          const medium = item.element;
          let frame = medium.parentElement;
          if (!frame?.classList.contains(OWN_FRAME)) {
            frame = doc.createElement("span");
            frame.className = OWN_FRAME;
            medium.replaceWith(frame);
            frame.append(medium);
          }
          const native = medium.matches(MEDIA) ? medium : undefined;
          found.push({ frame, target: item.target, native, position: () => told.get(medium)?.position, room: () => told.get(medium)?.room });
        }
        if (found.length) drawn(found);
      };
      look(doc);
      offer(rendered.items());
      const stopTold = rendered.onChange(offer);
      const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) look(node);
      });
      observer.observe(doc.body, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        stopTold();
      };
    },
    // (Each link element offered once: Silverware Assets' icon put into it is no new link; the function given back stops it)
    watchLinks: (drawn: (links: readonly Link[]) => void): (() => void) => {
      const seen = new WeakSet<HTMLElement>();
      const look = (root: ParentNode) => {
        const found: Link[] = [];
        const elements = [...(root instanceof HTMLElement && root.matches(LINKS) ? [root] : []), ...root.querySelectorAll<HTMLElement>(LINKS)];
        for (const element of elements) {
          if (seen.has(element)) continue;
          seen.add(element);
          const link = drawnLink(element);
          if (link?.target) found.push(link);
        }
        if (found.length) drawn(found);
      };
      // Links drawn outside the editor, as told (each once), their places as told last
      const offered = new WeakSet<HTMLElement>();
      const offer = (items: readonly RenderedItem[]) => {
        remember(items);
        const found: Link[] = [];
        for (const item of items) {
          if (item.kind !== "link" || offered.has(item.element)) continue;
          offered.add(item.element);
          found.push({ element: item.element, target: item.target, style: item.style, position: () => told.get(item.element)?.position });
        }
        if (found.length) drawn(found);
      };
      look(doc);
      offer(rendered.items());
      const stopTold = rendered.onChange(offer);
      const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) look(node);
      });
      observer.observe(doc.body, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        stopTold();
      };
    },
    // A file of the space a link points to (a wiki link's from the space's root, a markdown link's from the page's folder); a page or a site: none
    linkAsset: (link: Link, page: string): Asset | undefined => {
      if (WEB.test(link.target)) return undefined;
      const target = resolvedTarget(link, page);
      if (!FILE_NAME.test(target)) return undefined;
      return { kind: "file", path: target, url: documentUrl(target) };
    },
    renderedRanges: (text: string) => rendered.ranges(text),
    // (The editor's content is as tall as the whole page, the part not drawn by its estimated height)
    placeOf: (element: HTMLElement): number | undefined => {
      const content = element.closest(CONTENT)?.getBoundingClientRect();
      if (!content?.height) return undefined;
      return (element.getBoundingClientRect().top - content.top) / content.height;
    },
    pageText: async () => String(await bridge.getText()),
    pageName: async () => String(await bridge.getCurrentPage()),
    resolved: (embed: Embed, page: string): string => resolvedTarget(embed, page),
    assetOf: (embed: Embed, page: string): Asset => {
      const target = resolvedTarget(embed, page);
      const alt = embed.alt ? { alt: embed.alt } : {};
      return WEB.test(target) ? { kind: "web", url: target, ...alt } : { kind: "file", path: target, url: documentUrl(target), ...alt };
    },
    settings: async () => (bridge.getConfig ? await bridge.getConfig(ASSETS_PATH, undefined) : undefined),
    // A file of the space: its document's meta (its size in bytes, `lastModified`); a URL, or a file not there: none
    fileInfo: async (asset: Asset): Promise<{ readonly size?: number; readonly modified?: string | number } | undefined> => {
      if (asset.kind !== "file" || !bridge.documentMeta) return undefined;
      const meta = (await bridge.documentMeta(asset.path)) as { size?: unknown; lastModified?: unknown } | undefined;
      if (!meta) return undefined;
      const size = typeof meta.size === "number" ? meta.size : undefined;
      const modified = typeof meta.lastModified === "string" || typeof meta.lastModified === "number" ? meta.lastModified : undefined;
      return { ...(size === undefined ? {} : { size }), ...(modified === undefined ? {} : { modified }) };
    },
    writeEmbed: async (write: Write): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.embeds.set(write.text, write.changes, { occurrence: write.occurrence, of: write.of })).build());
      return report.skipped[0]?.reason;
    },
    embedToLink: async (write: FormWrite): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.embeds.toLink(write.text, { occurrence: write.occurrence, of: write.of })).build());
      return report.skipped[0]?.reason;
    },
    linkToEmbed: async (write: FormWrite): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.links.toEmbed(write.text, { occurrence: write.occurrence, of: write.of })).build());
      return report.skipped[0]?.reason;
    },
    open: (url: string): void => void (doc.defaultView ?? window).open(url, "_blank", "noopener"),
    problem: (message: string): void => void bridge.flash(message, "error"),
  };
}
