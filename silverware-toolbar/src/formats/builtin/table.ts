// A table's row: recognized, never turned into another block nor formatted.
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "table",
  scope: "block",
  read: (text) => (helpers.readLine(text).kind === "table" ? text : undefined),
});
