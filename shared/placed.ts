// Which of a text's blocks written alike an element shows, told by the element's place in the text as its host says it
// (SilverBullet's editor: shared/silverbullet/position.ts): what lets a plugin write the one block a widget shows,
// where the page has two of the same text, whatever is in view. Generic: a host that tells no place finds the block
// alone, never one of several by a guess. The place is asked as the text is read (together), so an edit between sets
// neither against the other.

/** An element's place in the page's text, as its host says; none where it cannot say */
export type PositionOf = (element: Element) => Promise<number | undefined>;

/**
 * Of a text's blocks written alike, the one an element shows: the one alone where there is one, else the one its place
 * `at` falls in (from its start to its end, both counted: a host may give either); none where that cannot be told (no
 * place given, or one in none of them)
 */
export function blockAt<T extends { readonly from: number; readonly to: number }>(alike: readonly T[], at: number | undefined): T | undefined {
  if (alike.length <= 1) return alike[0];
  return at === undefined ? undefined : alike.find((block) => block.from <= at && at <= block.to);
}
