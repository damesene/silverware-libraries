// The Mermaid format: a ```mermaid block of `xychart-beta` (bar and line
// series over labels) or `pie`, as Mermaid draws it; what Mermaid cannot say
// (a type it has not, colors, a table as the source…) in its comments, one key
// a line: `%% chart.<key>: <value>`. Pure: text in, model out, and back.
import type { ChartFormat } from "../core/format.ts";
import { type Axis, baseKind, type ChartModel, type Condition, type RowsTaken, LEGEND_PLACES, type LegendPlace, type Series, SERIES_KINDS, type SeriesKind, type Source, type Unreadable } from "../core/model.ts";

// Our comments: `%% chart.<key>: <value>`
const META_RE = /^\s*%%\s*chart\.([A-Za-z][\w.-]*)\s*:\s*(.*?)\s*$/;
// Silverware Layout's entries (the model's `layout`): `%% layout.<key>: <value>`, as Mermaid has nothing for them either
const LAYOUT_RE = /^\s*%%\s*layout\.([A-Za-z][\w.-]*)\s*:\s*(.*?)\s*$/;
// Chart types Mermaid draws as they are: the others are said in `chart.type`
const ROUND = new Set(["pie", "doughnut", "polar"]);

/** The items of a list as Mermaid writes them, `["a", b, "c, d"]` (a quoted item may hold a comma) */
export function listItems(text: string): string[] {
  const items: string[] = [];
  const re = /\s*(?:"([^"]*)"|([^,"]*?))\s*(?:,|$)/y;
  let at = 0;
  while (at < text.length) {
    re.lastIndex = at;
    const m = re.exec(text);
    if (!m || m[0] === "") break;
    const item = m[1] ?? m[2] ?? "";
    if (m[1] !== undefined || item !== "") items.push(item);
    at = re.lastIndex;
  }
  return items;
}

/** A match's group, empty where it matched nothing */
const group = (m: RegExpExecArray, i: number): string => m[i] ?? "";

/** A title as written after its keyword: in quotes, else the words as they are */
function titleOf(text: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const quoted = /^"([^"]*)"/.exec(t);
  return quoted ? quoted[1] : t;
}

/** An axis line's rest: `"Title" [a, b]`, `[a, b]`, `Title 0 --> 10`, `"Title"` */
function axisOf(rest: string): { axis: Axis; labels?: string[] } {
  const list = /\[([^\]]*)\]/.exec(rest);
  const range = /(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)/.exec(rest);
  const end = Math.min(list?.index ?? rest.length, range?.index ?? rest.length);
  const title = titleOf(rest.slice(0, end));
  return {
    axis: { ...(title ? { title } : {}), ...(range ? { min: Number(range[1]), max: Number(range[2]) } : {}) },
    ...(list ? { labels: listItems(group(list, 1)) } : {}),
  };
}

function numberOf(text: string): number | null {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) ? n : null;
}

/** The comma separated items of a key's value */
const commaList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** The kind Mermaid's bar or line is in a type: its own where that is the type's word (an area chart's line is its area) */
function impliedKind(word: "bar" | "line", base: SeriesKind | undefined): SeriesKind {
  const own = base ?? "line";
  return word === (own === "bar" ? "bar" : "line") ? own : word;
}

/** A condition as written after `chart.where:`: a column, then its criterion (from the first <, > or =; none: equal to what follows a space) */
export function conditionOf(text: string): Condition | undefined {
  const t = text.trim();
  const at = t.search(/[<>=]/);
  if (at > 0) return { column: t.slice(0, at).trim(), criterion: t.slice(at).trim() };
  return undefined;
}

/** `first 10` / `last 12` */
function rowsOf(text: string): RowsTaken | undefined {
  const m = /^(first|last)\s+(\d+)$/i.exec(text.trim());
  return m ? { from: group(m, 1).toLowerCase() as RowsTaken["from"], count: Number(group(m, 2)) } : undefined;
}

/** An axis' end as a comment says it: a number, else none */
function endOf(text: string | undefined): number | undefined {
  return text !== undefined && /^\s*-?\d+(\.\d+)?\s*$/.test(text) ? Number(text) : undefined;
}

/** An axis with the ends the comments say (`chart.yFrom` / `chart.yTo`): where Mermaid's line could not say them */
function withEnds(axis: Axis | undefined, from: string | undefined, to: string | undefined): Axis | undefined {
  const min = endOf(from);
  const max = endOf(to);
  if (min === undefined && max === undefined) return axis;
  return { ...axis, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

/** Our keys read into the model's fields (`where` a line each), the keys it has no field for kept */
function metaOf(meta: ReadonlyMap<string, string>, wheres: readonly string[] = []): Partial<ChartModel> {
  const out: { -readonly [K in keyof ChartModel]?: ChartModel[K] } = {};
  const extra: Record<string, string> = {};
  for (const [key, value] of meta) {
    switch (key) {
      case "type":
        if (value) out.type = value;
        break;
      case "stacked":
        out.stacked = value === "true";
        break;
      case "smooth":
        out.smooth = value === "true";
        break;
      case "colors":
        out.colors = commaList(value);
        break;
      case "legend":
        if ((LEGEND_PLACES as readonly string[]).includes(value)) out.legend = value as LegendPlace;
        else extra[key] = value;
        break;
      case "height":
        out.height = value;
        break;
      case "source":
      case "labels":
      case "series":
      case "kinds":
        break;
      case "rows":
        if (!rowsOf(value)) extra[key] = value;
        break;
      // An axis' end Mermaid cannot say (its range only with both ends): read with the axes, a value no number kept as written
      case "xFrom":
      case "xTo":
      case "yFrom":
      case "yTo":
        if (endOf(value) === undefined) extra[key] = value;
        break;
      default:
        extra[key] = value;
    }
  }
  const table = meta.get("source");
  const where = wheres.map(conditionOf).filter((c): c is Condition => !!c);
  const rows = rowsOf(meta.get("rows") ?? "");
  if (table)
    out.source = {
      table,
      ...(meta.get("labels") ? { labels: meta.get("labels") } : {}),
      series: commaList(meta.get("series") ?? ""),
      ...(where.length ? { where } : {}),
      ...(rows ? { rows } : {}),
    } satisfies Source;
  if (Object.keys(extra).length) out.extra = extra;
  return out;
}

/** A block's text as a chart: undefined where it is another diagram (a flowchart); Silverware Layout's entries with it */
export function readMermaid(text: string): ChartModel | Unreadable | undefined {
  const read = readChart(text);
  if (!read || "problem" in read) return read;
  const layout: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = LAYOUT_RE.exec(line);
    if (m) layout[group(m, 1)] = group(m, 2);
  }
  return Object.keys(layout).length ? { ...read, layout } : read;
}

function readChart(text: string): ChartModel | Unreadable | undefined {
  const meta = new Map<string, string>();
  const wheres: string[] = [];
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const m = META_RE.exec(line);
    // (where a line each, as many as there are conditions)
    if (m && group(m, 1) === "where") wheres.push(group(m, 2));
    else if (m) meta.set(group(m, 1), group(m, 2));
    else if (!/^\s*%%/.test(line) && line.trim() !== "") lines.push(line.trim());
  }
  const head = lines[0];
  if (head === undefined) return undefined;
  const own = metaOf(meta, wheres);
  if (/^xychart(-beta)?(\s|$)/.test(head)) {
    let title: string | undefined;
    let x: Axis | undefined;
    let y: Axis | undefined;
    let labels: string[] = [];
    const series: Series[] = [];
    for (const line of lines.slice(1)) {
      let m: RegExpExecArray | null;
      if ((m = /^title\s+(.*)$/.exec(line))) title = titleOf(group(m, 1));
      else if ((m = /^x-axis\b(.*)$/.exec(line))) {
        const read = axisOf(group(m, 1));
        x = read.axis;
        labels = read.labels ?? [];
      } else if ((m = /^y-axis\b(.*)$/.exec(line))) y = axisOf(group(m, 1)).axis;
      else if ((m = /^(bar|line)\b(.*)$/.exec(line))) {
        const list = /\[([^\]]*)\]/.exec(group(m, 2));
        if (!list) return { problem: `"${line}" has no values in [ ]` };
        const name = titleOf(group(m, 2).slice(0, list.index));
        series.push({ ...(name ? { name } : {}), kind: group(m, 1) as "bar" | "line", values: listItems(group(list, 1)).map(numberOf) });
      }
    }
    x = withEnds(x, meta.get("xFrom"), meta.get("xTo"));
    y = withEnds(y, meta.get("yFrom"), meta.get("yTo"));
    const kinds = new Set(series.map((s) => s.kind));
    const type = own.type ?? (kinds.has("bar") || kinds.size === 0 ? "bar" : "line");
    // A series' own kind: what chart.kinds says (what Mermaid has no word for), else what its bar or line says
    // in this type (impliedKind: an area chart's line is its area); none where it is the type's own
    const said = commaList(meta.get("kinds") ?? "");
    const base = baseKind(type);
    const drawn = series.map((s, i) => {
      const kind = (SERIES_KINDS as readonly string[]).includes(said[i] ?? "") ? (said[i] as SeriesKind) : impliedKind((s.kind as "bar" | "line" | undefined) ?? "line", base);
      const { kind: _kind, ...rest } = s;
      return kind !== (base ?? "line") ? { ...rest, kind } : rest;
    });
    return {
      type,
      ...(title ? { title } : {}),
      labels,
      series: drawn,
      ...(x && Object.keys(x).length ? { x } : {}),
      ...(y && Object.keys(y).length ? { y } : {}),
      ...(/\bhorizontal\b/.test(head) ? { horizontal: true } : {}),
      ...own,
    } satisfies ChartModel;
  }
  if (/^pie(\s|$)/.test(head)) {
    let title = titleOf(/^pie(?:\s+showData)?\s+title\s+(.*)$/.exec(head)?.[1] ?? "");
    const labels: string[] = [];
    const values: (number | null)[] = [];
    for (const line of lines.slice(1)) {
      let m: RegExpExecArray | null;
      if ((m = /^title\s+(.*)$/.exec(line))) title = titleOf(group(m, 1));
      else if ((m = /^"([^"]*)"\s*:\s*(.*)$/.exec(line))) {
        labels.push(group(m, 1));
        values.push(numberOf(group(m, 2)));
      }
    }
    return { type: "pie", ...(title ? { title } : {}), labels, series: [{ values }], ...own };
  }
  return undefined;
}

const quote = (text: string): string => `"${text.replace(/"/g, "'")}"`;
const numberText = (n: number | null): string => (n === null ? "0" : String(n));

/** An axis as Mermaid writes it after `x-axis` / `y-axis` (no line where it has nothing) */
function axisText(axis: Axis | undefined, labels?: readonly string[]): string | undefined {
  const parts = [
    ...(axis?.title ? [quote(axis.title)] : []),
    ...(labels && labels.length ? [`[${labels.map(quote).join(", ")}]`] : []),
    ...(axis?.min !== undefined && axis?.max !== undefined && !(labels && labels.length) ? [`${axis.min} --> ${axis.max}`] : []),
  ];
  return parts.length ? parts.join(" ") : undefined;
}

/** The model as the block's text; the other comments of `previous` (not ours) kept after the chart */
export function writeMermaid(model: ChartModel, previous?: string): string {
  const lines: string[] = [];
  const meta: [string, string][] = [];
  const round = ROUND.has(model.type);
  if (round) {
    lines.push(model.title ? `pie title ${model.title}` : "pie");
    const values = model.series[0]?.values ?? [];
    model.labels.forEach((label, i) => lines.push(`  ${quote(label)} : ${numberText(values[i] ?? null)}`));
    if (model.type !== "pie") meta.push(["type", model.type]);
  } else {
    lines.push(model.horizontal ? "xychart-beta horizontal" : "xychart-beta");
    if (model.title) lines.push(`  title ${quote(model.title)}`);
    const x = axisText(model.x, model.labels);
    if (x) lines.push(`  x-axis ${x}`);
    // Mermaid's y axis takes a range only with both ends
    const yRange = model.y?.min !== undefined && model.y?.max !== undefined ? ` ${model.y.min} --> ${model.y.max}` : "";
    if (model.y?.title || yRange) lines.push(`  y-axis${model.y?.title ? ` ${quote(model.y.title)}` : ""}${yRange}`);
    // What Mermaid cannot say of a range, in our comments: one end alone (Mermaid's syntax error else), an x range beside the labels
    if (!yRange && model.y?.min !== undefined) meta.push(["yFrom", String(model.y.min)]);
    if (!yRange && model.y?.max !== undefined) meta.push(["yTo", String(model.y.max)]);
    const xNative = model.x?.min !== undefined && model.x?.max !== undefined && !model.labels.length;
    if (!xNative && model.x?.min !== undefined) meta.push(["xFrom", String(model.x.min)]);
    if (!xNative && model.x?.max !== undefined) meta.push(["xTo", String(model.x.max)]);
    // A series as Mermaid draws it: bars, else a line (an area, points, steps: a line there, its kind in chart.kinds)
    const base = baseKind(model.type) ?? "line";
    const kindOf = (series: Series) => series.kind ?? base;
    const mermaidKind = (series: Series) => (kindOf(series) === "bar" ? "bar" : "line");
    for (const series of model.series) lines.push(`  ${mermaidKind(series)}${series.name ? ` ${quote(series.name)}` : ""} [${series.values.map(numberText).join(", ")}]`);
    const kinds = new Set(model.series.map(mermaidKind));
    const read = kinds.has("bar") || kinds.size === 0 ? "bar" : "line";
    if (model.type !== read) meta.push(["type", model.type]);
    // The kinds said where Mermaid's word would be read back as another (an area, points, steps; a line in an area chart)
    if (model.series.some((s) => impliedKind(mermaidKind(s), baseKind(model.type)) !== kindOf(s))) meta.push(["kinds", model.series.map(kindOf).join(", ")]);
  }
  if (model.stacked) meta.push(["stacked", "true"]);
  if (model.smooth) meta.push(["smooth", "true"]);
  if (model.colors?.length) meta.push(["colors", model.colors.join(", ")]);
  if (model.legend) meta.push(["legend", model.legend]);
  if (model.height) meta.push(["height", model.height]);
  if (model.source) {
    meta.push(["source", model.source.table]);
    if (model.source.labels) meta.push(["labels", model.source.labels]);
    if (model.source.series.length) meta.push(["series", model.source.series.join(", ")]);
    for (const condition of model.source.where ?? []) meta.push(["where", `${condition.column} ${condition.criterion}`]);
    if (model.source.rows) meta.push(["rows", `${model.source.rows.from} ${model.source.rows.count}`]);
  }
  for (const [key, value] of Object.entries(model.extra ?? {})) meta.push([key, value]);
  // Mermaid's directives (`%%{init: …}%%`) before the diagram, the other comments after it, as they were
  const comments = (previous ?? "").split("\n").filter((line) => /^\s*%%/.test(line) && !META_RE.test(line) && !LAYOUT_RE.test(line));
  const layout = Object.entries(model.layout ?? {}).map(([key, value]) => `%% layout.${key}: ${value}`);
  const directive = (line: string) => /^\s*%%\{/.test(line);
  return [...comments.filter(directive), ...lines, ...meta.map(([key, value]) => `%% chart.${key}: ${value}`), ...layout, ...comments.filter((line) => !directive(line))].join("\n");
}

export const MERMAID_FORMAT: ChartFormat = {
  name: "mermaid",
  label: "Mermaid",
  languages: ["mermaid"],
  read: readMermaid,
  write: writeMermaid,
};
