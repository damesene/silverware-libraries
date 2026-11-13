// Embeds SilverBullet's `markdownToHtml` draws none of (2.12.1, probed 2026-11-13): it draws an embedded image, video
// or audio as its element; a PDF it leaves out (its <object> lost), any other file it leaves as its text (`![[a.zip]]`).
// In the page, its widget draws them (a PDF viewer, its words that it cannot): in a cell rendered outside the editor a
// PDF is drawn as the widget draws it (an <object> of its URL), any other kept as a place, `<span data-swl-embed=
// "<target>" data-pos="<offset>">` (its text in it), which the assets' host frames as it frames a medium
// (./assets.ts). Done by rendering a stand-in of each, an image SilverBullet does draw, swapped for the place in its
// HTML; the offsets after it set back by the difference in length, so `data-pos` is the text's. Pure.
import { type Embed, readEmbeds } from "../../../../shared/markdown/embed.ts";

// What SilverBullet draws by an embed's extension: its media's (an image, audio, video; `createMediaElement`)
const DRAWN = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "apng", "mp4", "webm", "ogv", "mov", "m4v", "mp3", "wav", "ogg", "oga", "m4a", "flac", "aac", "opus"]);
// An image of no file (SilverBullet draws a `data:` image without its source: nothing loaded), told by its alt text
const STAND_IN = (n: number) => `![swl-embed-${n}](data:,.png)`;
const STAND_IN_DRAWN = /<img\b[^>]*?\balt="swl-embed-(\d+)"[^>]*>/gi;
const POSITION = /\bdata-pos="(\d+)"/g;

/** Whether SilverBullet's HTML draws an embed of this target */
export function drawnInHtml(target: string): boolean {
  const path = target.split(/[?#@$|]/, 1)[0]!;
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return !!ext && DRAWN.has(ext);
}

const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A text to render with each embed SilverBullet draws none of stood in for, and its HTML given back with their places (a PDF's viewer, where its URL is given) */
export function keepUndrawn(text: string, urlOf?: (embed: Embed) => string): { readonly text: string; readonly restore: (html: string) => string } {
  const undrawn = readEmbeds(text).filter((embed) => !drawnInHtml(embed.target));
  if (!undrawn.length) return { text, restore: (html) => html };
  let shown = "";
  let at = 0;
  // Each stand-in where it is in the text rendered, and the embed's
  const placed: { readonly from: number; readonly to: number; readonly original: number; readonly shift: number; readonly embed: Embed }[] = [];
  let shift = 0;
  undrawn.forEach((embed, n) => {
    shown += text.slice(at, embed.from);
    const standIn = STAND_IN(n);
    const from = shown.length;
    shown += standIn;
    shift += embed.to - embed.from - standIn.length;
    placed.push({ from, to: shown.length, original: embed.from, shift, embed });
    at = embed.to;
  });
  shown += text.slice(at);
  // An offset of the text rendered as the text's: in a stand-in its embed's start; after one, shifted by those before
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
        .replace(POSITION, (_all, offset: string) => `data-pos="${original(Number(offset))}"`)
        .replace(STAND_IN_DRAWN, (all, n: string) => {
          const one = placed[Number(n)];
          if (!one) return all;
          if (urlOf && /\.pdf$/i.test(one.embed.target.split(/[?#@$]/, 1)[0]!))
            return `<object type="application/pdf" data="${escaped(urlOf(one.embed))}" data-pos="${one.original}" style="width: 100%; max-width: 100%;"></object>`;
          // (Its text in it, as SilverBullet's HTML had it: what shows where nothing decorates it)
          return `<span class="swl-embed" data-swl-embed="${escaped(one.embed.target)}" data-pos="${one.original}">${escaped(one.embed.text)}</span>`;
        }),
  };
}
