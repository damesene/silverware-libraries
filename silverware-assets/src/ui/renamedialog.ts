// The Rename dialog of a file's menu (docs/silverware-assets-rename.md): its title on this page (an embed's alt text, a
// link's text) and its file's name in the space, two fields, each its own change; a link fills the name from the title
// for whoever wants both alike. The name's folder and extension are shown, not edited. A file of the web, or one not
// renamed here (in another plugin's field), has a title alone. What is written, and how, is the caller's: the dialog
// gives back what was chosen.
import type { Dialogs } from "../../../shared/dialog.ts";
import { COMPANION_ATTRIBUTE } from "../../../shared/editor.ts";
import { el } from "../../../shared/elements.ts";
import { fileNameOfTitle, pathParts, takenBy, validateFileName, validateTitle } from "../core/rename.ts";

export type RenameInput = {
  // What the title is: an embed's (its alt text, "Title") or a link's (the text it shows, "Text")
  readonly of: "embed" | "link";
  // The title as written now ("": none)
  readonly title: string;
  // What shows where it has none (the file's name)
  readonly untitled: string;
  // The file of the space, renamed where its name is changed; none: a title alone, `why` said in its place
  readonly file?: {
    readonly path: string;
    // The space's files, for a name another has (asked once, as the dialog opens)
    readonly paths: () => Promise<readonly string[]>;
  };
  // Why there is no file's name to change (a file of the web; one in a field being edited)
  readonly why?: string;
  // Opened from another plugin's field: the dialog is that editor's companion (its focus there is not the field's leave)
  readonly companion?: boolean;
};

/** What was chosen: the title, and the file's new path where its name changed */
export type RenameResult = { readonly title: string; readonly path?: string };

// (Each dialog's notes tied to their fields by ids of their own)
let made = 0;

export function openRenameDialog(doc: Document, dialogs: Dialogs, input: RenameInput, done: (result: RenameResult | undefined) => void): void {
  const id = `swa-rename-${++made}`;
  const titleName = input.of === "link" ? "Text" : "Title";
  const titleHint = input.of === "link" ? "What the link shows on this page. Empty: the file's name." : "Shown with the file on this page. Empty: none.";
  const titleNote = el(doc, "p", { class: "swa-rename-note", attrs: { id: `${id}-title`, "aria-live": "polite" } }, titleHint);
  const title = el(doc, "input", { class: "swa-rename-field", attrs: { type: "text", "aria-label": titleName, "aria-describedby": `${id}-title`, placeholder: input.untitled, spellcheck: "false" } });
  title.value = input.title;
  const clear = el(doc, "button", {
    class: "swa-rename-clear",
    text: "×",
    attrs: { type: "button", title: `No ${titleName.toLowerCase()}`, "aria-label": `No ${titleName.toLowerCase()}` },
    run: () => {
      title.value = "";
      title.focus();
      update();
    },
  });

  const parts = input.file ? pathParts(input.file.path) : undefined;
  const nameHint = "Renaming changes the links to it in every page.";
  const nameNote = el(doc, "p", { class: "swa-rename-note", attrs: { id: `${id}-name`, "aria-live": "polite" } }, nameHint);
  const name = el(doc, "input", { class: "swa-rename-field", attrs: { type: "text", "aria-label": "File name", "aria-describedby": `${id}-name`, spellcheck: "false" } });
  if (parts) name.value = parts.name;
  const fromTitle = el(doc, "button", {
    class: "swa-rename-from-title",
    text: `Use the ${titleName.toLowerCase()} as the file name`,
    attrs: { type: "button" },
    run: () => {
      name.value = fileNameOfTitle(title.value) || name.value;
      name.focus();
      update();
    },
  });
  // The space's paths: none yet (asked), or none to be had (the name then checked by SilverBullet alone)
  let paths: readonly string[] | undefined;
  let pathsAsked = !!input.file;

  const save = el(doc, "button", { class: "swa-dialog-save", text: "Save", attrs: { type: "button" }, run: () => finish() });
  const cancel = el(doc, "button", { class: "swa-dialog-cancel", text: "Cancel", attrs: { type: "button" }, run: () => dialog.close() });
  const footer = doc.createDocumentFragment();
  footer.append(cancel, save);

  /** The path the name gives (none: unchanged, or no file to rename) */
  const newPath = () => (parts && name.value !== parts.name ? `${parts.folder}${name.value}${parts.ext}` : undefined);
  /** Why the title, and why the name, cannot be written as they are; whether the space's files are still being read */
  const problems = () => {
    const path = newPath();
    const taken = path && paths ? takenBy(paths, input.file!.path, path) : undefined;
    return {
      title: validateTitle(title.value),
      name: path === undefined ? undefined : (validateFileName(name.value) ?? (taken ? `"${taken}" is another file` : undefined)),
      reading: path !== undefined && pathsAsked,
    };
  };
  const update = () => {
    const { title: titleProblem, name: nameProblem, reading } = problems();
    title.toggleAttribute("aria-invalid", !!titleProblem);
    titleNote.classList.toggle("swa-rename-problem", !!titleProblem);
    titleNote.textContent = titleProblem ? `This ${titleName.toLowerCase()} cannot be written: ${titleProblem}.` : titleHint;
    clear.hidden = !title.value;
    if (parts) {
      name.toggleAttribute("aria-invalid", !!nameProblem);
      nameNote.classList.toggle("swa-rename-problem", !!nameProblem);
      nameNote.textContent = nameProblem ? `Not renamed: ${nameProblem}.` : reading ? "Looking at the space's files…" : nameHint;
      const made = fileNameOfTitle(title.value);
      fromTitle.disabled = !made || made === name.value;
    }
    save.disabled = !!titleProblem || !!nameProblem || reading;
  };
  let finished = false;
  const finish = () => {
    if (save.disabled || finished) return;
    finished = true;
    const path = newPath();
    dialog.close();
    done({ title: title.value.trim(), ...(path ? { path } : {}) });
  };
  for (const field of [title, name]) field.addEventListener("input", update);

  const content = el(
    doc,
    "div",
    "swa-rename",
    el(doc, "span", "swa-rename-label", titleName),
    el(doc, "div", "swa-rename-line", title, clear),
    titleNote,
    el(doc, "span", "swa-rename-label", "File name"),
    ...(parts
      ? [
          el(doc, "div", "swa-rename-line", ...(parts.folder ? [el(doc, "span", { class: "swa-rename-fixed", text: parts.folder, attrs: { title: parts.folder } })] : []), name, ...(parts.ext ? [el(doc, "span", "swa-rename-fixed", parts.ext)] : [])),
          fromTitle,
          nameNote,
        ]
      : [el(doc, "p", "swa-rename-note", input.why ?? "Its name is not changed here.")]),
  );
  // (For a field of another plugin's, its companion before the focus comes to it as it opens: the field not taken for left)
  if (input.companion) content.setAttribute(COMPANION_ATTRIBUTE, "");
  const dialog = dialogs.open({
    title: "Rename",
    subtitle: input.file?.path ?? input.untitled,
    className: "swa-rename-window",
    content,
    footer,
    focus: title,
    closed: () => {
      if (finished) return;
      finished = true;
      done(undefined);
    },
  });
  if (input.companion) dialog.element.setAttribute(COMPANION_ATTRIBUTE, "");
  // Enter saves (not on a button: its own)
  dialog.element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    finish();
  });
  update();
  // The names taken, asked once: told under the field as they come (none to be had: SilverBullet checks the name)
  if (input.file)
    void input.file
      .paths()
      .then((all) => (paths = all))
      .catch(() => undefined)
      .finally(() => {
        pathsAsked = false;
        update();
      });
}
