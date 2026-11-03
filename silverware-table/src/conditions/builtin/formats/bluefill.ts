import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition => ({
  name: "blueFill",
  label: "Blue fill with dark blue text",
  category: "Styles",
  style: { fill: palette.blue, color: palette.blue },
});
