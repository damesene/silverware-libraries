// A cell's embeds as SilverBullet's `markdownToHtml` draws them (2.12.1), kept as the page shows them.
//
// Files it draws none of (probed 2026-11-13): it draws an embedded image, video or audio as its element; a PDF it
// leaves out (its <object> lost), any other file it leaves as its text (`![[a.zip]]`). In the page, its widget draws
// them (a PDF viewer, its words that it cannot): in a cell rendered outside the editor a PDF is drawn as the widget
// draws it (an <object> of its URL), any other kept as a place, `<span data-swl-embed="<target>" data-pos="<offset>">`
// (its text in it), which the grid tells of as it tells of a medium (src/grid/drawn.ts, shared/rendered.ts: Silverware
// Assets frames it). Done by rendering a stand-in of each, an image SilverBullet does draw, swapped for the place.
//
// A page embedded (`![[Other page]]`) it expands in the line holding it (a paragraph, a heading, a task: probed
// 2026-11-17), its elements marked with that page's offsets, not the cell's: read as the cell's, they would stand for
// the cell's lines (its blank lines put back into the other page) and a click there would land elsewhere. Marked out by
// an image before and after it, and what lies between them left unmarked: the page drawn is the line's, as its text.
//
// The offsets after what was put in set back by its length, so `data-pos` is the text's. Pure.
import { type Embed, isFileTarget, readEmbeds } from "../../../../shared/markdown/embed.ts";

// What SilverBullet draws by an embed's extension: its media's (an image, audio, video; `createMediaElement`)
const DRAWN = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "apng", "mp4", "webm", "ogv", "mov", "m4v", "mp3", "wav", "ogg", "oga", "m4a", "flac", "aac", "opus"]);
// An image of no file (SilverBullet draws a `data:` image without its source: nothing loaded), told by its alt text
const IMAGE = (alt: string) => `![${alt}](data:,.png)`;
const STAND_IN = (n: number) => IMAGE(`swl-embed-${n}`);
const STAND_IN_DRAWN = /<img\b[^>]*?\balt="swl-embed-(\d+)"[^>]*>/gi;
const PAGE_START = (n: number) => IMAGE(`swl-page-start-${n}`);
const PAGE_END = (n: number) => IMAGE(`swl-page-end-${n}`);
// A page embedded as drawn: the images round it, what lies between them
const PAGE_DRAWN = /<img\b[^>]*?\balt="swl-page-start-(\d+)"[^>]*>([\s\S]*?)<img\b[^>]*?\balt="swl-page-end-\1"[^>]*>/gi;
// An image of those left over (one drawn without the other): never shown
const PAGE_MARK_DRAWN = /<img\b[^>]*?\balt="swl-page-(?:start|end)-\d+"[^>]*>/gi;
const POSITION = /\bdata-pos="(\d+)"/g;
const MARKED = /\sdata-pos="\d+"/g;

/** Whether SilverBullet's HTML draws an embed of this target */
export function drawnInHtml(target: string): boolean {
  const path = target.split(/[?#@$|]/, 1)[0]!;
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return !!ext && DRAWN.has(ext);
}

const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A text to render with each file SilverBullet draws none of stood in for and each page embedded marked out, and its
 * HTML given back with the files' places (a PDF's viewer, where its URL is given) and the pages unmarked
 */
export function keepEmbeds(text: string, urlOf?: (embed: Embed) => string): { readonly text: string; readonly restore: (html: string) => string } {
  const kept = readEmbeds(text).filter((embed) => !isFileTarget(embed.target) || !drawnInHtml(embed.target));
  if (!kept.length) return { text, restore: (html) => html };
  let shown = "";
  let at = 0;
  // What was put in the text rendered (in it from..to), the text's offset there, and the shift after it, in order
  const placed: { readonly from: number; readonly to: number; readonly original: number; readonly shift: number }[] = [];
  let shift = 0;
  const put = (added: string, original: number, replaced: number) => {
    const from = shown.length;
    shown += added;
    shift += replaced - added.length;
    placed.push({ from, to: shown.length, original, shift });
  };
  // The files stood in for, by their stand-ins' numbers
  const standIns: Embed[] = [];
  let pages = 0;
  for (const embed of kept) {
    shown += text.slice(at, embed.from);
    if (isFileTarget(embed.target)) {
      put(STAND_IN(standIns.length), embed.from, embed.to - embed.from);
      standIns.push(embed);
    } else {
      put(PAGE_START(pages), embed.from, 0);
      shown += text.slice(embed.from, embed.to);
      put(PAGE_END(pages++), embed.to, 0);
    }
    at = embed.to;
  }
  shown += text.slice(at);
  // An offset of the text rendered as the text's: in what was put in, where it was put; after it, shifted by those before
  const original = (offset: number): number => {
    let shifted = offset;
    for (const one of placed) {
      if (offset < one.from) break;
      if (offset < one.to) return one.original;
      shifted = offset + one.shift;
    }
    return shifted;
  };
  return {
    text: shown,
    restore: (html) =>
      html
        .replace(PAGE_DRAWN, (_all, _n: string, page: string) => page.replace(MARKED, ""))
        .replace(PAGE_MARK_DRAWN, "")
        .replace(POSITION, (_all, offset: string) => `data-pos="${original(Number(offset))}"`)
        .replace(STAND_IN_DRAWN, (all, n: string) => {
          const embed = standIns[Number(n)];
          if (!embed) return all;
          if (urlOf && /\.pdf$/i.test(embed.target.split(/[?#@$]/, 1)[0]!))
            return `<object type="application/pdf" data="${escaped(urlOf(embed))}" data-pos="${embed.from}" style="width: 100%; max-width: 100%;"></object>`;
          // (Its text in it, as SilverBullet's HTML had it: what shows where nothing decorates it)
          return `<span class="swl-embed" data-swl-embed="${escaped(embed.target)}" data-pos="${embed.from}">${escaped(embed.text)}</span>`;
        }),
  };
}
