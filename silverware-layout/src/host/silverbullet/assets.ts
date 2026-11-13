// What the assets ask of SilverBullet (src/assets/decorate.ts, `AssetHost`): its embeds drawn (2.12.1, probed
// 2026-11-13: `.sb-inline-content` in the editor's content, its <img>, <video>, <audio> or <object> loading `.fs/<path>`,
// or "Error: Unsupported content: <name>"; an embedded page's markdown is no medium and is left alone), its button bar
// hidden (as on a grid: inline and important), a target resolved as SilverBullet resolves it, a file's URL, the
// settings, an embed written through the page writer.
import type { Asset } from "../../../../shared/assets.ts";
import { type Embed, type EmbedChanges, resolveLinkPath } from "../../../../shared/markdown/embed.ts";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import { documentUrl } from "./platform.ts";

const FRAME = ".sb-inline-content";
// Markdown rendered outside the editor (a grid's cells: Silverware Layout's convention), its media plain elements:
// each put in a frame of Silverware Layout's own to be decorated as SilverBullet's widget is; an embed SilverBullet's
// HTML draws none of is a place there (./undrawn.ts), its target its `data-swl-embed`
const RENDERED_MEDIA = "[data-swl-rendered] :is(img, video, audio, object, [data-swl-embed]):not(.swl-asset-frame > *, .swl-asset-icon *, .swl-asset-own, .swl-asset-own *)";
const OWN_FRAME = "swl-asset-frame";
const MEDIA = "img, video, audio, object";
const BARS = ".button-bar, .sb-widget-menu-bar";
const UNSUPPORTED = /Unsupported content:\s*(.+)$/;
// Links as SilverBullet draws them (2.12.1, probed 2026-11-13): in the editor a wiki link's widget `a.sb-wiki-link`
// (its href the target as written; a widget, so an element put in it is no edit of the text); in markdown rendered
// outside the editor (a grid's cell) a wiki link's `a.wiki-link` (its `data-ref` the target) and a markdown link's plain
// `a`. A markdown link in the editor (`a.sb-link`) is the editor's own text, marked: left alone, as CodeMirror would take
// an element put in it for an edit
const LINKS = ".cm-content a.sb-wiki-link, [data-swl-rendered] a[href]";
// A file of the space's name: an extension of its own, not a page's (`.md`)
const FILE_NAME = /\.(?!md$)[a-z0-9]{1,8}$/i;
const WEB = /^[a-z][a-z0-9+.-]*:/i;

/** A link drawn (src/assets/decorate.ts' `DrawnLink`) */
type Link = { readonly element: HTMLElement; readonly target: string; readonly style: "wiki" | "markdown"; readonly position?: () => number | undefined };
type FormWrite = { readonly text: string; readonly occurrence: number; readonly of: number };

/** A link's target and form as SilverBullet drew it; none for an element of Silverware Layout's own */
export function drawnLink(element: HTMLElement): Link | undefined {
  if (element.closest(".swl-asset-own, .swl-asset-card")) return undefined;
  if (element.matches("a.sb-wiki-link")) return { element, target: element.getAttribute("href") ?? "", style: "wiki" };
  if (element.matches("a.wiki-link[data-ref]")) return { element, target: element.getAttribute("data-ref") ?? "", style: "wiki" };
  const href = element.getAttribute("href");
  return href ? { element, target: href, style: "markdown" } : undefined;
}

/** An embed drawn (src/assets/decorate.ts' `DrawnEmbed`, named apart: the host knows no area) */
type Drawn = { readonly frame: HTMLElement; readonly target: string; readonly native: HTMLElement | undefined; readonly position?: () => number | undefined };
type Write = { readonly text: string; readonly occurrence: number; readonly of: number; readonly changes: EmbedChanges };

/** The target an embed's frame was drawn of: its medium's path in the space (or its URL), or the name it could not draw */
export function drawnTarget(frame: HTMLElement): { readonly target: string; readonly native: HTMLElement | undefined } | undefined {
  const place = frame.querySelector("[data-swl-embed]")?.getAttribute("data-swl-embed");
  if (place) return { target: place, native: undefined };
  const native = frame.querySelector<HTMLElement>(MEDIA) ?? undefined;
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
  const unsupported = UNSUPPORTED.exec(frame.textContent?.trim() ?? "");
  return unsupported ? { target: unsupported[1]!.trim(), native: undefined } : undefined;
}

export function silverBulletAssetHost(bridge: Bridge, writer: PageWriter, doc: Document) {
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
        const rendered = root instanceof HTMLElement && root.matches(RENDERED_MEDIA) ? [root] : [];
        for (const medium of [...rendered, ...root.querySelectorAll<HTMLElement>(RENDERED_MEDIA)]) {
          const frame = doc.createElement("span");
          frame.className = OWN_FRAME;
          medium.replaceWith(frame);
          frame.append(medium);
          frames.add(frame);
        }
        for (const frame of frames) {
          if (seen.has(frame)) continue;
          const target = drawnTarget(frame);
          // (Its content comes after the frame: looked at again as it does)
          if (!target) continue;
          seen.add(frame);
          if (!frame.classList.contains(OWN_FRAME)) for (const bar of frame.parentElement?.querySelectorAll<HTMLElement>(BARS) ?? []) bar.style.setProperty("display", "none", "important");
          found.push({ frame, ...target, ...(frame.classList.contains(OWN_FRAME) ? { position: () => renderedPosition(frame) } : {}) });
        }
        if (found.length) drawn(found);
      };
      look(doc);
      const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
        const placed: Drawn[] = [];
        for (const record of records) {
          for (const node of record.addedNodes) if (node instanceof HTMLElement) look(node);
          // A block rendered outside the editor given its place (later than its media came: its host read the page's
          // text while it was still the page before): its media offered again, their places known now
          if (record.type === "attributes" && record.target instanceof HTMLElement && record.target.matches("[data-swl-rendered]")) {
            for (const frame of record.target.querySelectorAll<HTMLElement>(`.${OWN_FRAME}`)) {
              const target = drawnTarget(frame);
              if (target) placed.push({ frame, ...target, position: () => renderedPosition(frame) });
            }
          }
        }
        if (placed.length) drawn(placed);
      });
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-swl-pos"] });
      return () => observer.disconnect();
    },
    // (Each link element offered once: Silverware Layout's icon put into it is no new link; the function given back stops it)
    watchLinks: (drawn: (links: readonly Link[]) => void): (() => void) => {
      const seen = new WeakSet<HTMLElement>();
      const look = (root: ParentNode) => {
        const found: Link[] = [];
        const elements = [...(root instanceof HTMLElement && root.matches(LINKS) ? [root] : []), ...root.querySelectorAll<HTMLElement>(LINKS)];
        for (const element of elements) {
          if (seen.has(element)) continue;
          seen.add(element);
          const link = drawnLink(element);
          // (One in markdown rendered outside the editor found by its place, as a medium there is)
          if (link?.target) found.push(element.closest("[data-swl-rendered]") ? { ...link, position: () => renderedPosition(element) } : link);
        }
        if (found.length) drawn(found);
      };
      look(doc);
      const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement) look(node);
      });
      observer.observe(doc.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    // A file of the space a link points to (a wiki link's from the space's root, a markdown link's from the page's folder); a page or a site: none
    linkAsset: (link: Link, page: string): Asset | undefined => {
      if (WEB.test(link.target)) return undefined;
      const target = resolvedTarget(link, page);
      if (!FILE_NAME.test(target)) return undefined;
      return { kind: "file", path: target, url: documentUrl(target) };
    },
    renderedRanges: () =>
      [...doc.querySelectorAll<HTMLElement>("[data-swl-rendered][data-swl-pos][data-swl-end]")].map((block) => ({ from: Number(block.getAttribute("data-swl-pos")), to: Number(block.getAttribute("data-swl-end")) })),
    pageText: async () => String(await bridge.getText()),
    pageName: async () => String(await bridge.getCurrentPage()),
    resolved: (embed: Embed, page: string): string => resolvedTarget(embed, page),
    assetOf: (embed: Embed, page: string): Asset => {
      const target = resolvedTarget(embed, page);
      const alt = embed.alt ? { alt: embed.alt } : {};
      return WEB.test(target) ? { kind: "web", url: target, ...alt } : { kind: "file", path: target, url: documentUrl(target), ...alt };
    },
    settings: async () => (bridge.getConfig ? await bridge.getConfig("silverware.layout.assets", undefined) : undefined),
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

/**
 * Where a medium in markdown rendered outside the editor is in the page: its block's place (`data-swl-pos`, the
 * convention) and its own offset in the block's markdown (SilverBullet's `data-pos`, which it leaves out at 0); its
 * block's place not known yet: none
 */
function renderedPosition(frame: HTMLElement): number | undefined {
  const block = frame.closest<HTMLElement>("[data-swl-rendered]");
  const base = block?.getAttribute("data-swl-pos");
  if (!block || base === null || base === undefined) return undefined;
  const marked = frame.querySelector("[data-pos]") ?? frame.closest("[data-pos]");
  const own = marked && block.contains(marked) ? Number(marked.getAttribute("data-pos")) || 0 : 0;
  return Number(base) + own;
}

/** An embed's (or a link's) target as SilverBullet resolves it: a wiki link's from the space's root, a markdown link's from the page's folder */
export function resolvedTarget(embed: Pick<Embed, "target" | "style">, page: string): string {
  const target = embed.target.split(/[#@$]/, 1)[0]!;
  if (WEB.test(target)) return target;
  if (embed.style === "wiki") return target.replace(/^\//, "");
  let decoded = target;
  try {
    decoded = decodeURI(target);
  } catch {
    // (As written)
  }
  return resolveLinkPath(page, decoded);
}
