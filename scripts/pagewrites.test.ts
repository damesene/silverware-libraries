// Every write of a page's text goes through the page writer (docs/silverware-core.md, *Storage*): SilverBullet's write
// functions (`replaceRange`, `writePage`, `writeFile`, `insertAtCursor`, `insertAtPos`) and the configuration page's
// name (`CONFIG_PAGE`) named in code (comments aside) outside a binding (`host/`, shared/silverbullet/) and the page
// writer (shared/pages/) fail here, unless listed: the editing tools for good (they change the user's text in the
// surface edited, as the user would), a name alike that writes no page, today's other places each with the step of
// docs/silverware-core-work.md that moves it. A name is read, not what it is called on: a method of a plugin's own named
// alike is listed too.
import { describe, expect, it } from "vitest";
import { allSources, codeOf, read } from "./sourcecode.ts";

/** The editing tools, `<file>: <name>` with why, and today's places with their step */
const ALLOWED: Readonly<Record<string, string>> = {
  // The plugins' entries, handed SilverBullet's API: into their bindings
  "silverware-assets/src/bridge.ts: replaceRange": "until step 4: the bridge, into the binding",
  "silverware-assets/src/bridge.ts: writePage": "until step 4: the bridge, into the binding",
  "silverware-chart/src/bridge.ts: replaceRange": "until step 4: the bridge, into the binding",
  "silverware-layout/src/bridge.ts: replaceRange": "until step 4: the bridge, into the binding",
  "silverware-layout/src/bridge.ts: writePage": "until step 4: the bridge, into the binding",
  "silverware-table/src/bridge.ts: replaceRange": "until step 4: the bridge, into the binding",
  "silverware-table/src/bridge.ts: writePage": "until step 4: the bridge, into the binding",
  "silverware-tags/src/bridge.ts: replaceRange": "until step 4: the bridge, into the binding",
  "silverware-tags/src/bridge.ts: writePage": "until step 4: the bridge, into the binding",
  "silverware-tags/src/space/silverbullet.ts: replaceRange": "until step 4: Silverware Tags' space of SilverBullet, into the binding",
  "silverware-tags/src/space/silverbullet.ts: writePage": "until step 4: Silverware Tags' space of SilverBullet, into the binding",
  "silverware-toolbar/src/bridge.ts: replaceRange": "until step 4: the bridge, into the binding",
  // Pages written past the page writer: through it
  "silverware-chart/src/index.ts: replaceRange": "until step 4: a chart's block written by the page writer's codeBlocks part",
  "silverware-chart/src/core/controller.ts: replaceRange": "until step 4: a chart's block written by the page writer's codeBlocks part",
  "silverware-chart/src/core/module.ts: replaceRange": "until step 4: a chart's block written by the page writer's codeBlocks part",
  "silverware-chart/src/modules/insert.ts: replaceRange": "until step 4: a chart's block written by the page writer's codeBlocks part",
  "silverware-chart/src/modules/insert.ts: insertAtCursor": "until step 4: a chart's block inserted by the page writer's codeBlocks part",
  "silverware-database/src/index.ts: insertAtCursor": "until step 4: the conversion's block inserted by the page writer's codeBlocks part",
  "silverware-table/src/controller.ts: insertAtCursor": "until step 4: a table inserted through the page writer (I7)",
  "silverware-table/src/core/store.ts: insertAtCursor": "until step 4: a table inserted through the page writer (I7)",
  "silverware-table/src/features/pivot.ts: insertAtCursor": "until step 4: a table inserted through the page writer (I7)",
  "silverware-table/src/features/views.ts: insertAtCursor": "until step 4: a table inserted through the page writer (I7)",
  "silverware-table/src/store/markdown/store.ts: insertAtCursor": "until step 4: a table inserted through the page writer (I7)",
  "silverware-layout/src/index.ts: replaceRange": "until step 4: Silverware Layout's edits through the page writer",
  "shared/configpage.ts: CONFIG_PAGE": "until step 4: settings through the core's Platform.settings",
  // The editing tools, for good: the user's text changed in the surface edited, as the user would
  "silverware-editor/src/codemirror.ts: replaceRange": "editing tool: the editor's own text",
  "silverware-layout/src/grid/drag.ts: replaceRange": "editing tool: a text dragged out of a field",
  "silverware-toolbar/src/core/controller.ts: replaceRange": "editing tool: the toolbar's actions on the surface edited",
  "shared/editor.ts: replaceRange": "editing tool: the editing surfaces' interface",
  // Not SilverBullet's: Silverware Database's own writeFile, a file's value in Files & media
  "silverware-database/src/domain/types/files.ts: writeFile": "not a page's write: a file's value as Files & media writes it",
  "silverware-database/src/views/fileseditor.ts: writeFile": "not a page's write: a file's value as Files & media writes it",
  "silverware-database/src/views/takefiles.ts: writeFile": "not a page's write: a file's value as Files & media writes it",
};

const NAMES = ["replaceRange", "writePage", "writeFile", "insertAtCursor", "insertAtPos", "CONFIG_PAGE"];

/** The write functions a file's code names, each once */
export function writesNamed(code: string): string[] {
  return NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(code));
}

const inScope = (file: string) => !/\/host\//.test(file) && !file.startsWith("shared/silverbullet/") && !file.startsWith("shared/pages/");

describe("pages written through the page writer", () => {
  it("lists each place as an editing tool, a step, or not a page's write", () => {
    for (const [entry, why] of Object.entries(ALLOWED)) expect(why, entry).toMatch(/^(editing tool|until step 4|not a page's write): /);
  });

  const found = allSources()
    .filter(inScope)
    .flatMap((file) => writesNamed(codeOf(read(file))).map((name) => `${file}: ${name}`));

  it("names SilverBullet's writes only in a binding, the writer or a listed place", () => {
    expect(found.filter((entry) => !(entry in ALLOWED))).toEqual([]);
  });

  it("lists no place that is gone", () => {
    expect(Object.keys(ALLOWED).filter((entry) => !found.includes(entry))).toEqual([]);
  });
});

describe("reading code", () => {
  it("finds each name as a word, not in a comment", () => {
    expect(writesNamed(codeOf("editor.replaceRange(a, b, c);\nspace.writePage(p, t);\n// writeFile\nconst x = CONFIG_PAGE;\nconst y = myreplaceRange;\n"))).toEqual(["replaceRange", "writePage", "CONFIG_PAGE"]);
  });
});
