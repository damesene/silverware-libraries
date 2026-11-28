// SilverBullet kept apart (docs/silverware-core.md, *SilverBullet kept apart*): what knows SilverBullet is a binding
// (each plugin's and the core's `src/host/silverbullet/`, shared/silverbullet/), never spread through the rest. Every
// plugin's and the core's src/ outside `host/`, entry files included, and shared/ outside shared/silverbullet/, are
// read for SilverBullet's markers in their code (comments aside): an import of shared/silverbullet/ or of a
// `host/silverbullet/`; a string starting with `sb-` or holding `.sb-` or `#sb-` (its classes and ids); `Library/` (its
// pages' places); `importFromSpace`, `posAtDOM`; its events' names. Each hit fails unless the list below names it,
// today's leaks each with the step of docs/silverware-core-work.md that moves it into a binding; the list is empty at
// the end.
import { describe, expect, it } from "vitest";
import { allSources, codeOf, read } from "./sourcecode.ts";

/** Today's leaks, `<file>: <marker>` with the step that moves it */
const LEAKS: Readonly<Record<string, string>> = {
  // silverware-assets
  "silverware-assets/src/bridge.ts: posAtDOM": "until step 4: into the plugin's binding",
  "silverware-assets/src/index.ts: imports ./host/silverbullet/assets.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-assets/src/index.ts: imports ../../shared/silverbullet/platform.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-assets/src/index.ts: imports ./host/silverbullet/syntaxmode.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-assets/src/index.ts: imports ./host/silverbullet/insert.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-assets/src/model/settings.ts: \"Library/\"": "until step 4: into the plugin's binding",
  // silverware-assets-docx
  "silverware-assets-docx/src/index.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-assets-docx/src/reader.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: into the plugin's binding",
  "silverware-assets-docx/src/type.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: into the plugin's binding",
  // silverware-assets-xlsx
  "silverware-assets-xlsx/src/index.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-assets-xlsx/src/reader.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: into the plugin's binding",
  "silverware-assets-xlsx/src/type.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: into the plugin's binding",
  // silverware-chart
  "silverware-chart/src/bridge.ts: posAtDOM": "until step 4: into the plugin's binding",
  "silverware-chart/src/index.ts: imports ../../shared/silverbullet/position.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-chart/src/index.ts: imports ../../shared/silverbullet/widgetmenu.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-chart/src/index.ts: posAtDOM": "until step 4: into the plugin's binding",
  // silverware-database
  "silverware-database/src/index.ts: imports ../../shared/silverbullet/widgetmenu.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ../../shared/silverbullet/keptkeys.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ../../shared/silverbullet/embedimage.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ../../shared/silverbullet/links.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ../../shared/silverbullet/position.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ./host/silverbullet/block.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ./host/silverbullet/places.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ./host/silverbullet/media.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ./host/silverbullet/layout.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: imports ./host/silverbullet/platform.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-database/src/index.ts: \"sb-fenced-code-hide\"": "until step 4: into the plugin's binding",
  "silverware-database/src/index.ts: \"sb-line-table-outside\"": "until step 4: into the plugin's binding",
  "silverware-database/src/index.ts: posAtDOM": "until step 4: into the plugin's binding",
  "silverware-database/src/modules/peek/panel.ts: \".sb-modal-box\"": "until step 4: into the plugin's binding",
  // silverware-editor
  "silverware-editor/src/codemirror.ts: posAtDOM": "not SilverBullet's: CodeMirror's own view.posAtDOM",
  "silverware-editor/src/livepreview.ts: posAtDOM": "not SilverBullet's: CodeMirror's own view.posAtDOM",
  // silverware-layout
  "silverware-layout/src/bridge.ts: posAtDOM": "until step 4: into the plugin's binding",
  "silverware-layout/src/index.ts: imports ../../shared/silverbullet/widgetmenu.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/behaviour.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/gridindex.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/embeddedgrids.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/links.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/syntaxmode.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/grid.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/cursor.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/dom.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ./host/silverbullet/page.ts": "until step 4: the entry only composing, its binding imported by it",
  "silverware-layout/src/index.ts: imports ../../shared/silverbullet/platform.ts": "until step 4: the entry only composing, its binding imported by it",
  // silverware-table
  "silverware-table/src/dom.ts: imports ../../shared/silverbullet/navpanels.ts": "until step 4: into the plugin's binding",
  "silverware-table/src/dom.ts: \"sb-table-widget\"": "until step 4: into the plugin's binding",
  "silverware-table/src/dom.ts: \"sb-table-align-\"": "until step 4: into the plugin's binding",
  "silverware-table/src/dom.ts: \".sb-task-state\"": "until step 4: into the plugin's binding",
  "silverware-table/src/index.ts: imports ./host/silverbullet/api.ts": "until step 4: the entry only composing, its binding imported by it",
  // silverware-tags
  "silverware-tags/src/settings.ts: \"Library/\"": "until step 4: into the plugin's binding",
  "silverware-tags/src/space/silverbullet.ts: \".sb-nav-root\"": "until step 4: into the plugin's binding",
  "silverware-tags/src/space/silverbullet.ts: \".sb-nav-input\"": "until step 4: into the plugin's binding",
  // silverware-toolbar
  "silverware-toolbar/src/dom.ts: imports ../../shared/silverbullet/navpanels.ts": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/dom.ts: \".sb-modal-box\"": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/dom.ts: \".sb-keyboard-bar\"": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/dom.ts: \"sb-viewport-tracked\"": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/dom.ts: \"sb-root\"": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/dom.ts: \"#sb-editor\"": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/index.ts: \"Library/\"": "until step 4: into the plugin's binding",
  "silverware-toolbar/src/modules/commands.ts: imports ../../../shared/silverbullet/commands.ts": "until step 4: into the plugin's binding",
  // shared
  "shared/configpage.ts: \"Library/\"": "until step 4: into the core's binding",
  "shared/pages/tags/names.ts: \"Library/\"": "until step 4: SilverBullet's library pages, given by the binding",
};

const EVENTS = ["editor:pageLoaded", "editor:pageModified", "editor:pageSaved", "page:index", "page:deleted", "mq:emptyQueue", "system:ready", "editor:complete", "slash:complete"];

/** SilverBullet's markers in a file's code, each once */
export function hostMarkers(code: string): string[] {
  const found = new Set<string>();
  for (const [, spec] of code.matchAll(/(?:\bfrom\s+|\bimport\(\s*)["']([^"']+)["']/g)) if (/(^|\/)(shared|host)\/silverbullet\//.test(spec!)) found.add(`imports ${spec}`);
  for (const [literal] of code.matchAll(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)) {
    const text = literal!.slice(1, -1);
    if (/^sb-/.test(text) || /[.#]sb-/.test(text)) found.add(`"${/[.#]?sb-[\w-]*/.exec(text)![0]}"`);
    if (text.includes("Library/")) found.add('"Library/"');
    for (const event of EVENTS) if (text.includes(event)) found.add(`"${event}"`);
  }
  for (const name of ["importFromSpace", "posAtDOM"]) if (new RegExp(`\\b${name}\\b`).test(code)) found.add(name);
  return [...found];
}

/** The files read: outside the bindings */
const inScope = (file: string) => !/\/host\//.test(file) && !file.startsWith("shared/silverbullet/");

describe("SilverBullet kept apart", () => {
  const found = allSources()
    .filter(inScope)
    .flatMap((file) => hostMarkers(codeOf(read(file))).map((marker) => `${file}: ${marker}`));

  it("knows it only in a binding, or as a leak listed with the step that moves it", () => {
    expect(found.filter((entry) => !(entry in LEAKS))).toEqual([]);
  });

  it("lists each leak with its step, or as not SilverBullet's", () => {
    for (const [entry, why] of Object.entries(LEAKS)) expect(why, entry).toMatch(/^(until step 4|not SilverBullet's): /);
  });

  it("lists no leak that is gone (an entry leaves as its step moves it)", () => {
    expect(Object.keys(LEAKS).filter((entry) => !found.includes(entry))).toEqual([]);
  });
});

describe("reading code", () => {
  it("finds an import of a binding, its classes and ids, its places, its API and its events", () => {
    expect(hostMarkers('import { a } from "../shared/silverbullet/links.ts";\nconst b = ".sb-root";\nconst c = "sb-x";\nconst d = `#sb-main .x`;\nconst e = "Library/Config";\nposAtDOM(x);\nevents.on("page:index");\n')).toEqual([
      "imports ../shared/silverbullet/links.ts",
      '".sb-root"',
      '"sb-x"',
      '"#sb-main"',
      '"Library/"',
      '"page:index"',
      "posAtDOM",
    ]);
  });

  it("leaves a class merely holding sb (swb-, a word), and comments", () => {
    expect(hostMarkers(codeOf('const a = "swb-bar";\nconst b = "usb-x";\n// .sb-root, Library/Config, posAtDOM\n/* "page:index" */\n'))).toEqual([]);
  });
});
