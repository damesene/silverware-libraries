// The Markdown tab of the Page layout dialog: what Silverware Layout does while SilverBullet shows the markdown as
// written (Editor: Toggle Markdown Syntax Rendering), each a box: embedded media and grids hidden, a click on a link
// placing the cursor alone. Saved on Save, as every tab.
import { el } from "../../../shared/elements.ts";
import type { SyntaxModeSettings } from "../model/settings.ts";
import type { DialogTabPart } from "./pagedialog.ts";

export function syntaxTab(doc: Document, settings: SyntaxModeSettings, save: (settings: SyntaxModeSettings) => Promise<string | undefined>): DialogTabPart {
  const box = (checked: boolean) => {
    const input = el(doc, "input", { attrs: { type: "checkbox" } });
    input.checked = checked;
    return input;
  };
  const hide = box(settings.hideWidgets);
  const click = box(settings.clickPlacesCursor);
  const current = (): SyntaxModeSettings => ({ hideWidgets: hide.checked, clickPlacesCursor: click.checked });
  const panel = el(
    doc,
    "div",
    "swl-syntax",
    el(doc, "p", "swl-syntax-note", "While SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax Rendering):"),
    el(doc, "label", "swl-media-check", hide, "Hide embedded files and grids: their markdown alone"),
    el(doc, "label", "swl-media-check", click, "A click on a link only places the cursor (Ctrl+click follows it)"),
  );
  return {
    id: "markdown",
    title: "Markdown",
    panel,
    changed: () => current().hideWidgets !== settings.hideWidgets || current().clickPlacesCursor !== settings.clickPlacesCursor,
    save: () => save(current()),
  };
}
