// The core: a code block read by the formats of its language into a chart's
// model, its source's data read in, drawn by Chart.js with the type's
// configuration; the charts drawn follow their sources as the page is edited
// and the theme as it is switched. Knows no module, format, type or source by
// name: the modules give them (and the user's definitions, custom.ts).
import { customFormats } from "../custom.ts";
import { type ChartConstructor, type Drawn, DrawnCharts } from "./drawn.ts";
import type { ChartFormat } from "./format.ts";
import { type ChartModel, isUnreadable, type Unreadable } from "./model.ts";
import type { ChartModule, ChartSource, ModuleHost, SourceData, TableApi } from "./module.ts";
import { themeOf, watchTheme } from "./theme.ts";
import type { ChartType } from "./type.ts";

/** What the core needs of its host (SilverBullet through the bridge, or the playground) */
export type ControllerEnv = {
  readonly getText: () => Promise<string>;
  readonly getCurrentPage: () => Promise<string>;
  readonly readPage: (name: string) => Promise<string>;
  // Chart.js, loaded the first time a chart is drawn
  readonly loadChart: () => Promise<ChartConstructor>;
  readonly table?: TableApi;
  // A chart's height where its block says none (CSS)
  readonly height?: string;
};

// The edits of a page come one per key: the charts read their sources once they pause
const FOLLOW_MS = 120;

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
    const shown = model.source ? await this.withSource(model, page, await this.pageText(page, text)) : model;
    if (isUnreadable(shown)) return this.problem(shown.problem);
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
    try {
      const chart = new Chart(canvas, type.config(shown, themeOf(this.doc)));
      this.drawn.add({ box, chart, page, model, made: Date.now(), seen: false });
    } catch (e) {
      return this.problem(`the chart could not be drawn: ${e instanceof Error ? e.message : String(e)}`);
    }
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
      const shown = await this.withSource(entry.model, page, text);
      // A source that cannot be read now (a table being renamed): the chart stays as it was until it can
      if (!isUnreadable(shown)) this.redraw(entry, shown);
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

  /** The model with its source's data in place of its block's: the series named as the block names them, else by their columns */
  private async withSource(model: ChartModel, page: string, text: string): Promise<ChartModel | Unreadable> {
    const source = model.source!;
    for (const reader of this.sources()) {
      let data: SourceData | Unreadable | undefined;
      try {
        data = await reader.read(source, page, text);
      } catch (e) {
        data = { problem: e instanceof Error ? e.message : String(e) };
      }
      if (!data) continue;
      if (isUnreadable(data)) return data;
      return {
        ...model,
        labels: data.labels,
        series: data.series.map((values, i) => ({
          name: model.series[i]?.name ?? source.series[i],
          ...(model.series[i]?.kind ? { kind: model.series[i].kind } : {}),
          values,
        })),
      };
    }
    // No source reads it (Silverware Table not installed): the block's own data
    return model;
  }

  private problem(text: string): HTMLElement {
    const box = this.doc.createElement("div");
    box.className = "swc-chart swc-problem";
    box.textContent = `Silverware Chart: ${text}`;
    return box;
  }
}
