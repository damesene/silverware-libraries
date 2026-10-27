// A tag: `#tag`, as SilverBullet reads one; a text no tag of one word can be
// (spaces, digits alone, punctuation) its tag of several, `#<a tag>`. Its
// content is a tag's name, not formatted (literal). Recognized selected whole,
// or with the selection (or the caret) in it: taken off, its name left.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

// SilverBullet's tag (tagRegex, client/markdown_parser/constants.ts of 2.12.1):
// a name of characters that are not spaces nor punctuation, not of digits
// alone, not ending in a hyphen; or any text in < >
const TAG = String.raw`#(?:(?:\d*[^\d\s!@#$%^&*(),.?":{}|<>\\';\/–—][^\s!@#$%^&*(),.?":{}|<>\\]*)|(?:<[^>\n]+>))(?<!-)`;
const WHOLE_RE = new RegExp(`^${TAG}$`);
// What of a tag may be before the selection and after it: `#<` and its text up to `>`, or `#` and its name
const SIDES: readonly (readonly [RegExp, RegExp])[] = [
  [/#<[^>\n]*/, /[^>\n]*>/],
  [/#[^\s!@#$%^&*(),.?":{}|<>\\]*/, /[^\s!@#$%^&*(),.?":{}|<>\\]*/],
];

/** A tag's name: what is in its < >, else after its # */
const nameOf = (tag: string) => (tag.startsWith("#<") ? tag.slice(2, -1) : tag.slice(1));

export default (helpers: Helpers): InlineDefinition => ({
  name: "tag",
  scope: "inline",
  label: "Tag",
  icon: helpers.icons.tag,
  group: "Links",
  keywords: ["hashtag", "#", "štítek"],
  literal: true,
  read: (text, { before, after }) => {
    if (WHOLE_RE.test(text)) return nameOf(text);
    for (const [head, tail] of SIDES) {
      const start = before.touching(head);
      const end = after.touching(tail);
      if (start === undefined || end === undefined) continue;
      const whole = start + text + end;
      if (WHOLE_RE.test(whole)) return { text: nameOf(whole), start, end };
    }
    return undefined;
  },
  write: (text) => {
    if (!text) return `#${helpers.cursor()}`;
    return WHOLE_RE.test(`#${text}`) ? `#${text}` : `#<${text.replace(/[>\n]/g, "")}>`;
  },
});
