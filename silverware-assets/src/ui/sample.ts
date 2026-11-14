// What the settings' samples are made of (the Appearance tab: a preview's label, a card, a link; docs/silverware-assets-label.md):
// a property shown in a sample, drawn as the page draws it, its name and a × over it as it is pointed at, focused or
// chosen (a click, a tap: a finger has no pointing), nothing moving; a chip of a property not shown, in a row over the
// sample; the sample files whose values the samples show. Each editor (ui/labeleditor.ts; ui/cardeditor.ts, a card's
// and a link's) puts them together and keeps what is shown.
import { el } from "../../../shared/elements.ts";

const BASE = "swa-sample";

/** A sample file of a type (a type not named here: a file's) */
const FILES: Readonly<Record<string, { readonly name: string; readonly alt: string; readonly size: string }>> = {
  image: { name: "lake.jpg", alt: "Sunset over the lake", size: "2.4 MB" },
  video: { name: "trip.mp4", alt: "Our trip", size: "48 MB" },
  audio: { name: "interview.mp3", alt: "Interview", size: "6.1 MB" },
  pdf: { name: "report.pdf", alt: "Quarterly report", size: "860 KB" },
  file: { name: "project.zip", alt: "Project files", size: "12 MB" },
};

/** The sample file of a type: its name, alt text and size */
export const sampleFile = (type: string | undefined) => FILES[type ?? "file"] ?? FILES.file!;

export type SampleItem = {
  readonly field: string;
  // Its name (over it) and what it is (its tooltip)
  readonly name: string;
  readonly hint: string;
  // What it shows, as the page draws it
  readonly content: HTMLElement;
  // What a screen reader says of it (none: its name)
  readonly spoken?: string;
  readonly selected: boolean;
  // Hidden by its × or Delete; none: it cannot be (no ×)
  hide?(): void;
  // Chosen or let go: by a click where it is not dragged (else the drag tells a press without a move), by Esc let go
  choose?(chosen: boolean): void;
};

/** A property shown in a sample: its content, its name and its × over it (pointed at, focused or chosen) */
export function sampleItem(doc: Document, item: SampleItem): HTMLElement {
  const hide = item.hide;
  const remove = hide && el(doc, "button", { class: `${BASE}-remove`, text: "×", title: `Hide ${item.name}`, attrs: { type: "button", "aria-label": `Hide ${item.name}`, tabindex: -1 } });
  item.content.classList.add(`${BASE}-value`);
  const element = el(
    doc,
    "span",
    {
      class: `${BASE}-item`,
      title: item.hint,
      attrs: { "data-swa-field": item.field, role: "listitem", tabindex: 0, "aria-label": item.spoken ?? item.name, "aria-selected": String(item.selected) },
    },
    // (Its name and its × together over it: nothing of the line under them)
    el(doc, "span", `${BASE}-bar`, el(doc, "span", { class: `${BASE}-tag`, text: item.name, attrs: { "aria-hidden": "true" } }), ...(remove ? [remove] : [])),
    item.content,
  );
  // (The × its own: no drag nor choice from it)
  remove?.addEventListener("pointerdown", (e) => e.stopPropagation());
  remove?.addEventListener("click", (e) => {
    e.stopPropagation();
    hide!();
  });
  if (item.choose) element.addEventListener("click", () => item.choose!(!item.selected));
  element.addEventListener("keydown", (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && hide) {
      e.preventDefault();
      hide();
    } else if (e.key === "Escape" && item.selected && item.choose) {
      e.preventDefault();
      e.stopPropagation();
      item.choose(false);
    }
  });
  return element;
}

/** A chip of a property not shown: shown by a click, Space or Enter; `draggable`, a pointer's press is its editor's drag (which tells one without a move) */
export function sampleChip(doc: Document, chip: { readonly field: string; readonly name: string; readonly hint: string; show(): void }, draggable = false): HTMLButtonElement {
  const button = el(doc, "button", { class: `${BASE}-chip`, title: chip.hint, attrs: { type: "button", "data-swa-field": chip.field, role: "listitem" } }, chip.name);
  // (Dragged: a pointer's press is the drag's, which tells one without a move; Space or Enter a click of no pointer)
  button.addEventListener("click", (e) => {
    if (!draggable || e.detail === 0) chip.show();
  });
  return button;
}

/** The row of the properties not shown, over a sample: its name, its list (what a drag drops into to hide one) */
export function hiddenRow(doc: Document, list: HTMLElement): HTMLElement {
  list.classList.add(`${BASE}-list`);
  return el(doc, "div", `${BASE}-hidden`, el(doc, "span", `${BASE}-hidden-name`, "Not shown"), list);
}

/** A sample's ground: its sample in the middle */
export const sampleStage = (doc: Document, ...children: HTMLElement[]) => el(doc, "div", `${BASE}-stage`, ...children);
