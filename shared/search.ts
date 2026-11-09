// Finding items by what is typed, as the plugins' searches do (the toolbar's
// popup, the emoji picker): every word typed starts a word of an item's text,
// ignoring case and diacritics ("li" finds Link and Bullet list, not Italic).

/**
 * Items found by what is typed: every word typed starts a word of an item's
 * text, ignoring case and diacritics; those whose label starts with what is
 * typed first, else in their order
 */
export function findByWords<T>(items: readonly T[], query: string, textOf: (item: T) => string, labelOf: (item: T) => string): T[] {
  const words = wordsOf(query);
  if (!words.length) return [...items];
  const found = items.filter((item) => {
    const own = wordsOf(textOf(item));
    return words.every((word) => own.some((w) => w.startsWith(word)));
  });
  const first = words.join(" ");
  // A stable sort: the order kept within each
  return found.sort((a, b) => Number(fold(labelOf(b)).startsWith(first)) - Number(fold(labelOf(a)).startsWith(first)));
}

function wordsOf(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Text compared ignoring case and diacritics */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
