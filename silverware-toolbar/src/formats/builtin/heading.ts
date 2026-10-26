// Headings 1 to 6: `#` as many times as the level. Turn into offers 1 to 3,
// the others are read (so they can be turned into another block).
import type { LineBlockDefinition } from "../format.ts";
import type { Helpers } from "../helpers.ts";

const OFFERED: Readonly<Record<number, readonly string[]>> = {
  1: ["title", "h1", "nadpis"],
  2: ["subtitle", "h2", "nadpis"],
  3: ["h3", "nadpis"],
};

export const heading =
  (level: 1 | 2 | 3 | 4 | 5 | 6) =>
  (helpers: Helpers): LineBlockDefinition => {
    const re = new RegExp(`^#{${level}}(?:[ \\t]+|$)`);
    const keywords = OFFERED[level];
    return {
      name: `heading${level}`,
      scope: "block",
      ...(keywords ? { label: `Heading ${level}`, icon: helpers.icons[`heading${level as 1 | 2 | 3}`], keywords } : {}),
      read: (text) => {
        const m = re.exec(text);
        return m ? text.slice(m[0].length) : undefined;
      },
      // A heading is not indented
      write: (text) => `${"#".repeat(level)} ${text}`,
    };
  };
