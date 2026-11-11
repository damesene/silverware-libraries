// A task: `- [ ] `, its indentation kept; read with any state SilverBullet
// reads, `[x]` or one of its own (`[IN PROGRESS]`). A task done stays done
// while its line stays a task (lines of the format turned into are left as
// written).
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "task",
  scope: "block",
  label: "Task",
  icon: helpers.icons.task,
  keywords: ["todo", "checkbox", "list", "úkol"],
  read: (text) => {
    const line = helpers.readLine(text);
    return line.kind === "task" ? line.content : undefined;
  },
  write: (text, { indent }) => `${indent}- [ ] ${text}`,
});
