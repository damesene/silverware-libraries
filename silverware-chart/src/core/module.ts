// What a module gives and what the core gives it. The core knows no module,
// no format, no type of chart and no source: the modules fill its registries
// (formats, types, sources) and use each other only through what they offer.
import type { ChartFormat } from "./format.ts";
import type { Source, Unreadable } from "./model.ts";
import type { ChartType } from "./type.ts";

/** A source's data: labels, and a series of values for each of its columns, in their order */
export type SourceData = {
  readonly labels: readonly string[];
  readonly series: readonly (readonly (number | null)[])[];
};

/** Where a chart's data come from instead of its block (a named table) */
export type ChartSource = {
  readonly id: string;
  /**
   * The data on the page, its text as the editor has it: undefined where
   * this source does not read it (another one may), Unreadable where it does
   * but cannot (a table not found), said in the chart's place
   */
  readonly read: (source: Source, page: string, text: string) => Promise<SourceData | Unreadable | undefined>;
};

export type ChartModule = {
  readonly formats?: () => readonly ChartFormat[];
  readonly types?: () => readonly ChartType[];
  readonly sources?: () => readonly ChartSource[];
};

/** What the space offers besides SilverBullet: Silverware Table's public API, where it is installed */
export type TableApi = {
  /** A table formula calculated on a page's text: one value as its text, several as a JSON list of texts, an error as its code */
  readonly evaluate: (formula: string, text: string, page: string) => Promise<string>;
};

export type ModuleHost = {
  /** Silverware Table, where it is installed (else undefined: charts of their blocks' data only) */
  readonly table: TableApi | undefined;
  /** What this module offers the others, under its own name (a module uses another's only so: none imports another) */
  offer(api: unknown): void;
  /** What the module of that name offers; undefined while it is off or offers nothing */
  offered<T>(module: string): T | undefined;
};
