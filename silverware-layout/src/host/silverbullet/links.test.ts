// @vitest-environment jsdom
// A click on a link SilverBullet shows as its markdown held back, one drawn as a link not; Ctrl+click followed.
import { afterEach, describe, expect, it } from "vitest";
import { holdShownLinkClicks, onShownLink } from "./links.ts";

/** SilverBullet's editor with a line: a link as its markdown, one drawn as a link, a markdown link's parts (2.12.1) */
function editor(): HTMLElement {
  const main = document.createElement("div");
  main.id = "sb-main";
  main.innerHTML =
    '<div class="cm-content"><div class="cm-line"><span class="sb-meta">[[</span><span class="sb-wiki-link">Page</span><span class="sb-meta">]]</span> ' +
    '<a class="sb-wiki-link" href="Other" contenteditable="false">Other</a> <span class="sb-link sb-meta">[</span><span class="sb-link">label</span>' +
    '<a class="sb-link" href="https://x.y"><span class="sb-link">drawn</span></a> text</div></div>';
  document.body.append(main);
  return main;
}

afterEach(() => document.body.replaceChildren());

describe("a link shown as its markdown", () => {
  it("is told apart from one drawn as a link, and from the text", () => {
    const main = editor();
    expect(onShownLink(main.querySelector("span.sb-wiki-link"))).toBe(true);
    expect(onShownLink(main.querySelector("span.sb-link:not(.sb-meta)"))).toBe(true);
    expect(onShownLink(main.querySelector("a.sb-wiki-link"))).toBe(false);
    expect(onShownLink(main.querySelector("a.sb-link span"))).toBe(false);
    expect(onShownLink(main.querySelector(".cm-line"))).toBe(false);
    // (Its marks too: `[[` and `]]` beside its text; a mark elsewhere not)
    expect(onShownLink(main.querySelector("span.sb-meta"))).toBe(true);
    const heading = document.createElement("span");
    heading.className = "sb-meta";
    heading.textContent = "#";
    main.querySelector(".cm-line")!.append(heading);
    expect(onShownLink(heading)).toBe(false);
  });

  it("holds its click back while wanted, Ctrl+click and another's not", () => {
    const main = editor();
    let wanted = true;
    holdShownLinkClicks(document, () => wanted);
    let followed = 0;
    main.addEventListener("click", () => void followed++);
    const shown = main.querySelector<HTMLElement>("span.sb-wiki-link")!;
    // (A press, then its click: on the line, as CodeMirror draws the line anew between them)
    const press = (on: Element, init: MouseEventInit = {}) => {
      on.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, ...init }));
      main.querySelector(".cm-line")!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ...init }));
    };
    press(shown);
    expect(followed).toBe(0);
    press(shown, { ctrlKey: true });
    expect(followed).toBe(1);
    press(main.querySelector("a.sb-wiki-link")!);
    expect(followed).toBe(2);
    wanted = false;
    press(shown);
    expect(followed).toBe(3);
  });
});
