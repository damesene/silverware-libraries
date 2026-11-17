// What the assets ask of SilverBullet (src/assets/decorate.ts, `AssetHost`): its embeds drawn (2.12.1, probed
// 2026-11-13: `.sb-inline-content` in the editor's content, its <img>, <video>, <audio> or <object> loading `.fs/<path>`,
// or "Error: Unsupported content: <name>"; an embedded page's markdown is no medium and is left alone), its button bar
// hidden (as on a grid: inline and important), a target resolved as SilverBullet resolves it, a file's URL, the
// settings, an embed written through the page writer. What is drawn outside the editor (a grid's cells) is told by
// the one drawing it (shared/rendered.ts: its media, its links, their places), never read from its HTML.
import type { Asset } from "../../../../shared/assets.ts";
import { type Embed, type EmbedChanges, resolvedTarget } from "../../../../shared/markdown/embed.ts";
import { type PageBuilder, pageChanges } from "../../../../shared/pages/changes.ts";
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import type { Rendered, RenderedItem } from "../../../../shared/rendered.ts";
import { ASSETS_PATH } from "../../model/settings.ts";
import type { FileFacts } from "../../core/stored.ts";
import { documentUrl, pageNamesOf } from "../../../../shared/silverbullet/platform.ts";
import { editorPosition } from "./editorposition.ts";
import { editorSheetArea } from "../../../../shared/silverbullet/editorarea.ts";

const FRAME = ".sb-inline-content";
// A medium drawn outside the editor (a grid's cell) is a plain element: put in a frame of Silverware Assets' own, to
// be decorated as SilverBullet's widget is
const OWN_FRAME = "swa-frame";
// A frame of ours its medium was decorated in (decorate.ts marks the type it was drawn as)
const DECORATED = `.${OWN_FRAME}[data-swa-type]`;
const MEDIA = "img, video, audio, object";
const BARS = ".button-bar, .sb-widget-menu-bar";
// (The frame's whole text: a page embedded there whose own embed failed says it deeper, after its words)
const UNSUPPORTED = /^(?:Error:\s*)?Unsupported content:\s*(.+)$/;
// Links as SilverBullet draws them in the editor (2.12.1, probed 2026-11-13): a wiki link's widget `a.sb-wiki-link`
// (its href the target as written; a widget, so an element put in it is no edit of the text). A markdown link there
// (`a.sb-link`) is the editor's own text, marked: left alone, as CodeMirror would take an element put in it for an
// edit. Those drawn outside the editor (a grid's cell) are told (`Rendered`)
const LINKS = ".cm-content a.sb-wiki-link";
// The editor's content: as tall as the whole page; each line of it drawn
const CONTENT = ".cm-content";
const LINE = ".cm-line";
// How many lines of text around an element are read each side
const CONTEXT_LINES = 3;
// A file of the space's name: an extension of its own, not a page's (`.md`)
const FILE_NAME = /\.(?!md$)[a-z0-9]{1,8}$/i;
const WEB = /^[a-z][a-z0-9+.-]*:/i;

/** A link drawn (src/assets/decorate.ts' `DrawnLink`) */
type Link = { readonly element: HTMLElement; readonly target: string; readonly style: "wiki" | "markdown"; readonly position?: () => number | undefined };
type FormWrite = { readonly text: string; readonly occurrence: number; readonly of: number };

/** The element of the editor's content an element is in (a line, a widget's box); none outside the editor */
function topOf(element: Element): Element | undefined {
  let top = element;
  while (top.parentElement && !top.parentElement.matches(CONTENT)) top = top.parentElement;
  return top.parentElement ? top : undefined;
}

/** A URL-encoded name decoded (SilverBullet encodes a link's and a file's path by encodeURIComponent, its `/` kept:
 * plug-api/lib/ref.ts `encodePageURI`); as it is where it is no such name */
function decoded(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** A link's target and form as SilverBullet drew it; none for an element of Silverware Assets' own */
export function drawnLink(element: HTMLElement): Link | undefined {
  if (element.closest(".swa-own, .swa-card")) return undefined;
  // (A wiki link's href is its target URL-encoded, `a%20b.pdf` for `[[a b.pdf]]`, `Q%26A.pdf` for `[[Q&A.pdf]]`, 2.12.1,
  // probed 2026-11-14: decoded, the file's name as written; its `data-ref` outside the editor is as written already)
  if (element.matches("a.sb-wiki-link")) return { element, target: decoded(element.getAttribute("href") ?? ""), style: "wiki" };
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

/** What SilverBullet drew in an embed's frame: its content's element (2.12.1 and after: `div > div.content`), none where it drew it so */
function drawingIn(frame: HTMLElement): Element | null {
  return frame.querySelector(":scope > * > .content, :scope > .content");
}

/** The target an embed's frame was drawn of: its medium's path in the space (or its URL), or the name it could not draw */
export function drawnTarget(frame: HTMLElement): { readonly target: string; readonly native: HTMLElement | undefined } | undefined {
  // (The frame's own medium, in its content (2.12.1, probed 2026-11-14: `div > div.content > img`); one deeper is in a
  // page embedded there, the other page's)
  const native = [...frame.querySelectorAll<HTMLElement>(MEDIA)].find((medium) => depthIn(frame, medium) <= MEDIUM_DEPTH);
  const source = native?.getAttribute("src") ?? native?.getAttribute("data");
  if (source) {
    return { target: decoded(source.replace(/^\.?\/?\.fs\//, "")), native };
  }
  // (Its words keep a run of spaces by no-break ones, `a\u00a0 b` for `a  b`, 2.12.1: the target's spaces again)
  // (Its drawing's words alone where it has one: a card of ours put in the frame has words too)
  const unsupported = UNSUPPORTED.exec((drawingIn(frame) ?? frame).textContent?.replace(/\u00a0/g, " ").trim() ?? "");
  return unsupported ? { target: unsupported[1]!.trim(), native: undefined } : undefined;
}

export function silverBulletAssetHost(bridge: Bridge, writer: PageWriter, doc: Document, rendered: Rendered) {
  // What is drawn outside the editor, as last told: each element's item (its place, its room)
  const told = new WeakMap<HTMLElement, RenderedItem>();
  const remember = (items: readonly RenderedItem[]) => {
    for (const item of items) told.set(item.element, item);
  };
  // A change of the page shown written by the page writer (its embed or link found by its text and its place among
  // those alike); why not, as text
  const inPage = async (build: (page: PageBuilder) => void): Promise<string | undefined> => {
    const page = String(await bridge.getCurrentPage());
    const report = await writer.write(pageChanges().page(page, build).build());
    return report.skipped[0]?.reason;
  };
  const where = (write: FormWrite) => ({ occurrence: write.occurrence, of: write.of });
  return {
    // (The function given back stops it)
    watch: (drawn: (embeds: readonly Drawn[]) => void): (() => void) => {
      // What SilverBullet drew in each frame as it was offered (its content's element): SilverBullet after 2.12.1 draws
      // an embed as a Lua directive's block and may draw its content anew in the same frame (its attributes kept, ours
      // too), which takes out what was decorated in it: a frame holding another drawing than it was offered with is
      // offered again
      const offeredWith = new WeakMap<HTMLElement, Element | null>();
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
          const target = drawnTarget(frame);
          // (Its content comes after the frame: looked at again as it does)
          if (!target) continue;
          const drawing = drawingIn(frame);
          // (Offered again only with another drawing; none found, SilverBullet's of another shape, once as before)
          if (offeredWith.has(frame) && (!drawing || offeredWith.get(frame) === drawing)) continue;
          offeredWith.set(frame, drawing);
          for (const bar of frame.parentElement?.querySelectorAll<HTMLElement>(BARS) ?? []) bar.style.setProperty("display", "none", "important");
          found.push({ frame, ...target });
        }
        if (found.length) drawn(found);
      };
      // Media drawn outside the editor, as told: each in a frame of its own, offered until it is decorated, its place
      // as told last (told again as the text above it changes: offered again, it was drawn anew each time, a PDF's
      // preview flickering with every key typed above its grid; a cell drawn anew has new media, offered then; one not
      // decorated, its place not found in the text read then, offered again as told again)
      const offer = (items: readonly RenderedItem[]) => {
        remember(items);
        const found: Drawn[] = [];
        for (const item of items) {
          if (item.kind !== "embed" || item.element.parentElement?.matches(DECORATED)) continue;
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
    // Where an element of the editor is in the page's text: SILVERBULLET-INTERNAL, see editorposition.ts (a widget of
    // the content's own asked by its box, a link by itself)
    positionOf: (element: HTMLElement): number | undefined => {
      const top = topOf(element);
      return top ? editorPosition(doc, top.matches(LINE) ? element : top) : undefined;
    },
    // The text drawn around an element of the editor's (2.12.1, probed 2026-11-14: each line of the page in view is a
    // `.cm-line` of the content, its text drawn without its marks; an embed's widget is a box of the content's own,
    // right before its line; a table or a block another widget whose lines are not drawn as lines)
    contextOf: (element: HTMLElement): { readonly before: string[]; readonly own?: string; readonly after: string[] } | undefined => {
      const top = topOf(element);
      if (!top) return undefined;
      const lines = (step: (at: Element) => Element | null) => {
        const found: string[] = [];
        for (let at = step(top); at && found.length < CONTEXT_LINES; at = step(at)) {
          const text = at.matches(LINE) ? (at.textContent ?? "").trim() : "";
          if (text) found.push(text);
        }
        return found;
      };
      const before = lines((at) => at.previousElementSibling);
      const after = lines((at) => at.nextElementSibling);
      return top.matches(LINE) ? { before, own: (top.textContent ?? "").trim(), after } : { before, after };
    },
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
    writeEmbed: (write: Write) => inPage((p) => p.embeds.set(write.text, write.changes, where(write))),
    embedToLink: (write: FormWrite) => inPage((p) => p.embeds.toLink(write.text, where(write))),
    linkToEmbed: (write: FormWrite & { readonly changes?: EmbedChanges }) => inPage((p) => p.links.toEmbed(write.text, where(write), write.changes)),
    // A file deleted: SilverBullet's own deletion of a document (`space.deleteDocument`, handed over); none: no Delete
    ...(bridge.deleteDocument
      ? {
          deleteFile: async (path: string): Promise<string | undefined> => {
            try {
              await bridge.deleteDocument!(path);
              return undefined;
            } catch (error) {
              return error instanceof Error ? error.message : String(error);
            }
          },
          confirm: async (question: string): Promise<boolean> => {
            const ask = bridge.confirmDelete ?? bridge.confirm;
            return ask ? !!(await ask(question)) : (doc.defaultView ?? window).confirm(question);
          },
        }
      : {}),
    removeEmbed: (write: FormWrite) => inPage((p) => p.embeds.remove(write.text, where(write))),
    linkToText: (write: FormWrite) => inPage((p) => p.links.toText(write.text, where(write))),
    writeLinkText: (write: FormWrite & { readonly shown: string }) => inPage((p) => p.links.setText(write.text, write.shown, where(write))),
    // A file renamed by SilverBullet's own command (Document: Rename's: the links to it in every page written anew, its
    // embeds too, the result told by it), handed `invokeFunction`; none: Rename sets a title alone
    ...(bridge.invokeFunction
      ? {
          renameFile: async (from: string, to: string): Promise<string | undefined> => {
            try {
              await bridge.invokeFunction!("index.renameDocumentCommand", { oldDocument: from, document: to });
              // (It gives true where it refused too, a name taken or not valid, said in its own notification: told by the
              // space's files, the new one there and the old one gone)
              if (!bridge.listFiles) return undefined;
              const paths = pageNamesOf(await bridge.listFiles());
              if (!paths.includes(to) || paths.includes(from)) return "SilverBullet did not rename it (its notification says why)";
              // (The page open rewritten on disk by it, its links to the file: shown, and not saved over by the editor's text of before)
              await bridge.reloadPage?.();
              return undefined;
            } catch (error) {
              return error instanceof Error ? error.message : String(error);
            }
          },
        }
      : {}),
    ...(bridge.listFiles ? { filePaths: async (): Promise<readonly string[]> => pageNamesOf(await bridge.listFiles!()) } : {}),
    // The files previews are kept in (core/stored.ts): SilverBullet's documents, read, written and deleted through its
    // space API, their time of change its file's meta (none: previews made each time)
    ...(bridge.fileMeta && bridge.readDocument && bridge.writeDocument && bridge.deleteDocument
      ? {
          previewFiles: {
            facts: async (path: string): Promise<FileFacts | undefined> => factsOf(await bridge.fileMeta!(path)),
            read: async (path: string): Promise<Uint8Array | undefined> => bytesOf(await bridge.readDocument!(path)),
            write: async (path: string, data: Uint8Array): Promise<void> => void (await bridge.writeDocument!(path, data)),
            remove: async (path: string): Promise<void> => void (await bridge.deleteDocument!(path)),
          },
        }
      : {}),
    open: (url: string): void => void (doc.defaultView ?? window).open(url, "_blank", "noopener"),
    // (The side panel over the editor's area: under SilverBullet's top bar and a toolbar docked at the editor's edge)
    sheetArea: editorSheetArea(doc),
    problem: (message: string): void => void bridge.flash(message, "error"),
  };
}

/** A document's content as SilverBullet's `space.readDocument` gives it, as bytes; none where it gives none */
export function bytesOf(data: unknown): Uint8Array | undefined {
  return data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : undefined;
}

/** A file's facts from SilverBullet's file meta (`lastModified` in ms, `size` in bytes); none where either is missing */
export function factsOf(meta: unknown): FileFacts | undefined {
  const { lastModified, size } = (meta ?? {}) as { lastModified?: unknown; size?: unknown };
  return typeof lastModified === "number" && typeof size === "number" ? { modified: lastModified, size } : undefined;
}
