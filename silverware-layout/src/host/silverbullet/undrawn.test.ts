// Embeds SilverBullet's HTML draws none of (2.12.1: a PDF left out, a zip left as its text) kept as places in a cell's
// HTML, the offsets of what follows them the text's.
import { describe, expect, it } from "vitest";
import { isFileTarget } from "../../../../shared/markdown/embed.ts";
import { drawnInHtml, keepUndrawn } from "./undrawn.ts";

/** SilverBullet's HTML as 2.12.1 renders a paragraph (its offset, 0 left out) and an image embed (`data:`: no source; its offset) */
const render = (text: string) =>
  text
    .split("\n\n")
    .reduce<{ html: string; at: number }>(
      (out, part) => {
        const image = /!\[([^\]]*)\]\(([^)]+)\)/.exec(part);
        const body = image ? part.replace(image[0], `<IMG alt="${image[1]}" title="${image[1]}" style="max-width: 100%;" data-pos="${out.at + image.index}">`) : part;
        return { html: `${out.html}<span class="p"${out.at ? ` data-pos="${out.at}"` : ""}>${body}</span>`, at: out.at + part.length + 2 };
      },
      { html: "", at: 0 },
    ).html;

describe("embeds SilverBullet's HTML draws none of", () => {
  it("are those not an image, a video or audio", () => {
    expect(["a.png", "b.MP4", "c.mp3", "d.pdf", "e.zip", "f", "g.png#x"].map(drawnInHtml)).toEqual([true, true, true, false, false, false, true]);
  });

  it("leaves an embedded page to SilverBullet's HTML, which expands it", () => {
    expect(["Notes", "Notes#Part", "Notes.md", "v1/Notes", "a.zip", "b.pdf"].map(isFileTarget)).toEqual([false, false, false, false, true, true]);
    const kept = keepUndrawn("![[Meeting notes]] and ![[Other#Part]]");
    expect(kept.text).toBe("![[Meeting notes]] and ![[Other#Part]]");
  });

  it("leaves a text without them as it is", () => {
    const kept = keepUndrawn("![[a.png]] and text");
    expect(kept.text).toBe("![[a.png]] and text");
    expect(kept.restore("<b>x</b>")).toBe("<b>x</b>");
  });

  it("keeps a file as a place, a PDF as its viewer, each at its offset, and what follows at the text's offsets", () => {
    const text = "Top\n\n![[archive.zip]]\n\n![[sample.pdf|Doc||{ view: preview }]]\n\nEnd";
    const kept = keepUndrawn(text, (embed) => `.fs/${embed.target}`);
    expect(kept.text).toBe("Top\n\n![swl-embed-0](data:,.png)\n\n![swl-embed-1](data:,.png)\n\nEnd");
    const html = kept.restore(render(kept.text));
    expect(html).toContain(`<span class="swl-embed" data-swl-embed="archive.zip" data-pos="${text.indexOf("![[archive")}">![[archive.zip]]</span>`);
    expect(html).toContain(`<object type="application/pdf" data=".fs/sample.pdf" data-pos="${text.indexOf("![[sample")}"`);
    expect(html).toContain(`<span class="p" data-pos="${text.indexOf("End")}">End</span>`);
    expect(html).not.toContain("swl-embed-");
  });

  it("keeps a PDF as a place where no URL is given", () => {
    const kept = keepUndrawn("![[a.pdf]]");
    expect(kept.restore(render(kept.text))).toContain('data-swl-embed="a.pdf"');
  });
});
