import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition => ({
  name: "greenFill",
  label: "Green fill with dark green text",
  category: "Styles",
  style: { fill: palette.green, color: palette.green },
});
