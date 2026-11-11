// A quote: `> `.
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

export default (helpers: Helpers): LineBlockDefinition => ({
  name: "quote",
  scope: "block",
  label: "Quote",
  icon: helpers.icons.quote,
  keywords: ["blockquote", "citace"],
  read: (text) => {
    const line = helpers.readLine(text);
    return line.kind === "quote" ? line.content : undefined;
  },
  write: (text) => `> ${text}`,
});
