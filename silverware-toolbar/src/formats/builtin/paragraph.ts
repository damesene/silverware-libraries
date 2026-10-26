// A paragraph: a line as it is, without a block's marker. Read last, so any
// line no other format reads is one. Its lines one after another are one
// paragraph: bold over them is one pair (markdown's emphasis goes on over a
// line break within a paragraph).
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "paragraph",
  scope: "block",
  label: "Paragraph",
  icon: helpers.icons.paragraph,
  keywords: ["text", "plain", "odstavec"],
  joins: true,
  read: (text) => text,
  write: (text) => text,
});
