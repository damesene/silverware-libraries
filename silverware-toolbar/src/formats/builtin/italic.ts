// Italic: `_`, as SilverBullet's own command writes it; `*` read too.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): InlineDefinition => ({
  name: "italic",
  scope: "inline",
  label: "Italic",
  icon: helpers.icons.italic,
  group: "Format",
  keywords: ["emphasis", "kurzíva"],
  marker: ["_", "*"],
});
