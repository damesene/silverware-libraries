// The settings module: the settings every chart may have, for the settings
// dialog (core/settingsdialog.ts), which shows each where the chart's type
// has what it needs: the title, height and legend; stacked, horizontal and
// smooth; the axes' titles and range; each series' name, color and kind, each
// slice's color.
import { baseKind, type ChartModel, LEGEND_PLACES, type LegendPlace, type Series, type SeriesKind } from "../core/model.ts";
import type { ChartModule, ModuleHost } from "../core/module.ts";
import type { ItemSetting, Setting, SettingValue } from "../core/setting.ts";

const text = (value: SettingValue): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const number = (value: SettingValue): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

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
  return { ...model, series: model.series.map((series, i) => (i === index ? change(series) : series)) };
}

const KIND_LABELS: Readonly<Record<SeriesKind, string>> = { bar: "Bars", line: "Line", area: "Area", points: "Points", step: "Steps" };

/** A color written for the series (or slice) at `index`, the ones before it as they show (the palette's) where none was written */
function withColor(model: ChartModel, index: number, value: SettingValue, count: number, palette: (i: number) => string): ChartModel {
  const colors = Array.from({ length: count }, (_, i) => model.colors?.[i] ?? palette(i));
  colors[index] = text(value) ?? palette(index);
  return { ...model, colors };
}

/** The common settings; `palette` the colors series take where the chart says none */
export function commonSettings(palette: (i: number) => string): readonly Setting[] {
  const color = (each: "series" | "labels"): ItemSetting => ({
    key: each === "series" ? "series.color" : "slice.color",
    label: "Color",
    tab: each === "series" ? "Series" : "Slices",
    control: "color",
    each,
    needs: each === "series" ? "series" : "slices",
    get: (model, i) => model.colors?.[i] ?? palette(i),
    set: (model, i, value) => withColor(model, i, value, each === "series" ? model.series.length : model.labels.length, palette),
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
      when: (m, type) => (type.capabilities ?? []).includes("lines") || m.series.some((s) => s.kind === "line" || s.kind === "area"),
      get: (m) => !!m.smooth,
      set: (m, v) => withField(m, "smooth", v ? true : undefined),
    },
    { key: "x.title", label: "X axis title", tab: "Axes", control: "text", needs: "axes", get: (m) => m.x?.title ?? "", set: (m, v) => withAxis(m, "x", "title", text(v)) },
    { key: "y.title", label: "Y axis title", tab: "Axes", control: "text", needs: "axes", get: (m) => m.y?.title ?? "", set: (m, v) => withAxis(m, "y", "title", text(v)) },
    { key: "y.min", label: "Y axis from", hint: "Empty: as the values need", tab: "Axes", control: "number", needs: "axes", get: (m) => m.y?.min, set: (m, v) => withAxis(m, "y", "min", number(v)) },
    { key: "y.max", label: "Y axis to", hint: "Empty: as the values need", tab: "Axes", control: "number", needs: "axes", get: (m) => m.y?.max, set: (m, v) => withAxis(m, "y", "max", number(v)) },
    color("series"),
    {
      key: "series.name",
      label: "Name",
      tab: "Series",
      control: "text",
      each: "series",
      needs: "series",
      get: (m, i) => m.series[i]?.name ?? m.source?.series[i] ?? "",
      set: (m, i, v) =>
        withSeries(m, i, ({ name: _name, ...series }) => {
          const name = text(v);
          return name ? { ...series, name } : series;
        }),
    },
    {
      key: "series.kind",
      label: "Drawn as",
      tab: "Series",
      control: "choice",
      each: "series",
      needs: "series",
      when: (_m, type) => !!type.kinds?.length,
      choices: (type) => (type.kinds ?? []).map((kind) => ({ value: kind, label: KIND_LABELS[kind] })),
      get: (m, i) => m.series[i]?.kind ?? baseKind(m.type) ?? "",
      // The type's own kind written as none: the series drawn as the type draws its series
      set: (m, i, v) =>
        withSeries(m, i, ({ kind: _kind, ...series }) => (v && v !== m.type ? { ...series, kind: v as SeriesKind } : series)),
    },
    color("labels"),
  ];
}

export function settingsModule(host: ModuleHost): ChartModule {
  const settings = commonSettings((i) => host.palette(i));
  return { settings: () => settings };
}
