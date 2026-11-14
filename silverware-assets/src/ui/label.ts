// A preview's label (docs/silverware-assets-label.md): a line above the preview and one under it, each the properties
// the user turned on there, in their order. The alt text falls back to the file's name, but is left out where it
// would only repeat the name shown too. The type's icon is drawn as a card draws it, no dot after it.
import { el } from "../../../shared/elements.ts";
import type { LabelField, PreviewLabel } from "../model/settings.ts";
import { iconElement } from "./card.ts";

/** What a file has to show: its name always, its type's icon (SVG text or a URL), its alt text, size and date where known (as text) */
export type LabelValues = { readonly name: string; readonly icon?: string; readonly alt?: string; readonly size?: string; readonly modified?: string };

/** A property shown: its field, its text */
export type LabelText = { readonly field: LabelField; readonly text: string };

/** The texts of each place of a label: the properties on, those without a value left out */
export function labelTexts(label: PreviewLabel, values: LabelValues): { readonly above: readonly LabelText[]; readonly below: readonly LabelText[] } {
  const shown = (field: LabelField) => [...label.above, ...label.below].some((part) => part.field === field && part.on);
  const alt = values.alt?.trim();
  const text = (field: LabelField): string | undefined => {
    if (field === "alt") return alt || (shown("name") ? undefined : values.name);
    return field === "name" ? values.name : values[field];
  };
  const place = (parts: PreviewLabel["above"]) => parts.flatMap((part): LabelText[] => {
    if (!part.on) return [];
    const one = text(part.field);
    return one ? [{ field: part.field, text: one }] : [];
  });
  return { above: place(label.above), below: place(label.below) };
}

const PLACE_CLASS = { above: "swa-label-above", below: "swa-label-below" } as const;

/** A property's element in a line: its text, the icon drawn */
export function labelPart(doc: Document, one: LabelText): HTMLElement {
  if (one.field === "icon") return el(doc, "span", { class: "swa-label-icon", attrs: { "aria-hidden": "true" } }, iconElement(doc, one.text));
  return el(doc, "span", { class: `swa-label-${one.field}`, text: one.text });
}

/** A place's line: its texts (none: no line), the whole as its tooltip (the icon left out of it) */
export function drawLabelLine(doc: Document, place: "above" | "below", texts: readonly LabelText[]): HTMLElement | undefined {
  if (!texts.length) return undefined;
  const words = texts.filter((one) => one.field !== "icon").map((one) => one.text);
  const line = el(doc, "div", { class: `swa-own swa-label ${PLACE_CLASS[place]}`, ...(words.length ? { title: words.join(" · ") } : {}) });
  for (const one of texts) line.append(labelPart(doc, one));
  return line;
}
