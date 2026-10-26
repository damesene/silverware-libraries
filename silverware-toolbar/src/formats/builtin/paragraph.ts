// A paragraph: a line as it is, without a block's marker. Read last, so any
// line no other format reads is one.
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "paragraph",
  scope: "block",
  label: "Paragraph",
  icon: helpers.icons.paragraph,
  keywords: ["text", "plain", "odstavec"],
  read: (text) => text,
  write: (text) => text,
});
