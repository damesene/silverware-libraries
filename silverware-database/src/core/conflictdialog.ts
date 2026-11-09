// The dialog of a write left as what it rests on changed since a view showed
// it (core.ts `onItems`, `ItemConflict`), opened from its notification's
// Show conflict: what changed (each item's field as the view showed it, as it
// is now, as the write would make it), the lines the write would change on
// each document (shared/diffview.ts, as Silverware Tags' review shows them),
// and Write mine: the write on the items as the dialog shows them, refused
// anew, its own conflict, where they changed again since. Keep theirs closes
// it, nothing written. The shared dialog in the settings' look (`swd-settings`),
// a class of its own (`swd-conflict`).
import { Dialogs } from "../../../shared/dialog.ts";
import { diffRuns } from "../../../shared/diffview.ts";
import { el } from "../../../shared/elements.ts";
import { buttons } from "./dialogparts.ts";
import type { ItemConflict, Result } from "./core.ts";
import { ICONS } from "./icons.ts";

const BASE = "swd-settings";

// The conflicts whose dialog is open: Show conflict pressed again (its notification stays) opens no second one
const open = new WeakSet<ItemConflict>();

export type ConflictHost = {
  readonly document: Document;
  /** A document opened in the editor (an item's page), where the platform opens one */
  open?(document: string): void;
  /** Told once the write is done (written or not): the places shown follow it */
  written?(): void;
};

/** A conflict shown: what changed, the lines the write would change, Write mine and Keep theirs */
export function openConflict(host: ConflictHost, conflict: ItemConflict): void {
  if (open.has(conflict)) return;
  open.add(conflict);
  const doc = host.document;
  const dialogs = new Dialogs(doc, { base: BASE, closeIcon: ICONS.close });
  let writing = false;
  const lines = el(
    doc,
    "table",
    "swd-conflict-lines",
    el(doc, "thead", {}, el(doc, "tr", {}, ...["Item", "Field", "As you saw it", "Now", "Yours"].map((text) => el(doc, "th", { text, attrs: { scope: "col" } })))),
    el(
      doc,
      "tbody",
      {},
      ...conflict.lines.map((line) =>
        el(
          doc,
          "tr",
          {},
          el(doc, "td", { text: line.name }),
          el(doc, "td", { text: line.field }),
          el(doc, "td", { class: "swd-conflict-shown", text: line.shown }),
          el(doc, "td", { class: "swd-conflict-now", text: line.now }),
          el(doc, "td", { class: "swd-conflict-wanted", text: line.wanted }),
        ),
      ),
    ),
  );
  const diffs = el(doc, "div", { class: "swd-conflict-diffs", attrs: { "aria-live": "polite" } }, el(doc, "p", { class: "swd-conflict-note", text: "Reading what writing yours would change…" }));
  const write = el(doc, "button", { class: `${BASE}-save swd-conflict-force`, text: "Write mine", run: () => void force() });
  const keep = el(doc, "button", { class: `${BASE}-cancel`, text: "Keep theirs", run: () => dialog.close() });
  // (Written over already, by this dialog before: nothing more to do but close it)
  const done = conflict.written();
  if (done) {
    write.hidden = true;
    keep.textContent = "Close";
  }
  // A failed write's note: one, the last
  const failed = el(doc, "p", { class: "swd-conflict-note swd-conflict-failed", attrs: { hidden: "" } });
  const dialog = dialogs.open({
    title: "Changed since it was shown",
    subtitle: conflict.problem,
    className: "swd-conflict",
    content: el(doc, "div", "swd-conflict-body", failed, lines, el(doc, "h3", { class: "swd-conflict-section", text: done ? "Yours was written" : "What writing yours changes" }), diffs),
    // (Its buttons alone: the dialog puts them in its foot)
    footer: buttons(doc, keep, write),
    focus: keep,
    dismiss: () => !writing,
    closed: () => open.delete(conflict),
  });

  // The write planned on the items as they are now: each document's lines, nothing written
  void (async () => {
    if (done) return void diffs.replaceChildren(el(doc, "p", { class: "swd-conflict-note", text: "Yours was written over it already." }));
    try {
      const { documents: planned, problem } = await conflict.preview();
      const documents = planned.filter((one) => one.runs.length);
      // (Why there is nothing to show: the write refused as it is now, changed again; else kept where no page shows it)
      const none = problem ?? "No lines to show: what it writes is kept where no page shows it.";
      diffs.replaceChildren(
        ...(documents.length
          ? documents.map((one) =>
              el(
                doc,
                "details",
                { class: "swd-conflict-document", attrs: { open: "" } },
                el(
                  doc,
                  "summary",
                  "swd-conflict-summary",
                  el(doc, "span", { class: "swd-conflict-name", text: one.document || "(no page)" }),
                  ...(one.document && host.open ? [el(doc, "button", { class: "swd-conflict-open", text: "Open", title: `Open ${one.document}`, run: () => host.open!(one.document) })] : []),
                ),
                el(doc, "div", "swd-diff", ...diffRuns(doc, "swd", one.runs)),
              ),
            )
          : [el(doc, "p", { class: "swd-conflict-note", text: none })]),
      );
    } catch (error) {
      diffs.replaceChildren(el(doc, "p", { class: "swd-conflict-note", text: `Not read: ${error instanceof Error ? error.message : String(error)}` }));
    }
  })();

  async function force(): Promise<void> {
    if (writing) return;
    writing = true;
    write.disabled = keep.disabled = true;
    // Not written but for a new conflict (refused as it is now, a page's write failed): said here, the dialog kept
    const notWritten = (problem: string) => {
      writing = false;
      write.disabled = keep.disabled = false;
      failed.textContent = `Not written: ${problem}`;
      failed.hidden = false;
    };
    let result: Result;
    try {
      result = await conflict.force();
    } catch (error) {
      return notWritten(error instanceof Error ? error.message : String(error));
    }
    // (Changed again: the core offers the conflict as it is now, in a notification of its own)
    if ("problem" in result && result.cause !== "left") return notWritten(result.problem);
    writing = false;
    host.written?.();
    dialog.close();
  }
}
