// The editor of a preview's label in the settings (docs/silverware-assets-label.md): one element, a sample of a
// preview as the page draws it (its type's icon in a box), its label's lines made of the properties shown, each as its
// sample value (as on the page); the properties not shown a row of chips of their names over it. A property shown,
// pointed at, focused or chosen (a click, a tap: a finger has no pointing) shows its name and a × over it, nothing
// moving (its text is not swapped for its name: the line would reflow under the pointer). Dragged (a
// finger: held first), a property moves within its line, to the other, or up to the row (hidden); a chip of the row
// dragged into a line is shown there, clicked shown where it was (shared/drag.ts). × or Delete hides a property, Alt+←
// → moves it a step (past an end into the other line), Alt+↑ ↓ to the other line, Esc lets it go. Each change is told
// (a type's label made its own so, by its caller), and a `change` event is sent from its element (the settings
// window's Save follows those).
import { reorder } from "../../../shared/drag.ts";
import { el } from "../../../shared/elements.ts";
import { LABEL_FIELDS, type LabelField, type PreviewLabel } from "../model/settings.ts";
import { iconElement } from "./card.ts";
import { labelPart, type LabelValues } from "./label.ts";
import { hiddenRow, sampleChip, sampleFile, sampleItem, sampleStage } from "./sample.ts";

const FIELD_NAMES: Readonly<Record<LabelField, string>> = { icon: "Icon", alt: "Alt text", name: "Name", size: "Size", modified: "Date changed" };
const FIELD_HINTS: Readonly<Record<LabelField, string>> = {
  icon: "The file type's icon",
  alt: "The embed's alt text, else the file's name",
  name: "The file's name",
  size: "The file's size",
  modified: "The date the file was last changed",
};
const PLACES = ["above", "below"] as const;
type Place = (typeof PLACES)[number];
/** Where a chip goes: a place, before the chip shown there at `index` (none there: after the last), or off */
export type ChipTarget = { readonly place: Place | "off"; readonly index: number };
const PLACE_NAMES: Readonly<Record<Place | "off", string>> = { above: "Above the preview", below: "Below the preview", off: "Not shown" };
const BASE = "swa-label-edit";

export type LabelEditor = {
  readonly element: HTMLElement;
  /** Shows a label: its type's (its sample, its icon) */
  show(label: PreviewLabel, type: { readonly name: string; readonly icon: string } | undefined): void;
};

/** Where a property is: its place, its index there */
function whereIs(label: PreviewLabel, field: LabelField): { readonly place: Place; readonly index: number } | undefined {
  for (const place of PLACES) {
    const index = label[place].findIndex((part) => part.field === field);
    if (index >= 0) return { place, index };
  }
  return undefined;
}

/** The properties shown in a place, in order */
export const shownIn = (label: PreviewLabel, place: Place) => label[place].filter((part) => part.on).map((part) => part.field);

/**
 * A property put where a chip goes: off, hidden where it is (its place kept, to come back to); in a place, shown there
 * before the property shown at `index` (counted without it), else after the last shown there
 */
export function placedPart(label: PreviewLabel, field: LabelField, to: ChipTarget): PreviewLabel {
  const from = whereIs(label, field);
  if (!from) return label;
  if (to.place === "off") return { ...label, [from.place]: label[from.place].map((part) => (part.field === field ? { ...part, on: false } : part)) };
  const lists = { above: [...label.above], below: [...label.below] };
  lists[from.place].splice(from.index, 1);
  const target = lists[to.place];
  const shown = target.filter((part) => part.on);
  const before = shown[to.index];
  const last = shown.at(-1);
  const at = before ? target.indexOf(before) : last ? target.indexOf(last) + 1 : 0;
  target.splice(at, 0, { field, on: true });
  return lists;
}

/** A property hidden shown again where it was */
export function shownAgain(label: PreviewLabel, field: LabelField): PreviewLabel {
  const from = whereIs(label, field);
  return from ? { ...label, [from.place]: label[from.place].map((part) => (part.field === field ? { ...part, on: true } : part)) } : label;
}

/** Where Alt+arrow takes a property shown: ← → a step (past an end into the other place), ↑ ↓ to the other place; none where it goes nowhere */
export function steppedTo(label: PreviewLabel, field: LabelField, key: string): ChipTarget | undefined {
  const from = whereIs(label, field);
  if (!from) return undefined;
  const shown = shownIn(label, from.place);
  const index = shown.indexOf(field);
  const other: Place = from.place === "above" ? "below" : "above";
  const otherEnd = (place: Place) => (place === "above" ? shownIn(label, "above").length : 0);
  if (key === "ArrowLeft") return index > 0 ? { place: from.place, index: index - 1 } : from.place === "below" ? { place: "above", index: otherEnd("above") } : undefined;
  if (key === "ArrowRight") return index < shown.length - 1 ? { place: from.place, index: index + 1 } : from.place === "above" ? { place: "below", index: 0 } : undefined;
  if (key === "ArrowUp") return from.place === "below" ? { place: other, index: otherEnd(other) } : undefined;
  if (key === "ArrowDown") return from.place === "above" ? { place: other, index: 0 } : undefined;
  return undefined;
}

/** The values of a type's sample file (the date: today's, as the page writes it) */
function sampleOf(type: { readonly name: string; readonly icon: string } | undefined, date: string): LabelValues {
  const sample = sampleFile(type?.name);
  return { name: sample.name, ...(type ? { icon: type.icon } : {}), alt: sample.alt, size: sample.size, modified: date };
}


export function labelEditor(doc: Document, changed: (label: PreviewLabel) => void, date: string): LabelEditor {
  let label: PreviewLabel = { above: [], below: [] };
  let type: { readonly name: string; readonly icon: string } | undefined;
  // The property chosen (a click, a tap): its name and its × shown, as on hover
  let selected: LabelField | undefined;
  const list = (place: Place | "off") =>
    el(doc, "div", { class: `${BASE}-list${place === "off" ? "" : ` ${BASE}-line ${BASE}-line-${place}`}`, attrs: { "data-swa-place": place, role: "list", "aria-label": PLACE_NAMES[place] } });
  const lists: Record<Place | "off", HTMLElement> = { off: list("off"), above: list("above"), below: list("below") };
  // (The order the drag counts its containers in)
  const containers = [lists.off, lists.above, lists.below];
  const targets = ["off", "above", "below"] as const;
  // The sample: the label's lines (its properties shown, as their values) round a preview's box, as the page draws them
  const box = el(doc, "div", { class: `${BASE}-preview`, attrs: { "aria-hidden": "true" } });
  const sample = el(doc, "div", { class: `${BASE}-sample` }, lists.above, box, lists.below);
  const hint = el(doc, "div", "swa-sample-hint", "Point at or tap a property for its name and ×; drag it above or below the preview, or up to the row to hide it.");
  const element = el(doc, "div", `swa-sample-editor ${BASE}`, hiddenRow(doc, lists.off), sampleStage(doc, sample), hint);

  const set = (next: PreviewLabel, focusField?: LabelField) => {
    label = next;
    draw();
    changed(label);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (focusField) element.querySelector<HTMLElement>(`[data-swa-field="${focusField}"]`)?.focus();
  };
  const hide = (field: LabelField) => {
    if (selected === field) selected = undefined;
    set(placedPart(label, field, { place: "off", index: 0 }));
    // (The focus to the row, where the property is now)
    element.querySelector<HTMLElement>(`[data-swa-place="off"] [data-swa-field="${field}"]`)?.focus();
  };
  const choose = (field: LabelField | undefined) => {
    selected = field;
    draw();
    if (field) element.querySelector<HTMLElement>(`[data-swa-field="${field}"]`)?.focus();
  };
  /** A press on an element of a property: a drag of it (a press without a move: `clicked`) */
  const draggable = (item: HTMLElement, field: LabelField, clicked: () => void) =>
    item.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // (No text selected by the drag; the element focused, so its keys work then)
      e.preventDefault();
      item.focus();
      element.classList.add(`${BASE}-dragging`);
      reorder(e, {
        element: item,
        base: BASE,
        flow: "inline",
        hold: true,
        containers: () => containers,
        items: (container) => [...container.querySelectorAll<HTMLElement>(":scope > [data-swa-field]")],
        // Let go: the property where it went; cancelled, or never moved: drawn again as the label is
        done: (to) => {
          element.classList.remove(`${BASE}-dragging`);
          if (to) set(placedPart(label, field, { place: targets[to.container]!, index: to.index }), field);
          else draw();
        },
        clicked,
      });
    });
  // A property not shown: a chip of its name, shown where it was by a click, Space or Enter, or dragged into a place
  const chipOf = (field: LabelField) => {
    const show = () => set(shownAgain(label, field), field);
    const chip = sampleChip(doc, { field, name: FIELD_NAMES[field], hint: `${FIELD_HINTS[field]}. Click to show it, or drag it above or below the preview`, show }, true);
    draggable(chip, field, show);
    return chip;
  };
  // A property shown: its value as the page draws it; pointed at, focused or chosen, its name over it and its ×
  const itemOf = (field: LabelField, value: string) => {
    const item = sampleItem(doc, {
      field,
      name: FIELD_NAMES[field],
      hint: `${FIELD_HINTS[field]}. Drag it to move it, × to hide it`,
      content: labelPart(doc, { field, text: value }),
      ...(field === "icon" ? {} : { spoken: `${FIELD_NAMES[field]}: ${value}` }),
      selected: selected === field,
      hide: () => hide(field),
    });
    item.classList.add(`swa-label-${field}`);
    // (Chosen by a press without a move: the drag tells it; let go by Esc)
    draggable(item, field, () => choose(selected === field ? undefined : field));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && selected) {
        e.preventDefault();
        e.stopPropagation();
        return choose(undefined);
      }
      if (!e.altKey || !e.key.startsWith("Arrow")) return;
      e.preventDefault();
      const to = steppedTo(label, field, e.key);
      if (to) set(placedPart(label, field, to), field);
    });
    return item;
  };
  const draw = () => {
    const values = sampleOf(type, date);
    for (const place of PLACES) lists[place].replaceChildren(...shownIn(label, place).flatMap((field) => (values[field] === undefined ? [] : [itemOf(field, values[field]!)])));
    // (Those not shown in a steady order: the properties' own)
    const hidden = new Set([...label.above, ...label.below].filter((part) => !part.on).map((part) => part.field));
    lists.off.replaceChildren(...LABEL_FIELDS.filter((field) => hidden.has(field)).map((field) => chipOf(field)));
    box.replaceChildren(...(type ? [iconElement(doc, type.icon)] : []));
  };

  return {
    element,
    show: (next, of) => {
      label = next;
      type = of;
      selected = undefined;
      draw();
    },
  };
}
