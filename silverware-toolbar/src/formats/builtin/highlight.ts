// Highlight: `==`, SilverBullet's marker.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): InlineDefinition => ({
  name: "highlight",
  scope: "inline",
  label: "Highlight",
  icon: helpers.icons.highlight,
  group: "Format",
  keywords: ["marker", "mark", "zvýraznění"],
  marker: "==",
});
