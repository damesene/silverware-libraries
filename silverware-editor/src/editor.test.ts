// @vitest-environment jsdom
// Silverware Editor: the stand-in (a `<textarea>`) and the CodeMirror editor, both one `TextEditor`; the keys' names;
// the editing surfaces found. CodeMirror is imported here from vendor.ts (in SilverBullet it is a file beside the
// bundle, loaded when idle).
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_ATTRIBUTE, EDITOR_VERSION, editorsOf, keyMatches, textareaEditor, type TextEditor } from "../../shared/editor.ts";
import { codeMirrorEditor } from "./codemirror.ts";
import * as cm from "./vendor.ts";

afterEach(() => document.body.replaceChildren());

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("the keys' names", () => {
  it("match a key with its modifiers exactly, Mod as Ctrl off a Mac", () => {
    expect(keyMatches("Mod-Enter", key({ key: "Enter", ctrlKey: true }))).toBe(true);
    expect(keyMatches("Mod-Enter", key({ key: "Enter" }))).toBe(false);
    expect(keyMatches("Escape", key({ key: "Escape" }))).toBe(true);
    expect(keyMatches("Escape", key({ key: "Escape", ctrlKey: true }))).toBe(false);
    expect(keyMatches("Shift-Tab", key({ key: "Tab", shiftKey: true }))).toBe(true);
    expect(keyMatches("Mod-b", key({ key: "B", ctrlKey: true }))).toBe(true);
    // (A letter's key with Shift held is not the key without it: Ctrl+Shift+Z is no `Mod-z`; a shifted sign is itself)
    expect(keyMatches("Mod-z", key({ key: "Z", ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(keyMatches("Mod-Shift-z", key({ key: "Z", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(keyMatches("?", key({ key: "?", shiftKey: true }))).toBe(true);
  });
});

/** The same checks for both editors: a `TextEditor` either way */
function behaves(name: string, make: (options: Parameters<typeof textareaEditor>[1]) => TextEditor) {
  describe(name, () => {
    it("holds its text and selection, a range replaced, read-only, its keys first, changes told", () => {
      const changes: string[] = [];
      const done = vi.fn(() => true);
      const editor = make({ text: "Hello world", className: "my-field", label: "A field", selection: { from: 6, to: 11 }, keys: { "Mod-Enter": done }, onChange: (text) => changes.push(text) });
        expect(editor.element.classList.contains("my-field")).toBe(true);
      expect(editor.getText()).toBe("Hello world");
      expect(editor.getSelection()).toMatchObject({ from: 6, to: 11 });
      editor.replaceRange(6, 11, "there");
      expect(editor.getText()).toBe("Hello there");
      expect(changes.at(-1)).toBe("Hello there");
      editor.setText("Other");
      expect(editor.getText()).toBe("Other");
      editor.setSelection(0, 2);
      expect(editor.getSelection()).toMatchObject({ from: 0, to: 2 });
      editor.readOnly = true;
      expect(editor.readOnly).toBe(true);
      editor.readOnly = false;
      // A key of the plugin's, its press kept from the page's editor
      const outside = vi.fn();
      document.body.addEventListener("keydown", outside);
      const target = editor.element.matches("textarea") ? editor.element : editor.element.shadowRoot!.querySelector(".cm-content")!;
      target.dispatchEvent(key({ key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
      expect(done).toHaveBeenCalled();
      expect(outside).not.toHaveBeenCalled();
      editor.destroy();
    });
  });
}

behaves("the stand-in (a <textarea>)", (options) => textareaEditor(document, options));
behaves("the CodeMirror editor", (options) => codeMirrorEditor(cm, document, options, { made: () => undefined, gone: () => undefined }));

describe("the CodeMirror editor's own", () => {
  const make = (options: Partial<Parameters<typeof codeMirrorEditor>[2]> = {}) =>
    codeMirrorEditor(cm, document, { text: "", ...options }, { made: () => undefined, gone: () => undefined });
  const content = (editor: TextEditor) => editor.element.shadowRoot!.querySelector<HTMLElement>(".cm-content")!;

  it("keeps the text a plugin puts in out of its history: undone, it stays", () => {
    const editor = make();
    editor.setText("Read from the page");
    content(editor).dispatchEvent(key({ key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    expect(editor.getText()).toBe("Read from the page");
    editor.destroy();
  });

  it("lets a key of the plugin's that it did not take through to its own keys", () => {
    const enter = vi.fn(() => false);
    const editor = make({ text: "- one", keys: { Enter: enter } });
    content(editor).dispatchEvent(key({ key: "Enter", bubbles: true, cancelable: true }));
    expect(enter).toHaveBeenCalled();
    expect(editor.getText()).toBe("- one\n- ");
    editor.destroy();
  });
});

describe("an editor left", () => {
  it("is told so once the companion that had the focus is taken away (no focus event tells it)", async () => {
    const left = vi.fn();
    const editor = textareaEditor(document, { text: "x", onBlur: left });
    const companion = document.createElement("div");
    companion.setAttribute(COMPANION_ATTRIBUTE, "");
    const search = companion.appendChild(document.createElement("input"));
    document.body.append(editor.element, companion);
    editor.focus();
    search.focus();
    companion.remove();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(left).toHaveBeenCalledTimes(1);
    editor.destroy();
  });

  it("is told so once the focus is out of it and of what acts on it (a toolbar's popup), not as it goes there or comes back", () => {
    const left = vi.fn();
    const editor = textareaEditor(document, { text: "x", onBlur: left });
    const companion = document.createElement("div");
    companion.setAttribute(COMPANION_ATTRIBUTE, "");
    const search = companion.appendChild(document.createElement("input"));
    const elsewhere = document.createElement("input");
    document.body.append(editor.element, companion, elsewhere);
    editor.focus();
    search.focus();
    expect(left).not.toHaveBeenCalled();
    editor.focus();
    search.focus();
    elsewhere.focus();
    expect(left).toHaveBeenCalledTimes(1);
    editor.focus();
    elsewhere.focus();
    expect(left).toHaveBeenCalledTimes(2);
    editor.destroy();
  });
});

describe("the CodeMirror editor's live preview", () => {
  const make = (text: string, selection = 0, readOnly = false) => {
    const editor = codeMirrorEditor(cm, document, { text, selection, readOnly }, { made: () => undefined, gone: () => undefined });
    const root = editor.element.shadowRoot!;
    const lines = () => [...root.querySelectorAll(".cm-line")].map((line) => line.textContent);
    return { editor, root, lines };
  };

  it("says it shows the markdown as rendered, the stand-in not", () => {
    expect(make("x").editor.preview).toBe(true);
    expect(textareaEditor(document, { text: "x" }).preview).toBe(false);
  });

  it("hides the marks away from the selection, shows those it touches", () => {
    const { editor, lines } = make("x\n# Title\nsome **bold**, *it* and `code`\n[text](https://a.b) and [[Page]], [[Page|alias]]", 0);
    expect(lines()).toEqual(["x", "Title", "some bold, it and code", "text and Page, alias"]);
    editor.setSelection(25);
    expect(lines()[2]).toBe("some bold, *it* and code");
    editor.setSelection(9);
    expect(lines()[1]).toBe("# Title");
    editor.destroy();
  });

  it("draws a hashtag as SilverBullet does, as written; none in code, a URL or a heading's mark", () => {
    const { editor, root } = make("x\nA #tag and #<two words>, `#code`, https://a.b/#frag\n# Title #inner\n```\n#fenced\n```", 0);
    expect([...root.querySelectorAll(".swe-hashtag")].map((tag) => tag.textContent)).toEqual(["#tag", "#<two words>", "#inner"]);
    editor.destroy();
  });

  it("draws a task's checkbox, toggling it, a done task struck through, a bullet for a list's mark", () => {
    const { editor, root, lines } = make("x\n- [ ] open\n- [x] done\n* item", 0);
    expect(lines()).toEqual(["x", "•  open", "•  done", "• item"]);
    const boxes = [...root.querySelectorAll<HTMLInputElement>("input.swe-checkbox")];
    expect(boxes.map((box) => box.checked)).toEqual([false, true]);
    expect(root.querySelector(".swe-task-done")?.textContent).toBe("done");
    boxes[0]!.click();
    expect(editor.getText()).toBe("x\n- [x] open\n- [x] done\n* item");
    expect(editor.getSelection()).toEqual({ from: 0, to: 0, backward: false });
    editor.destroy();
  });

  it("draws an embed where its plugin draws it, its markdown where the caret is (its drawing ended); another embed as written", () => {
    const ended: string[] = [];
    const embed = (markdown: string) => {
      const name = /[\w-]+\.png/.exec(markdown)?.[0];
      return name
        ? {
            key: markdown,
            draw: (container: HTMLElement, signal: AbortSignal) => {
              const picture = container.ownerDocument.createElement("img");
              picture.className = "test-picture";
              picture.setAttribute("src", `/files/${name}`);
              container.append(picture);
              signal.addEventListener("abort", () => ended.push(name));
            },
          }
        : undefined;
    };
    const editor = codeMirrorEditor(cm, document, { text: "x\n![[photo.png|A|40]] and ![B](other.png)\n![[file.pdf]]", selection: 0, embed }, { made: () => undefined, gone: () => undefined });
    const root = editor.element.shadowRoot!;
    const pictures = () => [...root.querySelectorAll<HTMLImageElement>(".swe-embed > img")].map((one) => one.getAttribute("src"));
    expect(pictures()).toEqual(["/files/photo.png", "/files/other.png"]);
    expect(root.querySelectorAll(".cm-line")[2]!.textContent).toBe("![[file.pdf]]");
    editor.setSelection(4);
    expect(pictures()).toEqual(["/files/other.png"]);
    expect(ended).toEqual(["photo.png"]);
    expect(root.querySelectorAll(".cm-line")[1]!.textContent).toContain("![[photo.png|A|40]]");
    editor.destroy();
  });

  it("puts the page's rules of what an embed draws into its root, by their prefixes, none of the editor's own", async () => {
    const sheet = document.createElement("style");
    sheet.textContent = ".test-picture { color: red } [data-test-view] img { width: 1px } .cm-line { color: blue } @media (min-width: 1px) { .test-picture { margin: 1px } .other { margin: 2px } }";
    document.head.append(sheet);
    const embed = () => ({ key: "k", draw: (container: HTMLElement) => container.append(Object.assign(container.ownerDocument.createElement("i"), { className: "test-picture" })) });
    const editor = codeMirrorEditor(cm, document, { text: "x\n![[a.png]]", selection: 0, embed }, { made: () => undefined, gone: () => undefined });
    await Promise.resolve();
    const styles = editor.element.shadowRoot!.querySelector("style[data-swe-page-styles]")!.textContent!;
    expect(styles).toContain(".test-picture");
    expect(styles).toContain("[data-test-view] img");
    expect(styles).toContain("@media");
    expect(styles).not.toContain(".cm-line");
    expect(styles).not.toContain(".other");
    editor.destroy();
    sheet.remove();
  });

  it("draws a table as one, its markdown where the selection touches it; a press in a cell puts the caret at its start", () => {
    const text = "x\n| a | *b* | c |\n|:--|--:|:-:|\n| 1 |  | [[Page]] \\| y |\n| 2 |\n\nz";
    const { editor, root, lines } = make(text, 0);
    const cells = () => [...root.querySelectorAll(".swe-table tr")].map((row) => [...row.children].map((cell) => cell.textContent));
    expect(cells()).toEqual([
      ["a", "b", "c"],
      ["1", "", "Page | y"],
      ["2", "", ""],
    ]);
    expect(root.querySelector(".swe-table th em")?.textContent).toBe("b");
    expect([...root.querySelectorAll<HTMLElement>(".swe-table th")].map((cell) => cell.style.textAlign)).toEqual(["left", "right", "center"]);
    expect(lines()).toEqual(["x", "", "z"]);
    const cell = root.querySelectorAll(".swe-table td")[2]!;
    cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    expect(editor.getSelection().from).toBe(text.indexOf("[[Page"));
    expect(root.querySelector(".swe-table")).toBeNull();
    expect(lines()[1]).toBe("| a | b | c |");
    editor.destroy();
  });

  it("puts the caret at a pressed cell's start in a table indented on its lines", () => {
    const text = "x\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |";
    const { editor, root } = make(text, 0);
    root.querySelectorAll(".swe-table td")[1]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    expect(editor.getSelection().from).toBe(text.lastIndexOf("2"));
    editor.destroy();
  });

  it("shows no source in a read-only editor, its checkboxes not toggled", () => {
    const { editor, root, lines } = make("**bold** [ ]\n- [ ] task", 0, true);
    expect(lines()).toEqual(["bold [ ]", "•  task"]);
    root.querySelector<HTMLInputElement>("input.swe-checkbox")!.click();
    expect(editor.getText()).toBe("**bold** [ ]\n- [ ] task");
    editor.destroy();
  });
});

describe("the editors' API", () => {
  it("is the stand-in without Silverware Editor or of another version, a <textarea> each, no surface", () => {
    const standIn = editorsOf(undefined);
    expect(standIn.create(document, { text: "x" }).element.tagName).toBe("TEXTAREA");
    expect(standIn.surfaceOf(document.body)).toBeUndefined();
    expect(editorsOf({ version: EDITOR_VERSION + 1, create: () => undefined, surfaceOf: () => undefined })).toBe(standIn);
  });

  it("makes CodeMirror's editors once it is loaded, the stand-in's before; finds the surface a node is in, none once it is gone", async () => {
    const { api, loadCodeMirror } = await import("./index.ts");
    expect(api.create(document, { text: "before" }).element.tagName).toBe("TEXTAREA");
    // (In a test the file beside the bundle is not there: the module handed over as the loader would give it)
    await loadCodeMirror(async () => cm);
    const editor = api.create(document, { text: "after" });
    expect(editor.element.shadowRoot!.querySelector(".cm-content")).not.toBeNull();
    const inside = editor.element.shadowRoot!.querySelector(".cm-line")!;
    expect(api.surfaceOf(inside)).toBe(editor);
    expect(api.surfaceOf(document.body)).toBeUndefined();
    editor.destroy();
    expect(api.surfaceOf(inside)).toBeUndefined();
  });
});
