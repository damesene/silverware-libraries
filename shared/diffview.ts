// A document's change as a review shows it: each run of lines changed, its
// first line's number, the lines before (removed) and after (added); for
// Silverware Tags' review and Silverware Database's conflicts alike, in each
// plugin's look (`base`: its classes `${base}-diff-run`, `${base}-diff-line-number`,
// `${base}-diff-removed`, `${base}-diff-added`; their CSS shared/diffview.css, written into each plugin's
// style page by the build, scripts/sharedstyles.mjs).
import { el } from "./elements.ts";
import type { DiffRun } from "./pages/diff.ts";

/** The runs of a document's change, an element each */
export function diffRuns(doc: Document, base: string, runs: readonly DiffRun[]): HTMLElement[] {
  return runs.map((run) =>
    el(
      doc,
      "div",
      `${base}-diff-run`,
      el(doc, "div", { class: `${base}-diff-line-number`, text: `line ${run.line}` }),
      ...run.removed.map((line) => el(doc, "div", { class: `${base}-diff-removed`, text: line || " " })),
      ...run.added.map((line) => el(doc, "div", { class: `${base}-diff-added`, text: line || " " })),
    ),
  );
}
