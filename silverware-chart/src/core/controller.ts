// The core: a code block read by the formats of its language into a chart's
// model, its source's data read in, drawn by Chart.js with the type's
// configuration; the charts drawn follow their sources as the page is edited
// and the theme as it is switched. Where the block's data are behind its
// source's, the chart says so (Stale) and writes them on request (Update
// data); a module may have them written with an edit of the source
// (`dataEdits`). Knows no module, format, type or source by name: the modules
// give them (and the user's definitions, custom.ts).
import { customFormats } from "../custom.ts";
import { type Block, blockOf, blocksOf } from "./blocks.ts";
import { type ChartConstructor, type Drawn, DrawnCharts } from "./drawn.ts";
import type { ChartFormat } from "./format.ts";
import { type ChartModel, isUnreadable, type Unreadable } from "./model.ts";
import type { ChartModule, ChartSource, ModuleHost, SourceData, TableApi, TextEdit } from "./module.ts";
import { themeOf, watchTheme } from "./theme.ts";
import type { ChartType } from "./type.ts";

/** What the core needs of its host (SilverBullet through the bridge, or a test's) */
export type ControllerEnv = {
  readonly getText: () => Promise<string>;
  readonly getCurrentPage: () => Promise<string>;
  readonly readPage: (name: string) => Promise<string>;
  // One edit of the page open (one undo step): Update data
  readonly replaceRange?: (from: number, to: number, text: string) => Promise<void>;
  // Chart.js, loaded the first time a chart is drawn
  readonly loadChart: () => Promise<ChartConstructor>;
  readonly table?: TableApi;
  // A chart's height where its block says none (CSS)
  readonly height?: string;
};

// The edits of a page come one per key: the charts read their sources once they pause
const FOLLOW_MS = 120;

/** The model with a source's data in place of its block's: the series named and drawn as the block has them, else by their columns */
function withData(model: ChartModel, data: SourceData): ChartModel {
  const names = model.source?.series ?? [];
  return {
    ...model,
    labels: [...data.labels],
    series: data.series.map((values, i) => ({
      ...(model.series[i]?.name ?? names[i] ? { name: model.series[i]?.name ?? names[i] } : {}),
      ...(model.series[i]?.kind ? { kind: model.series[i]!.kind } : {}),
      values: [...values],
    })),
  };
}

/** Whether a source's data are as they were */
function sameSource(a: SourceData, b: SourceData): boolean {
  return a.labels.length === b.labels.length && a.labels.every((label, i) => label === b.labels[i]) && a.series.length === b.series.length && a.series.every((values, i) => values.length === b.series[i]?.length && values.every((v, j) => v === b.series[i]?.[j]));
}

/** Whether the block's data are its source's (no value and 0 alike: a format may write no value as 0) */
function sameData(model: ChartModel, data: SourceData): boolean {
  const value = (v: number | null | undefined) => v ?? 0;
  return (
    model.labels.length === data.labels.length &&
    model.labels.every((label, i) => label === data.labels[i]) &&
    model.series.length === data.series.length &&
    data.series.every((values, i) => {
      const own = model.series[i]?.values ?? [];
      return own.length === values.length && values.every((v, j) => value(v) === value(own[j]));
    })
  );
}

export class Controller {
  private modules: readonly ChartModule[] = [];
  private readonly offers = new Map<string, unknown>();
  private readonly drawn = new DrawnCharts();
  private chart: Promise<ChartConstructor> | undefined;
  private following: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly doc: Document,
    private readonly env: ControllerEnv,
  ) {
    watchTheme(doc, () => void this.drawAnew());
  }

  /** The host a module gets: the core's, with what it offers kept under its name */
  hostFor(name: string): ModuleHost {
    return {
      table: this.env.table,
      readPage: (page) => this.env.readPage(page),
      dataEdits: (text) => this.dataEdits(text),
      offer: (api) => void this.offers.set(name, api),
      offered: <T>(module: string) => this.offers.get(module) as T | undefined,
    };
  }

  setModules(modules: readonly ChartModule[]): void {
    this.modules = modules;
  }

  /** The formats: the user's first (one of a built-in one's name in its place), then the modules' in their order */
  formats(): ChartFormat[] {
    const custom = customFormats();
    const builtIn = this.modules.flatMap((module) => module.formats?.() ?? []);
    const names = new Set(custom.map((format) => format.name));
    return [...custom, ...builtIn.filter((format) => !names.has(format.name))];
  }

  types(): ChartType[] {
    return this.modules.flatMap((module) => module.types?.() ?? []);
  }

  private sources(): ChartSource[] {
    return this.modules.flatMap((module) => module.sources?.() ?? []);
  }

  /** The code blocks' languages some format reads (the library page defines a code widget for each) */
  languages(): string[] {
    return [...new Set(this.formats().flatMap((format) => format.languages))];
  }

  /** A block read as a chart by the first format of its language that knows it; undefined where none does */
  read(language: string, text: string): { format: ChartFormat; model: ChartModel | Unreadable } | undefined {
    for (const format of this.formats()) {
      if (!format.languages.includes(language)) continue;
      let model: ChartModel | Unreadable | undefined;
      try {
        model = format.read(text);
      } catch (e) {
        model = { problem: `${format.label} could not read it: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (model) return { format, model };
    }
    return undefined;
  }

  /**
   * The element a code block shows: its chart, or why it cannot be drawn;
   * undefined where no format reads it as a chart (the library page hands
   * it on to what drew such blocks before)
   */
  async render(language: string, text: string, page: string): Promise<HTMLElement | undefined> {
    const read = this.read(language, text);
    if (!read) return undefined;
    if (isUnreadable(read.model)) return this.problem(read.model.problem);
    const model = read.model;
    const type = this.types().find((t) => t.name === model.type);
    if (!type) return this.problem(`no chart type "${model.type}"`);
    let data: SourceData | undefined;
    if (model.source) {
      const pageText = await this.pageText(page, text);
      const found = await this.sourceData(model, page, pageText, blockOf(pageText, language, text));
      if (!found) return this.problem(`nothing reads the source "${model.source.table}"`);
      if (isUnreadable(found)) return this.problem(found.problem);
      data = found;
    }
    let Chart: ChartConstructor;
    try {
      Chart = await (this.chart ??= this.env.loadChart());
    } catch (e) {
      this.chart = undefined;
      return this.problem(`Chart.js could not be loaded (${e instanceof Error ? e.message : String(e)})`);
    }
    const box = this.doc.createElement("div");
    box.className = "swc-chart";
    box.dataset.swcType = model.type;
    box.style.height = model.height ?? this.env.height ?? "300px";
    const canvas = this.doc.createElement("canvas");
    box.append(canvas);
    let entry: Drawn;
    try {
      const chart = new Chart(canvas, type.config(data ? withData(model, data) : model, themeOf(this.doc)));
      entry = { box, chart, page, model, language, body: text, format: read.format, data, made: Date.now(), seen: false };
      this.drawn.add(entry);
    } catch (e) {
      return this.problem(`the chart could not be drawn: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.markStale(entry, data);
    return box;
  }

  /**
   * The page was edited (its text now): the charts shown on it read their
   * sources again, once the edits pause, and are drawn so in place
   */
  pageModified(text: string, page: string): void {
    clearTimeout(this.following);
    this.following = setTimeout(() => void this.follow(text, page), FOLLOW_MS);
  }

  private async follow(text: string, page: string): Promise<void> {
    for (const entry of this.drawn.shown()) {
      if (entry.page !== page || !entry.model.source) continue;
      const data = await this.sourceData(entry.model, page, text, blockOf(text, entry.language, entry.body));
      // A source that cannot be read now (a table being renamed): the chart stays as it was until it can
      if (!data || isUnreadable(data)) continue;
      // Drawn anew only where its data changed: an edit elsewhere on the page would start its animation with each key
      if (!entry.data || !sameSource(entry.data, data)) {
        entry.data = data;
        this.redraw(entry, withData(entry.model, data));
      }
      this.markStale(entry, data);
    }
  }

  /** The theme switched: every chart shown drawn in its colors (their data as last drawn) */
  private drawAnew(): void {
    for (const entry of this.drawn.shown()) {
      const type = this.types().find((t) => t.name === entry.model.type);
      const current = entry.chart.data as { labels?: unknown[]; datasets?: { data: unknown }[] };
      if (!type) continue;
      const config = type.config(entry.model, themeOf(this.doc));
      // The data as shown (a source's), in the new colors
      config.data.labels = current.labels ?? config.data.labels;
      config.data.datasets.forEach((dataset, i) => {
        if (current.datasets?.[i]) dataset.data = current.datasets[i].data;
      });
      DrawnCharts.redraw(entry, config);
    }
  }

  private redraw(entry: Drawn, model: ChartModel): void {
    const type = this.types().find((t) => t.name === model.type);
    if (type) DrawnCharts.redraw(entry, type.config(model, themeOf(this.doc)));
  }

  /** The chart marked Stale where its block's data are not its source's, with Update data; unmarked where they are */
  private markStale(entry: Drawn, data: SourceData | undefined): void {
    const stale = !!data && !sameData(entry.model, data);
    let mark = entry.box.querySelector<HTMLButtonElement>(".swc-stale");
    if (!stale) {
      mark?.remove();
      return;
    }
    if (mark || !this.env.replaceRange) return;
    mark = this.doc.createElement("button");
    mark.type = "button";
    mark.className = "swc-stale";
    mark.textContent = "Stale: update data";
    mark.title = "The data written in the block are not its source's (other tools draw the block's): write the source's into it";
    mark.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.updateData(entry);
    });
    // (A press on it is not a press on the widget, which would move SilverBullet's cursor into the block)
    mark.addEventListener("mousedown", (e) => e.stopPropagation());
    entry.box.append(mark);
  }

  /** Update data: the chart's block written with its source's data, by its format, as one edit */
  private async updateData(entry: Drawn): Promise<void> {
    const text = await this.env.getText();
    const block = blockOf(text, entry.language, entry.body);
    if (!block) return;
    const edit = await this.blockEdit(block, entry.page, text);
    if (edit) await this.env.replaceRange?.(edit.from, edit.to, edit.text);
  }

  /** The edit that writes a block's data as its source has them, by the block's format; none where they are */
  private async blockEdit(block: Block, page: string, text: string): Promise<TextEdit | undefined> {
    const read = this.read(block.language, block.body);
    if (!read || isUnreadable(read.model) || !read.model.source) return undefined;
    const data = await this.sourceData(read.model, page, text, block);
    if (!data || isUnreadable(data) || sameData(read.model, data)) return undefined;
    const written = read.format.write(withData(read.model, data), block.body);
    return written === block.body ? undefined : { from: block.bodyFrom, to: block.bodyTo, text: written };
  }

  /**
   * The edits bringing every chart of the text up to its source (a module
   * has them written with an edit of a table); a source on another page is
   * left out (that page is not what is written)
   */
  private async dataEdits(text: string): Promise<TextEdit[]> {
    let page = "";
    try {
      page = await this.env.getCurrentPage();
    } catch {
      // Without its name, the page's own sources are still read from the text
    }
    const languages = new Set(this.languages());
    const edits: TextEdit[] = [];
    for (const block of blocksOf(text)) {
      if (!languages.has(block.language)) continue;
      const read = this.read(block.language, block.body);
      if (!read || isUnreadable(read.model) || !read.model.source || read.model.source.table.startsWith("[[")) continue;
      try {
        const edit = await this.blockEdit(block, page, text);
        if (edit) edits.push(edit);
      } catch (e) {
        console.error("Silverware Chart: a chart's data could not be written", e);
      }
    }
    return edits;
  }

  /** The page's text: the editor's while it holds the page (a block of it in there), else the page as saved */
  private async pageText(page: string, block: string): Promise<string> {
    try {
      if ((await this.env.getCurrentPage()) === page) {
        const text = await this.env.getText();
        // A page being opened renders before the editor has its text
        if (text.includes(block)) return text;
      }
      return await this.env.readPage(page);
    } catch {
      return "";
    }
  }

  /** The model's source's data, by the first source that reads its reference; undefined where none does (the block's own data drawn) */
  private async sourceData(model: ChartModel, page: string, text: string, block: Block | undefined): Promise<SourceData | Unreadable | undefined> {
    const source = model.source!;
    for (const reader of this.sources()) {
      let data: SourceData | Unreadable | undefined;
      try {
        data = await reader.read(source, { page, text, block });
      } catch (e) {
        data = { problem: e instanceof Error ? e.message : String(e) };
      }
      if (data) return data;
    }
    return undefined;
  }

  private problem(text: string): HTMLElement {
    const box = this.doc.createElement("div");
    box.className = "swc-chart swc-problem";
    box.textContent = `Silverware Chart: ${text}`;
    return box;
  }
}
