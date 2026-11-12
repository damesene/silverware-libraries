// The core: a code block read by the formats of its language into a chart's
// model, its source's data read in, drawn by Chart.js with the type's
// configuration; the charts drawn follow their sources as the page is edited
// and the theme as it is switched. Where the block's data are behind its
// source's, the chart says so (Stale) and writes them on request (Update
// data); a module may have them written with an edit of the source
// (`dataEdits`). Knows no module, format, type or source by name: the modules
// give them (and the user's definitions, custom.ts).
import type { Layout, LayoutProvider } from "../../../shared/layout.ts";
import { customFormats } from "../custom.ts";
import { type Block, blockOf, blocksOf } from "./blocks.ts";
import { type ChartConstructor, chartBox, type Drawn, DrawnCharts } from "./drawn.ts";
import type { ChartFormat } from "./format.ts";
import { type ChartModel, isUnreadable, type Source, type Unreadable } from "./model.ts";
import { type ChartMenuHost, chartMenu } from "./chartmenu.ts";
import type { Candidate, ChartModule, ChartSource, Command, FollowSource, ModuleHost, SourceContext, SourceData, TableApi, TextEdit } from "./module.ts";
import type { Setting } from "./setting.ts";
import { openSettings } from "./settingsdialog.ts";
import { ChartToolbar } from "./toolbar.ts";
import { IterableWeakSet } from "./weakset.ts";
import { themeOf, watchTheme } from "./theme.ts";
import type { ChartType } from "./type.ts";

/** What the core needs of its host (SilverBullet through the bridge, or a test's) */
export type ControllerEnv = {
  readonly getText: () => Promise<string>;
  readonly getCurrentPage: () => Promise<string>;
  readonly readPage: (name: string) => Promise<string>;
  // One edit of the page open (one undo step): Update data
  readonly replaceRange?: (from: number, to: number, text: string) => Promise<void>;
  // The cursor's offset in the page open, and putting it somewhere (Edit source: a block with the cursor in it shows its markdown)
  readonly getCursor?: () => Promise<number>;
  readonly moveCursor?: (at: number) => Promise<void>;
  readonly flash?: (message: string, type?: "info" | "error") => void;
  // One of options picked in the host's own picker (SilverBullet's filter box): its index
  readonly pick?: (label: string, options: readonly { readonly label: string; readonly hint?: string }[]) => Promise<number | undefined>;
  // Chart.js, loaded the first time a chart is drawn
  readonly loadChart: () => Promise<ChartConstructor>;
  readonly table?: TableApi;
  // A chart's height where its block says none (CSS)
  readonly height?: string;
  // Silverware Layout's API where it is installed (else its stand-in): the charts registered with it, laid out at the
  // width their blocks keep (shared/layout.ts)
  readonly layout?: Layout;
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

/** Text copied where the page has no Clipboard API (a page over http): the copy command on a field selected, as Silverware Table does */
function copyByCommand(doc: Document, text: string): void {
  const field = doc.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position: fixed; top: 0; left: 0; opacity: 0;";
  doc.body.append(field);
  field.select();
  const done = doc.execCommand("copy");
  field.remove();
  if (!done) throw new Error("the browser refused to copy");
}

/** A chart's whole block: its text in fences, the language its format reads first */
function fenced(format: ChartFormat, text: string): string {
  return "```" + (format.languages[0] ?? format.name) + "\n" + text + "\n```";
}

/** Whether two references say the same: the table, its labels' column and its values' columns */
function sameReference(a: Source, b: Source): boolean {
  const where = (s: Source) => (s.where ?? []).map((c) => `${c.column}\u0000${c.criterion}`).join("\u0001");
  const rows = (s: Source) => (s.rows ? `${s.rows.from} ${s.rows.count}` : "");
  return a.table === b.table && a.labels === b.labels && a.series.length === b.series.length && a.series.every((name, i) => name === b.series[i]) && where(a) === where(b) && rows(a) === rows(b);
}

/**
 * The model with another reference: a series named as its column was (it
 * followed the column) named as the column is now
 */
function withSource(model: ChartModel, source: Source): ChartModel {
  const was = model.source?.series ?? [];
  return {
    ...model,
    source,
    series: model.series.map((series, i) => (series.name !== undefined && was[i] !== undefined && series.name.toLowerCase() === was[i]!.toLowerCase() && source.series[i] !== undefined ? { ...series, name: source.series[i] } : series)),
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
  // The chart drawn in each box (the toolbar's menu is its)
  private readonly boxes = new WeakMap<HTMLElement, Drawn>();
  // The toolbar of the chart hovered, where its block can be written
  private readonly toolbar: ChartToolbar | undefined;
  private chart: Promise<ChartConstructor> | undefined;
  private following: ReturnType<typeof setTimeout> | undefined;
  private readonly unwatchTheme: () => void;
  // Each run of following the page's edits: a run that a later one started meanwhile writes nothing it read
  private followRun = 0;
  // What shows where a chart's source could not be read, with its block: drawn in its place once it can be
  private readonly waiting = new IterableWeakSet<HTMLElement>();
  private readonly waitingFor = new WeakMap<HTMLElement, { readonly language: string; readonly body: string }>();

  constructor(
    private readonly doc: Document,
    private readonly env: ControllerEnv,
  ) {
    this.unwatchTheme = watchTheme(doc, () => void this.drawAnew());
    env.layout?.register(this.layoutProvider());
    if (env.replaceRange) {
      this.toolbar = new ChartToolbar(doc, (box) => {
        const entry = this.boxes.get(box);
        return entry ? chartMenu(this.menuHost(), entry) : undefined;
      });
    }
  }

  /**
   * The charts as Silverware Layout's widgets: its entries kept in the chart's model (`layout`), which its format writes
   * as it can (Mermaid: `%% layout.<key>`); read from the chart drawn in the widget, written into its block as found in
   * the page now (one edit). A format that keeps no layout drops it: the write says so, nothing written
   */
  private layoutProvider(): LayoutProvider {
    const entryOf = (element: Element) => {
      const box = element.querySelector<HTMLElement>(".swc-chart");
      return box ? this.boxes.get(box) : undefined;
    };
    return {
      name: "silverware-chart",
      selector: ".swc-widget",
      read: (element) => entryOf(element)?.model.layout ?? {},
      write: async (element, changes) => {
        const entry = entryOf(element);
        if (!entry || !this.env.replaceRange) return "this chart cannot be written here";
        const text = await this.env.getText();
        const block = blockOf(text, entry.language, entry.body);
        const read = block && this.read(block.language, block.body);
        if (!block || !read || isUnreadable(read.model)) return "the chart's block is not where it was (edited meanwhile)";
        const layout: Record<string, string> = { ...read.model.layout };
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) delete layout[key];
          else layout[key] = value;
        }
        const { layout: _, ...model } = read.model;
        const written = read.format.write(Object.keys(layout).length ? { ...model, layout } : model, block.body);
        const back = this.read(block.language, written);
        if (!back || isUnreadable(back.model) || JSON.stringify(back.model.layout ?? {}) !== JSON.stringify(layout)) return `the ${read.format.label} format keeps no layout of a chart`;
        if (written !== block.body) await this.env.replaceRange(block.bodyFrom, block.bodyTo, written);
        return undefined;
      },
    };
  }

  /** Gone from the page (another started in its place, Space Lua loaded again): its watching ended, its toolbar out */
  stop(): void {
    this.unwatchTheme();
    this.toolbar?.stop();
    clearTimeout(this.following);
  }

  /** The host a module gets: the core's, with what it offers kept under its name */
  hostFor(name: string): ModuleHost {
    return {
      table: this.env.table,
      readPage: (page) => this.env.readPage(page),
      page: async () => ({ name: await this.env.getCurrentPage(), text: await this.env.getText(), cursor: (await this.env.getCursor?.()) ?? 0 }),
      replaceRange: async (from, to, text) => void (await this.env.replaceRange?.(from, to, text)),
      flash: (message, type) => this.env.flash?.(message, type),
      newBlock: (model) => this.newBlock(model),
      pick: async (label, options) => this.env.pick?.(label, options),
      candidates: (context) => this.candidates(context),
      chartOf: async (source, context) => {
        const model: ChartModel = { type: "bar", labels: [], series: [], source };
        const data = await this.sourceData(model, context.page, context.text, context.block);
        if (!data) return { problem: `nothing reads the source "${source.table}"` };
        return isUnreadable(data) ? data : withData(model, data);
      },
      palette: (index) => {
        const palette = themeOf(this.doc).palette;
        return palette[index % palette.length] ?? "#888888";
      },
      dataEdits: (text, follow) => this.dataEdits(text, follow),
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

  /** The modules' commands (the init page defines them) */
  commands(): Command[] {
    return this.modules.flatMap((module) => module.commands?.() ?? []);
  }

  /** The modules' slash commands (the init page defines them) */
  slashCommands(): Command[] {
    return this.modules.flatMap((module) => module.slashCommands?.() ?? []);
  }

  /** The tables every source offers for a chart at a place of a page's text, each once */
  private async candidates(context: SourceContext): Promise<Candidate[]> {
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const source of this.sources()) {
      for (const candidate of (await source.candidates?.(context).catch(() => [])) ?? []) {
        if (seen.has(candidate.table)) continue;
        seen.add(candidate.table);
        out.push(candidate);
      }
    }
    return out;
  }

  /** The settings every chart has (the modules'), for its settings dialog */
  settings(): Setting[] {
    return this.modules.flatMap((module) => module.settings?.() ?? []);
  }

  types(): ChartType[] {
    return this.modules.flatMap((module) => module.types?.() ?? []);
  }

  private sources(): ChartSource[] {
    return this.modules.flatMap((module) => module.sources?.() ?? []);
  }

  /** The code blocks' languages some format reads (the init page defines a code widget for each) */
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
   * undefined where no format reads it as a chart (the init page hands
   * it on to what drew such blocks before); `pageText` the page's text where
   * it is known (an edit followed), else read
   */
  async render(language: string, text: string, page: string, pageText?: string): Promise<HTMLElement | undefined> {
    const read = this.read(language, text);
    if (!read) return undefined;
    if (isUnreadable(read.model)) return this.problem(read.model.problem);
    const model = read.model;
    const type = this.types().find((t) => t.name === model.type);
    if (!type) return this.problem(`no chart type "${model.type}"`);
    let data: SourceData | undefined;
    if (model.source) {
      const known = pageText ?? (await this.pageText(page, text));
      const found = await this.sourceData(model, page, known, blockOf(known, language, text));
      if (!found) return this.problem(`nothing reads the source "${model.source.table}"`);
      if (isUnreadable(found)) return this.waitFor(this.problem(found.problem, found.choices, { language, body: text, page }), language, text);
      data = found;
    }
    let Chart: ChartConstructor;
    try {
      Chart = await (this.chart ??= this.env.loadChart());
    } catch (e) {
      this.chart = undefined;
      return this.problem(`Chart.js could not be loaded (${e instanceof Error ? e.message : String(e)})`);
    }
    const box = chartBox(this.doc);
    box.className = "swc-chart";
    box.dataset.swcType = model.type;
    box.style.height = model.height ?? this.env.height ?? "300px";
    const canvas = this.doc.createElement("canvas");
    box.append(canvas);
    const entry: Drawn = { box, page, model, language, body: text, format: read.format, data };
    this.boxes.set(box, entry);
    this.toolbar?.watch(box);
    try {
      // Made now, and again where the box comes back after its chart was let go: with the data as last drawn
      box.setUp(
        () => new Chart(canvas, type.config(entry.data ? withData(model, entry.data) : model, themeOf(this.doc))),
        () => this.drawn.add(entry),
        () => this.drawn.remove(entry),
      );
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
    const run = ++this.followRun;
    for (const entry of this.drawn.shown()) {
      if (entry.page !== page || !entry.model.source) continue;
      const data = await this.sourceData(entry.model, page, text, blockOf(text, entry.language, entry.body));
      // (Edits after it read meanwhile: the later run draws them, this one's would be older)
      if (run !== this.followRun) return;
      // A source that cannot be read now (a table being renamed): the chart stays as it was until it can
      if (!data || isUnreadable(data)) continue;
      // Drawn anew only where its data changed: an edit elsewhere on the page would start its animation with each key
      if (!entry.data || !sameSource(entry.data, data)) {
        entry.data = data;
        this.redraw(entry, withData(entry.model, data));
      }
      this.markStale(entry, data);
    }
    // A chart whose source could not be read (a table not named yet, a column renamed): drawn once it can be
    for (const box of this.waiting) {
      const block = this.waitingFor.get(box);
      if (!block || !box.isConnected || !blockOf(text, block.language, block.body)) continue;
      const shown = await this.render(block.language, block.body, page, text);
      if (run !== this.followRun) return;
      if (!shown || shown.classList.contains("swc-problem") || !box.isConnected) continue;
      this.waiting.delete(box);
      box.replaceWith(shown);
    }
  }

  /** A source's problem shown: drawn as the chart in its place once the page's edits let its source be read */
  private waitFor(box: HTMLElement, language: string, body: string): HTMLElement {
    this.waitingFor.set(box, { language, body });
    this.waiting.add(box);
    return box;
  }

  /** The theme switched: every chart shown drawn in its colors (their data as last drawn) */
  private drawAnew(): void {
    // The data as shown (a source's, its series as many as it has), in the new colors
    for (const entry of this.drawn.shown()) this.redraw(entry, entry.data ? withData(entry.model, entry.data) : entry.model);
  }

  private redraw(entry: Drawn, model: ChartModel): void {
    const type = this.types().find((t) => t.name === model.type);
    if (type) DrawnCharts.redraw(entry, type.config(model, themeOf(this.doc)));
  }

  /** The chart marked Stale where its block's data are not its source's, with Update data; unmarked where they are */
  private markStale(entry: Drawn, data: SourceData | undefined): void {
    // (Not where its format would write the block as it is: data it cannot hold, a label it writes otherwise)
    const read = data && !sameData(entry.model, data) ? this.read(entry.language, entry.body) : undefined;
    const stale = !!read && !isUnreadable(read.model) && read.format.write(withData(read.model, data!), entry.body) !== entry.body;
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

  /**
   * The edit that writes a block's data as its source has them, by the
   * block's format; `source` another reference for it (a rename followed, a
   * column picked), written with them; none where nothing changes
   */
  private async blockEdit(block: Block, page: string, text: string, source?: Source): Promise<TextEdit | undefined> {
    const read = this.read(block.language, block.body);
    if (!read || isUnreadable(read.model) || !(source ?? read.model.source)) return undefined;
    const model = source ? withSource(read.model, source) : read.model;
    const data = await this.sourceData(model, page, text, block);
    const readable = data && !isUnreadable(data) ? data : undefined;
    // Its data written where they can be read; a reference changed, written whatever its data
    if (model === read.model && (!readable || sameData(model, readable))) return undefined;
    const written = read.format.write(readable ? withData(model, readable) : model, block.body);
    return written === block.body ? undefined : { from: block.bodyFrom, to: block.bodyTo, text: written };
  }

  /**
   * The edits bringing every chart of the text up to its source (a module
   * has them written with an edit of a table), `follow` its references to
   * what the edit renamed; a source on another page is left out (that page is
   * not what is written)
   */
  private async dataEdits(text: string, follow?: FollowSource): Promise<TextEdit[]> {
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
        const followed = follow?.(read.model.source, block, text);
        const edit = await this.blockEdit(block, page, text, followed && !sameReference(followed, read.model.source) ? followed : undefined);
        if (edit) edits.push(edit);
      } catch (e) {
        console.error("Silverware Chart: a chart's data could not be written", e);
      }
    }
    return edits;
  }

  /** A block's source written anew (a column picked where its reference found none), with its data where they can be read */
  private async pick(language: string, body: string, page: string, source: Source): Promise<void> {
    const text = await this.env.getText();
    const block = blockOf(text, language, body);
    if (!block) return;
    const edit = await this.blockEdit(block, page, text, source);
    if (edit) await this.env.replaceRange?.(edit.from, edit.to, edit.text);
  }

  /** The format new charts are written in: the first built-in one (the setting of a default, later), else the first */
  private defaultFormat(): ChartFormat | undefined {
    return this.modules.flatMap((module) => module.formats?.() ?? [])[0] ?? this.formats()[0];
  }

  /** A chart's whole block in the default format */
  private newBlock(model: ChartModel): string {
    const format = this.defaultFormat();
    if (!format) throw new Error("no format to write a chart in (the mermaid module is off)");
    return fenced(format, format.write(model));
  }

  /** What the chart's menu does */
  private menuHost(): ChartMenuHost {
    // The chart's block in the page now, with the page's text and the model it holds
    const located = async (entry: Drawn) => {
      const text = await this.env.getText();
      const block = blockOf(text, entry.language, entry.body);
      const read = block && this.read(block.language, block.body);
      if (!block || !read || isUnreadable(read.model)) {
        this.env.flash?.("Silverware Chart: the chart's block is not where it was (edited meanwhile): nothing was written", "error");
        return undefined;
      }
      return { text, block, model: read.model, format: read.format };
    };
    // A located block written with a model, where that changes it
    const write = async (at: NonNullable<Awaited<ReturnType<typeof located>>>, model: ChartModel) => {
      const written = at.format.write(model, at.block.body);
      if (written !== at.block.body) await this.env.replaceRange?.(at.block.bodyFrom, at.block.bodyTo, written);
    };
    return {
      doc: this.doc,
      types: () => this.types(),
      formats: () => this.formats(),
      settings: async (entry, tab) => {
        const at = await located(entry);
        if (!at) return;
        const type = this.types().find((t) => t.name === at.model.type);
        if (!type) return;
        // The source's columns, as the page's sources offer its table (one on another page: none, its series as the block has them)
        const source = at.model.source;
        const candidate = source && (await this.candidates({ page: entry.page, text: at.text, block: at.block })).find((c) => c.table === source.table);
        openSettings(this.doc, {
          model: at.model,
          type,
          format: at.format,
          settings: this.settings(),
          ...(candidate ? { columns: candidate.columns } : {}),
          ...(tab ? { tab } : {}),
          save: async (change) => {
            const now = await located(entry);
            if (!now) return;
            const model = change(now.model);
            // With a source, its data as the settings now read it (other columns, rows, conditions)
            const data = model.source ? await this.sourceData(model, entry.page, now.text, now.block) : undefined;
            await write(now, data && !isUnreadable(data) ? withData(model, data) : model);
          },
        });
      },
      entries: (entry) =>
        this.modules.flatMap(
          (module) =>
            module.menuEntries?.({
              model: entry.model,
              type: this.types().find((t) => t.name === entry.model.type),
              rewrite: async (change) => {
                const at = await located(entry);
                if (at) await write(at, change(at.model));
              },
            }) ?? [],
        ),
      candidates: async (entry) => {
        const text = await this.pageText(entry.page, entry.body);
        return this.candidates({ page: entry.page, text, block: blockOf(text, entry.language, entry.body) });
      },
      rewrite: async (entry, change) => {
        const at = await located(entry);
        if (at) await write(at, change(at.model));
      },
      pick: async (entry, source) => {
        const at = await located(entry);
        if (!at) return undefined;
        const edit = await this.blockEdit(at.block, entry.page, at.text, source);
        if (!edit) return entry;
        await this.env.replaceRange?.(edit.from, edit.to, edit.text);
        // The chart as its block is now (what comes next finds the block by its text)
        const read = this.read(entry.language, edit.text);
        return read && !isUnreadable(read.model) ? { ...entry, body: edit.text, model: read.model } : undefined;
      },
      convert: async (entry, format) => {
        const at = await located(entry);
        if (!at) return;
        await this.env.replaceRange?.(at.block.from, at.block.to, fenced(format, format.write(at.model)));
      },
      editSource: async (entry) => {
        const at = await located(entry);
        if (at) await this.env.moveCursor?.(at.block.bodyFrom);
      },
      copySource: async (entry) => {
        const at = await located(entry);
        if (!at) return;
        const text = at.text.slice(at.block.from, at.block.to);
        const clipboard = this.doc.defaultView?.navigator.clipboard;
        try {
          if (clipboard?.writeText) await clipboard.writeText(text);
          else copyByCommand(this.doc, text);
          this.env.flash?.("Chart's source copied");
        } catch (e) {
          this.env.flash?.(`Silverware Chart: the source could not be copied (${e instanceof Error ? e.message : String(e)})`, "error");
        }
      },
      reload: async (entry) => {
        if (entry.model.source) {
          const text = await this.pageText(entry.page, entry.body);
          const data = await this.sourceData(entry.model, entry.page, text, blockOf(text, entry.language, entry.body));
          if (data && !isUnreadable(data)) {
            entry.data = data;
            this.markStale(entry, data);
          }
        }
        entry.box.remake();
      },
      copyImage: (entry) => {
        const view = this.doc.defaultView as (Window & { ClipboardItem?: typeof ClipboardItem }) | null;
        const clipboard = view?.navigator.clipboard;
        const canvas = entry.box.querySelector("canvas");
        if (!clipboard?.write || !view?.ClipboardItem || !canvas) return undefined;
        const Item = view.ClipboardItem;
        return async () => {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!blob) return;
          try {
            await clipboard.write([new Item({ "image/png": blob })]);
            this.env.flash?.("Chart copied as an image");
          } catch (e) {
            this.env.flash?.(`Silverware Chart: the chart could not be copied (${e instanceof Error ? e.message : String(e)})`, "error");
          }
        };
      },
    };
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
      if (data) return isUnreadable(data) ? data : this.drawable(model, data);
    }
    return undefined;
  }

  /** A source's data as the chart's type draws them: as many series as it has (a pie one), so its block can hold them all */
  private drawable(model: ChartModel, data: SourceData): SourceData {
    const limit = this.types().find((t) => t.name === model.type)?.seriesLimit;
    return limit === undefined || data.series.length <= limit ? data : { ...data, series: data.series.slice(0, limit) };
  }

  /** What shows where a chart cannot be drawn: why, and the sources it could have instead (`choices`), a click writing one into its block */
  private problem(text: string, choices?: Unreadable["choices"], block?: { language: string; body: string; page: string }): HTMLElement {
    const box = this.doc.createElement("div");
    box.className = "swc-chart swc-problem";
    box.append(`Silverware Chart: ${text}`);
    if (choices?.length && block && this.env.replaceRange) {
      const row = box.appendChild(this.doc.createElement("div"));
      row.className = "swc-choices";
      row.append("Use: ");
      for (const choice of choices) {
        const button = row.appendChild(this.doc.createElement("button"));
        button.type = "button";
        button.className = "swc-choice";
        button.textContent = choice.label;
        // (A press on it is not a press on the widget, which would move SilverBullet's cursor into the block)
        button.addEventListener("mousedown", (e) => e.stopPropagation());
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          void this.pick(block.language, block.body, block.page, choice.source);
        });
      }
    }
    return box;
  }
}
