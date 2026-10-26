// A bullet list's item: `- `, its indentation kept (a nested item stays nested).
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const RE = /^[-*+](?:[ \t]+|$)/;

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "bullet",
  scope: "block",
  label: "Bullet list",
  icon: helpers.icons.bullet,
  keywords: ["unordered", "list", "seznam", "odrážky"],
  read: (text) => {
    const m = RE.exec(text);
    return m ? text.slice(m[0].length) : undefined;
  },
  write: (text, { indent }) => `${indent}- ${text}`,
});
