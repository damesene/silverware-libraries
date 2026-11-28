// Two ways to make DOM, one rule (docs/silverware-preact.md, *Two ways, one rule*): Preact for every island of a
// plugin's own (what is inside an overlay, a database's views and place, the toolbar's bar, the tags workspace, …);
// `el()` only for what is put into or onto SilverBullet's DOM and lives by its rendering (marks and small nodes in its
// tables, embeds and lines; controls laid on its widgets and measured with them at once). A file importing the element
// builder (shared/elements.ts) or calling `createElement` (code, comments aside) fails here unless the list below names
// it, or a folder holding it: a decoration of SilverBullet's DOM for good, or today's island with the step of
// docs/silverware-preact.md that converts it (its steps 7 and 10 are docs/silverware-core-work.md's); the list holds only
// decorations at the end.
import { describe, expect, it } from "vitest";
import { allSources, codeOf, read } from "./sourcecode.ts";

/** Files and folders (ending in `/`) allowed `el()`: "decoration", or the step that converts the island */
const ALLOWED: Readonly<Record<string, string>> = {
  // Silverware Table: its controls and marks on SilverBullet's tables; its dialogs are islands
  "silverware-table/src/controller.ts": "decoration: SilverBullet's rendered tables enhanced in place",
  "silverware-table/src/dom.ts": "decoration: nodes put into SilverBullet's tables",
  "silverware-table/src/core/editor.ts": "decoration: the cell editor in a cell of SilverBullet's table",
  "silverware-table/src/core/insert.ts": "decoration: the + laid on a table's widget",
  "silverware-table/src/core/outline.ts": "decoration: an outline laid on a table's widget",
  "silverware-table/src/core/overwindow.ts": "decoration: marks of a table's widget shown over the window",
  "silverware-table/src/core/toolbar.ts": "decoration: the toolbar laid on a table's widget",
  "silverware-table/src/core/touch-keyboard.ts": "decoration: an input keeping the on-screen keyboard (a workaround)",
  "silverware-table/src/features/columntypes.ts": "decoration: a column type's look in the table's cells",
  "silverware-table/src/features/filters.ts": "decoration: the filter row in the table",
  "silverware-table/src/features/formulas.ts": "decoration: a formula's marks in the table's cells",
  "silverware-table/src/host/silverbullet/adapter.ts": "decoration: SilverBullet's rendered tables, as the core asks",
  "silverware-table/src/host/silverbullet/cells.ts": "decoration: a cell's nodes in SilverBullet's table",
  "silverware-table/src/host/silverbullet/columns.ts": "decoration: a column's nodes in SilverBullet's table",
  "silverware-table/src/host/silverbullet/drawn.ts": "decoration: the sheet's table, drawn as SilverBullet draws its own",
  "silverware-table/src/host/silverbullet/linedrag.ts": "decoration: a line dragged in SilverBullet's table",
  "silverware-table/src/host/silverbullet/looks.ts": "decoration: a cell's look in SilverBullet's table",
  "silverware-table/src/host/silverbullet/modules/labels.ts": "decoration: a table's name in a tab on its widget",
  "silverware-table/src/host/silverbullet/modules/largetables.ts": "decoration: a large table's box around its widget",
  "silverware-table/src/host/silverbullet/modules/sheet.ts": "decoration: a table's widget shown as a sheet over the window",
  "silverware-table/src/host/silverbullet/overlays.ts": "decoration: outlines over SilverBullet's table's cells",
  "silverware-table/src/features/choicesdialog.ts": "until step 10: a dialog",
  "silverware-table/src/features/conditionsdialog.ts": "until step 10: a dialog (docs/silverware-preact.md, its step 4)",
  "silverware-table/src/features/excel.ts": "until step 10: a dialog",
  "silverware-table/src/features/functiondialog.ts": "until step 10: a dialog",
  "silverware-table/src/features/pivotdialog.ts": "until step 10: a dialog",
  "silverware-table/src/features/resultview.ts": "until step 10: a table over the window",
  "silverware-table/src/features/viewdialog.ts": "until step 10: a dialog",
  "silverware-table/src/settings.ts": "until step 10: the settings dialog",
  // Silverware Chart
  "silverware-chart/src/core/controller.ts": "decoration: a chart drawn in its code block's widget",
  "silverware-chart/src/core/drawn.ts": "decoration: a chart's widget",
  "silverware-chart/src/core/theme.ts": "decoration: a sample of SilverBullet's look measured",
  "silverware-chart/src/core/toolbar.ts": "decoration: the toolbar laid on a chart's widget",
  "silverware-chart/src/index.ts": "decoration: a block's problem shown in its widget",
  "silverware-chart/src/core/settingsdialog.ts": "until step 10: the chart's settings",
  // Silverware Database: every view, the place, the peek and the dialogs
  "silverware-database/src/": "until step 10: the place, the views, the peek, Properties and the dialogs (docs/silverware-preact.md, its steps 5 and 6)",
  // Silverware Editor: CodeMirror's lines drawn as SilverBullet draws its own
  "silverware-editor/src/codemirror.ts": "decoration: the editor's own nodes around CodeMirror",
  "silverware-editor/src/livepreview.ts": "decoration: widgets in CodeMirror's lines, as SilverBullet's",
  "silverware-editor/src/look.ts": "decoration: a sample of the page's look measured",
  "silverware-editor/src/pagestyles.ts": "decoration: the page's rules copied into the editor's root",
  // Silverware Icons
  "silverware-icons/src/picker.ts": "until step 10: the picker",
  // Silverware Layout: its grids and handles on SilverBullet's page; its dialogs are islands
  "silverware-layout/src/grid/ui/columngrips.ts": "decoration: a grid's column grips on its widget",
  "silverware-layout/src/grid/ui/dividers.ts": "decoration: a grid's dividers on its widget",
  "silverware-layout/src/grid/ui/view.ts": "decoration: a grid's view in SilverBullet's page",
  "silverware-layout/src/grid/ui/placepicker.ts": "until step 10: the place picker's bar over the page, taking every press",
  "silverware-layout/src/host/silverbullet/codeblocks.ts": "decoration: nodes in SilverBullet's code blocks",
  "silverware-layout/src/host/silverbullet/embeddedgrids.ts": "decoration: grids embedded in SilverBullet's page",
  "silverware-layout/src/host/silverbullet/tasks.ts": "decoration: nodes in SilverBullet's tasks",
  "silverware-layout/src/index.ts": "decoration: a problem shown in a widget",
  "silverware-layout/src/ui/fontzoom.ts": "decoration: the zoom's label at the page's edge",
  "silverware-layout/src/ui/guidelines.ts": "decoration: guides laid over the page",
  "silverware-layout/src/ui/handle.ts": "decoration: a block's handle laid on the page",
  "silverware-layout/src/ui/aligntab.ts": "until step 10: a tab of the page dialog",
  "silverware-layout/src/ui/pagedialog.ts": "until step 10: the page dialog",
  "silverware-layout/src/ui/syntaxtab.ts": "until step 10: a tab of the page dialog",
  // Silverware Assets and its viewers: previews in SilverBullet's embeds; panels, dialogs and readers are islands
  "silverware-assets/src/builtin/actions.ts": "decoration: no island: a canvas an image is copied by, a link a file is saved by",
  "silverware-assets/src/builtin/types.ts": "decoration: a preview in SilverBullet's embed",
  "silverware-assets/src/decorate.ts": "decoration: SilverBullet's embeds decorated",
  "silverware-assets/src/host/silverbullet/assets.ts": "decoration: the binding's nodes in SilverBullet's embeds",
  "silverware-assets/src/ui/card.ts": "decoration: an embed's card",
  "silverware-assets/src/ui/label.ts": "decoration: a preview's label",
  "silverware-assets/src/ui/plainmedium.ts": "decoration: a medium SilverBullet draws, in an embed",
  "silverware-assets/src/builtin/panels.ts": "until step 10: the side panel and the view over the page",
  "silverware-assets/src/ui/cardeditor.ts": "until step 10: a dialog",
  "silverware-assets/src/ui/insertdialog.ts": "until step 10: a dialog",
  "silverware-assets/src/ui/labeleditor.ts": "until step 10: a dialog",
  "silverware-assets/src/ui/mediatab.ts": "until step 10: the settings' tabs",
  "silverware-assets/src/ui/moremenu.ts": "until step 10: a menu's content",
  "silverware-assets/src/ui/renamedialog.ts": "until step 10: a dialog",
  "silverware-assets/src/ui/sample.ts": "until step 10: the settings' samples",
  "silverware-assets/src/ui/settingswindow.ts": "until step 10: the settings window",
  "silverware-assets/src/ui/uploadprogress.ts": "until step 10: the uploads' panel",
  "silverware-assets-docx/src/documents.ts": "decoration: a document drawn by docx-preview",
  "silverware-assets-docx/src/load.ts": "decoration: docx-preview's container",
  "silverware-assets-docx/src/preview.ts": "decoration: a preview in SilverBullet's embed",
  "silverware-assets-docx/src/reader.ts": "until step 10: the reader",
  "silverware-assets-pdf/src/pdfjs/load.ts": "decoration: pdf.js's canvas",
  "silverware-assets-pdf/src/preview.ts": "decoration: a preview in SilverBullet's embed",
  "silverware-assets-xlsx/src/preview.ts": "decoration: a preview in SilverBullet's embed",
  "silverware-assets-xlsx/src/table.ts": "decoration: a sheet's content drawn, as docx-preview draws a document",
  "silverware-assets-xlsx/src/reader.ts": "until step 10: the reader",
  // Silverware Tags and Silverware Toolbar: islands whole
  "silverware-tags/src/": "until step 10: the workspace, its dialogs and the settings",
  "silverware-toolbar/src/": "until step 10: the bar, its popup and panels, the settings",
  // shared/
  "shared/clipboard.ts": "decoration: no island: a textarea the copy command copies",
  "shared/editorlook.ts": "decoration: a sample the page renders, measured",
  "shared/silverbullet/embedimage.ts": "decoration: an image in a field, as SilverBullet's embed",
  "shared/dialog.ts": "until step 7: the dialogs' frame, replaced by the core's",
  "shared/popupmenu.ts": "until step 7: the popup menus' frame, replaced by the core's",
  "shared/controls.ts": "until step 10: a settings dialog's controls",
  "shared/diffview.ts": "until step 10: a dialog's diff",
  "shared/docreader.ts": "until step 10: the readers' shell",
  "shared/editor.ts": "until step 10: the editor's stand-in field",
  "shared/formulafield.ts": "until step 10: a dialog's formula field",
  "shared/icons.ts": "until step 10: the icons' stand-in picker",
  "shared/menu.ts": "until step 10: the menus' content",
  "shared/suggest.ts": "until step 10: a field's names offered",
  "shared/tabs.ts": "until step 10: a dialog's tabs",
};

/** Whether a file's code makes elements itself */
export function makesElements(code: string): boolean {
  return /(?:\bfrom\s+|\bimport\(\s*)["'][^"']*\/shared\/elements\.ts["']|(?:\bfrom\s+|\bimport\(\s*)["']\.\/elements\.ts["']|\bcreateElement(?:NS)?\(/.test(code);
}

const allowedBy = (file: string) => Object.keys(ALLOWED).find((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry));

describe("elements made by el() or createElement", () => {
  const found = allSources()
    .filter((file) => file !== "shared/elements.ts")
    .filter((file) => makesElements(codeOf(read(file))));

  it("only in a decoration of SilverBullet's DOM, or an island listed with its step", () => {
    expect(found.filter((file) => !allowedBy(file))).toEqual([]);
  });

  it("lists nothing that makes no elements any more", () => {
    expect(Object.keys(ALLOWED).filter((entry) => !found.some((file) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry)))).toEqual([]);
  });

  it("lists each entry as a decoration or a step", () => {
    for (const [entry, why] of Object.entries(ALLOWED)) expect(why, entry).toMatch(/^(decoration|until step (7|10)): /);
  });
});

describe("reading code", () => {
  it("finds the builder imported and createElement called, not in a comment", () => {
    expect(makesElements('import { el } from "../../shared/elements.ts";')).toBe(true);
    expect(makesElements('import { el } from "./elements.ts";')).toBe(true);
    expect(makesElements("const a = document.createElement('div');")).toBe(true);
    expect(makesElements(codeOf("// document.createElement('div')\nconst a = 1;"))).toBe(false);
  });
});
