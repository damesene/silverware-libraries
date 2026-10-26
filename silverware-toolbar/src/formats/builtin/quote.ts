// A quote: `> `.
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const RE = /^>[ \t]?/;

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "quote",
  scope: "block",
  label: "Quote",
  icon: helpers.icons.quote,
  keywords: ["blockquote", "citace"],
  read: (text) => {
    const m = RE.exec(text);
    return m ? text.slice(m[0].length) : undefined;
  },
  write: (text) => `> ${text}`,
});
