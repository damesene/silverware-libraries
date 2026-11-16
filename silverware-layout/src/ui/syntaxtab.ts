// The Markdown tab of the settings dialog: how the page's markdown is met, two settings each changing what SilverBullet
// itself does (off: SilverBullet's own, said so on top and in each note). A click on a link shown as its markdown (the
// caret in it, or all of them in the plain markdown view) placing the cursor alone, and, in the plain markdown view
// (Editor: Toggle Markdown Syntax Rendering), its grids hidden. Each under a heading of when it applies, a sentence of
// what SilverBullet does then, the box as what we do, and what on and off give. Saved on Save, as every tab.
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
  // A setting's section: its heading (as the dialog's other tabs name their rows), what SilverBullet does, the box, the notes
  const section = (heading: string, sentence: string, input: HTMLInputElement, label: string, ...notes: string[]) =>
    el(
      doc,
      "section",
      "swl-syntax-section",
      el(doc, "h3", "swl-dialog-row-name swl-syntax-heading", heading),
      el(doc, "p", "swl-syntax-text", sentence),
      el(doc, "label", "swl-syntax-check", input, label),
      ...notes.map((note) => el(doc, "p", "swl-syntax-note", note)),
    );
  const panel = el(
    doc,
    "div",
    "swl-syntax",
    el(doc, "p", "swl-syntax-lead", "These settings change how SilverBullet itself behaves. Turn one off to get SilverBullet's own behaviour back."),
    section(
      "Links shown as markdown",
      "A link shows as markdown while the cursor is in it, and in the plain markdown view. SilverBullet opens it on a click there too, which makes it hard to edit.",
      clicks,
      "A click only places the cursor; Ctrl+click opens the link",
      "On: a click puts the cursor in the link, to edit it.",
      "Off (SilverBullet's own): a click opens it.",
    ),
    section(
      "Plain markdown view",
      "SilverBullet can show a page as plain markdown, without formatting (command Editor: Toggle Markdown Syntax Rendering). It still draws grids there, under their markdown.",
      hide,
      "Hide grids in this view",
      "On: <grid> and <cell> stay plain text, like the rest of the page.",
      "Off (SilverBullet's own): the grid is drawn under its markdown.",
    ),
  );
  return {
    id: "markdown",
    title: "Markdown",
    panel,
    changed: () => current().hideGrids !== settings.hideGrids || current().clickPlacesCursor !== settings.clickPlacesCursor,
    save: () => save(current()),
  };
}
