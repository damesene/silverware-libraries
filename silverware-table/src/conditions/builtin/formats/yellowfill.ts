import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition => ({
  name: "yellowFill",
  label: "Yellow fill with dark yellow text",
  style: { fill: palette.yellow, color: palette.yellow },
});
