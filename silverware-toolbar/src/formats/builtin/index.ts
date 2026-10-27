// The built-in formats, in the order they are offered (Turn into's choices,
// the inline actions). Only formats here: what they share is beside the folder.
import bold from "./bold.ts";
import bullet from "./bullet.ts";
import code from "./code.ts";
import { heading } from "./heading.ts";
import highlight from "./highlight.ts";
import italic from "./italic.ts";
import link from "./link.ts";
import numbered from "./numbered.ts";
import paragraph from "./paragraph.ts";
import quote from "./quote.ts";
import rule from "./rule.ts";
import strikethrough from "./strikethrough.ts";
import table from "./table.ts";
import task from "./task.ts";
import underline from "./underline.ts";
import wikiLink from "./wikiLink.ts";

export const BUILT_IN_DEFINITIONS = [
  bold,
  italic,
  underline,
  strikethrough,
  highlight,
  code,
  link,
  wikiLink,
  paragraph,
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  bullet,
  numbered,
  task,
  quote,
  table,
  rule,
];

// The block formats in the order a line is read: a rule before a bullet list
// (`- - -`), a task before a bullet list (`- [ ]`), the paragraph last (it
// reads any line); custom formats go before all of them
export const BLOCK_READING_ORDER: readonly string[] = ["rule", "table", "heading1", "heading2", "heading3", "heading4", "heading5", "heading6", "task", "bullet", "numbered", "quote", "paragraph"];
