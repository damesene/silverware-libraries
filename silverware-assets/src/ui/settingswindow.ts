// Silverware Assets' settings window ("Silverware Assets: Settings"): its tabs (Files: how each type is shown and what
// a click does, the card, the heights; Markdown: what happens while SilverBullet shows the markdown as written), saved
// together on Save. Cancel closes without asking; Esc, × or a press beside it ask where changes would be lost. The
// shared dialog and tabs (shared/), classes `swa-dialog-*`.
import { Dialogs } from "../../../shared/dialog.ts";
import { el } from "../../../shared/elements.ts";
import { tabs } from "../../../shared/tabs.ts";
import type { SyntaxModeSettings } from "../model/settings.ts";
import type { SettingsTab } from "./mediatab.ts";

const BASE = "swa-dialog";
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/** The Markdown tab: a box each, what happens while SilverBullet shows the markdown as written */
export function markdownTab(doc: Document, settings: SyntaxModeSettings, save: (settings: SyntaxModeSettings) => Promise<string | undefined>): SettingsTab {
  const box = (checked: boolean) => {
    const input = el(doc, "input", { attrs: { type: "checkbox" } });
    input.checked = checked;
    return input;
  };
  const hide = box(settings.hideAssets);
  const click = box(settings.clickPlacesCursor);
  const current = (): SyntaxModeSettings => ({ hideAssets: hide.checked, clickPlacesCursor: click.checked });
  const panel = el(
    doc,
    "div",
    "swa-settings-markdown",
    el(doc, "p", "swa-settings-note", "While SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax Rendering):"),
    el(doc, "label", "swa-settings-check", hide, "Hide embedded files: their markdown alone"),
    el(doc, "label", "swa-settings-check", click, "A click on a link only places the cursor (Ctrl+click follows it)"),
  );
  return {
    id: "markdown",
    title: "Markdown",
    panel,
    changed: () => current().hideAssets !== settings.hideAssets || current().clickPlacesCursor !== settings.clickPlacesCursor,
    save: () => save(current()),
  };
}

export type SettingsWindowStore = {
  // Whether settings can be saved here (else they are shown, not changed)
  readonly canSave: boolean;
  confirm(question: string): Promise<boolean>;
};

/** The settings window, one per window (opened again: the one open closed first) */
export class SettingsWindow {
  private readonly dialogs: Dialogs;

  constructor(private readonly doc: Document) {
    this.dialogs = new Dialogs(doc, { base: BASE, closeIcon: CLOSE_ICON });
  }

  open(list: readonly SettingsTab[], store: SettingsWindowStore): void {
    const doc = this.doc;
    let saving = false;
    const { bar, panels, select } = tabs(doc, BASE, "swa", list.map(({ id, title, panel }) => ({ id, title, panel })));
    const content = doc.createDocumentFragment();
    content.append(...panels);
    const note = el(doc, "div", `${BASE}-note`);
    const changed = () => list.some((tab) => tab.changed());
    const saveButton = el(doc, "button", { class: `${BASE}-save`, text: "Save", run: () => void save() });
    const update = () => {
      saveButton.disabled = saving || !store.canSave || !changed();
      if (!store.canSave) note.textContent = "Settings cannot be saved here.";
    };
    for (const tab of list) for (const type of ["change", "input"]) tab.panel.addEventListener(type, update);
    if (!store.canSave) for (const control of content.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")) control.disabled = true;
    const cancel = el(doc, "button", { class: `${BASE}-cancel`, text: "Cancel", run: () => void (saving || dialog.close()) });
    const footer = doc.createDocumentFragment();
    footer.append(note, cancel, saveButton);
    const save = async () => {
      if (saving || !changed()) return;
      saving = true;
      update();
      note.textContent = "Saving…";
      note.classList.remove(`${BASE}-problem`);
      // (Each tab that changed, one after another: each writes the CONFIG page)
      let problem: string | undefined;
      for (const tab of list) {
        if (problem || !tab.changed()) continue;
        try {
          problem = await tab.save();
        } catch (error) {
          problem = error instanceof Error ? error.message : String(error);
        }
      }
      saving = false;
      if (problem) {
        note.textContent = `Not saved: ${problem}`;
        note.classList.add(`${BASE}-problem`);
        update();
        return;
      }
      dialog.close();
    };
    const dialog = this.dialogs.open({
      title: "Silverware Assets",
      subtitle: "How embedded and linked files are shown",
      className: "swa-settings-window",
      bar,
      content,
      footer,
      dismiss: async () => !saving && (!changed() || (await store.confirm("Close the settings without saving your changes?"))),
    });
    select(list[0]?.id ?? "");
    update();
  }
}
