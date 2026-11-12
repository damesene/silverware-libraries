// Small line icons (24×24, drawn with currentColor) for the dialog

// Sized like a letter until the library's CSS sizes it: SilverBullet loads the
// CSS after the script, and an SVG without a size shows 300×150 meanwhile
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
} as const;
