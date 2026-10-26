// A numbered list's item: `1. `, its indentation kept; numbered from 1 at
// each depth, so it writes every line at once.
import type { MultilineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const RE = /^\d{1,9}[.)](?:[ \t]+|$)/;

export default (helpers: Helpers): MultilineBlockDefinition => ({
  name: "numbered",
  scope: "block",
  label: "Numbered list",
  icon: helpers.icons.numbered,
  keywords: ["ordered", "list", "seznam", "číslovaný"],
  read: (text) => {
    const m = RE.exec(text);
    return m ? text.slice(m[0].length) : undefined;
  },
  multiline: true,
  write: (items) => {
    const numbers = helpers.numberByIndent(items);
    return items.map(({ text, indent }, i) => `${indent}${numbers[i]}. ${text}`);
  },
});
