// Inline code: a backtick. Its content is not formatted (literal): put on
// text with formats, their markers go; other formats wrap it, not go inside it.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): InlineDefinition => ({
  name: "code",
  scope: "inline",
  label: "Code",
  icon: helpers.icons.code,
  group: "Format",
  keywords: ["inline code", "monospace", "kód"],
  marker: "`",
  literal: true,
});
