// Bold: `**`, as SilverBullet's own command writes it; `__` read too.
import type { InlineDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): InlineDefinition => ({
  name: "bold",
  scope: "inline",
  label: "Bold",
  icon: helpers.icons.bold,
  group: "Format",
  keywords: ["strong", "tučné"],
  marker: ["**", "__"],
});
