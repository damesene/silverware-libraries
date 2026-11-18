// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { textareaEditor, type Editors } from "../../../../shared/editor.ts";
import { highlightCodeIn } from "./codeblocks.ts";

afterEach(() => {
  document.body.replaceChildren();
});

/** An editor's API highlighting a code's `return` alone, bold */
function editorsWith(highlightCode?: Editors["highlightCode"]): Editors {
  return { version: 1, create: (doc, options) => textareaEditor(doc, options), surfaceOf: () => undefined, ...(highlightCode ? { highlightCode } : {}) };
}

describe("a grid's code blocks highlighted", () => {
  it("draws a code block's parts in their looks between its lines' <br>s, its text as it was, once", async () => {
    document.body.innerHTML = '<div class="grid"><pre data-lang="csharp" data-pos="7">return 1;<br>x</pre><pre>plain</pre></div>';
    const grid = document.querySelector<HTMLElement>(".grid")!;
    const highlight = vi.fn(async (code: string) => [{ text: "return", look: { "font-weight": "bold" } }, { text: code.slice(6) }]);
    highlightCodeIn(grid, editorsWith(highlight));
    await vi.waitFor(() => expect(grid.querySelector("pre span")).not.toBeNull());
    expect(highlight).toHaveBeenCalledWith("return 1;\nx", "csharp");
    const pre = grid.querySelector("pre")!;
    expect(pre.innerHTML).toBe('<span style="font-weight: bold;">return</span> 1;<br>x');
    expect(pre.textContent).toBe("return 1;x");
    // (Once: a grid drawn anew with the cell taken over highlights it no more; a block with no language none)
    highlightCodeIn(grid, editorsWith(highlight));
    expect(highlight).toHaveBeenCalledTimes(1);
  });

  it("highlights a grid not yet in the page, as it is drawn before its host puts it there", async () => {
    const grid = document.createElement("div");
    grid.innerHTML = '<pre data-lang="csharp">return</pre>';
    highlightCodeIn(grid, editorsWith(async () => [{ text: "return", look: { "font-weight": "bold" } }]));
    await vi.waitFor(() => expect(grid.querySelector("pre span")?.textContent).toBe("return"));
  });

  it("leaves the code as rendered where the editor highlights none, or knows no language of it", async () => {
    document.body.innerHTML = '<div class="grid"><pre data-lang="nope">a</pre></div>';
    const grid = document.querySelector<HTMLElement>(".grid")!;
    highlightCodeIn(grid, editorsWith());
    const none = vi.fn(async () => undefined);
    highlightCodeIn(grid, editorsWith(none));
    await vi.waitFor(() => expect(none).toHaveBeenCalled());
    expect(grid.querySelector("pre")!.innerHTML).toBe("a");
  });
});
