// The formats domain's API for the rest of Silverware Toolbar: which formats
// exist (built-in and custom), and the engines applying them.
export { blockFormatOf, canTurn, turnInto } from "./block.ts";
export { canCodeBlock, inCodeBlock, toggleCodeBlock } from "./codeblock.ts";
export { formatsOf, message } from "./custom.ts";
export type { Format, FormatDefinition } from "./format.ts";
export { HELPERS, type Helpers } from "./helpers.ts";
export { canClear, canFormat, clear, isOn, plainText, toggle } from "./inline.ts";
export { asWord, keptCaret, wordAt } from "./word.ts";
export { BUILT_IN_PROBLEMS, customFormatsAnew, defineCustomFormats, formatById, formatsIn, resetCustomFormats } from "./registry.ts";
