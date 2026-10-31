// The pages module: the window's view by page. Left the pages as a tree by
// folder (a folder's box checks every page under it; a search), right the tags
// of the pages checked, as labels of mail are: each with how many of them have
// it, × to take it off them all (again: kept), a field adding tags to them
// all. Review changes… shows what changes. Tags are added into each page's
// frontmatter (those it has left out), taken off its frontmatter and its tag
// lines (a hashtag in its text stays: Delete tag takes it off).
//
// Its commands: Tag pages (the view), Page tags (the view, the page open
// checked). The tag picked in the view by tag: Add to pages… (the tag to add),
// Remove from pages… (the pages having it checked, the tag taken off).
import type { ModuleHost, TagsModule, WorkspaceHost } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { addPageTags, pageTags, removePageTags } from "../tags/edit.ts";
import { hashtagOf } from "../tags/names.ts";
import { chipsField, suggestions } from "../ui/chips.ts";
import { el } from "../ui/elements.ts";
import { ICONS } from "../ui/icons.ts";
import { pageTree } from "../ui/pagetree.ts";

export const VIEW = "pages";
export const TAG_PAGES_COMMAND = "Silverware Tags: Tag pages";
export const PAGE_TAGS_COMMAND = "Silverware Tags: Page tags";

type State = { readonly checked: readonly string[]; readonly add: readonly string[]; readonly remove: readonly string[] };

const listed = (names: readonly string[]) => names.map(hashtagOf).join(" ");

export function pagesOperation(pages: readonly string[], add: readonly string[], remove: readonly string[]): Operation {
  const parts = [...(add.length ? [`add ${listed(add)}`] : []), ...(remove.length ? [`remove ${listed(remove)}`] : [])].join(", ");
  const which = pages.length === 1 ? pages[0]! : counted(pages.length, "page");
  return {
    label: `Tags of ${which}: ${parts}`,
    pages: () => pages,
    edit: (text) => {
      const added = addPageTags(text, add);
      if (added.problem) return added;
      const removed = removePageTags(added.text, remove);
      if (removed.problem) return removed;
      return { text: removed.text, changes: added.changes + removed.changes };
    },
    done: (pages, changes) => `Tags of ${pages === 1 ? which : counted(pages, "page")}: ${parts} (${counted(changes, "change")})`,
  };
}

const stateOf = (value: unknown): State => {
  const s = (value ?? {}) as Partial<State>;
  return { checked: s.checked ?? [], add: s.add ?? [], remove: s.remove ?? [] };
};

// Pages read at once for their tags
const AT_ONCE = 6;

function pagesView(module: ModuleHost, host: WorkspaceHost, given: unknown): HTMLElement {
  const { doc, catalog } = host;
  let state = stateOf(given);
  const names = [...catalog.tags.keys()];
  // Each page's own tags as read (its frontmatter's and its tag lines'), for this showing of the view
  const tagsOf = new Map<string, readonly string[]>();
  const keep = (next: Partial<State>) => {
    state = { ...state, ...next };
    host.remember(state);
  };

  const search = el(doc, "input", { class: "swg-field swg-search", attrs: { type: "search", placeholder: "Search pages", "aria-label": "Search pages", spellcheck: "false", "data-swg-focus": "" } });
  const tree = pageTree(doc, catalog.pages, { checked: state.checked, changed: () => picked() });
  search.addEventListener("input", () => tree.filter(search.value));

  const heading = el(doc, "h3", "swg-detail-name");
  const theirs = el(doc, "div", { class: "swg-chips swg-their-tags", attrs: { "aria-label": "Their tags" } });
  const add = chipsField(doc, { values: state.add, placeholder: "Add a tag to them", suggest: (typed) => suggestions(names, typed), changed: () => (keep({ add: add.chosen() }), update()), kind: "add" });
  const reviewButton = el(doc, "button", {
    class: "swg-button swg-primary swg-review-changes",
    text: "Review changes…",
    run: () => {
      const toAdd = add.values();
      if (!state.checked.length || (!toAdd.length && !state.remove.length)) return;
      keep({ add: toAdd });
      host.review(pagesOperation(state.checked, toAdd, state.remove));
    },
  });
  const right = el(
    doc,
    "div",
    "swg-detail swg-form",
    heading,
    el(doc, "div", "swg-form-row", el(doc, "span", { class: "swg-form-label", text: "Their tags" }), theirs),
    el(doc, "div", "swg-form-row", el(doc, "span", { class: "swg-form-label", text: "Add" }), add.element),
    el(doc, "div", "swg-actions", reviewButton),
  );

  let reading = 0;
  /** The pages checked changed: their tags read (those not read yet), shown */
  const picked = () => {
    keep({ checked: tree.checked() });
    const read = ++reading;
    const missing = state.checked.filter((page) => !tagsOf.has(page));
    update();
    if (!missing.length) return;
    void (async () => {
      for (let i = 0; i < missing.length; i += AT_ONCE)
        await Promise.all(
          missing.slice(i, i + AT_ONCE).map(async (page) => {
            try {
              tagsOf.set(page, pageTags(await module.space.read(page)));
            } catch {
              tagsOf.set(page, []);
            }
          }),
        );
      if (read === reading) update();
    })();
  };

  const update = () => {
    const pages = state.checked;
    heading.textContent = pages.length ? (pages.length === 1 ? pages[0]! : `${counted(pages.length, "page")} picked`) : "Pick pages";
    const read = pages.filter((page) => tagsOf.has(page));
    const counts = new Map<string, number>();
    for (const page of read) for (const tag of tagsOf.get(page)!) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    // A tag to take off that none of them has any more is no change
    if (state.remove.some((tag) => !counts.has(tag)) && read.length === pages.length) keep({ remove: state.remove.filter((tag) => counts.has(tag)) });
    const chips = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => {
      const off = state.remove.includes(tag);
      return el(
        doc,
        "span",
        { class: off ? "swg-chip swg-removing" : "swg-chip", attrs: { "data-swg-chip": tag } },
        el(doc, "span", { class: "swg-chip-name", text: hashtagOf(tag) }),
        count < pages.length ? el(doc, "span", { class: "swg-chip-count", text: `${count}/${pages.length}`, title: `On ${count} of the ${counted(pages.length, "page")}` }) : null,
        el(doc, "button", {
          class: "swg-chip-remove",
          html: off ? ICONS.undo : ICONS.close,
          title: off ? `Keep ${hashtagOf(tag)}` : `Remove ${hashtagOf(tag)} from them`,
          attrs: { "aria-label": off ? `Keep ${hashtagOf(tag)}` : `Remove ${hashtagOf(tag)}` },
          run: () => {
            keep({ remove: off ? state.remove.filter((t) => t !== tag) : [...state.remove, tag] });
            update();
          },
        }),
      );
    });
    theirs.replaceChildren(
      ...(chips.length ? chips : [el(doc, "span", { class: "swg-empty", text: !pages.length ? "Pick pages on the left: a folder picks every page under it." : read.length < pages.length ? "Reading their tags…" : "They have no tags of their own." })]),
    );
    const changes = add.chosen().length + state.remove.length;
    reviewButton.disabled = !pages.length || !changes;
  };

  picked();
  return el(doc, "div", "swg-manager-body", el(doc, "div", "swg-manager-tags", search, el(doc, "div", "swg-tree-box-list", tree.element)), right);
}

export function pagesModule(module: ModuleHost): TagsModule {
  return {
    views: () => [
      {
        id: VIEW,
        label: "By page",
        render: (host, state) => pagesView(module, host, state),
        // Applied: the same pages checked, nothing to change
        applied: (state) => ({ checked: stateOf(state).checked, add: [], remove: [] }),
      },
    ],
    commands: () => [
      { name: TAG_PAGES_COMMAND, run: () => module.open(VIEW) },
      {
        name: PAGE_TAGS_COMMAND,
        run: async () => {
          const page = await module.space.currentPage();
          await module.open(VIEW, page ? { checked: [page] } : undefined);
        },
      },
    ],
    tagParts: (tag, host) => {
      const info = host.catalog.tags.get(tag);
      const own = info?.byContext.get("page");
      return {
        actions: [
          el(host.doc, "button", { class: "swg-button", text: "Add to pages…", attrs: { "data-swg-action": "pages.add" }, run: () => host.show(VIEW, { add: [tag] }) }),
          ...(own?.size
            ? [el(host.doc, "button", { class: "swg-button", text: "Remove from pages…", attrs: { "data-swg-action": "pages.remove" }, run: () => host.show(VIEW, { checked: [...own].sort((a, b) => a.localeCompare(b)), remove: [tag] }) })]
            : []),
        ],
      };
    },
  };
}
