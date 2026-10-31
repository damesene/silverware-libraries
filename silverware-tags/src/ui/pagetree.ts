// Pages as a tree by folder ("/" in a page's name: `Projects/Alpha/Plan`),
// each with a check box; a folder's box checks every page under it (its own
// page too, where a page has its name), shown checked where all are and in
// between where some are. A search shows the pages whose name holds it, with
// the folders above them open. Folders open as they are clicked; only those
// open are in the document (a space of thousands of pages).
import { el } from "./elements.ts";
import { ICONS } from "./icons.ts";

type Node = {
  readonly path: string;
  readonly label: string;
  // Whether a page has this name (else a folder only)
  readonly page: boolean;
  readonly children: Node[];
  // Every page from here down
  readonly pages: string[];
};

function treeOf(pages: readonly string[]): Node[] {
  type Building = { path: string; label: string; page: boolean; children: Map<string, Building> };
  const root = new Map<string, Building>();
  for (const page of pages) {
    let level = root;
    const parts = page.split("/");
    parts.forEach((label, i) => {
      let node = level.get(label);
      if (!node) level.set(label, (node = { path: parts.slice(0, i + 1).join("/"), label, page: false, children: new Map() }));
      if (i === parts.length - 1) node.page = true;
      level = node.children;
    });
  }
  const done = (level: Map<string, Building>): Node[] =>
    [...level.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((node) => {
        const children = done(node.children);
        return { path: node.path, label: node.label, page: node.page, children, pages: [...(node.page ? [node.path] : []), ...children.flatMap((child) => child.pages)] };
      });
  return done(root);
}

export type PageTree = {
  readonly element: HTMLElement;
  // The pages checked, in the space's order
  checked(): string[];
  // Pages checked (as a folder's box checks them)
  check(pages: readonly string[], on: boolean): void;
  filter(query: string): void;
};

export function pageTree(doc: Document, pages: readonly string[], options: { readonly checked?: readonly string[]; readonly changed?: () => void } = {}): PageTree {
  const roots = treeOf(pages);
  const checked = new Set(options.checked ?? []);
  // The folders above the pages checked at the start open, so they show
  const open = new Set<string>((options.checked ?? []).flatMap((page) => page.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
  let query = "";
  const list = el(doc, "ul", { class: "swg-tree", attrs: { role: "tree" } });

  const shown = (node: Node): boolean => !query || node.pages.some((page) => page.toLowerCase().includes(query));
  const stateOf = (node: Node): "on" | "off" | "some" => {
    const on = node.pages.filter((page) => checked.has(page)).length;
    return on === 0 ? "off" : on === node.pages.length ? "on" : "some";
  };
  const render = () => list.replaceChildren(...roots.filter(shown).map(item));
  const item = (node: Node): HTMLElement => {
    const folder = node.children.length > 0;
    const expanded = folder && (open.has(node.path) || !!query);
    const box = el(doc, "input", { class: "swg-tree-box", attrs: { type: "checkbox", "aria-label": node.path } });
    const state = stateOf(node);
    box.checked = state === "on";
    box.indeterminate = state === "some";
    box.addEventListener("change", () => {
      api.check(node.pages, stateOf(node) !== "on");
      options.changed?.();
    });
    const toggle = folder
      ? el(doc, "button", {
          class: "swg-tree-toggle",
          html: ICONS.chevron,
          title: expanded ? "Close" : "Open",
          attrs: { "aria-expanded": String(expanded), "aria-label": `${expanded ? "Close" : "Open"} ${node.path}` },
          run: () => {
            if (open.has(node.path)) open.delete(node.path);
            else open.add(node.path);
            render();
          },
        })
      : el(doc, "span", "swg-tree-toggle swg-tree-leaf");
    const row = el(
      doc,
      "div",
      "swg-tree-row",
      toggle,
      el(doc, "label", "swg-tree-label", box, el(doc, "span", { class: "swg-tree-icon", html: node.page && !folder ? ICONS.page : ICONS.folder }), el(doc, "span", { class: "swg-tree-name", text: node.label })),
      folder ? el(doc, "span", { class: "swg-count", text: String(node.pages.length), title: `${node.pages.length} pages` }) : null,
    );
    const li = el(doc, "li", { class: "swg-tree-item", attrs: { role: "treeitem", "data-swg-page": node.path, "aria-expanded": folder ? String(expanded) : undefined } }, row);
    if (expanded) li.append(el(doc, "ul", { class: "swg-tree-children", attrs: { role: "group" } }, ...node.children.filter(shown).map(item)));
    return li;
  };

  const api: PageTree = {
    element: list,
    checked: () => pages.filter((page) => checked.has(page)),
    check: (list, on) => {
      for (const page of list) {
        if (on) checked.add(page);
        else checked.delete(page);
      }
      render();
    },
    filter: (q) => {
      query = q.trim().toLowerCase();
      render();
    },
  };
  render();
  return api;
}
