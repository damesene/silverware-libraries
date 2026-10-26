// The shape of a format: how a block (a heading, a list's item) or an inline
// format (bold, a link) is read and written in markdown. Built-in formats
// (builtin/) and the user's (custom.ts, from Space Lua) have it alike: a
// definition is data and functions, the engines (block.ts, inline.ts) apply
// it and know no format by name.

/** One side of the selection on its line (`before`: the line's text up to it, after its block marker; `after`: from it to the line's end) */
export type Side = {
  readonly text: string;
  /** What touches the selection: a string, a regex's match (the engine anchors it at the selection) or so many characters; else undefined */
  touching(what: string | RegExp | number): string | undefined;
};

/** What an inline format's `read` gets besides the text selected */
export type ReadContext = { readonly index: number; readonly before: Side; readonly after: Side };

/**
 * What an inline format's `read` gives when it recognizes the format: the
 * plain text, and where the format reaches past the selection, the parts of
 * `before` (`start`) and `after` (`end`) it covers
 */
export type Found = string | { readonly text: string; readonly start?: string; readonly end?: string };

/** A line a block format writes: its index among the lines selected, the indentation before its marker */
export type BlockInfo = { readonly index: number; readonly indent: string };
export type BlockItem = BlockInfo & { readonly text: string };

/** What `afterWrite` gets: the text written, and the core's editor (positions relative to that text) */
export type Written = { readonly text: string };
export type FormatEditor = { select(from: number, to: number): void };

type Common = {
  readonly name: string;
  // Offered (a Turn into choice, an action) only with a label
  readonly label?: string;
  readonly icon?: string;
  readonly group?: string;
  readonly keywords?: readonly string[];
  readonly afterWrite?: (written: Written, editor: FormatEditor) => void;
};

/**
 * A block format: a line's prefix (`marker`, the indentation dropped), or
 * `read` (the line's text after its indentation → its plain text) and
 * `write`. Without `write`: recognized, its lines left as they are (a table,
 * a rule).
 */
export type LineBlockDefinition = Common & {
  readonly scope: "block";
  readonly marker?: string;
  readonly read?: (text: string, info: BlockInfo) => string | undefined;
  readonly multiline?: false;
  readonly write?: (text: string, info: BlockInfo) => string;
};

/** A block format whose `write` gets every line, as items, and gives their lines (a numbered list counts them) */
export type MultilineBlockDefinition = Common & {
  readonly scope: "block";
  readonly marker?: string;
  readonly read?: (text: string, info: BlockInfo) => string | undefined;
  readonly multiline: true;
  readonly write: (items: readonly BlockItem[]) => readonly string[];
};

export type BlockDefinition = LineBlockDefinition | MultilineBlockDefinition;

/**
 * An inline format: the markers around the text (`marker`, the first one
 * written, every one read: bold's `**` and `__`), or `read` and `write`;
 * `literal`: its content is not formatted (code).
 */
export type InlineDefinition = Common & {
  readonly scope: "inline";
  readonly marker?: string | readonly string[];
  readonly literal?: boolean;
  readonly read?: (text: string, context: ReadContext) => Found | undefined;
  readonly write?: (text: string, info: { readonly index: number }) => string;
};

export type FormatDefinition = BlockDefinition | InlineDefinition;

/** A format as the engines use it: every definition checked and completed (custom.ts) */
export type Format = {
  readonly id: string;
  readonly name: string;
  readonly scope: "block" | "inline";
  readonly label: string | undefined;
  readonly icon: string;
  readonly group: string | undefined;
  readonly keywords: readonly string[];
  // Inline: the markers, the first one written (undefined: read and write)
  readonly markers: readonly string[] | undefined;
  readonly literal: boolean;
  readonly multiline: boolean;
  readonly readBlock?: (text: string, info: BlockInfo) => string | undefined;
  readonly readInline?: (text: string, context: ReadContext) => Found | undefined;
  readonly writeLine?: (text: string, info: BlockInfo) => string;
  readonly writeLines?: (items: readonly BlockItem[]) => readonly string[];
  readonly writeInline?: (text: string, info: { readonly index: number }) => string;
  readonly afterWrite?: (written: Written, editor: FormatEditor) => void;
};
