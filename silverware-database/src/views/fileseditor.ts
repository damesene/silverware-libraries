// A value of files edited (Files & media, docs/silverware-database-files.md): a popup over its cell (in the peek, in its
// row) listing its files, each drawn larger, with a grip to move it (dragged, or Alt+↑ ↓ on it) and × to take it out;
// under them a search of the space's files (its words each in a file's name, a folder before a separator, as references
// are searched: domain/folders.ts) or an address of the web typed, and Upload (the host's dialog: Silverware Assets').
// The list is written as it is (its files as they were written, the new ones as links: no text read by the type, a name
// may hold a comma) once the popup is left or Enter pressed where no control takes it; Esc puts it aside. The upload
// dialog is the popup's companion: going to it does not leave the popup. Files an upload gives once the popup has been
// left are added to the value as it was written then.
import { reorder } from "../../../shared/drag.ts";
import { inCompanion } from "../../../shared/editor.ts";
import { el } from "../../../shared/elements.ts";
import type { Media } from "../core/media.ts";
import { folderSearch, foundBy } from "../domain/folders.ts";
import { type FileEntry, fileLabel, fileName, readFile, validateFileTarget, writeFile } from "../domain/types/files.ts";
import { takeFiles } from "./takefiles.ts";
import type { GivenFiles } from "../core/media.ts";

// A grip: six dots
const GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></svg>';
// Each file's box in the popup (px): its longer side at most 150
const ROW_BOX = { width: 150, height: 150, min: 60 };
// The files a search shows at most: more are found by typing more of a name
const SHOWN_FILES = 50;
// What the space's paths are split into folders by
const SEPARATOR = "/";

/** What the files' editor is given */
export type FilesEditing = {
  readonly label: string;
  /** The database the files are uploaded for (its folder of files) */
  readonly database: string;
  /** The host's files; none: no file drawn, searched nor uploaded (an address typed still added) */
  readonly media: Media | undefined;
  /** The files as the value has them */
  readonly files: readonly FileEntry[];
  /** Esc on a field puts the editing aside */
  readonly escape: (field: HTMLElement) => void;
  /** The files as left, as written (an empty list: none), once the popup is left or Enter pressed */
  readonly done: (written: readonly string[]) => void;
  /** Files an upload gave once the popup had been left: the value as `done` was given it, and with them */
  readonly later: (was: readonly string[], now: readonly string[]) => void;
};

/** The popup in `cell` (laid over it by `float`), the focus in its search */
export function filesEditor(cell: HTMLElement, editing: FilesEditing, float: (panel: HTMLElement) => void): HTMLElement {
  const doc = cell.ownerDocument;
  const { label, media } = editing;
  const files: FileEntry[] = [...editing.files];
  let known: readonly string[] | undefined;
  let finished: readonly string[] | undefined;
  // A file being dragged by its grip: the row moves in the document as it goes, which takes the focus from its grip (not
  // the popup left)
  let dragging = false;
  // The one file's menu open (one at a time): closed, the focus back on its ⋯
  let menuOpen: { readonly items: HTMLElement; readonly more: HTMLElement } | undefined;
  const closeMenu = (focus: boolean) => {
    const open = menuOpen;
    if (!open) return;
    menuOpen = undefined;
    open.items.hidden = true;
    if (focus && open.more.isConnected) open.more.focus({ preventScroll: true });
  };
  const list = el(doc, "div", { class: "swd-files-list", attrs: { role: "list", "aria-label": label } });
  const search = el(doc, "input", { class: "swd-editor-search", attrs: { type: "text", placeholder: media ? "Find a file, or type an address…" : "Type an address (https://…)", "aria-label": `Add to ${label}` } });
  const found = el(doc, "div", { class: "swd-editor-list swd-files-found", attrs: { role: "group", "aria-label": "Files found" } });
  const note = el(doc, "div", { class: "swd-editor-note", attrs: { role: "status" } });
  // Files added through the host's dialog (Silverware Assets': the device's, a link, the space's), one button; without it
  // the field alone (a file of the space, an address)
  const upload = el(doc, "button", { class: "swd-files-upload", text: "+ Add files…", attrs: { type: "button" } });
  // (The field and Upload side by side, those found and what is said under them)
  const panel = el(doc, "div", { class: "swd-editor swd-editor-choices swd-editor-files", attrs: { tabindex: "-1" } }, list, ...(media?.upload ? [upload] : [search, found]), note);
  const written = () => files.map((one) => one.written);
  const finish = () => {
    if (finished) return;
    finished = written();
    doc.removeEventListener("pointerdown", pressed, true);
    editing.done(finished);
  };
  const say = (text: string) => {
    note.textContent = text;
    note.hidden = text === "";
  };
  // A file added (once: one there already is not), the focus kept where it was
  const add = (target: string, title?: string): boolean => {
    const problem = validateFileTarget(target);
    if (problem) return say(problem), false;
    const entry = readFile(writeFile(target, title));
    if (!entry) return false;
    if (files.some((one) => one.target === entry.target)) return say(`${fileLabel(entry)} is there already`), false;
    files.push(entry);
    say("");
    return true;
  };
  // A file moved by `by` places (none past the ends), its grip focused again
  const move = (at: number, by: number) => {
    const to = Math.max(0, Math.min(files.length - 1, at + by));
    if (to === at) return;
    const [entry] = files.splice(at, 1);
    files.splice(to, 0, entry!);
    drawList();
    list.querySelectorAll<HTMLElement>(".swd-files-grip")[to]?.focus({ preventScroll: true });
  };
  const drawList = () => {
    list.replaceChildren(
      ...files.map((file, at) => {
        const name = fileLabel(file);
        const grip = el(doc, "button", { class: "swd-files-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { type: "button", "aria-label": `Move ${name} (Alt+↑ ↓)` } });
        // Its menu: the file opened in a tab, downloaded, or taken out of the value (the file stays in the space)
        const url = media?.url(file.target);
        const remove = el(doc, "button", { class: "swd-files-remove", text: "Remove", attrs: { type: "button", "aria-label": `Take ${name} out` } });
        const items = el(
          doc,
          "div",
          { class: "swd-files-menu", attrs: { role: "menu", hidden: "" } },
          ...(url
            ? [
                el(doc, "button", { text: "View original", attrs: { type: "button", role: "menuitem" }, run: () => void doc.defaultView?.open(url, "_blank", "noopener") }),
                el(doc, "a", { text: "Download", attrs: { href: url, download: fileName(file), role: "menuitem" } }),
              ]
            : []),
          remove,
        );
        const more = el(doc, "button", { class: "swd-files-more", text: "⋯", title: `${name}: its menu`, attrs: { type: "button", "aria-label": `${name}: its menu`, "aria-haspopup": "menu" } });
        // (Pressed again: closed, the focus kept on it, not lost with the menu hidden, which left the popup)
        more.addEventListener("click", () => {
          const was = menuOpen?.items === items;
          closeMenu(was);
          if (was) return;
          items.hidden = false;
          placeMenu(items, more);
          menuOpen = { items, more };
          items.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
        });
        // (An item chosen: the menu closed)
        items.addEventListener("click", () => closeMenu(false));
        // (Its ⋯ beside the file, its menu opening under it)
        const row = el(doc, "div", { class: "swd-files-row", attrs: { role: "listitem", title: name } }, grip, media ? media.draw(file.target, ROW_BOX) : el(doc, "span", { class: "swd-files-name", text: name }), el(doc, "span", "swd-files-menu-box", more, items));
        remove.addEventListener("click", () => {
          files.splice(at, 1);
          drawList();
          drawFound();
          // (The focus on the row that took its place, else the search)
          (list.querySelectorAll<HTMLElement>(".swd-files-more")[Math.min(at, files.length - 1)] ?? (media?.upload ? upload : search)).focus({ preventScroll: true });
        });
        grip.addEventListener("keydown", (event) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
          event.preventDefault();
          event.stopPropagation();
          move(at, event.key === "ArrowUp" ? -1 : 1);
        });
        grip.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          grip.focus({ preventScroll: true });
          dragging = true;
          reorder(event, {
            element: row,
            base: "swd-props",
            flow: "block",
            containers: () => [list],
            items: (container) => [...container.querySelectorAll<HTMLElement>(":scope > .swd-files-row")],
            done: (to) => {
              dragging = false;
              if (to) return move(at, to.index - at);
              drawList();
              list.querySelectorAll<HTMLElement>(".swd-files-grip")[at]?.focus({ preventScroll: true });
            },
          });
        });
        return row;
      }),
    );
  };
  // What the search offers: a file named whole (an address of the web, a wiki link typed or pasted), else the space's
  // files its words find (not those added)
  const offered = (): readonly string[] => {
    const typed = search.value.trim();
    const named = readFile(typed);
    if (named) return files.some((one) => one.target === named.target) ? [] : [named.target];
    if (!known || !typed) return [];
    const read = folderSearch(typed, SEPARATOR);
    return known.filter((path) => !files.some((one) => one.target === path) && foundBy(path, read)).slice(0, SHOWN_FILES);
  };
  const drawFound = () => {
    found.replaceChildren(
      ...offered().map((target) => {
        const web = !!readFile(target)?.web;
        const name = fileLabel({ target, web });
        const folder = web ? undefined : target.slice(0, Math.max(0, target.lastIndexOf(SEPARATOR)));
        return el(
          doc,
          "button",
          {
            class: "swd-files-found-item",
            title: target,
            attrs: { type: "button", "aria-label": `Add ${web ? target : name}` },
            run: () => {
              if (!add(target)) return;
              search.value = "";
              drawList();
              drawFound();
              search.focus({ preventScroll: true });
            },
          },
          // (An address: said so, itself quieter under it, cut where long; a file of the space its name, its folder under it)
          el(doc, "span", { class: "swd-editor-document-name", text: web ? "Add from the web" : known?.includes(target) ? name : `Add ${name}` }),
          ...(web ? [el(doc, "span", { class: "swd-editor-document-folder", text: target })] : folder ? [el(doc, "span", { class: "swd-editor-document-folder", text: folder })] : []),
        );
      }),
    );
    found.hidden = found.childElementCount === 0;
  };
  search.addEventListener("input", () => {
    say("");
    drawFound();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // (Nothing typed: saved, as Enter elsewhere; else the first found added)
    if (!search.value.trim()) return finish();
    const first = offered()[0];
    if (first === undefined) return say(readFile(search.value.trim()) ? "" : media ? "No file of the space has that name: type an address with its https://, or a link ([[folder/name.png]])" : "Type an address with its https://, or a link ([[folder/name.png]])");
    if (!add(first)) return;
    search.value = "";
    drawList();
    drawFound();
  });
  // Files uploaded (those dropped or pasted on it, or picked in the host's dialog: none given), added once written
  const uploadGiven = (given?: GivenFiles) => {
    const uploading = media?.upload?.(editing.database, given);
    if (!uploading) return say("Uploading files needs Silverware Assets");
    void uploading.then((targets) => {
      if (!targets?.length) {
        if (!finished) upload.focus({ preventScroll: true });
        return;
      }
      // (Left meanwhile: added to the value as it was written as the popup was left)
      if (finished) {
        const was = finished;
        const had = was.map((one) => readFile(one)?.target);
        const now = [...was, ...targets.filter((one) => !had.includes(one.target)).map((one) => writeFile(one.target, one.title))];
        if (now.length !== was.length) editing.later(was, now);
        return;
      }
      for (const one of targets) add(one.target, one.title);
      drawList();
      drawFound();
      upload.focus({ preventScroll: true });
    });
  };
  upload.addEventListener("click", () => uploadGiven());
  // (A link pasted on it, the field gone: the dialog with it)
  panel.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text/plain").trim() ?? "";
    if (!media?.upload || event.clipboardData?.files.length || !/^https?:\/\/\S+$/i.test(text)) return;
    event.preventDefault();
    uploadGiven({ files: [], uriList: text, source: "clipboard" });
  });
  takeFiles(panel, (given) => uploadGiven(given), { paste: true });
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target === search || (event.target as Element).closest("button, a")) return;
    event.preventDefault();
    finish();
  });
  // (A press on its buttons keeps the focus where it is: a button pressed on its icon takes none in some browsers, which
  // left the popup with the focus nowhere; each button's own action gives the focus where it goes)
  panel.addEventListener("mousedown", (event) => {
    if ((event.target as Element).closest("button")) event.preventDefault();
  });
  // Left: saved, unless the focus went to its companion (the upload dialog). Looked at once the focus has settled, a task
  // later (a microtask runs between the focus leaving and coming to what was pressed): a control drawn anew (×, a grip, a
  // file found) loses the focus as it goes, then the list gives it to another of its controls
  panel.addEventListener("focusout", () => {
    setTimeout(() => {
      const now = doc.activeElement;
      if (!finished && !dragging && !panel.contains(now) && !inCompanion(now)) finish();
    });
  });
  // A press beside it where the focus is not in it (gone with the upload dialog): saved too
  const pressed = (event: PointerEvent) => {
    if (finished || !panel.isConnected) return doc.removeEventListener("pointerdown", pressed, true);
    if (!panel.contains(event.target as Node) && !inCompanion(event.target) && !panel.contains(doc.activeElement)) finish();
  };
  doc.addEventListener("pointerdown", pressed, true);
  // (The list scrolled: its file's menu kept by its ⋯)
  list.addEventListener("scroll", () => menuOpen && placeMenu(menuOpen.items, menuOpen.more), { passive: true });
  // A file's menu closed by a press elsewhere in the popup, and by Esc alone (the popup kept)
  panel.addEventListener("pointerdown", (event) => {
    if (menuOpen && !(event.target as Element).closest(".swd-files-menu-box")) closeMenu(false);
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu(true);
      return;
    }
    // (Put aside: an upload that comes after adds to the value as it was, not to what was put aside)
    if (event.key === "Escape") {
      finished ??= editing.files.map((one) => one.written);
      doc.removeEventListener("pointerdown", pressed, true);
    }
  }, true);
  editing.escape(panel);
  drawList();
  drawFound();
  say("");
  cell.replaceChildren(panel);
  float(panel);
  (media?.upload ? upload : search).focus({ preventScroll: true });
  panel.scrollIntoView?.({ block: "nearest" });
  // (The space's files as they come, where the field searches them (no dialog to add through): what was typed meanwhile
  // searched among them)
  if (!media?.upload) void media?.files().then((paths) => {
    known = paths;
    if (!finished) drawFound();
  });
  return panel;
}

// How far a file's menu stays from the window's edges (px)
const EDGE = 8;

/**
 * A file's menu placed by its ⋯ over everything (the list scrolls and cuts what is in it): under it from its left edge,
 * from its right edge where it would go past the window's, over it where there is no room under it
 */
function placeMenu(items: HTMLElement, more: HTMLElement): void {
  const view = items.ownerDocument.defaultView;
  if (!view) return;
  const at = more.getBoundingClientRect();
  items.style.position = "fixed";
  const { width, height } = items.getBoundingClientRect();
  let left = at.left;
  if (left + width > view.innerWidth - EDGE) left = at.right - width;
  left = Math.max(EDGE, Math.min(left, view.innerWidth - width - EDGE));
  const top = at.bottom + 2 + height > view.innerHeight - EDGE && at.top - 2 - height >= EDGE ? at.top - 2 - height : at.bottom + 2;
  items.style.left = `${Math.round(left)}px`;
  items.style.top = `${Math.round(top)}px`;
  items.style.right = "auto";
}
