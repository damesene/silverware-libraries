// The Markdown tab of the Page layout dialog: what Silverware Layout does while SilverBullet shows the markdown as
// written (Editor: Toggle Markdown Syntax Rendering): its grids hidden, a box. Saved on Save, as every tab.
import { el } from "../../../shared/elements.ts";
import type { SyntaxModeSettings } from "../model/settings.ts";
import type { DialogTabPart } from "./pagedialog.ts";

export function syntaxTab(doc: Document, settings: SyntaxModeSettings, save: (settings: SyntaxModeSettings) => Promise<string | undefined>): DialogTabPart {
  const hide = el(doc, "input", { attrs: { type: "checkbox" } });
  hide.checked = settings.hideGrids;
  const current = (): SyntaxModeSettings => ({ hideGrids: hide.checked });
  const panel = el(
    doc,
    "div",
    "swl-syntax",
    el(doc, "p", "swl-syntax-note", "While SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax Rendering):"),
    el(doc, "label", "swl-syntax-check", hide, "Hide grids: their markdown alone"),
  );
  return {
    id: "markdown",
    title: "Markdown",
    panel,
    changed: () => current().hideGrids !== settings.hideGrids,
    save: () => save(current()),
  };
}
