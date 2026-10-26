// Strikethrough: `~~`.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): InlineDefinition => ({
  name: "strikethrough",
  scope: "inline",
  label: "Strikethrough",
  icon: helpers.icons.strike,
  group: "Format",
  keywords: ["strike", "delete", "přeškrtnuté"],
  marker: "~~",
});
