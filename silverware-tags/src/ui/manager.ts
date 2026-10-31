// The Tag manager: left the tags of the space as a tree by "/" (each with the
// pages using it and what is under it; a search cuts it to the tags holding
// what is typed), right the tag picked: where it is used (pages, items, tasks,
// …), the pages (each opening it), the modules' actions on it. Read anew after
// an action changed something; Undo in its foot while there is a change to
// undo.
import type { Catalog } from "../core/catalog.ts";
import { pageCounts, pagesWith } from "../core/catalog.ts";
import type { TagAction } from "../core/module.ts";
import { counted } from "../core/operation.ts";
import { hashtagOf } from "../tags/names.ts";
import { filterTree, type TagNode, tagTree } from "../tags/tree.ts";
import { buttons, openDialog } from "./dialog.ts";
import { el } from "./elements.ts";
import { ICONS } from "./icons.ts";

export type ManagerOptions = {
  readonly catalog: () => Promise<Catalog>;
  readonly actions: (tag: string, catalog: Catalog) => readonly TagAction[];
  readonly navigate: (page: string) => unknown;
  // The last change to undo, while there is one
  readonly undo: () => { readonly label: string; readonly run: () => Promise<void> } | undefined;
  // The tag shown first
  readonly tag?: string;
};

// What a context is called where a tag is used (SilverBullet's `parent`): of several pages, of one
const CONTEXTS: Readonly<Record<string, string>> = { page: "pages", item: "items", task: "tasks", table: "tables", header: "headings", paragraph: "paragraphs", data: "data" };
const CONTEXT: Readonly<Record<string, string>> = { page: "page", item: "item", task: "task", table: "table", header: "heading", paragraph: "paragraph", data: "data" };

export async function showManager(doc: Document, options: ManagerOptions): Promise<void> {
  let catalog = await options.catalog();
  let tree = tagTree(pageCounts(catalog));
  let picked: string | undefined = options.tag ?? tree[0]?.name;
  const open = new Set<string>();
  // The levels above the tag shown first open
  const openTo = (tag: string | undefined) => {
    const parts = tag?.split("/") ?? [];
    for (let i = 1; i < parts.length; i++) open.add(parts.slice(0, i).join("/"));
  };
  openTo(picked);
  let query = "";

  const search = el(doc, "input", { class: "swg-field swg-search", attrs: { type: "search", placeholder: "Search tags", "aria-label": "Search tags", spellcheck: "false" } });
  const list = el(doc, "ul", { class: "swg-tags", attrs: { role: "tree", "aria-label": "Tags", tabindex: "0" } });
  const detail = el(doc, "div", "swg-detail");
  const foot = el(doc, "div", "swg-foot-row");

  const shownNodes = () => filterTree(tree, query);
  // The tags in the order they show (those open), for the arrows
  const visible = (): string[] => {
    const out: string[] = [];
    const walk = (nodes: readonly TagNode[]) => {
      for (const node of nodes) {
        out.push(node.name);
        if (node.children.length && (open.has(node.name) || query)) walk(node.children);
      }
    };
    walk(shownNodes());
    return out;
  };

  const renderTree = () => {
    const item = (node: TagNode): HTMLElement => {
      const folder = node.children.length > 0;
      const expanded = folder && (open.has(node.name) || !!query);
      const li = el(
        doc,
        "li",
        { class: "swg-tag-item", attrs: { role: "treeitem", "data-swg-tag": node.name, "aria-selected": String(node.name === picked), "aria-expanded": folder ? String(expanded) : undefined } },
        el(
          doc,
          "div",
          { class: "swg-tag-row", on: { click: () => pick(node.name) } },
          folder
            ? el(doc, "button", {
                class: "swg-tree-toggle",
                html: ICONS.chevron,
                attrs: { "aria-expanded": String(expanded), "aria-label": `${expanded ? "Close" : "Open"} ${node.name}`, tabindex: "-1" },
                on: {
                  click: (e) => {
                    e.stopPropagation();
                    if (open.has(node.name)) open.delete(node.name);
                    else open.add(node.name);
                    renderTree();
                  },
                },
              })
            : el(doc, "span", "swg-tree-toggle swg-tree-leaf"),
          el(doc, "span", { class: node.own ? "swg-tag-name" : "swg-tag-name swg-level", text: node.label, title: hashtagOf(node.name) }),
          el(doc, "span", { class: "swg-count", text: String(node.own || ""), title: node.own ? counted(node.own, "page") : "" }),
        ),
      );
      if (expanded) li.append(el(doc, "ul", { class: "swg-tree-children", attrs: { role: "group" } }, ...node.children.map(item)));
      return li;
    };
    const nodes = shownNodes();
    list.replaceChildren(...(nodes.length ? nodes.map(item) : [el(doc, "li", { class: "swg-empty", text: tree.length ? "No tag holds that." : "No tags in this space yet." })]));
  };

  const renderDetail = () => {
    if (!picked) {
      detail.replaceChildren(el(doc, "p", { class: "swg-empty", text: "Pick a tag." }));
      return;
    }
    const tag = picked;
    const info = catalog.tags.get(tag);
    const under = pagesWith(catalog, tag, true).length;
    const subtags = [...catalog.tags.keys()].filter((name) => name.startsWith(`${tag}/`)).length;
    const uses = info ? [...info.byContext].map(([context, pages]) => `${counted(pages.size, "page")} in ${CONTEXTS[context] ?? context}`) : [];
    const actions = options.actions(tag, catalog);
    const pages = info ? [...info.pages].sort((a, b) => a.localeCompare(b)) : [];
    const parts = [
      el(doc, "h3", { class: "swg-detail-name", text: hashtagOf(tag) }),
      el(doc, "p", {
        class: "swg-detail-uses",
        text: [info ? `Used on ${counted(info.pages.size, "page")}` : "No page uses it itself", ...(uses.length > 1 ? [uses.join(", ")] : []), ...(subtags ? [`${counted(subtags, "tag")} under it, on ${counted(under, "page")} in all`] : [])].join(" · "),
      }),
      el(
        doc,
        "div",
        "swg-actions",
        ...actions.map((action) =>
          el(doc, "button", {
            class: action.danger ? "swg-button swg-danger" : "swg-button",
            text: action.label,
            attrs: { "data-swg-action": action.id },
            run: () => void runAction(action),
          }),
        ),
      ),
      pages.length
        ? el(
            doc,
            "ul",
            { class: "swg-pages", attrs: { "aria-label": `Pages tagged ${hashtagOf(tag)}` } },
            ...pages.map((page) =>
              el(
                doc,
                "li",
                {},
                el(doc, "button", {
                  class: "swg-page-link",
                  text: page,
                  title: `Open ${page}`,
                  attrs: { "data-swg-page": page },
                  run: () => {
                    dialog.close();
                    void options.navigate(page);
                  },
                }),
                el(doc, "span", { class: "swg-page-contexts", text: info ? [...info.byContext].filter(([, set]) => set.has(page)).map(([context]) => CONTEXT[context] ?? context).join(", ") : "" }),
              ),
            ),
          )
        : null,
    ];
    detail.replaceChildren(...parts.filter((part) => part !== null));
  };

  const renderFoot = () => {
    const undo = options.undo();
    foot.replaceChildren(
      buttons(
        doc,
        ...(undo
          ? [
              el(doc, "button", {
                class: "swg-button swg-undo",
                html: ICONS.undo,
                title: `Undo: ${undo.label}`,
                attrs: { "aria-label": `Undo: ${undo.label}` },
                run: () => void undo.run().then(() => reload()),
              }),
            ]
          : []),
        el(doc, "span", "swg-spacer"),
        el(doc, "button", { class: "swg-button", text: "Close", run: () => dialog.close() }),
      ),
    );
    const button = foot.querySelector(".swg-undo");
    if (button && undo) button.append(` Undo: ${undo.label}`);
  };

  const pick = (tag: string) => {
    picked = tag;
    renderTree();
    renderDetail();
  };

  const reload = async (show?: string) => {
    catalog = await options.catalog();
    tree = tagTree(pageCounts(catalog));
    if (show) picked = show;
    if (picked && !catalog.tags.has(picked) && !visibleAll().includes(picked)) picked = tree[0]?.name;
    openTo(picked);
    renderTree();
    renderDetail();
    renderFoot();
    // The button that had the focus drawn anew (a dialog over it gave it back to that one): the tags take it, so keys stay the dialog's
    if (!dialog.element.contains(doc.activeElement)) list.focus({ preventScroll: true });
  };
  const visibleAll = () => [...catalog.tags.keys()].flatMap((name) => name.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")));

  const runAction = async (action: TagAction) => {
    const result = await action.run();
    if (result) await reload(typeof result === "string" ? result : undefined);
  };

  search.addEventListener("input", () => {
    query = search.value;
    const shown = visible();
    if (!picked || !shown.includes(picked)) picked = shown[0];
    renderTree();
    renderDetail();
  });
  // ↑ ↓ through the tags shown, → opens a level, ← closes it (from the search field too)
  const keys = (e: KeyboardEvent) => {
    const shown = visible();
    const at = picked ? shown.indexOf(picked) : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = shown[Math.min(shown.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) pick(next);
      list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.currentTarget === list && picked) {
      e.preventDefault();
      if (e.key === "ArrowRight") open.add(picked);
      else open.delete(picked);
      renderTree();
    }
  };
  search.addEventListener("keydown", keys);
  list.addEventListener("keydown", keys);

  renderTree();
  renderDetail();
  renderFoot();
  const total = new Set([...catalog.tags.values()].flatMap((tag) => [...tag.pages])).size;
  const dialog = openDialog(doc, {
    title: "Tags",
    subtitle: `${counted(catalog.tags.size, "tag")} on ${counted(total, "page")}`,
    className: "swg-manager",
    content: el(doc, "div", "swg-manager-body", el(doc, "div", "swg-manager-tags", search, list), detail),
    footer: foot,
    focus: search,
  });
}
