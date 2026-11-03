import type { FormatDefinition } from "../../api.ts";

export default (): FormatDefinition => ({
  name: "bold",
  label: "Bold text",
  category: "Styles",
  style: { bold: true },
});
