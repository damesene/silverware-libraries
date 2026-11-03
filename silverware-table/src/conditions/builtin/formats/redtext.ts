import type { FormatDefinition, Helpers } from "../../api.ts";

export default ({ palette }: Helpers): FormatDefinition => ({
  name: "redText",
  label: "Red text",
  style: { color: palette.red },
});
