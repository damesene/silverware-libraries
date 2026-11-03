import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition => ({
  name: "redFill",
  label: "Light red fill with dark red text",
  style: { fill: palette.red, color: palette.red },
});
