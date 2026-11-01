// What a module gives and what the core gives it. The core knows no module,
// no format, no type of chart and no source: the modules fill its registries
// (formats, types, sources) and use each other only through what they offer.
import type { Block } from "./blocks.ts";
import type { ChartFormat } from "./format.ts";
import type { Source, Unreadable } from "./model.ts";
import type { ChartType } from "./type.ts";

/** A source's data: labels, and a series of values for each of its columns, in their order */
export type SourceData = {
  readonly labels: readonly string[];
  readonly series: readonly (readonly (number | null)[])[];
};

/** Where a source is read: the chart's page, its text as the editor has it, the chart's block in it */
export type SourceContext = {
  readonly page: string;
  readonly text: string;
  // The chart's block in the text (undefined: not found there, as for a page being opened)
  readonly block: Block | undefined;
};

/** Where a chart's data come from instead of its block (a table) */
export type ChartSource = {
  readonly id: string;
  /**
   * The data a source reference says: undefined where this source does not
   * read such references (another one may), Unreadable where it does but
   * cannot (a table not found), said in the chart's place
   */
  readonly read: (source: Source, context: SourceContext) => Promise<SourceData | Unreadable | undefined>;
};

export type ChartModule = {
  readonly formats?: () => readonly ChartFormat[];
  readonly types?: () => readonly ChartType[];
  readonly sources?: () => readonly ChartSource[];
};

/** An edit of a page's text */
export type TextEdit = { readonly from: number; readonly to: number; readonly text: string };

/** A table as Silverware Table gives it (silverware.table.tables) */
export type NamedTable = {
  readonly name?: string;
  readonly from: number;
  readonly to: number;
  readonly columns: readonly { readonly name: string; readonly key: string }[];
  readonly rows: readonly (readonly string[])[];
};

/** Silverware Table's public API, where it is installed */
export type TableApi = {
  /** The tables of a markdown text, with their names */
  readonly tables: (text: string) => Promise<readonly NamedTable[]>;
  /** A function told of each of its writes, the page's text as the write leaves it, its edits written with it */
  readonly onWrite: (listener: (text: string) => Promise<readonly TextEdit[]>) => void;
};

export type ModuleHost = {
  /** Silverware Table, where it is installed (else undefined) */
  readonly table: TableApi | undefined;
  /** A page's text as saved */
  readPage(name: string): Promise<string>;
  /**
   * The edits that bring the data of every chart of a page's text up to its
   * source's, each block written by its format (none where all are): what a
   * write of a table writes with it
   */
  dataEdits(text: string): Promise<TextEdit[]>;
  /** What this module offers the others, under its own name (a module uses another's only so: none imports another) */
  offer(api: unknown): void;
  /** What the module of that name offers; undefined while it is off or offers nothing */
  offered<T>(module: string): T | undefined;
};
