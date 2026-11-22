// The row under a group's (or a view's) items drawn when more are listed (docs/silverware-database-load-more.md): Load
// N more and how many of them are shown, the same in every view, each putting them in a row of its own (a table's cell
// across its columns, a board's column's foot).
import { el } from "../../../shared/elements.ts";

/** Load N more (N those a press draws: the page's size, or those left), and how many of all are shown (`50 of 1,240`) */
export function moreParts(doc: Document, shown: number, total: number, next: number, press: () => void): HTMLElement[] {
  const number = (n: number) => n.toLocaleString("en-US");
  return [
    el(doc, "button", { class: "swd-load-more-button", text: `Load ${number(next)} more`, title: `Show the next ${number(next)} of the ${number(total - shown)} not shown`, run: press }),
    el(doc, "span", { class: "swd-load-more-count", text: `${number(shown)} of ${number(total)}` }),
  ];
}
