// A table's row: recognized, never turned into another block nor formatted.
import type { LineBlockDefinition } from "../format.ts";

export default (): LineBlockDefinition => ({
  name: "table",
  scope: "block",
  read: (text) => (text.startsWith("|") ? text : undefined),
});
