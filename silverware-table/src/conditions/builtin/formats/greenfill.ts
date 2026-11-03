import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition => ({
  name: "greenFill",
  label: "Green fill with dark green text",
  style: { fill: palette.green, color: palette.green },
});
