// Icons the views and modules draw, 16 × 16 in the text's color: a property
// type's (by its name; a type of the user's the text's), opening an item, going
// back, closing, editing (a pencil).
import { el } from "../../../shared/elements.ts";
import { validateIcon } from "../domain/look.ts";
import type { Property } from "../model/database.ts";

export const svg = (body: string) => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const TYPE_ICONS: Readonly<Record<string, string>> = {
  text: svg('<path d="M3 4.5h10M3 8h10M3 11.5h6"/>'),
  number: svg('<path d="M6.5 2.5 5 13.5M11 2.5 9.5 13.5M3 6h10.5M2.5 10H13"/>'),
  checkbox: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="m5 8.25 2 2L11 6"/>'),
  date: svg('<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>'),
  time: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.25l2 1.25"/>'),
  datetime: svg('<rect x="2.5" y="3.5" width="8" height="8" rx="1.5"/><path d="M2.5 6.5h8M5 2v3"/><circle cx="11.5" cy="11.5" r="3"/><path d="M11.5 10v1.5l1 .75"/>'),
  progress: svg('<rect x="2" y="6" width="12" height="4" rx="2"/><path d="M4 8h4.5"/>'),
  select: svg('<circle cx="8" cy="8" r="5.5"/><path d="m5.75 7 2.25 2.25L10.25 7"/>'),
  "multi-select": svg('<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/><circle cx="3" cy="4.5" r=".8" fill="currentColor"/><circle cx="3" cy="8" r=".8" fill="currentColor"/><circle cx="3" cy="11.5" r=".8" fill="currentColor"/>'),
  reference: svg('<path d="M4.5 2.5h5l3 3v8h-8z"/><path d="M9.5 2.5v3h3M6.5 9h3.5M8.5 7.5 10 9l-1.5 1.5"/>'),
  tags: svg('<path d="M2.5 8.25V3.5a1 1 0 0 1 1-1h4.75l5.25 5.25-5.75 5.75z"/><circle cx="5.5" cy="5.5" r=".9" fill="currentColor"/>'),
  url: svg('<path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0-3.9-3.9l-.75.75"/><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 3.9 3.9l.75-.75"/>'),
};

/** A property's own icon (an emoji, as its schema keeps it) where it is one, else none: its type's then (`typeIcon`) */
export function ownIcon(property: Property): string | undefined {
  return property.icon && !validateIcon(property.icon) ? property.icon : undefined;
}

/** A property's icon where the views name it: its own (an emoji, as large as the text), else its type's; `className` the place's */
export function propertyIcon(doc: Document, property: Property, type: string, className: string): HTMLElement {
  const own = ownIcon(property);
  return own ? el(doc, "span", { class: `${className} swd-prop-own-icon`, text: own, attrs: { "aria-hidden": "true" } }) : el(doc, "span", { class: className, html: typeIcon(type) });
}

/** A property type's icon (a type the views do not know: the text's) */
export function typeIcon(type: string): string {
  return TYPE_ICONS[type] ?? TYPE_ICONS.text!;
}

export const VIEW_ICONS = {
  open: svg('<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>'),
  back: svg('<path d="M10 3 5 8l5 5"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  chevron: svg('<path d="m6 4 4 4-4 4"/>'),
  edit: svg('<path d="M10.5 3.5 12.5 5.5 6 12H4v-2z"/>'),
  fullScreen: svg('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>'),
  exitFullScreen: svg('<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/>'),
  folder: svg('<path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path d="M7 9h4M9.5 7.5 11 9l-1.5 1.5"/>'),
} as const;
