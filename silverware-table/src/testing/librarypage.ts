// What the tests reading the library page's tables (Functions, Column types,
// Conditions) expect of a description written in a cell: as the page writes
// any text in a table, the one rule for all of them.

// A mention as SilverBullet reads one (client/markdown_parser/parser.ts: `@` after none of a word's character, `.`, `@`, `+`,
// `-`; a name as its atMentionRegex starts one), not one escaped already
const MENTION = /(^|[^\w.@+\-\\])@(?=\d*[^\d\s!@#$%^&*(),.?":{}|<>\\/'’])/g;

/**
 * A text as the library page writes it in a table's cell: `|` escaped (else it
 * ends the cell), and an `@` SilverBullet would read as a mention escaped,
 * `\@` (else the page is listed in its Mention Inbox: `[@due]`, `=@projects`)
 */
export function asInLibraryPage(text: string): string {
  return text.replace(/\|/g, "\\|").replace(MENTION, "$1\\@");
}
