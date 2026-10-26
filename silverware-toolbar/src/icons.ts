// Small line icons (24×24, drawn with currentColor) for the toolbar and the popup

// Sized like a letter until the library's CSS sizes it: SilverBullet loads the
// CSS after the script, and an SVG without a size shows 300×150 meanwhile
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// Letters drawn as text, for formats a letter says best (H1, the bold B)
export const letters = (text: string, weight = 700) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="${text.length > 1 ? 13 : 17}" font-family="system-ui, sans-serif" font-weight="${weight}" fill="currentColor">${text}</text></svg>`;

export const ICONS = {
  bold: svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
  italic: svg('<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>'),
  strike: svg('<path d="M5 12h14M16 7.5C15.4 6 13.9 5 12 5 9.8 5 8 6.3 8 8c0 1.5 1.1 2.4 3 3M8 16.5C8.6 18 10.1 19 12 19c2.2 0 4-1.3 4-3 0-.6-.2-1.2-.5-1.7"/>'),
  highlight: svg('<path d="m9 11-5 5v3h3l5-5M14.5 5.5l4 4M9 11l4-4 4 4-4 4z"/>'),
  code: svg('<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  wikiLink: svg('<path d="M8 5H5v14h3M16 5h3v14h-3M10 9h4M10 15h4"/>'),
  unlink: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16"/>'),
  clear: svg('<path d="M6 5h12M12 5l-3 14M15 13l5 5M20 13l-5 5"/>'),
  paragraph: svg('<path d="M13 4v16M17 4v16M19 4H10a4 4 0 0 0 0 8h3"/>'),
  heading1: letters("H1"),
  heading2: letters("H2"),
  heading3: letters("H3"),
  bullet: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  numbered: svg('<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5c0-.8.7-1.5 1.5-1.5s1.5.6 1.5 1.3c0 1.2-3 2.2-3 3.7h3"/>'),
  task: svg('<rect x="3" y="4" width="7" height="7" rx="1"/><path d="m4.5 7.5 1.5 1.5 3-3M13 7h8M3 15h7v6H3zM13 18h8"/>'),
  quote: svg('<path d="M5 6v12M9 8h10M9 12h10M9 16h6"/>'),
  turnInto: svg('<path d="M4 7h12l-3-3M20 17H8l3 3"/>'),
  more: svg('<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  chevron: svg('<path d="m9 6 6 6-6 6"/>'),
  chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'),
  star: svg('<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>'),
  starOn: svg('<path fill="currentColor" d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>'),
  command: svg('<path d="m5 8 4 4-4 4M12 16h7"/>'),
  grip: svg('<circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  // An item shown as its icon only, or with its label
  iconOnly: svg('<rect x="8" y="8" width="8" height="8" rx="1.5"/>'),
  label: svg('<rect x="3" y="8" width="6" height="8" rx="1.5"/><path d="M12 12h9"/>'),
} as const;
