// A horizontal rule (`---`, `***`, `- - -`): recognized, left as it is (a
// line's block read tells it from a bullet list's, which `- - -` reads like).
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "rule",
  scope: "block",
  read: (text) => (helpers.readLine(text).kind === "rule" ? text : undefined),
});
