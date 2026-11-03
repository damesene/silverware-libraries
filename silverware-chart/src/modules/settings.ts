// The settings module: the settings every chart may have, for the settings
// dialog (core/settingsdialog.ts), which shows each where the chart has what
// it needs: the title, height and legend; stacked, horizontal and smooth; its
// source's labels, rows and conditions; the axes' titles and range; each
// series' name, color and kind (with a source: each column of its table,
// drawn or not), each slice's color.
import { baseKind, type ChartModel, type Condition, LEGEND_PLACES, type LegendPlace, type Series, type SeriesKind, type Source } from "../core/model.ts";
import type { ChartModule, ModuleHost } from "../core/module.ts";
import type { ItemSetting, Setting, SettingContext, SettingValue } from "../core/setting.ts";

const text = (value: SettingValue): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const number = (value: SettingValue): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const same = (a: string | undefined, b: string | undefined) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** The model with a field set, or taken off where it has no value */
function withField<K extends keyof ChartModel>(model: ChartModel, key: K, value: ChartModel[K] | undefined): ChartModel {
  const { [key]: _was, ...rest } = model;
  return (value === undefined ? rest : { ...rest, [key]: value }) as ChartModel;
}

/** An axis' field set (its title, its range's ends), the axis gone where it holds nothing */
function withAxis(model: ChartModel, axis: "x" | "y", field: "title" | "min" | "max", value: string | number | undefined): ChartModel {
  const { [field]: _was, ...rest } = model[axis] ?? {};
  const next = value === undefined ? rest : { ...rest, [field]: value };
  return withField(model, axis, Object.keys(next).length ? next : undefined);
}

/** A series' field set (its name, its kind), the others as they were */
function withSeries(model: ChartModel, index: number, change: (series: Series) => Series): ChartModel {
  return index < 0 ? model : { ...model, series: model.series.map((series, i) => (i === index ? change(series) : series)) };
}

/** The source's field set, the model without a source as it is */
function withSource(model: ChartModel, change: (source: Source) => Source): ChartModel {
  return model.source ? { ...model, source: change(model.source) } : model;
}

const KIND_LABELS: Readonly<Record<SeriesKind, string>> = { bar: "Bars", line: "Line", area: "Area", point: "Points", step: "Steps" };

/** A color written for the series (or slice) at `index`, the others as they show (the palette's) where none was written */
function withColor(model: ChartModel, index: number, value: SettingValue, count: number, palette: (i: number) => string): ChartModel {
  if (index < 0) return model;
  const colors = Array.from({ length: count }, (_, i) => model.colors?.[i] ?? palette(i));
  colors[index] = text(value) ?? palette(index);
  return { ...model, colors };
}

/** Which series a column of the source's table is drawn as (-1: not drawn) */
const seriesOf = (model: ChartModel, column: string | undefined) => (model.source?.series ?? []).findIndex((name) => same(name, column));

/**
 * The model with a column of the source's table drawn or not: the series in
 * the table's order, each keeping its name, kind and color (a color written
 * for one only where the chart's colors are written)
 */
function withColumnDrawn(model: ChartModel, column: string, on: boolean, context: SettingContext, palette: (i: number) => string): ChartModel {
  const source = model.source;
  if (!source || !context.columns) return model;
  const was = source.series;
  const all = context.columns.map((c) => c.name).filter((name) => (same(name, column) ? on : was.some((s) => same(s, name))));
  // A type of fewer series (a pie): the column switched on in place of others, the first of them kept where there is room
  const limit = context.type.seriesLimit ?? Infinity;
  const kept = new Set([...(on ? all.filter((name) => same(name, column)) : []), ...all.filter((name) => !same(name, column))].slice(0, limit));
  const drawn = all.filter((name) => kept.has(name));
  const old = (name: string) => was.findIndex((s) => same(s, name));
  // (A type of slices colors them, not its series: its colors stay)
  const seriesColors = (context.type.capabilities ?? []).includes("series");
  return {
    ...model,
    source: { ...source, series: drawn },
    series: drawn.map((name) => model.series[old(name)] ?? { name, values: [] }),
    ...(model.colors && seriesColors ? { colors: drawn.map((name, i) => (old(name) >= 0 ? (model.colors?.[old(name)] ?? palette(i)) : palette(i))) } : {}),
  };
}

const ROWS_CHOICES = [
  { value: "", label: "All" },
  { value: "first", label: "The first" },
  { value: "last", label: "The last" },
];

/** The common settings; `palette` the colors series take where the chart says none */
export function commonSettings(palette: (i: number) => string): readonly Setting[] {
  const hasSource = (m: ChartModel, context: SettingContext) => !!m.source && !!context.columns;
  const columnName = (context: SettingContext, i: number) => context.columns?.[i]?.name;
  const kind = (each: "series" | "columns"): ItemSetting => ({
    key: "series.kind",
    label: "Drawn as",
    tab: "Series",
    control: "choice",
    each,
    needs: "series",
    when: (_m, context) => !!context.type.kinds?.length,
    choices: (context) => (context.type.kinds ?? []).map((k) => ({ value: k, label: KIND_LABELS[k] })),
    get: (m, i, context) => m.series[each === "series" ? i : seriesOf(m, columnName(context, i))]?.kind ?? baseKind(m.type) ?? "",
    // The type's own kind written as none: the series drawn as the type draws its series
    set: (m, i, v, context) =>
      withSeries(m, each === "series" ? i : seriesOf(m, columnName(context, i)), ({ kind: _kind, ...series }) => (v && v !== m.type ? { ...series, kind: v as SeriesKind } : series)),
  });
  const name = (each: "series" | "columns"): ItemSetting => ({
    key: "series.name",
    label: "Name",
    tab: "Series",
    control: "text",
    each,
    needs: "series",
    get: (m, i, context) => {
      const at = each === "series" ? i : seriesOf(m, columnName(context, i));
      return m.series[at]?.name ?? m.source?.series[at] ?? columnName(context, i) ?? "";
    },
    set: (m, i, v, context) =>
      withSeries(m, each === "series" ? i : seriesOf(m, columnName(context, i)), ({ name: _name, ...series }) => {
        const written = text(v);
        return written ? { ...series, name: written } : series;
      }),
  });
  const color = (each: "series" | "columns" | "labels"): ItemSetting => ({
    key: each === "labels" ? "slice.color" : "series.color",
    label: "Color",
    tab: each === "labels" ? "Slices" : "Series",
    control: "color",
    each,
    needs: each === "labels" ? "slices" : "series",
    get: (m, i, context) => {
      const at = each === "columns" ? seriesOf(m, columnName(context, i)) : i;
      return at < 0 ? palette(i) : (m.colors?.[at] ?? palette(at));
    },
    set: (m, i, v, context) => {
      const at = each === "columns" ? seriesOf(m, columnName(context, i)) : i;
      return withColor(m, at, v, each === "labels" ? m.labels.length : m.series.length, palette);
    },
  });
  return [
    { key: "title", label: "Title", tab: "General", control: "text", get: (m) => m.title ?? "", set: (m, v) => withField(m, "title", text(v)) },
    { key: "height", label: "Height", hint: "As CSS writes it: 300px, 20em (empty: the setting's)", tab: "General", control: "text", get: (m) => m.height ?? "", set: (m, v) => withField(m, "height", text(v)) },
    {
      key: "legend",
      label: "Legend",
      tab: "General",
      control: "choice",
      choices: [{ value: "", label: "Where the type puts it" }, ...LEGEND_PLACES.map((place) => ({ value: place, label: place === "none" ? "None" : place[0]!.toUpperCase() + place.slice(1) }))],
      get: (m) => m.legend ?? "",
      set: (m, v) => withField(m, "legend", (LEGEND_PLACES as readonly string[]).includes(String(v)) ? (v as LegendPlace) : undefined),
    },
    { key: "stacked", label: "Stacked", hint: "The series on top of each other", tab: "General", control: "switch", needs: "stacked", get: (m) => !!m.stacked, set: (m, v) => withField(m, "stacked", v ? true : undefined) },
    { key: "horizontal", label: "Horizontal", hint: "Bars across", tab: "General", control: "switch", needs: "horizontal", get: (m) => !!m.horizontal, set: (m, v) => withField(m, "horizontal", v ? true : undefined) },
    {
      key: "smooth",
      label: "Smooth lines",
      hint: "Lines curved through their points",
      tab: "General",
      control: "switch",
      // Where the chart has a line: its type's, or a series drawn as one
      when: (m, context) => (context.type.capabilities ?? []).includes("lines") || m.series.some((s) => s.kind === "line" || s.kind === "area"),
      get: (m) => !!m.smooth,
      set: (m, v) => withField(m, "smooth", v ? true : undefined),
    },
    {
      key: "labels",
      label: "Labels",
      hint: "The column whose cells name the values",
      tab: "Data",
      control: "choice",
      when: hasSource,
      choices: (context) => [{ value: "", label: "None: 1, 2, …" }, ...(context.columns ?? []).map((c) => ({ value: c.name, label: c.name }))],
      get: (m, context) => context.columns?.find((c) => same(c.name, m.source?.labels))?.name ?? "",
      set: (m, v) =>
        withSource(m, ({ labels: _labels, ...source }) => {
          const labels = text(v);
          return labels ? { ...source, labels } : source;
        }),
    },
    {
      key: "rows.from",
      label: "Rows",
      hint: "All of them, or only the first or the last so many",
      tab: "Data",
      control: "choice",
      when: hasSource,
      choices: ROWS_CHOICES,
      get: (m) => m.source?.rows?.from ?? "",
      set: (m, v) =>
        withSource(m, ({ rows, ...source }) => (v === "first" || v === "last" ? { ...source, rows: { from: v, count: rows?.count ?? 10 } } : source)),
    },
    {
      key: "rows.count",
      label: "How many rows",
      hint: "The first or the last so many",
      tab: "Data",
      control: "number",
      when: hasSource,
      get: (m) => m.source?.rows?.count ?? 10,
      set: (m, v) => {
        const count = number(v);
        return withSource(m, (source) => (source.rows && count && count > 0 ? { ...source, rows: { ...source.rows, count: Math.floor(count) } } : source));
      },
    },
    {
      key: "where",
      label: "Only where",
      hint: "Rows where every condition holds: is, is not, >, ≥, <, ≤ a value; * and ? stand for any characters",
      tab: "Data",
      control: "conditions",
      when: hasSource,
      choices: (context) => (context.columns ?? []).map((c) => ({ value: c.name, label: c.name })),
      get: (m) => m.source?.where ?? [],
      set: (m, v) =>
        withSource(m, ({ where: _where, ...source }) => {
          const where = (Array.isArray(v) ? (v as readonly Condition[]) : []).filter((c) => c.column);
          return where.length ? { ...source, where } : source;
        }),
    },
    { key: "x.title", label: "X axis title", tab: "Axes", control: "text", needs: "axes", get: (m) => m.x?.title ?? "", set: (m, v) => withAxis(m, "x", "title", text(v)) },
    { key: "y.title", label: "Y axis title", tab: "Axes", control: "text", needs: "axes", get: (m) => m.y?.title ?? "", set: (m, v) => withAxis(m, "y", "title", text(v)) },
    { key: "y.min", label: "Y axis from", hint: "Empty: as the values need", tab: "Axes", control: "number", needs: "axes", get: (m) => m.y?.min, set: (m, v) => withAxis(m, "y", "min", number(v)) },
    { key: "y.max", label: "Y axis to", hint: "Empty: as the values need", tab: "Axes", control: "number", needs: "axes", get: (m) => m.y?.max, set: (m, v) => withAxis(m, "y", "max", number(v)) },
    // Each column of the source's table: drawn or not first (the others apply to the series it is then);
    // of a type of one series (a pie) the one drawn picked, in place of the other
    ...(["switch", "radio"] as const).map(
      (control): ItemSetting => ({
        key: "series.on",
        label: "Drawn",
        tab: "Series",
        control,
        each: "columns",
        when: (_m, context) => (context.type.seriesLimit === 1) === (control === "radio"),
        get: (m, i, context) => seriesOf(m, columnName(context, i)) >= 0,
        set: (m, i, v, context) => withColumnDrawn(m, columnName(context, i) ?? "", !!v, context, palette),
      }),
    ),
    color("columns"),
    name("columns"),
    kind("columns"),
    // Each series of the block's own (a chart of no table)
    color("series"),
    name("series"),
    kind("series"),
    color("labels"),
  ];
}

export function settingsModule(host: ModuleHost): ChartModule {
  const settings = commonSettings((i) => host.palette(i));
  return { settings: () => settings };
}
