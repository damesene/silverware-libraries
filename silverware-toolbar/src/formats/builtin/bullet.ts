// A bullet list's item: `- `, its indentation kept (a nested item stays nested).
// Read by its list marker (a line's `item`), not its kind: a task's line
// (`- [x] a`) or a rule's (`- - -`) is a bullet's too where a format of the
// user's took the task's or the rule's place and leaves it.
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "bullet",
  scope: "block",
  label: "Bullet list",
  icon: helpers.icons.bullet,
  keywords: ["unordered", "list", "seznam", "odrážky"],
  read: (text) => {
    const item = helpers.readLine(text).item;
    return item?.kind === "bullet" ? item.content : undefined;
  },
  write: (text, { indent }) => `${indent}- ${text}`,
});
