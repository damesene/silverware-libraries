// A horizontal rule (`---`, `***`, `- - -`): recognized, left as it is. Read
// before a bullet list, which `- - -` would otherwise be.
import type { LineBlockDefinition } from "../format.ts";

const RE = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

export default (): LineBlockDefinition => ({
  name: "rule",
  scope: "block",
  read: (text) => (RE.test(text) ? text : undefined),
});
