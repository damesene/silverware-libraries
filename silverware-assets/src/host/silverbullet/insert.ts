// Files pasted, dropped and uploaded in SilverBullet, taken from it into Silverware Assets' dialog
// (docs/silverware-assets-insert.md): its editor's `paste` and `drop` of files taken at the document's capture before
// its own handlers (`client/codemirror/editing/editor_paste.ts`, 2.12.1 and main 2026-11-15), its event
// `silverbullet:upload-files` too (a desktop shell's), and its *File: Upload* replaced by the init page. In the page's
// editor (found by SilverBullet's elements: here alone) and in a field of another plugin's (a grid's cell: the
// editing surface Silverware Editor's API gives, shared/editor.ts). What is taken is decided in the event (a
// clipboard's and a drop's files are read there alone, `preventDefault` there alone): the setting as last read, read-
// only, a fenced block or the front matter (SilverBullet's line classes, both versions) left to SilverBullet. The
// files are written once Insert is pressed, then their markdown put in at the selection then (a drop's: where it was
// dropped), in one edit; the page changed meanwhile, they are written and their markdown said, not put in another.
import type { EditingSurface } from "../../../../shared/editor.ts";
import type { Bridge } from "../../bridge.ts";
import { joinedMarkdown, type LinkStyle, mappedPlace, markdownOf, placeIn, takesPaste, webMarkdownOf, webNameOf, webUrlOf } from "../../core/insert.ts";
import type { InsertChoice, InsertFile } from "../../ui/insertdialog.ts";
import { editorPositionAt } from "./editorposition.ts";

// SilverBullet's elements: its page's editor's text, a line of fenced code, an indented one, the front matter
const PAGE_TEXT = "#sb-main .cm-editor .cm-content";
const CODE_LINE = ".sb-line-fenced-code, .sb-line-code, .sb-frontmatter";
// Its event of files uploaded (a desktop shell's: `detail.files`)
const UPLOAD_EVENT = "silverbullet:upload-files";
// Its desktop app's own handling of a file of the space dropped (linked, not uploaded again): left to it
type DesktopWindow = { readonly silverbulletDesktop?: { readonly resolveSpaceFileDrop?: unknown } };

/**
 * Where files are put: the page's editor (at a place of its text, else its selection as Insert is pressed; `block`: a
 * drop on a widget, the files a line of their own beside it), or another plugin's field
 */
export type InsertTarget = { readonly kind: "page"; readonly page: string; readonly at?: number; readonly block?: boolean } | { readonly kind: "surface"; readonly surface: EditingSurface };

/** What taking files asks of Silverware Assets */
export type InsertWatch = {
  // Whether files are taken (the setting, as last read: the decision is in the event)
  enabled(): boolean;
  // The editing surface a node is in (Silverware Editor's fields), none where it is in none
  surfaceOf(node: Node): EditingSurface | undefined;
  // The page open, as last told (the event cannot wait for it)
  page(): string | undefined;
  // The dialog opened for these files, to put them there
  open(files: readonly InsertFile[], target: InsertTarget): void;
};

/** Whether the page's editor takes edits now (SilverBullet's read-only mode makes its text not editable) */
const pageEditable = (doc: Document): boolean => doc.querySelector(PAGE_TEXT)?.getAttribute("contenteditable") !== "false";

/** Where a node is: a field of another plugin's, the page's text (not in its fenced code or front matter), or nothing taken */
function targetOf(doc: Document, node: Node | null, line: Element | null | undefined, watch: InsertWatch, at?: number): InsertTarget | undefined {
  if (!node) return undefined;
  const surface = watch.surfaceOf(node);
  if (surface) return surface.readOnly ? undefined : { kind: "surface", surface };
  const element = node instanceof Element ? node : node.parentElement;
  const text = element?.closest(PAGE_TEXT);
  // (A field of a widget in the page's text, a table's cell's input: its own, not the page's; a widget itself, which
  // CodeMirror marks not editable, is the page's)
  if (!text || element?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])') !== text || !pageEditable(doc) || line?.closest(CODE_LINE)) return undefined;
  const page = watch.page();
  // (On a widget, an embed's, a grid's, a table's (CodeMirror marks it not editable), or off any line: the files a
  // line of their own beside it)
  const widget = !line || !!element?.closest('[contenteditable="false"]');
  return page === undefined ? undefined : { kind: "page", page, ...(at === undefined ? {} : { at, ...(widget ? { block: true } : {}) }) };
}

/** The line of the editor the selection is in (a paste goes there) */
function selectionLine(doc: Document): Element | null {
  const node = doc.getSelection()?.anchorNode ?? null;
  return (node instanceof Element ? node : node?.parentElement)?.closest(".cm-line") ?? null;
}

/** Files taken from SilverBullet as they are pasted, dropped or uploaded, until `signal` ends */
export function watchInserts(doc: Document, watch: InsertWatch, signal: AbortSignal): void {
  const options = { capture: true, signal };
  doc.addEventListener(
    "paste",
    (event) => {
      const data = event.clipboardData;
      if (!watch.enabled() || !data) return;
      const files = [...data.files];
      const kinds = { files: files.length, types: [...data.types], html: data.types.includes("text/html") ? data.getData("text/html") : "" };
      if (!takesPaste(kinds)) return;
      const target = targetOf(doc, event.target as Node | null, selectionLine(doc), watch);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // (An image copied from a web page: its address too, to be linked instead of kept)
      const url = webUrlOf(kinds);
      watch.open(
        files.map((file) => ({ file, source: "clipboard", ...(url ? { url } : {}) })),
        target,
      );
    },
    options,
  );
  const dropped = (event: DragEvent): boolean => !!event.dataTransfer?.types.includes("Files") && !(doc.defaultView as DesktopWindow | null)?.silverbulletDesktop?.resolveSpaceFileDrop;
  doc.addEventListener(
    "dragover",
    (event) => {
      if (!watch.enabled() || !dropped(event)) return;
      const line = doc.elementFromPoint(event.clientX, event.clientY)?.closest(".cm-line");
      if (!targetOf(doc, event.target as Node | null, line, watch)) return;
      // (Not stopped: SilverBullet's editor and Silverware Layout's grids watch it too)
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },
    options,
  );
  doc.addEventListener(
    "drop",
    (event) => {
      if (!watch.enabled() || !dropped(event)) return;
      const line = doc.elementFromPoint(event.clientX, event.clientY)?.closest(".cm-line");
      const target = targetOf(doc, event.target as Node | null, line, watch, editorPositionAt(doc, event.clientX, event.clientY));
      if (!target) return;
      const files = [...(event.dataTransfer?.files ?? [])];
      if (!files.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // (An image dragged from a web page: its address too, to be linked instead of kept)
      const data = event.dataTransfer;
      const url = webUrlOf({ files: files.length, html: data?.types.includes("text/html") ? data.getData("text/html") : "", uriList: data?.types.includes("text/uri-list") ? data.getData("text/uri-list") : "" });
      watch.open(
        files.map((file) => ({ file, source: "drop", ...(url ? { url } : {}) })),
        target,
      );
    },
    options,
  );
  doc.addEventListener(
    UPLOAD_EVENT,
    (event) => {
      const files = (event as CustomEvent<{ files?: File[] }>).detail?.files;
      const page = watch.page();
      if (!watch.enabled() || !files?.length || page === undefined || !pageEditable(doc)) return;
      event.stopImmediatePropagation();
      watch.open(
        files.map((file) => ({ file, source: "upload" })),
        { kind: "page", page },
      );
    },
    options,
  );
}

/** Whose a command's upload is: Silverware Assets' (the setting as last read), SilverBullet's own (turned off), or none's (the page read-only) */
export const uploadBy = (doc: Document, enabled: boolean): "assets" | "silverbullet" | "none" => (!pageEditable(doc) ? "none" : enabled ? "assets" : "silverbullet");

/** Where files go in the page now: a drop's place, else its selection (none told: its end) */
async function pagePlace(bridge: Bridge, target: Extract<InsertTarget, { kind: "page" }>, text: string): Promise<{ from: number; to: number }> {
  const selection = target.at === undefined && bridge.getSelection ? ((await bridge.getSelection()) as { from?: unknown; to?: unknown } | undefined) : undefined;
  const at = target.at ?? (typeof selection?.from === "number" ? selection.from : text.length);
  const from = Math.min(Math.max(at, 0), text.length);
  const to = target.at === undefined && typeof selection?.to === "number" ? Math.min(Math.max(selection.to, from), text.length) : from;
  return { from, to };
}

/** The text and where files go in it now (none: the page not read) */
async function placeNow(bridge: Bridge, target: InsertTarget): Promise<{ readonly text: string; readonly from: number; readonly to: number } | undefined> {
  try {
    if (target.kind === "surface") return { text: target.surface.getText(), ...target.surface.getSelection() };
    const text = String(await bridge.getText());
    return { text, ...(await pagePlace(bridge, target, text)) };
  } catch {
    return undefined;
  }
}

/**
 * The files chosen written into the space (each in turn: one that fails said, the rest still written), then their
 * markdown put in where they go, one edit; what was not put in (another page open, the field closed, a failure) said
 * with its markdown
 */
export async function insertChosen(bridge: Bridge, target: InsertTarget, chosen: readonly InsertChoice[], progress?: (index: number, state: "uploading" | "done" | "failed") => void): Promise<void> {
  // Where they go is where it is as Insert is pressed, moved by what is typed
  // elsewhere while they upload; where it is typed over, where the cursor is then
  const asPressed = await placeNow(bridge, target);
  const written: InsertChoice[] = [];
  const failed: string[] = [];
  for (const [index, one] of chosen.entries()) {
    // (A file of the web linked: nothing to write)
    if (one.url) {
      written.push(one);
      continue;
    }
    progress?.(index, "uploading");
    try {
      if (!bridge.writeDocument) throw new Error("this SilverBullet hands over no way to write a file");
      await bridge.writeDocument(one.path, new Uint8Array(await one.file.arrayBuffer()));
      written.push(one);
      progress?.(index, "done");
    } catch (error) {
      failed.push(`${one.path} (${error instanceof Error ? error.message : String(error)})`);
      progress?.(index, "failed");
    }
  }
  if (failed.length) void bridge.flash(`Silverware Assets: not written: ${failed.join(", ")}`, "error");
  if (!written.length) return;
  let style: LinkStyle = "wikilink";
  try {
    style = (bridge.getConfig ? await bridge.getConfig("defaultLinkStyle", "wikilink") : "wikilink") === "wikilink" ? "wikilink" : "markdown";
  } catch {
    // (SilverBullet's own style then)
  }
  const parts = written.map((one) => ({ text: one.url ? webMarkdownOf(one.url, webNameOf(one.url), one.as, one.configured) : markdownOf(one.path, one.as, one.configured, style), embed: one.as !== "link" }));
  try {
    await putIn(bridge, target, parts, asPressed);
  } catch (error) {
    void bridge.flash(`Silverware Assets: written, but not put in (${error instanceof Error ? error.message : String(error)}); their markdown: ${joinedMarkdown(parts, false)}`, "error");
  }
}

/** The files' markdown put in where they go (as Insert was pressed, `asPressed`, moved by what changed since) */
async function putIn(bridge: Bridge, target: InsertTarget, parts: readonly { readonly text: string; readonly embed: boolean }[], asPressed: { readonly text: string; readonly from: number; readonly to: number } | undefined): Promise<void> {
  if (target.kind === "surface") {
    // (The field closed meanwhile, a grid's cell written: its markdown said, not put into a field no more shown)
    if (!target.surface.element.isConnected) {
      void bridge.flash(`Silverware Assets: written, but the field they go into was closed; their markdown: ${joinedMarkdown(parts, false)}`, "info");
      return;
    }
    const text = target.surface.getText();
    const { from, to } = (asPressed && mappedPlace(asPressed.text, text, asPressed.from, asPressed.to)) ?? target.surface.getSelection();
    const place = placeIn(text, from, to);
    const markdown = place.before + joinedMarkdown(parts, place.inLine, place.indent) + place.after;
    target.surface.replaceRange(from, to, markdown);
    target.surface.setSelection(from + markdown.length);
    target.surface.focus();
    return;
  }
  const page = String(await bridge.getCurrentPage());
  if (page !== target.page) {
    const markdown = joinedMarkdown(parts, false);
    void bridge.flash(`Silverware Assets: written, but another page is open now; their markdown: ${markdown}`, "info");
    return;
  }
  const text = String(await bridge.getText());
  const mapped = asPressed && mappedPlace(asPressed.text, text, asPressed.from, asPressed.to);
  // (Where it was is changed over: the cursor now, not the drop's place, which is another text's)
  const { from, to } = mapped ?? (await pagePlace(bridge, { kind: "page", page: target.page }, text));
  // A drop on a widget: a line of their own beside it (CodeMirror gives its start for its top half, its end for its
  // bottom); none in the front matter (it starts the page: after it)
  if (target.block && mapped) {
    const front = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(text);
    const at = front && from < front[0].length ? front[0].length : from;
    const lineStart = at === 0 || text[at - 1] === "\n";
    const markdown = joinedMarkdown(parts, false);
    await bridge.replaceRange(at, at, lineStart ? `${markdown}\n` : `\n${markdown}`);
    return;
  }
  const place = placeIn(text, from, to);
  await bridge.replaceRange(from, to, place.before + joinedMarkdown(parts, place.inLine, place.indent) + place.after);
}
