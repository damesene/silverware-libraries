// Icons the views and modules draw, 16 × 16 in the text's color: a property
// type's (by its name; a type of the user's the text's), opening an item, going
// back, closing.
export const svg = (body: string) => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const TYPE_ICONS: Readonly<Record<string, string>> = {
  text: svg('<path d="M3 4.5h10M3 8h10M3 11.5h6"/>'),
  number: svg('<path d="M6.5 2.5 5 13.5M11 2.5 9.5 13.5M3 6h10.5M2.5 10H13"/>'),
  checkbox: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="m5 8.25 2 2L11 6"/>'),
  date: svg('<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/>'),
  select: svg('<circle cx="8" cy="8" r="5.5"/><path d="m5.75 7 2.25 2.25L10.25 7"/>'),
  "multi-select": svg('<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/><circle cx="3" cy="4.5" r=".8" fill="currentColor"/><circle cx="3" cy="8" r=".8" fill="currentColor"/><circle cx="3" cy="11.5" r=".8" fill="currentColor"/>'),
  url: svg('<path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l2-2a2.75 2.75 0 0 0-3.9-3.9l-.75.75"/><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-2 2a2.75 2.75 0 0 0 3.9 3.9l.75-.75"/>'),
};

/** A property type's icon (a type the views do not know: the text's) */
export function typeIcon(type: string): string {
  return TYPE_ICONS[type] ?? TYPE_ICONS.text!;
}

export const VIEW_ICONS = {
  open: svg('<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>'),
  back: svg('<path d="M10 3 5 8l5 5"/>'),
  close: svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
} as const;
