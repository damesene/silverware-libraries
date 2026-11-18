// The dialog files are inserted by (docs/silverware-assets-insert.md): a row each, its path (in the page's folder, the
// name offered: SilverBullet's rules, taken apart from the batch's and the space's), how it is inserted (a link, a card,
// a preview, the file in full), the file drawn as it will be; with several, a choice for all of them. Opened empty to
// upload, with Files and (on a touch screen) Camera. An image of the web (copied from a page, dragged from one) may be
// linked at its address instead of kept in the space (its row's *Kept*, linked by default; one too large for the space
// linked alone).
// Nothing is written here: the rows chosen are given back, the host writes them. The host gives what is known of a file's type and draws it (src/decorate.ts' `drawSample`).
import type { Dialogs } from "../../../shared/dialog.ts";
import { COMPANION_ATTRIBUTE } from "../../../shared/editor.ts";
import { el } from "../../../shared/elements.ts";
import { cleanName, extensionOf, type FileSource, nameOf, pathIn, pathsApart, validateFilePath, webNameOf } from "../core/insert.ts";
import type { InsertAs, View } from "../model/settings.ts";

/** A file to insert, where it comes from; its address on the web where the browser gave it (an image of a web page) */
export type InsertFile = { readonly file: File; readonly source: FileSource; readonly url?: string };

/** What the dialog is told of a file's type: its name, its icon, whether it can be drawn in a view, its views as set, whether it is costly to draw */
export type InsertType = {
  readonly name: string;
  readonly icon: string;
  can(view: View): boolean;
  // The view *Show as* gives it (what *As shown* inserts it as, none written)
  readonly configured: View;
  // How the settings say it is inserted
  readonly insertAs: InsertAs;
  readonly costly: boolean;
};

/** A file as it is to be inserted: its path, how; `url`: linked at its address on the web, not kept in the space */
export type InsertChoice = { readonly file: File; readonly path: string; readonly as: Exclude<InsertAs, "shown">; readonly configured: View; readonly url?: string };

export type InsertDialogHost = {
  // The folder of the page it goes into (from the space's top)
  readonly folder: string;
  // The largest file the space takes (bytes)
  readonly maxBytes: number;
  // The time names of the clipboard and the camera are made of
  now(): Date;
  // The paths of the space's files, case alike (lower case): a name taken asked of
  existing(): Promise<ReadonlySet<string>>;
  typeOf(file: File, path: string): InsertType;
  // The file drawn as it will be (a view of its type, read-only), into `container`, until `signal` ends
  drawSample(container: HTMLElement, file: File, path: string, view: View, signal: AbortSignal): void;
  // Whether this is a touch screen (Camera offered)
  readonly touch: boolean;
  // Opened for a field of another plugin's (a grid's cell): the dialog acts on its editor, the focus going to it is not
  // the field left (shared/editor.ts `COMPANION_ATTRIBUTE`)
  readonly companion?: boolean;
  // Each file's name asked alone, nothing of how it is shown (another plugin's upload: it writes a link of its own,
  // shared/assets.ts `insertFiles`); a file drawn as the first view its type has
  readonly nameOnly?: boolean;
};

// What each choice is called
const AS_NAMES: Readonly<Record<Exclude<InsertAs, "shown">, string>> = { link: "Link", card: "Card", preview: "Preview", full: "Full" };
const CHOICES: readonly Exclude<InsertAs, "shown">[] = ["link", "card", "preview", "full"];
// A file of a costly type larger than this is drawn on a click alone (bytes)
export const COSTLY_BYTES = 20 * 1024 * 1024;
const BASE = "swa-insert";

/** A row of choices, one checked: a radio group whose arrows move the choice (`chosen` told) */
function choiceRow(doc: Document, label: string, options: readonly { readonly value: string; readonly text: string; readonly disabled?: string }[], value: string, chosen: (value: string) => void): { readonly element: HTMLElement; set(value: string): void } {
  const buttons = options.map((option) =>
    el(doc, "button", {
      class: `${BASE}-choice`,
      text: option.text,
      attrs: { type: "button", role: "radio", "data-value": option.value, ...(option.disabled ? { "aria-disabled": "true", title: option.disabled } : {}) },
    }),
  );
  const set = (to: string) => {
    for (const button of buttons) {
      const on = button.dataset.value === to;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    }
    // (None chosen: the first reached by Tab)
    if (!buttons.some((button) => button.dataset.value === to) && buttons[0]) buttons[0].tabIndex = 0;
  };
  const choose = (button: HTMLButtonElement) => {
    if (button.getAttribute("aria-disabled") === "true") return;
    set(button.dataset.value!);
    chosen(button.dataset.value!);
  };
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => choose(button));
    button.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      for (let n = 1; n <= buttons.length; n++) {
        const next = buttons[(index + step * n + buttons.length * n) % buttons.length]!;
        if (next.getAttribute("aria-disabled") === "true") continue;
        next.focus();
        choose(next);
        break;
      }
    });
  });
  set(value);
  return { element: el(doc, "div", { class: `${BASE}-choices`, attrs: { role: "radiogroup", "aria-label": label } }, ...buttons), set };
}

/** A row's state */
type Row = {
  readonly file: File;
  readonly type: InsertType;
  // Its path as typed or offered
  wanted: string;
  as: Exclude<InsertAs, "shown">;
  // A path taken in the space: replaced, or its name made another (`-N`)
  replace: boolean;
  // Its address on the web, where it has one, and whether it is linked there (not kept in the space)
  readonly url?: string;
  web: boolean;
  readonly element: HTMLElement;
  readonly field: HTMLInputElement;
  readonly address: HTMLElement;
  readonly note: HTMLElement;
  readonly sample: HTMLElement;
  readonly choices: { set(value: string): void };
  readonly tooLarge: boolean;
  drawing?: AbortController;
  // Drawn again a moment after the name is typed
  typing?: ReturnType<typeof setTimeout>;
};

/** How a file of a type is first inserted: as the settings say, *As shown* the view configured (one it cannot draw: the next it can) */
function firstChoice(type: InsertType): Exclude<InsertAs, "shown"> {
  const wanted: Exclude<InsertAs, "shown"> = type.insertAs === "shown" ? type.configured : type.insertAs;
  if (wanted === "link" || type.can(wanted)) return wanted;
  return (["full", "preview", "card"] as const).find((view) => type.can(view)) ?? "card";
}

/** How a file is drawn where nothing is asked of how it is shown (`nameOnly`): the first view its type can be drawn in */
const sampleView = (type: InsertType): View => (["preview", "full", "card"] as const).find((view) => type.can(view)) ?? "card";

/**
 * The dialog opened over the page: `files` its rows (none: an upload, picked in it); `done` given the files as chosen
 * as Insert is pressed (none: cancelled). `pick` opens the browser's picker (several files; `camera`: a photo taken)
 */
export function openInsertDialog(
  doc: Document,
  dialogs: Dialogs,
  files: readonly InsertFile[],
  host: InsertDialogHost,
  done: (choices: readonly InsertChoice[] | undefined) => void,
): void {
  const rows: Row[] = [];
  let existing: ReadonlySet<string> = new Set();
  // The names taken in the space not known yet (Insert off meanwhile: a file of a name taken would be replaced unasked),
  // or not to be known (said)
  let looking = true;
  let unknown = false;
  let finished = false;
  const list = el(doc, "div", `${BASE}-rows`);
  const allBox = el(doc, "div", `${BASE}-all`);
  const insert = el(doc, "button", { class: "swa-dialog-save", text: "Insert", attrs: { type: "button" }, run: () => finish(true) });
  const note = el(doc, "div", { class: "swa-dialog-note", attrs: { role: "status", "aria-live": "polite" } });

  /** Whether a row is left out: too large for the space, not linked on the web */
  const leftOut = (row: Row) => row.tooLarge && !row.web;

  /** Each row's path now: cleaned where typed so, taken apart from the batch's, and from the space's where kept both (a row linked on the web: none of the space's) */
  const paths = (): string[] =>
    pathsApart(
      rows.map((row, index) => (row.web ? `\u0000web-${index}` : row.wanted)),
      (path) => existing.has(path.toLowerCase()),
      (index) => !rows[index]!.replace,
    );

  /** Each row's note and the Insert button as the paths are now (the focus kept on the note's control it was on) */
  const update = () => {
    const focused = doc.activeElement instanceof HTMLElement && doc.activeElement.closest(`.${BASE}-row-note`) ? doc.activeElement : undefined;
    const focusedRow = focused ? rows.findIndex((row) => row.note.contains(focused)) : -1;
    const focusedValue = focused?.dataset.value ?? (focused?.classList.contains(`${BASE}-fix`) ? "fix" : undefined);
    const now = paths();
    let ready = 0;
    const limit = `${Math.floor(host.maxBytes / 1024 / 1024)} MiB`;
    rows.forEach((row, index) => {
      row.field.hidden = row.web;
      row.address.hidden = !row.web;
      if (row.web) {
        row.note.replaceChildren(row.tooLarge ? `Too large for the space (it takes files up to ${limit}): linked at its address on the web.` : "Not kept in the space: linked at its address on the web, shown while the site keeps it there.");
        row.element.removeAttribute("data-swa-problem");
        row.field.setAttribute("aria-invalid", "false");
        ready++;
        return;
      }
      const path = now[index]!;
      const problem = row.tooLarge ? `Too large: the space takes files up to ${limit}. Left out.` : validateFilePath(row.wanted);
      const taken = !row.tooLarge && !problem && existing.has(row.wanted.toLowerCase());
      row.note.replaceChildren();
      row.element.toggleAttribute("data-swa-problem", !!problem);
      if (problem && !row.tooLarge) {
        const ext = /\.([a-z0-9]+)$/i.exec(row.file.name)?.[1] ?? extensionOf(row.file.type);
        const fixed = cleanName(row.wanted.slice(row.wanted.lastIndexOf("/") + 1), ext);
        // (Its folders made what SilverBullet takes too: what it refuses taken out, an empty one left out)
        const folder = (row.wanted.includes("/") ? row.wanted.slice(0, row.wanted.lastIndexOf("/")) : "")
          .split("/")
          .map((part) => part.replace(/[@#|<>$[\]\u0000-\u001f]/g, "").replace(/^[.^\s]+/, "").trim())
          .filter((part) => part && part !== "..")
          .join("/");
        row.note.append(
          `Not taken by SilverBullet: ${problem}. `,
          el(doc, "button", {
            class: `${BASE}-fix`,
            text: `Use “${fixed}”`,
            attrs: { type: "button" },
            run: () => {
              row.wanted = pathIn(folder, fixed);
              row.field.value = row.wanted;
              update();
            },
          }),
        );
      } else if (problem) row.note.append(problem);
      else if (taken) {
        const keep = choiceRow(doc, "A file of this name is in the space", [
          { value: "keep", text: "Keep both" },
          { value: "replace", text: "Replace it" },
        ], row.replace ? "replace" : "keep", (value) => {
          row.replace = value === "replace";
          update();
        });
        row.note.append(el(doc, "span", { text: row.replace && path === row.wanted ? "A file of this name is in the space: replaced. " : `A file of this name is in the space: inserted as “${path}”. ` }), keep.element);
      } else if (path !== row.wanted) row.note.append(`Another file of this batch has this name: inserted as “${path}”.`);
      if (!problem && !row.tooLarge) ready++;
      row.field.setAttribute("aria-invalid", String(!!problem && !row.tooLarge));
    });
    insert.disabled = looking || !ready || rows.some((row) => !row.web && !row.tooLarge && !!validateFilePath(row.wanted));
    note.textContent = looking && rows.length ? "Looking for files of these names in the space…" : unknown ? "The space's files could not be listed: a file of a name taken is replaced." : "";
    allBox.hidden = !!host.nameOnly || rows.filter((row) => !leftOut(row)).length < 2;
    for (const row of rows) row.element.toggleAttribute("data-swa-left-out", leftOut(row));
    syncAll();
    empty.hidden = rows.length > 0;
    // (The note drawn anew: its control the focus was on focused again)
    if (focusedRow >= 0 && focusedValue) {
      const again = focusedValue === "fix" ? rows[focusedRow]?.note.querySelector<HTMLElement>(`.${BASE}-fix`) : rows[focusedRow]?.note.querySelector<HTMLElement>(`[data-value="${focusedValue}"]`);
      again?.focus();
    }
  };

  /** A row's file drawn as it will be: its view (a link: its name and its type's icon); a costly type's large file on a click */
  const draw = (row: Row) => {
    if (finished) return;
    row.drawing?.abort();
    const control = new AbortController();
    row.drawing = control;
    row.sample.replaceChildren();
    const path = row.web && row.url ? webNameOf(row.url) : (paths()[rows.indexOf(row)] ?? row.wanted);
    if (row.as === "link") {
      const link = el(doc, "span", `${BASE}-link`, el(doc, "span", { class: `${BASE}-link-icon`, html: row.type.icon }), path);
      row.sample.append(link);
      return;
    }
    if (row.type.costly && row.as !== "card" && row.file.size > COSTLY_BYTES) {
      row.sample.append(
        el(doc, "div", `${BASE}-held`, `A large ${row.type.name} file: drawn here on a click. It is inserted as chosen either way. `, el(doc, "button", { text: "Show here", attrs: { type: "button" }, run: () => host.drawSample(row.sample, row.file, path, row.as as View, control.signal) })),
      );
      return;
    }
    host.drawSample(row.sample, row.file, path, row.as, control.signal);
  };

  /** A row of a file */
  const addRow = (one: InsertFile) => {
    if (finished) return;
    const offered = nameOf(one.file, one.source, host.now());
    const ext = /\.([a-z0-9]+)$/i.exec(offered)?.[1] ?? extensionOf(one.file.type);
    // (A name SilverBullet would refuse offered cleaned at once)
    const name = validateFilePath(offered) ? cleanName(offered, ext) : offered;
    const wanted = pathIn(host.folder, name);
    const type = host.typeOf(one.file, wanted);
    const index = rows.length;
    const field = el(doc, "input", { class: `${BASE}-path`, attrs: { type: "text", spellcheck: "false", "aria-label": `File ${index + 1}: its name in the space` } });
    field.value = wanted;
    const noteId = `${BASE}-note-${Math.random().toString(36).slice(2)}`;
    const rowNote = el(doc, "div", { class: `${BASE}-row-note`, attrs: { id: noteId, role: "status", "aria-live": "polite" } });
    field.setAttribute("aria-describedby", noteId);
    const sample = el(doc, "div", `${BASE}-sample`);
    const as = host.nameOnly ? sampleView(type) : firstChoice(type);
    const row: Row = {
      file: one.file,
      type,
      wanted,
      as,
      replace: false,
      ...(one.url ? { url: one.url } : {}),
      // (Linked where it can be, the user's choice 2026-11-15: kept in the space where asked)
      web: !!one.url,
      field,
      address: el(doc, "span", { class: `${BASE}-address`, text: one.url ?? "", attrs: { title: one.url ?? "" } }),
      note: rowNote,
      sample,
      tooLarge: one.file.size > host.maxBytes,
      element: el(doc, "div", `${BASE}-row`),
      choices: { set: () => undefined },
    };
    const choices = choiceRow(
      doc,
      `File ${index + 1}: inserted as`,
      CHOICES.map((value) => ({ value, text: AS_NAMES[value], ...(value === "link" || type.can(value) ? {} : { disabled: "This file cannot be shown so" }) })),
      as,
      (value) => {
        row.as = value as Exclude<InsertAs, "shown">;
        syncAll();
        draw(row);
      },
    );
    (row as { choices: { set(value: string): void } }).choices = choices;
    field.addEventListener("input", () => {
      row.wanted = field.value.trim();
      update();
      clearTimeout(row.typing);
      row.typing = setTimeout(() => draw(row), 300);
    });
    // Where it is kept: in the space, or linked at its address on the web (an image of a web page alone)
    const kept = one.url
      ? choiceRow(
          doc,
          `File ${index + 1}: kept`,
          [
            { value: "space", text: "In the space", ...(row.tooLarge ? { disabled: `Too large for the space` } : {}) },
            { value: "web", text: "Linked from the web" },
          ],
          row.web ? "web" : "space",
          (value) => {
            row.web = value === "web";
            choices.element.hidden = !!host.nameOnly || leftOut(row);
            update();
            draw(row);
          },
        ).element
      : undefined;
    choices.element.hidden = !!host.nameOnly || leftOut(row);
    row.element.append(
      el(doc, "div", `${BASE}-row-head`, el(doc, "span", { class: `${BASE}-icon`, html: type.icon }), field, row.address),
      ...(kept ? [el(doc, "div", `${BASE}-kept`, el(doc, "span", `${BASE}-kept-label`, "Kept"), kept)] : []),
      rowNote,
      choices.element,
      sample,
    );
    rows.push(row);
    list.append(row.element);
    if (!leftOut(row)) draw(row);
  };

  /** The choice for all shown as the rows have it: theirs where all have the same, none where they differ */
  const syncAll = () => {
    const shown = rows.filter((row) => !leftOut(row));
    const same = shown.length && shown.every((row) => row.as === shown[0]!.as) ? shown[0]!.as : "";
    all.set(same);
  };

  // For all of them: a choice that sets every row, one set by hand too (a type that cannot be shown so keeps its own)
  const all = choiceRow(doc, "All files: inserted as", CHOICES.map((value) => ({ value, text: AS_NAMES[value] })), "", (value) => {
    for (const row of rows) {
      if (leftOut(row)) continue;
      const as = value as Exclude<InsertAs, "shown">;
      if (as !== "link" && !row.type.can(as)) continue;
      row.as = as;
      row.choices.set(as);
      draw(row);
    }
    syncAll();
  });
  allBox.append(el(doc, "span", `${BASE}-all-label`, "All files"), all.element);

  // Files picked here (an upload): several, or a photo of the camera
  const empty = el(doc, "p", `${BASE}-empty`, "Pick the files to insert.");
  const picker = (camera: boolean) => {
    const input = el(doc, "input", { attrs: { type: "file", ...(camera ? { accept: "image/*", capture: "environment" } : { multiple: "" }) } });
    input.hidden = true;
    input.addEventListener("change", () => {
      for (const file of input.files ?? []) addRow({ file, source: camera ? "camera" : "upload" });
      input.remove();
      update();
    });
    doc.body.append(input);
    input.click();
  };
  const pickers = el(
    doc,
    "div",
    `${BASE}-pickers`,
    el(doc, "button", { text: "Files…", attrs: { type: "button" }, run: () => picker(false) }),
    ...(host.touch ? [el(doc, "button", { text: "Camera…", attrs: { type: "button" }, run: () => picker(true) })] : []),
  );

  const content = el(doc, "div", BASE, allBox, list, empty, ...(files.length ? [] : [pickers]));
  // (Its rows there before it opens: the focus given to the first's name as it opens. For a field of another plugin's
  // the dialog is its companion before the focus comes to it: the field not taken for left as the dialog opens)
  for (const one of files) addRow(one);
  if (host.companion) content.setAttribute(COMPANION_ATTRIBUTE, "");
  const cancel = el(doc, "button", { class: "swa-dialog-cancel", text: "Cancel", attrs: { type: "button" }, run: () => finish(false) });
  const footer = doc.createDocumentFragment();
  footer.append(note, cancel, insert);
  const finish = (inserting: boolean) => {
    if (finished) return;
    if (inserting && insert.disabled) return;
    finished = true;
    const now = paths();
    const chosen = inserting
      ? rows.flatMap((row, index): InsertChoice[] =>
          leftOut(row) ? [] : row.web && row.url ? [{ file: row.file, path: webNameOf(row.url), as: row.as, configured: row.type.configured, url: row.url }] : [{ file: row.file, path: now[index]!, as: row.as, configured: row.type.configured }],
        )
      : undefined;
    for (const row of rows) {
      row.drawing?.abort();
      clearTimeout(row.typing);
    }
    dialog.close();
    done(chosen);
  };
  const dialog = dialogs.open({
    title: files.length === 1 ? "Insert file" : "Insert files",
    subtitle: host.nameOnly ? "Its name in the space" : "Its name in the space, and how it is put in the page",
    className: "swa-insert-window",
    content,
    footer,
    // (The first name to type; a row linked on the web has none shown: its choice of where it is kept, else Insert)
    focus: rows[0] ? (rows.find((row) => !row.web)?.field ?? rows[0].element.querySelector<HTMLElement>('.swa-insert-kept [aria-checked="true"]') ?? insert) : (pickers.querySelector("button") as HTMLElement),
    closed: () => {
      for (const row of rows) {
        row.drawing?.abort();
        clearTimeout(row.typing);
      }
      if (!finished) {
        finished = true;
        done(undefined);
      }
    },
  });
  if (host.companion) dialog.element.setAttribute(COMPANION_ATTRIBUTE, "");
  // Enter inserts, where the focus is on no button nor choice (a field's Enter: the dialog's)
  dialog.element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, [role=radio], textarea")) return;
    event.preventDefault();
    finish(true);
  });
  update();
  // The names taken in the space, asked once: each row's note told again then
  void host
    .existing()
    .then((paths) => {
      existing = paths;
    })
    .catch(() => {
      unknown = true;
    })
    .finally(() => {
      looking = false;
      if (finished) return;
      update();
      // (Drawn again under the names they have now: one of a name taken is `-1`)
      for (const row of rows) if (!leftOut(row)) draw(row);
    });
}
