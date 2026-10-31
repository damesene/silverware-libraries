// Work over many pages shown while it runs (pages read for a preview, pages
// undone): a small dialog counting them, shown only once the work takes a
// moment (a few pages are done before it would show).
import { openDialog } from "./dialog.ts";
import { el } from "./elements.ts";

// How long work runs before it is shown
const SHOWN_AFTER_MS = 300;

export type Progress = {
  update(done: number, of: number): void;
  close(): void;
};

export function showProgress(doc: Document, title: string, what: string): Progress {
  const line = el(doc, "p", { class: "swg-note", attrs: { "aria-live": "polite" } });
  const bar = el(doc, "progress", { class: "swg-progress" });
  let dialog: ReturnType<typeof openDialog> | undefined;
  let closed = false;
  const timer = setTimeout(() => {
    if (closed) return;
    // (Not closed by Esc: the work goes on whatever the dialog does)
    dialog = openDialog(doc, { title, className: "swg-small swg-progress-dialog", content: el(doc, "div", "swg-form", line, bar), dismiss: () => false });
  }, SHOWN_AFTER_MS);
  return {
    update: (done, of) => {
      line.textContent = `${what} ${done} of ${of}…`;
      bar.max = of;
      bar.value = done;
    },
    close: () => {
      closed = true;
      clearTimeout(timer);
      dialog?.close();
    },
  };
}
