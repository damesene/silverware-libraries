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
  /** The chart's settings dialog (at a tab of it) */
  settings(entry: Drawn, tab?: string): Promise<void>;
  /** The modules' entries of the chart's menu */
  entries(entry: Drawn): readonly MenuEntry[];
  /** The tables the chart's page offers as its source */
  candidates(entry: Drawn): Promise<readonly Candidate[]>;
  /** The chart's block written anew with the model changed so */
  rewrite(entry: Drawn, change: (model: ChartModel) => ChartModel): Promise<void>;
  /** The chart's source set (its data written with it): the chart as its block is then */
  pick(entry: Drawn, source: Source): Promise<Drawn | undefined>;
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

/** A table's columns as a source: its first other column the labels, its columns of numbers the values (all of them where it has no such) */
function sourceOf(candidate: Candidate): Source {
  const x = candidate.columns.find((c) => !c.numeric)?.name;
  const numbers = candidate.columns.filter((c) => c.numeric && c.name !== x).map((c) => c.name);
  return { table: candidate.table, ...(x ? { x } : {}), series: numbers.length ? numbers : candidate.columns.filter((c) => c.name !== x).map((c) => c.name) };
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
          button.className = "swc-menu-item";
          if (entry.model.source?.table === candidate.table) button.setAttribute("aria-checked", "true");
          button.innerHTML = ICONS.data;
          const label = button.appendChild(host.doc.createElement("span"));
          label.className = "swc-label";
          label.textContent = candidate.label;
          // Picked: drawn at once (its text column the labels, its columns of numbers the values), the settings' Data open to change that
          button.addEventListener("click", () => {
            menu.close();
            void (async () => {
              const chart = entry.model.source?.table === candidate.table ? entry : await host.pick(entry, sourceOf(candidate));
              if (chart) await host.settings(chart, "Data");
            })();
          });
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
