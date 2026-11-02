// The chart's ⋯ menu, as data for the toolbar (core/toolbar.ts): the core's
// entries (Type, a gallery of the types and their variants; Settings…; Data,
// the tables the sources offer, then their columns to pick; Edit source,
// Convert to; Copy source, Copy as image; Reload) and the modules', each in
// its group. What each does is the host's (the controller's).
import type { Drawn } from "./drawn.ts";
import type { ChartFormat } from "./format.ts";
import type { ChartModel, Source } from "./model.ts";
import { type Candidate, MENU_GROUPS, type MenuEntry } from "./module.ts";
import type { MenuItem, MenuView } from "./toolbar.ts";
import type { ChartType } from "./type.ts";

export type ChartMenuHost = {
  readonly doc: Document;
  types(): readonly ChartType[];
  formats(): readonly ChartFormat[];
  /** The chart's settings dialog */
  settings(entry: Drawn): Promise<void>;
  /** The modules' entries of the chart's menu */
  entries(entry: Drawn): readonly MenuEntry[];
  /** The tables the chart's page offers as its source */
  candidates(entry: Drawn): Promise<readonly Candidate[]>;
  /** The chart's block written anew with the model changed so */
  rewrite(entry: Drawn, change: (model: ChartModel) => ChartModel): Promise<void>;
  /** The chart's source set (its data written with it) */
  pick(entry: Drawn, source: Source): Promise<void>;
  /** The chart's block written in another format */
  convert(entry: Drawn, format: ChartFormat): Promise<void>;
  /** The chart's markdown shown (the cursor put into its block) */
  editSource(entry: Drawn): Promise<void>;
  /** The chart's block (its fences too) copied as text */
  copySource(entry: Drawn): Promise<void>;
  /** The chart drawn anew, its source read again */
  reload(entry: Drawn): Promise<void>;
  /** The chart copied as an image; undefined where the page cannot (no Clipboard API for images) */
  copyImage(entry: Drawn): (() => Promise<void>) | undefined;
};

const icon = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  type: icon('<path d="M6 20V10M12 20V4M18 20v-7"/>'),
  data: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'),
  settings: icon('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  convert: icon('<path d="M4 7h13l-3-3M20 17H7l3 3"/>'),
  source: icon('<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>'),
  image: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  copy: icon('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  reload: icon('<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>'),
  none: icon('<path d="M18 6L6 18M6 6l12 12"/>'),
};

/**
 * The model with a type and its variant's flags (the others taken off), its
 * series all drawn as the type draws them: a kind of their own (a line over
 * bars) would keep the chart as it was (Series sets one apart again)
 */
function typed(model: ChartModel, type: string, flags: { stacked?: boolean; horizontal?: boolean }): ChartModel {
  const { stacked: _stacked, horizontal: _horizontal, ...rest } = model;
  return {
    ...rest,
    type,
    series: model.series.map(({ kind: _kind, ...series }) => series),
    ...(flags.stacked ? { stacked: true } : {}),
    ...(flags.horizontal ? { horizontal: true } : {}),
  };
}

/** The gallery: each type, then its variants */
function typeView(host: ChartMenuHost, entry: Drawn): MenuView {
  const model = entry.model;
  const items: MenuItem[] = host.types().flatMap((type) =>
    [{ label: type.label, icon: type.icon }, ...(type.variants ?? [])].map((variant) => {
      const flags = { stacked: "stacked" in variant ? variant.stacked : undefined, horizontal: "horizontal" in variant ? variant.horizontal : undefined };
      return {
        label: variant.label,
        icon: variant.icon,
        checked: model.type === type.name && !!model.stacked === !!flags.stacked && !!model.horizontal === !!flags.horizontal,
        run: () => host.rewrite(entry, (m) => typed(m, type.name, flags)),
      };
    }),
  );
  return { title: "Type", items, tiles: true };
}

/** A table's columns to pick: the labels' column, the values' columns */
function columnsView(host: ChartMenuHost, entry: Drawn, candidate: Candidate): MenuView {
  return {
    title: candidate.label,
    element: (menu) => {
      const doc = host.doc;
      const form = doc.createElement("div");
      form.className = "swc-menu-form";
      const current = entry.model.source?.table === candidate.table ? entry.model.source : undefined;
      const same = (a: string, b: string | undefined) => a.toLowerCase() === (b ?? "").toLowerCase();
      // The labels: a column, or none (1, 2, …)
      const xLabel = form.appendChild(doc.createElement("label"));
      xLabel.className = "swc-menu-field";
      xLabel.append("Labels");
      const x = xLabel.appendChild(doc.createElement("select"));
      x.append(new Option("(none: 1, 2, …)", ""));
      for (const column of candidate.columns) x.append(new Option(column.name, column.name));
      const firstText = candidate.columns.find((c) => !c.numeric)?.name ?? "";
      x.value = current ? (candidate.columns.find((c) => same(c.name, current.x))?.name ?? "") : firstText;
      // The values: the columns ticked
      const seriesTitle = form.appendChild(doc.createElement("div"));
      seriesTitle.className = "swc-menu-field-title";
      seriesTitle.textContent = "Values";
      const boxes = candidate.columns.map((column) => {
        const label = form.appendChild(doc.createElement("label"));
        label.className = "swc-menu-check";
        const box = label.appendChild(doc.createElement("input"));
        box.type = "checkbox";
        box.value = column.name;
        box.checked = current ? current.series.some((s) => same(column.name, s)) : column.numeric && column.name !== x.value;
        label.append(column.name);
        return box;
      });
      // The rows: all, or the first or last so many (of those the conditions keep)
      const rowsLabel = form.appendChild(doc.createElement("label"));
      rowsLabel.className = "swc-menu-field";
      rowsLabel.append("Rows");
      const rowsFrom = rowsLabel.appendChild(doc.createElement("select"));
      rowsFrom.append(new Option("All", ""), new Option("First", "first"), new Option("Last", "last"));
      rowsFrom.value = current?.rows?.from ?? "";
      const rowsCount = rowsLabel.appendChild(doc.createElement("input"));
      rowsCount.type = "number";
      rowsCount.min = "1";
      rowsCount.className = "swc-menu-count";
      rowsCount.value = String(current?.rows?.count ?? 10);
      rowsCount.setAttribute("aria-label", "How many rows");
      const showCount = () => (rowsCount.hidden = rowsFrom.value === "");
      rowsFrom.addEventListener("change", showCount);
      showCount();
      // Only the rows where each condition holds: a column, an operator, a value
      const whereTitle = form.appendChild(doc.createElement("div"));
      whereTitle.className = "swc-menu-field-title";
      whereTitle.textContent = "Only where";
      const conditions = form.appendChild(doc.createElement("div"));
      conditions.className = "swc-menu-conditions";
      const OPS: readonly (readonly [string, string])[] = [["=", "is"], ["<>", "is not"], [">", ">"], [">=", "≥"], ["<", "<"], ["<=", "≤"]];
      const addCondition = (column = candidate.columns[0]?.name ?? "", criterion = "=") => {
        const row = conditions.appendChild(doc.createElement("div"));
        row.className = "swc-menu-condition";
        const col = row.appendChild(doc.createElement("select"));
        for (const c of candidate.columns) col.append(new Option(c.name, c.name));
        col.value = candidate.columns.find((c) => same(c.name, column))?.name ?? candidate.columns[0]?.name ?? "";
        const op = row.appendChild(doc.createElement("select"));
        for (const [value, label] of OPS) op.append(new Option(label, value));
        const written = OPS.map(([o]) => o).sort((a, b) => b.length - a.length).find((o) => criterion.trim().startsWith(o)) ?? "=";
        op.value = written;
        const value = row.appendChild(doc.createElement("input"));
        value.type = "text";
        value.placeholder = "value, app*";
        value.value = criterion.trim().startsWith(written) ? criterion.trim().slice(written.length).trim() : criterion.trim();
        const remove = row.appendChild(doc.createElement("button"));
        remove.type = "button";
        remove.className = "swc-menu-remove";
        remove.textContent = "×";
        remove.title = "Remove this condition";
        remove.addEventListener("click", () => row.remove());
      };
      for (const condition of current?.where ?? []) addCondition(condition.column, condition.criterion);
      const add = form.appendChild(doc.createElement("button"));
      add.type = "button";
      add.className = "swc-menu-add";
      add.textContent = "+ Add a condition";
      add.addEventListener("click", () => addCondition());
      const apply = form.appendChild(doc.createElement("button"));
      apply.type = "button";
      apply.className = "swc-menu-apply";
      apply.textContent = "Draw these";
      const refresh = () => {
        apply.disabled = !boxes.some((box) => box.checked);
      };
      for (const box of boxes) box.addEventListener("change", refresh);
      refresh();
      apply.addEventListener("click", () => {
        const series = boxes.filter((box) => box.checked).map((box) => box.value);
        const where = [...conditions.querySelectorAll(".swc-menu-condition")].map((row) => {
          const [col, op] = [...row.querySelectorAll("select")] as HTMLSelectElement[];
          const value = row.querySelector("input")!.value.trim();
          return { column: col!.value, criterion: `${op!.value} ${value}`.trim() };
        });
        const count = Math.floor(Number(rowsCount.value));
        const rows = rowsFrom.value && count > 0 ? { from: rowsFrom.value as "first" | "last", count } : undefined;
        menu.close();
        void host.pick(entry, { table: candidate.table, ...(x.value ? { x: x.value } : {}), series, ...(where.length ? { where } : {}), ...(rows ? { rows } : {}) });
      });
      return form;
    },
  };
}

/** The tables the page offers, the current one marked; read as the view opens */
function dataView(host: ChartMenuHost, entry: Drawn): MenuView {
  return {
    title: "Data",
    element: (menu) => {
      const list = host.doc.createElement("div");
      list.className = "swc-menu-items";
      list.textContent = "Reading the page…";
      void host.candidates(entry).then((candidates) => {
        list.replaceChildren();
        if (!candidates.length) list.textContent = "No table on this page";
        for (const candidate of candidates) {
          const button = list.appendChild(host.doc.createElement("button"));
          button.type = "button";
          button.className = "swc-menu-item swc-menu-sub";
          if (entry.model.source?.table === candidate.table) button.setAttribute("aria-checked", "true");
          button.innerHTML = ICONS.data;
          const label = button.appendChild(host.doc.createElement("span"));
          label.className = "swc-label";
          label.textContent = candidate.label;
          button.addEventListener("click", () => menu.open(columnsView(host, entry, candidate)));
        }
        if (entry.model.source) {
          const off = list.appendChild(host.doc.createElement("button"));
          off.type = "button";
          off.className = "swc-menu-item";
          off.innerHTML = ICONS.none;
          const label = off.appendChild(host.doc.createElement("span"));
          label.className = "swc-label";
          label.textContent = "No table: the block's own numbers";
          off.addEventListener("click", () => {
            menu.close();
            void host.rewrite(entry, ({ source: _source, ...model }) => model);
          });
        }
      });
      return list;
    },
  };
}

/** The chart's menu: the core's entries and the modules', by their groups (MENU_GROUPS), by order within one */
export function chartMenu(host: ChartMenuHost, entry: Drawn): MenuView {
  const others = host.formats().filter((format) => format.name !== entry.format.name);
  const copy = host.copyImage(entry);
  const own: MenuEntry[] = [
    { group: "chart", order: 0, item: { label: "Type", icon: ICONS.type, open: () => typeView(host, entry) } },
    { group: "chart", order: 10, item: { label: "Settings…", icon: ICONS.settings, run: () => host.settings(entry) } },
    { group: "data", order: 0, item: { label: "Data", icon: ICONS.data, open: () => dataView(host, entry) } },
    ...others.map((format, i): MenuEntry => ({ group: "source", order: 10 + i, item: { label: `Convert to ${format.label}`, icon: ICONS.convert, run: () => host.convert(entry, format) } })),
    { group: "source", order: 0, item: { label: "Edit source", icon: ICONS.source, run: () => host.editSource(entry) } },
    { group: "copy", order: 0, item: { label: "Copy source", icon: ICONS.copy, run: () => host.copySource(entry) } },
    { group: "copy", order: 10, item: { label: "Copy as image", icon: ICONS.image, ...(copy ? { run: copy } : { disabled: "This page cannot copy images (no Clipboard API: a page over http)" }) } },
    { group: "view", order: 0, item: { label: "Reload", icon: ICONS.reload, run: () => host.reload(entry) } },
  ];
  const entries = [...own, ...host.entries(entry)];
  const rank = (e: MenuEntry) => MENU_GROUPS.indexOf(e.group) * 1000 + (e.order ?? 500);
  return { title: "Chart", items: [...entries].sort((a, b) => rank(a) - rank(b)).map((e) => e.item) };
}
