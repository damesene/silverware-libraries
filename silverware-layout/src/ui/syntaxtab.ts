// The Markdown tab of the settings dialog: how the page's markdown is met. A click on a link shown as its markdown
// (the caret in it, or all of them while SilverBullet shows the markdown as written) placing the cursor alone, and,
// while SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax Rendering), its grids hidden: a box
// each. Saved on Save, as every tab.
import { el } from "../../../shared/elements.ts";
import type { SyntaxModeSettings } from "../model/settings.ts";
import type { DialogTabPart } from "./pagedialog.ts";

export function syntaxTab(doc: Document, settings: SyntaxModeSettings, save: (settings: SyntaxModeSettings) => Promise<string | undefined>): DialogTabPart {
  const box = (checked: boolean) => {
    const input = el(doc, "input", { attrs: { type: "checkbox" } });
    input.checked = checked;
    return input;
  };
  const clicks = box(settings.clickPlacesCursor);
  const hide = box(settings.hideGrids);
  const current = (): SyntaxModeSettings => ({ hideGrids: hide.checked, clickPlacesCursor: clicks.checked });
  const panel = el(
    doc,
    "div",
    "swl-syntax",
    el(doc, "label", "swl-syntax-check", clicks, "Clicking a link shown as markdown only places the cursor (Ctrl+click opens it)"),
    el(doc, "p", "swl-syntax-note", "A link shows as markdown while the cursor is in it, or in markdown-as-written mode. Rendered links still open on click."),
    el(doc, "p", "swl-syntax-note", "When SilverBullet shows the page's markdown as written (Editor: Toggle Markdown Syntax Rendering):"),
    el(doc, "label", "swl-syntax-check", hide, "Show grids as markdown only"),
    el(doc, "p", "swl-syntax-note", "Off: SilverBullet draws the columns under the markdown too."),
  );
  return {
    id: "markdown",
    title: "Markdown",
    panel,
    changed: () => current().hideGrids !== settings.hideGrids || current().clickPlacesCursor !== settings.clickPlacesCursor,
    save: () => save(current()),
  };
}
