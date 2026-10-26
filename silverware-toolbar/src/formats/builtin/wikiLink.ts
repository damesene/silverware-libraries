// A wiki link: `[[page]]`. Its content is a page's name, not formatted
// (literal). Taken off, its alias is left (`[[page|alias]]`), else its page.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const WHOLE_RE = /^\[\[([^\][]+)\]\]$/;
const START_RE = /\[\[[^\][]*/;
const END_RE = /[^\][]*\]\]/;

/** What a wiki link's inside leaves: its alias, else its page */
const shown = (inner: string) => (inner.includes("|") ? inner.slice(inner.indexOf("|") + 1) : inner);

export default (helpers: Helpers): InlineDefinition => ({
  name: "wikiLink",
  scope: "inline",
  label: "Wiki link",
  icon: helpers.icons.wikiLink,
  group: "Links",
  keywords: ["page", "internal", "odkaz", "stránka"],
  literal: true,
  read: (text, { before, after }) => {
    const whole = WHOLE_RE.exec(text);
    if (whole) return shown(whole[1]!);
    const start = before.touching(START_RE);
    const end = after.touching(END_RE);
    if (start === undefined || end === undefined) return undefined;
    return { text: shown(start.slice(2) + text + end.slice(0, -2)), start, end };
  },
  write: (text) => `[[${text || helpers.cursor()}]]`,
});
