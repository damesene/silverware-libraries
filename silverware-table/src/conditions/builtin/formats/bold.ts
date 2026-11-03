import type { FormatDefinition } from "../../api.ts";

export default (): FormatDefinition => ({
  name: "bold",
  label: "Bold text",
  style: { bold: true },
});
