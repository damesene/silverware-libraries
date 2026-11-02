// What a module gives and what the core gives it. The core knows no module,
// no format, no type of chart and no source: the modules fill its registries
// (formats, types, sources) and use each other only through what they offer.
import type { Block } from "./blocks.ts";
import type { ChartFormat } from "./format.ts";
import type { ChartModel, Source, Unreadable } from "./model.ts";
import type { Setting } from "./setting.ts";
import type { MenuItem } from "./toolbar.ts";
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

/** A table a chart could draw, as the Data menu offers it: its reference (source:), and its columns */
export type Candidate = {
  readonly label: string;
  readonly table: string;
  // Where the table starts in the page's text (one table offered by several sources: by its place and by its name)
  readonly at: number;
  // Each column's name, and whether its cells are numbers (a series' column offered ticked)
  readonly columns: readonly { readonly name: string; readonly numeric: boolean }[];
};

/**
 * A table's columns as a chart's source: its first column of no numbers the
 * labels, its other columns of numbers the values (where it has none: all its
 * other columns); what Data, Insert chart and /chart draw a table picked as
 */
export function sourceOfColumns(table: string, columns: Candidate["columns"]): Source {
  const x = columns.find((c) => !c.numeric)?.name;
  const numbers = columns.filter((c) => c.numeric && c.name !== x).map((c) => c.name);
  return { table, ...(x ? { x } : {}), series: numbers.length ? numbers : columns.filter((c) => c.name !== x).map((c) => c.name) };
}

/** Where a chart's data come from instead of its block (a table) */
export type ChartSource = {
  readonly id: string;
  /** The tables of the chart's page this source can read, for the Data menu */
  readonly candidates?: (context: SourceContext) => Promise<readonly Candidate[]>;
  /**
   * The data a source reference says: undefined where this source does not
   * read such references (another one may), Unreadable where it does but
   * cannot (a table not found), said in the chart's place
   */
  readonly read: (source: Source, context: SourceContext) => Promise<SourceData | Unreadable | undefined>;
};

/** A command of a module's (as SilverBullet lists it: "Silverware Chart: Insert chart"; a slash command by its word: "chart") */
export type Command = {
  readonly name: string;
  readonly description?: string;
  readonly run: () => unknown;
};

export type ChartModule = {
  readonly commands?: () => readonly Command[];
  readonly slashCommands?: () => readonly Command[];
  // Settings of every chart, for the settings dialog (a type of chart gives its own: ChartType.settings)
  readonly settings?: () => readonly Setting[];
  // Entries of the chart's ⋯ menu (each in its group: MENU_GROUPS)
  readonly menuEntries?: (chart: ChartHandle) => readonly MenuEntry[];
  readonly formats?: () => readonly ChartFormat[];
  readonly types?: () => readonly ChartType[];
  readonly sources?: () => readonly ChartSource[];
};

/** The groups of the chart's ⋯ menu, in their order: what the chart is, its data, its source, copies, how it is shown */
export const MENU_GROUPS = ["chart", "data", "source", "copy", "view"] as const;
export type MenuGroup = (typeof MENU_GROUPS)[number];

/** An entry of the chart's menu: its item, in a group (by `order` within it, less first) */
export type MenuEntry = { readonly group: MenuGroup; readonly order?: number; readonly item: MenuItem };

/** The chart a menu is about, as a module's entries see it: its model as its block has it, the block written anew */
export type ChartHandle = {
  readonly model: ChartModel;
  readonly type: ChartType | undefined;
  rewrite(change: (model: ChartModel) => ChartModel): Promise<void>;
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

/** A table one of Silverware Table's writes wrote, as its context tells it: its name now, a column's name now */
export type WrittenTable = {
  readonly name: string | undefined;
  column(before: string): string | undefined;
};

/** What one of Silverware Table's writes did, as its listeners may ask */
export type WriteContext = {
  renamed(): boolean;
  table(before: string): WrittenTable | undefined;
  tableAt(at: number): WrittenTable | undefined;
};

/** Silverware Table's public API, where it is installed */
export type TableApi = {
  /** The tables of a markdown text, with their names */
  readonly tables: (text: string) => Promise<readonly NamedTable[]>;
  /** A function told of each of its writes, the page's text as the write leaves it and what the write did, its edits written with it */
  readonly onWrite: (listener: (text: string, context: WriteContext) => Promise<readonly TextEdit[]>) => void;
};

/** A source reference as an edit made it (a table or a column renamed): the same where it is none of its business */
export type FollowSource = (source: Source, block: Block, text: string) => Source;

export type ModuleHost = {
  /** Silverware Table, where it is installed (else undefined) */
  readonly table: TableApi | undefined;
  /** A page's text as saved */
  readPage(name: string): Promise<string>;
  /** The page open: its name, its text, the cursor's offset in it */
  page(): Promise<{ readonly name: string; readonly text: string; readonly cursor: number }>;
  /** One edit of the page open (one undo step) */
  replaceRange(from: number, to: number, text: string): Promise<void>;
  /** A notification */
  flash(message: string, type?: "info" | "error"): void;
  /** A chart's whole block (its fences too) in the format new charts are written in */
  newBlock(model: ChartModel): string;
  /** The color of the series (or slice) at an index where the chart says none (the theme's palette) */
  palette(index: number): string;
  /** One of options picked in the host's own picker (SilverBullet's); its index, undefined where none was */
  pick(label: string, options: readonly { readonly label: string; readonly hint?: string }[]): Promise<number | undefined>;
  /** The tables every source offers for a chart at a place of a page's text */
  candidates(context: SourceContext): Promise<readonly Candidate[]>;
  /** A bar chart of a source's data, read at a place of a page's text (the series named by their columns), or why it cannot be */
  chartOf(source: Source, context: SourceContext): Promise<ChartModel | Unreadable>;
  /**
   * The edits that bring the data of every chart of a page's text up to its
   * source's, each block written by its format (none where all are): what a
   * write of a table writes with it; `follow` the references to what the
   * write renamed, written with them
   */
  dataEdits(text: string, follow?: FollowSource): Promise<TextEdit[]>;
  /** What this module offers the others, under its own name (a module uses another's only so: none imports another) */
  offer(api: unknown): void;
  /** What the module of that name offers; undefined while it is off or offers nothing */
  offered<T>(module: string): T | undefined;
};
