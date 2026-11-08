// Views for working on the core without the built-in ones (step 5): written
// against the view API alone (core/view.ts, its types only), as a user's own
// view is, so the playground tries that API too. A table to read, edit, sort,
// filter and order items, and the raw data a view gets.
import { el } from "../shared/elements.ts";
import type { Property } from "../silverware-database/src/model/database.ts";
import type { ViewDefinition, ViewHost } from "../silverware-database/src/core/view.ts";

const NAME = { key: "name", label: "Name" } as const;

/** The next sort of a column's header clicked: ascending, descending, none */
function nextSort(host: ViewHost, key: string) {
  const now = host.listing.sort[0];
  if (now?.key !== key) return [{ key, direction: "asc" as const }];
  return now.direction === "asc" ? [{ key, direction: "desc" as const }] : [];
}

function drawTable(host: ViewHost, element: HTMLElement): void {
  const doc = host.document;
  const columns: readonly (Property | typeof NAME)[] = [NAME, ...host.look.shownProperties];
  const sorted = host.listing.sort[0];
  const head = el(
    doc,
    "tr",
    undefined,
    el(doc, "th", "dbg-actions"),
    ...columns.map((column) =>
      el(
        doc,
        "th",
        { title: "Sort", run: () => void host.listing.setSort(nextSort(host, column.key)) },
        column.label,
        sorted?.key === column.key ? (sorted.direction === "asc" ? " ▲" : " ▼") : "",
      ),
    ),
  );
  const filters = el(
    doc,
    "tr",
    "dbg-filters",
    el(doc, "th"),
    ...columns.map((column) => {
      const input = el(doc, "input", { attrs: { placeholder: "Filter", value: host.listing.filter[column.key] ?? "" } });
      input.addEventListener("change", () => {
        const problem = host.listing.validateCondition(input.value);
        input.setCustomValidity(problem ?? "");
        if (!problem) void host.listing.setFilter(column.key, input.value);
      });
      return el(doc, "th", undefined, input);
    }),
  );
  const items = host.items;
  const rows = items.map((item, at) =>
    el(
      doc,
      "tr",
      undefined,
      el(
        doc,
        "td",
        "dbg-actions",
        el(doc, "button", { title: "Move up", text: "↑", attrs: at === 0 ? { disabled: "" } : {}, run: () => void host.move(item, { before: items[at - 1]! }) }),
        el(doc, "button", { title: "Move down", text: "↓", attrs: at === items.length - 1 ? { disabled: "" } : {}, run: () => void host.move(item, { after: items[at + 1]! }) }),
        el(doc, "button", { title: "Remove", text: "✕", run: () => void host.remove([item]) }),
      ),
      ...columns.map((column) => {
        const property = "type" in column ? column : undefined;
        const value = property ? item.values[property.key] : item.name;
        const problem = property && value !== undefined ? host.type(property).validate(value, property.params) : undefined;
        const input = el(doc, "input", { class: problem ? "dbg-invalid" : "", title: problem ?? "", attrs: { value: host.text(item, column.key) } });
        input.addEventListener("change", () => {
          if (!property) return void host.rename(item, input.value);
          const parsed = host.type(property).parse(input.value, property.params);
          if ("problem" in parsed) {
            input.setCustomValidity(parsed.problem);
            input.reportValidity();
            return;
          }
          void host.update(item, property.key, parsed.value);
        });
        return el(doc, "td", undefined, input);
      }),
    ),
  );
  element.replaceChildren(
    el(doc, "table", "dbg-table", el(doc, "thead", undefined, head, filters), el(doc, "tbody", undefined, ...rows)),
    el(
      doc,
      "p",
      "dbg-foot",
      el(doc, "button", { text: "+ Add item", run: () => void host.create() }),
      el(doc, "button", { text: "Undo", title: "Undo this database's last change", run: () => void host.undo() }),
      el(doc, "span", { text: `${items.length} of ${host.total} shown` }),
    ),
  );
}

export const DEBUG_VIEWS: readonly ViewDefinition[] = [
  {
    name: "debug-table",
    label: "Table (debug)",
    // (Its items drawn without their colors)
    colors: false,
    icon: "▦",
    render(host, element) {
      drawTable(host, element);
      return { update: () => drawTable(host, element) };
    },
  },
  {
    name: "raw",
    label: "Raw",
    // (Its items drawn without their colors)
    colors: false,
    icon: "{}",
    settings: [{ key: "indent", label: "Indent", hint: "Spaces of the JSON's indent", control: "number", default: 2 }],
    render(host, element) {
      const draw = () => element.replaceChildren(el(host.document, "pre", { class: "dbg-raw", text: JSON.stringify({ database: host.database, items: host.items }, null, Number(host.setting("indent")) || 0) }));
      draw();
      return { update: draw };
    },
  },
];
