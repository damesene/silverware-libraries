// What a converter of the user's is given (`silverware.database.defineConverters`
// of a function: its HELPERS), the built-in converters' own parts: markdown
// read as SilverBullet reads it (a line's block, a text's blocks as a tree, a
// line's marks), a text made plain, values read and their property inferred,
// a key made of a label, attributes written; and the tasks converter, to build
// on. Of no kind of block: a converter of a table, a list or sections uses the
// same as the tasks converter does.
import { readLine } from "../../../shared/markdown/blockline.ts";
import { allBlocks, readBlocks } from "../../../shared/markdown/blocks.ts";
import { escapedAttributes, inlineMarks } from "../../../shared/markdown/inline.ts";
import { writeAttribute, writeTaskLine } from "../../../shared/markdown/task.ts";
import { keyFromLabel } from "../domain/keys.ts";
import { labelOfKey } from "../domain/loose.ts";
import { TASKS_CONVERTER } from "./builtin/tasks.ts";
import { inferProperty } from "./infer.ts";
import { joinedValues, plainText, readValue } from "./values.ts";

export const CONVERTER_HELPERS = Object.freeze({
  readLine,
  readBlocks,
  allBlocks,
  inlineMarks,
  plainText,
  readValue,
  joinedValues,
  inferProperty,
  keyFromLabel,
  labelOfKey,
  writeAttribute,
  writeTaskLine,
  escapedAttributes,
  tasks: TASKS_CONVERTER,
});
