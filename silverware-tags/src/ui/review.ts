// A plan as the window's review shows it: each page that changes with its
// lines before and after (folded under its name, the first few open, the
// others' lines made as they are opened), the pages left alone and why.
import { diffLines } from "../../../shared/pages/diff.ts";
import { counted } from "../core/operation.ts";
import type { Plan } from "../core/plan.ts";
import { el } from "../../../shared/elements.ts";

// Pages shown open at the start
const OPEN = 3;
// Pages listed at most (the rest counted): each a line, its lines before and after made as it is opened
const LISTED = 1000;

export function reviewList(doc: Document, plan: Plan): HTMLElement {
  const body = el(doc, "div", "swg-preview");
  if (plan.changes.length) {
    const list = el(doc, "div", "swg-preview-pages");
    plan.changes.slice(0, LISTED).forEach((change, i) => {
      const diff = el(doc, "div", "swg-diff");
      const details = el(
        doc,
        "details",
        { class: "swg-preview-page", attrs: { "data-swg-page": change.page } },
        el(doc, "summary", "swg-preview-summary", el(doc, "span", { class: "swg-preview-name", text: change.page }), el(doc, "span", { class: "swg-count", text: counted(change.changes, "change") })),
        diff,
      );
      // Its lines made as it is first opened (hundreds of pages: only those looked at)
      const fill = () => {
        if (diff.childElementCount) return;
        diff.append(
          ...diffLines(change.before, change.after).map((run) =>
            el(
              doc,
              "div",
              "swg-diff-run",
              el(doc, "div", { class: "swg-diff-line-number", text: `line ${run.line}` }),
              ...run.removed.map((line) => el(doc, "div", { class: "swg-diff-removed", text: line || " " })),
              ...run.added.map((line) => el(doc, "div", { class: "swg-diff-added", text: line || " " })),
            ),
          ),
        );
      };
      details.addEventListener("toggle", () => details.open && fill());
      if (i < OPEN) {
        fill();
        details.open = true;
      }
      list.append(details);
    });
    if (plan.changes.length > LISTED) list.append(el(doc, "p", { class: "swg-note", text: `and ${counted(plan.changes.length - LISTED, "more page")}` }));
    body.append(list);
  } else body.append(el(doc, "p", { class: "swg-empty", text: "Nothing to change." }));
  if (plan.skipped.length)
    body.append(
      el(doc, "h3", { class: "swg-section", text: `Left alone (${plan.skipped.length})` }),
      el(doc, "ul", "swg-skipped", ...plan.skipped.map((skip) => el(doc, "li", { attrs: { "data-swg-page": skip.page } }, el(doc, "strong", { text: skip.page }), `: ${skip.reason}`))),
    );
  return body;
}
