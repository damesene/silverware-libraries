// Files being uploaded, told in a panel at the window's bottom right (docs/silverware-assets-insert.md *Files being
// uploaded*): a row each, its name, its state (waiting, uploading, uploaded, not uploaded) and a bar; above them how
// many are done. SilverBullet tells no bytes written: a file's state alone. Taken away a moment after the last is done.
// Uploads at once each a panel of its own, one above another in one column (taken away with the last). The line of how
// many are done is what a screen reader is told, not each row anew.
import { el } from "../../../shared/elements.ts";

/** A file being uploaded: its name, its type's icon */
export type UploadEntry = { readonly name: string; readonly icon: string };

export type UploadState = "waiting" | "uploading" | "done" | "failed";

export type UploadProgress = {
  /** A file's state (its index among the entries) */
  state(index: number, state: UploadState): void;
  /** All done: taken away a moment later (longer where one failed, to be read) */
  finish(): void;
  /** Taken away now */
  remove(): void;
  readonly element: HTMLElement;
};

const BASE = "swa-upload-progress";
const STACK = `${BASE}-stack`;
const STATE_TEXT: Readonly<Record<UploadState, string>> = { waiting: "Waiting", uploading: "Uploading…", done: "Uploaded", failed: "Not uploaded" };
// How long it stays once all are done (ms): all uploaded, one failed; how long it fades out
export const SHOWN_AFTER = { done: 1500, failed: 5000 } as const;
const FADE_MS = 200;

/** The panel of `entries` shown */
export function showUploadProgress(doc: Document, entries: readonly UploadEntry[]): UploadProgress {
  const win = doc.defaultView!;
  const states: UploadState[] = entries.map(() => "waiting");
  const head = el(doc, "div", { class: `${BASE}-head`, attrs: { role: "status", "aria-live": "polite" } });
  const rows = entries.map((entry) => {
    const status = el(doc, "span", `${BASE}-status`);
    const row = el(
      doc,
      "div",
      `${BASE}-row`,
      el(doc, "span", { class: `${BASE}-icon`, html: entry.icon }),
      el(doc, "span", { class: `${BASE}-name`, text: entry.name }),
      status,
      el(doc, "div", `${BASE}-bar`, el(doc, "div", `${BASE}-bar-fill`)),
    );
    return { row, status };
  });
  const element = el(doc, "div", { class: BASE, attrs: { role: "group", "aria-label": "Files being uploaded" } }, head, el(doc, "div", `${BASE}-rows`, ...rows.map((one) => one.row)));
  // (The column of panels: made by the first, taken away with the last)
  let stack = doc.body.querySelector<HTMLElement>(`:scope > .${STACK}`);
  if (!stack) {
    stack = el(doc, "div", STACK);
    doc.body.append(stack);
  }
  stack.append(element);
  let gone = false;

  /** A row shown in its state (only the one changed: a row's text is not told anew) */
  const showRow = (index: number) => {
    rows[index]!.row.setAttribute("data-swa-upload", states[index]!);
    rows[index]!.status.textContent = STATE_TEXT[states[index]!];
  };
  const tell = () => {
    const done = states.filter((state) => state === "done" || state === "failed").length;
    const failed = states.filter((state) => state === "failed").length;
    const uploading = states.indexOf("uploading");
    head.textContent =
      done === entries.length
        ? failed
          ? `${entries.length - failed} of ${entries.length} uploaded`
          : entries.length === 1
            ? "Uploaded"
            : `All ${entries.length} uploaded`
        : entries.length === 1
          ? "Uploading…"
          : `Uploading ${uploading >= 0 ? uploading + 1 : done + 1} of ${entries.length}…`;
  };

  const remove = () => {
    if (gone) return;
    gone = true;
    const column = element.parentElement;
    element.remove();
    if (column && !column.childElementCount) column.remove();
  };

  states.forEach((_, index) => showRow(index));
  tell();
  return {
    element,
    state(index, state) {
      if (gone || states[index] === undefined) return;
      states[index] = state;
      showRow(index);
      tell();
    },
    finish() {
      win.setTimeout(
        () => {
          element.classList.add(`${BASE}-leaving`);
          win.setTimeout(remove, FADE_MS);
        },
        states.includes("failed") ? SHOWN_AFTER.failed : SHOWN_AFTER.done,
      );
    },
    remove,
  };
}
