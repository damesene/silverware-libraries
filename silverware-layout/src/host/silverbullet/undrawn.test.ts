// @vitest-environment jsdom
// Embeds SilverBullet's HTML draws none of (2.12.1: a PDF left out, a zip left as its text) kept as places in a cell's
// HTML, the offsets of what follows them the text's.
import { describe, expect, it } from "vitest";
import { isFileTarget } from "../../../../shared/markdown/embed.ts";
import { inEmbeddedPage, isEmbeddedPage } from "../../grid/ui/offsets.ts";
import { drawnInHtml, keepEmbeds } from "./undrawn.ts";

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

  it("marks out an embedded page for SilverBullet's HTML to expand between, drawn in an element at the embed, nothing in it marked", () => {
    expect(["Notes", "Notes#Part", "Notes.md", "v1/Notes", "a.zip", "b.pdf"].map(isFileTarget)).toEqual([false, false, false, false, true, true]);
    const text = "![[Notes]]\n\n- a";
    const kept = keepEmbeds(text);
    expect(kept.text).toBe("![swl-page-start-0](data:,.png)![[Notes]]![swl-page-end-0](data:,.png)\n\n- a");
    // SilverBullet 2.12.1's markdownToHtml of it, Notes "Some text\n\n- x\n- y" expanded (probed 2026-11-17)
    const listAt = kept.text.indexOf("- a");
    const html = kept.restore(
      `<span class="p"><img alt="swl-page-start-0" title="swl-page-start-0" style="max-width: 100%;"><span class="p">Some text</span><br><ul data-pos="11"><li data-pos="11"><span class="p" data-pos="13">x</span></li></ul><img alt="swl-page-end-0" title="swl-page-end-0" style="max-width: 100%;" data-pos="41"></span><br><ul data-pos="${listAt}"><li data-pos="${listAt}"><span class="p" data-pos="${listAt + 2}">a</span></li></ul>`,
    );
    expect(html).toBe(
      `<span class="p"><span class="swl-embedded" data-swl-embedded="Notes" data-pos="0"><span class="p">Some text</span><br><ul><li><span class="p">x</span></li></ul></span></span><br><ul data-pos="12"><li data-pos="12"><span class="p" data-pos="14">a</span></li></ul>`,
    );
  });

  it("marks out each of several pages, in a heading too, the text's offsets after them", () => {
    const text = "# ![[A]] and ![[B]]\n\nEnd";
    const kept = keepEmbeds(text);
    expect(kept.text).toBe("# ![swl-page-start-0](data:,.png)![[A]]![swl-page-end-0](data:,.png) and ![swl-page-start-1](data:,.png)![[B]]![swl-page-end-1](data:,.png)\n\nEnd");
    const end = kept.text.indexOf("End");
    const html = kept.restore(`<h1><img alt="swl-page-start-0"><b data-pos="3">a</b><img alt="swl-page-end-0"> and <img alt="swl-page-start-1"><b data-pos="5">b</b><img alt="swl-page-end-1"></h1><span class="p" data-pos="${end}">End</span>`);
    expect(html).toBe(
      `<h1><span class="swl-embedded" data-swl-embedded="A" data-pos="2"><b>a</b></span> and <span class="swl-embedded" data-swl-embedded="B" data-pos="13"><b>b</b></span></h1><span class="p" data-pos="${text.indexOf("End")}">End</span>`,
    );
  });

  it("draws no image of a mark left over, where SilverBullet drew one without the other, nor a mark it shows as text", () => {
    const kept = keepEmbeds("![[A]]");
    expect(kept.restore('<span class="p"><img alt="swl-page-start-0">a</span>')).toBe('<span class="p">a</span>');
    // (An indented code block, HTML: SilverBullet expands no page there, the marks its text)
    const code = keepEmbeds("    ![[A]]");
    expect(code.restore(`<pre>${code.text.trim()}</pre>`)).toBe("<pre>![[A]]</pre>");
  });

  it("leaves a page embed as it is where the text shows it as text (escaped), and marks out an image of a page as one", () => {
    expect(keepEmbeds("\\![[Notes]]").text).toBe("\\![[Notes]]");
    // (SilverBullet expands an image of no file as the page, probed 2026-11-17)
    expect(keepEmbeds("![logo](Notes)").text).toBe("![swl-page-start-0](data:,.png)![logo](Notes)![swl-page-end-0](data:,.png)");
  });

  it("leaves a text without them as it is", () => {
    const kept = keepEmbeds("![[a.png]] and text");
    expect(kept.text).toBe("![[a.png]] and text");
    expect(kept.restore("<b>x</b>")).toBe("<b>x</b>");
  });

  it("keeps a file as a place, a PDF as its viewer, each at its offset, and what follows at the text's offsets", () => {
    const text = "Top\n\n![[archive.zip]]\n\n![[sample.pdf|Doc||{ view: preview }]]\n\nEnd";
    const kept = keepEmbeds(text, (embed) => `.fs/${embed.target}`);
    expect(kept.text).toBe("Top\n\n![swl-embed-0](data:,.png)\n\n![swl-embed-1](data:,.png)\n\nEnd");
    const html = kept.restore(render(kept.text));
    expect(html).toContain(`<span class="swl-embed" data-swl-embed="archive.zip" data-pos="${text.indexOf("![[archive")}">![[archive.zip]]</span>`);
    expect(html).toContain(`<object type="application/pdf" data=".fs/sample.pdf" data-pos="${text.indexOf("![[sample")}"`);
    expect(html).toContain(`<span class="p" data-pos="${text.indexOf("End")}">End</span>`);
    expect(html).not.toContain("swl-embed-");
  });

  it("keeps a PDF as a place where no URL is given", () => {
    const kept = keepEmbeds("![[a.pdf]]");
    expect(kept.restore(render(kept.text))).toContain('data-swl-embed="a.pdf"');
  });
});

describe("a page embedded as the grid takes one", () => {
  it("is an element the grid tells as a page embedded, what is in it none of the cell's (the contract of GridHost.renderMarkdown)", () => {
    const kept = keepEmbeds("![[Notes]]");
    const cell = document.createElement("div");
    cell.innerHTML = kept.restore('<span class="p"><img alt="swl-page-start-0"><ul data-pos="11"><li data-pos="11">x</li></ul><img alt="swl-page-end-0" data-pos="41"></span>');
    const page = cell.querySelector("span > span")!;
    expect(isEmbeddedPage(page)).toBe(true);
    expect(inEmbeddedPage(cell.querySelector("li")!)).toBe(true);
    expect(cell.querySelectorAll("li [data-pos], ul[data-pos]")).toHaveLength(0);
  });
});

describe("a stand-in SilverBullet shows as text", () => {
  it("is its embed's text again (an indented code block)", () => {
    const kept = keepEmbeds("Text\n\n    ![[a.zip]]");
    expect(kept.text).toContain("![swl-embed-0](data:,.png)");
    expect(kept.restore('<span class="p">Text</span><pre data-pos="10">![swl-embed-0](data:,.png)</pre>')).toBe('<span class="p">Text</span><pre data-pos="10">![[a.zip]]</pre>');
  });
});
