// @vitest-environment jsdom
// HTML from outside the code made safe: nothing that runs, links the web's and mail's alone.
import { describe, expect, it } from "vitest";
import { madeSafe, safeHtml } from "./safehtml.ts";

describe("a document made safe", () => {
  it("keeps the web's and mail's links alone (opened in a new tab), nothing that runs", () => {
    const body = document.createElement("div");
    body.innerHTML =
      '<a href="https://example.com">web</a><a href="mailto:a@b.c">mail</a><a href="javascript:alert(1)">script</a><a href=" JavaScript:x">spaced</a><a href="#bookmark">inner</a>' +
      '<p onclick="alert(1)">text</p><script>alert(1)</script><iframe src="x"></iframe><img src="data:image/png;base64,AAAA" onerror="alert(1)">';
    madeSafe(body);
    const links = [...body.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["https://example.com", "mailto:a@b.c", null, null, null]);
    expect(links[0]!.target).toBe("_blank");
    expect(links[0]!.rel).toBe("noopener noreferrer");
    expect(body.querySelector("p")!.hasAttribute("onclick")).toBe(false);
    expect(body.querySelector("script, iframe")).toBeNull();
    expect(body.querySelector("img")!.hasAttribute("onerror")).toBe(false);
    expect(body.querySelector("img")!.getAttribute("src")).toMatch(/^data:image/);
  });
});

describe("HTML read as text", () => {
  it("keeps no SVG animation, an SVG link's address checked by either name, its target set; no style loading from elsewhere; no style sheet where none is asked", () => {
    const box = document.createElement("div");
    box.append(
      safeHtml(
        document,
        '<svg><a href="https://example.com"><animate attributeName="href" values="0;javascript:alert(1)"/><text>t</text></a><a xlink:href="data:text/html,x"><text>u</text></a></svg>' +
          '<p style="color: red; background: url(https://evil.example/x)">p</p><style>.a { background: url( "https://evil.example/y" ) } .b { background: url(data:image/png;base64,AA) }</style>',
      ),
    );
    expect(box.querySelector("animate")).toBeNull();
    const links = [...box.querySelectorAll("svg a")];
    expect(links[0]!.getAttribute("target")).toBe("_blank");
    expect(links[1]!.getAttributeNames()).toEqual([]);
    expect(box.querySelector("p")!.getAttribute("style")).toBe("color: red; background: none");
    expect(box.querySelector("style")!.textContent).toBe(".a { background: none } .b { background: url(data:image/png;base64,AA) }");
    const bare = document.createElement("div");
    bare.append(safeHtml(document, "<table><tr><td><style>body { display: none }</style>x</td></tr></table>", { styleSheets: false }));
    expect(bare.querySelector("style")).toBeNull();
    expect(bare.textContent).toBe("x");
  });

  it("is taken in safe: no script's URL in any attribute, no document of its own, no form, no style sheet imported", () => {
    const fragment = safeHtml(
      document,
      '<style>@import url(x.css); .a { color: red }</style><svg><a xlink:href="javascript:alert(1)"><text>t</text></a></svg>' +
        '<iframe srcdoc="<script>alert(1)</script>"></iframe><div srcdoc="x" data-x="java	script:alert(1)">d</div><form action="x"><input></form><img src="data:image/webp;base64,AAAA">',
    );
    const box = document.createElement("div");
    box.append(fragment);
    expect(box.querySelector("style")!.textContent).toBe(" .a { color: red }");
    expect(box.querySelector("svg a")!.getAttributeNames()).toEqual([]);
    expect(box.querySelector("iframe, form")).toBeNull();
    expect(box.querySelector("div")!.getAttributeNames()).toEqual([]);
    expect(box.querySelector("img")!.getAttribute("src")).toMatch(/^data:image\/webp/);
  });
});
