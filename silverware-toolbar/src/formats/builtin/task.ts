// A task: `- [ ] `, its indentation kept. A task done stays done while its
// line stays a task (lines of the format turned into are left as written).
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const RE = /^[-*+][ \t]+\[[ xX]\](?:[ \t]+|$)/;

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "task",
  scope: "block",
  label: "Task",
  icon: helpers.icons.task,
  keywords: ["todo", "checkbox", "list", "úkol"],
  read: (text) => {
    const m = RE.exec(text);
    return m ? text.slice(m[0].length) : undefined;
  },
  write: (text, { indent }) => `${indent}- [ ] ${text}`,
});
