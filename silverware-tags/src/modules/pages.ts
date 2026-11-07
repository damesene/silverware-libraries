// The pages module: the window's view by page. Left the pages as a tree by
// folder (a folder's box checks every page under it shown), a search of them
// by name and tags (`#a`, `-#a`: tags/query.ts, the index's tags of every
// context) and Untagged (pages using no tag), Check all shown; right the tags
// of the pages checked, as labels of mail are: each with how many of them have
// it, × to take it off them all (again: kept), a field adding tags to them
// all. Review changes… shows what changes. Tags are added into each page's
// frontmatter (those it has left out), taken off its frontmatter and its tag
// lines (a hashtag in its text stays: Remove tag takes it off).
//
// Its commands: Tag pages (the view), Page tags (the view, the page open
// checked). The tag picked in the view by tag: Add to pages… (the tag to add),
// Remove from pages… (the pages having it checked, the tag taken off).
import { metaPages } from "../core/catalog.ts";
import type { ModuleHost, TagsModule, WorkspaceHost } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import { each } from "../core/plan.ts";
import { addPageTags, removePageTags, tagUses } from "../../../shared/pages/tags/edit.ts";
import type { FrontmatterForm } from "../../../shared/pages/tags/frontmatter.ts";
import { hashtagOf, isMetaTag } from "../../../shared/pages/tags/names.ts";
import { isEmptyQuery, pageMatches, parsePageQuery } from "../tags/query.ts";
import { chipsField, suggestions, tagSearchField } from "../ui/chips.ts";
import { checkbox } from "../ui/form.ts";
import { el } from "../../../shared/elements.ts";
import { ICONS } from "../ui/icons.ts";
import { pageTree } from "../ui/pagetree.ts";

export const VIEW = "pages";
export const TAG_PAGES_COMMAND = "Silverware Tags: Tag pages";
export const PAGE_TAGS_COMMAND = "Silverware Tags: Page tags";

type State = {
  readonly checked: readonly string[];
  readonly add: readonly string[];
  readonly remove: readonly string[];
  // The search as typed, and whether it shows the pages using no tag only
  readonly search: string;
  readonly untagged: boolean;
};

const listed = (names: readonly string[]) => names.map(hashtagOf).join(" ");

export function pagesOperation(pages: readonly string[], add: readonly string[], remove: readonly string[], form: FrontmatterForm = "flow"): Operation {
  const parts = [...(add.length ? [`add ${listed(add)}`] : []), ...(remove.length ? [`remove ${listed(remove)}`] : [])].join(", ");
  const which = pages.length === 1 ? pages[0]! : counted(pages.length, "page");
  return {
    label: `Tags of ${which}: ${parts}`,
    pages: () => pages,
    edit: (text) => {
      const added = addPageTags(text, add, form);
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
  return { checked: s.checked ?? [], add: s.add ?? [], remove: s.remove ?? [], search: s.search ?? "", untagged: s.untagged ?? false };
};

function pagesView(module: ModuleHost, host: WorkspaceHost, given: unknown): HTMLElement {
  const { doc, catalog } = host;
  let state = stateOf(given);
  const names = [...catalog.tags.keys()];
  // Each page's tags as read, for this showing of the view: its own (its frontmatter's and its tag lines'), and
  // those only in its text (a paragraph's, an item's…: shown apart, as this view does not change them)
  const tagsOf = new Map<string, { readonly own: readonly string[]; readonly text: readonly string[] }>();
  const keep = (next: Partial<State>) => {
    state = { ...state, ...next };
    host.remember(state);
  };

  // SilverBullet's meta pages (libraries, templates) left out, as its own tree's Pages leaves them
  const meta = metaPages(catalog);
  const tree = pageTree(doc, catalog.pages.filter((page) => !meta.has(page) || state.checked.includes(page)), { checked: state.checked, changed: () => picked() });
  // Every tag each page uses, as the index has them (any context)
  const usedBy = new Map<string, string[]>();
  for (const [name, info] of catalog.tags) for (const page of info.pages) (usedBy.get(page) ?? usedBy.set(page, []).get(page)!).push(name);
  const search = tagSearchField(doc, { value: state.search, placeholder: "Search pages, #tag, -#tag", names, changed: () => (keep({ search: search.value() }), filtered()) });
  const untagged = checkbox(doc, "Untagged", state.untagged, (on) => (keep({ untagged: on }), filtered()));
  untagged.element.title = "Only the pages using no tag";
  const shownLine = el(doc, "span", { class: "swg-note swg-shown" });
  const checkShown = el(doc, "button", {
    class: "swg-button swg-check-shown",
    text: "Check all shown",
    run: () => {
      tree.check(tree.shown(), true);
      picked();
    },
  });
  const filters = el(doc, "div", "swg-page-filters", untagged.element, shownLine, checkShown);
  /** The search or Untagged changed: the tree shows the pages they find */
  const filtered = () => {
    const query = parsePageQuery(state.search);
    const on = state.untagged || !isEmptyQuery(query);
    tree.filter(on ? (page) => (!state.untagged || !usedBy.has(page)) && pageMatches(query, page, usedBy.get(page) ?? []) : undefined);
    filterNote();
  };
  const filterNote = () => {
    const shown = tree.shown();
    const visible = new Set(shown);
    const checked = new Set(state.checked);
    const hidden = state.checked.filter((page) => !visible.has(page)).length;
    shownLine.textContent = `${counted(shown.length, "page")} shown${hidden ? `, ${hidden} checked hidden by the search` : ""}`;
    checkShown.disabled = !shown.length || shown.every((page) => checked.has(page));
  };

  const heading = el(doc, "h3", "swg-detail-name");
  // What of the tags asked to take off cannot be (none of the pages has it as its own)
  const said = el(doc, "p", { class: "swg-note", attrs: { "aria-live": "polite" } });
  // Those dropped so, said until the pages picked change
  let dropped: readonly string[] = [];
  const theirs = el(doc, "div", { class: "swg-chips swg-their-tags", attrs: { "aria-label": "Their tags" } });
  const inText = el(doc, "div", { class: "swg-chips swg-text-tags", attrs: { "aria-label": "In their text" } });
  const inTextRow = el(doc, "div", "swg-form-row", el(doc, "span", { class: "swg-form-label", text: "In their text" }), inText, el(doc, "span", { class: "swg-form-hint", text: "Not changed here: Remove tag (By tag) takes them off the text." }));
  const add = chipsField(doc, { values: state.add, placeholder: "Add a tag to them", suggest: (typed) => suggestions(names, typed), changed: () => (keep({ add: add.chosen() }), update()), kind: "add" });
  const reviewButton = el(doc, "button", {
    class: "swg-button swg-primary swg-review-changes",
    text: "Review changes…",
    run: () => {
      const toAdd = add.values();
      if (!state.checked.length || (!toAdd.length && !state.remove.length)) return;
      keep({ add: toAdd });
      host.review(pagesOperation(state.checked, toAdd, state.remove, module.newTagsForm));
    },
  });
  const right = el(
    doc,
    "div",
    "swg-detail swg-form",
    heading,
    el(doc, "div", "swg-form-row", el(doc, "span", { class: "swg-form-label", text: "Their tags" }), theirs),
    inTextRow,
    el(doc, "div", "swg-form-row", el(doc, "span", { class: "swg-form-label", text: "Add" }), add.element),
    el(doc, "div", "swg-actions", reviewButton),
    said,
  );

  let reading = 0;
  /** The pages checked changed: their tags read (those not read yet), shown */
  const picked = () => {
    const checked = tree.checked();
    if (checked.join("\n") !== state.checked.join("\n")) dropped = [];
    keep({ checked });
    filterNote();
    const read = ++reading;
    const missing = state.checked.filter((page) => !tagsOf.has(page));
    update();
    if (!missing.length) return;
    void (async () => {
      // (A few at a time, as a plan reads them)
      await each(missing, async (page) => {
        try {
          const uses = tagUses(await module.space.read(page));
          const own = [...new Set(uses.filter((use) => use.context === "page").map((use) => use.name))];
          const text = [...new Set(uses.map((use) => use.name))].filter((name) => !own.includes(name));
          tagsOf.set(page, { own, text });
        } catch {
          tagsOf.set(page, { own: [], text: [] });
        }
      });
      if (read === reading) update();
    })();
  };

  const update = () => {
    const pages = state.checked;
    heading.textContent = pages.length ? (pages.length === 1 ? pages[0]! : `${counted(pages.length, "page")} picked`) : "Pick pages";
    const read = pages.filter((page) => tagsOf.has(page));
    const counts = new Map<string, number>();
    // (SilverBullet's own tags not offered to take off: a library's meta/library is how it is installed)
    for (const page of read) for (const tag of tagsOf.get(page)!.own) if (!isMetaTag(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    // Those only in their text, on the pages not having them as their own
    const textCounts = new Map<string, number>();
    for (const page of read) for (const tag of tagsOf.get(page)!.text) if (!isMetaTag(tag)) textCounts.set(tag, (textCounts.get(tag) ?? 0) + 1);
    // A tag to take off that none of them has as its own (only in their text, a paragraph's hashtag) is no change: said, and dropped
    const notOwn = read.length === pages.length ? state.remove.filter((tag) => !counts.has(tag)) : [];
    if (notOwn.length) {
      keep({ remove: state.remove.filter((tag) => counts.has(tag)) });
      dropped = notOwn;
    }
    said.textContent = dropped.length ? `${dropped.map(hashtagOf).join(" ")}: none of these pages has it as its own tag, only in their text (Remove tag takes it off the text).` : "";
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
    inTextRow.hidden = !textCounts.size;
    inText.replaceChildren(
      ...[...textCounts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) =>
        el(
          doc,
          "span",
          { class: "swg-chip swg-chip-text", attrs: { "data-swg-chip": tag } },
          el(doc, "span", { class: "swg-chip-name", text: hashtagOf(tag) }),
          count < pages.length ? el(doc, "span", { class: "swg-chip-count", text: `${count}/${pages.length}`, title: `In the text of ${count} of the ${counted(pages.length, "page")}` }) : null,
        ),
      ),
    );
    theirs.replaceChildren(
      ...(chips.length ? chips : [el(doc, "span", { class: "swg-empty", text: !pages.length ? "Pick pages on the left: a folder picks every page under it." : read.length < pages.length ? "Reading their tags…" : "They have no tags of their own." })]),
    );
    const changes = add.chosen().length + state.remove.length;
    reviewButton.disabled = !pages.length || !changes;
  };

  filtered();
  picked();
  return el(doc, "div", "swg-manager-body", el(doc, "div", "swg-manager-tags", search.element, filters, el(doc, "div", "swg-tree-box-list", tree.element)), right);
}

export function pagesModule(module: ModuleHost): TagsModule {
  return {
    views: () => [
      {
        id: VIEW,
        label: "By page",
        render: (host, state) => pagesView(module, host, state),
        // Applied: the same pages checked, nothing to change
        applied: (state) => ({ ...stateOf(state), add: [], remove: [] }),
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
    tagActions: () => [
      { id: "pages.add", label: "Add to pages…", run: (tag, host) => host.show(VIEW, { add: [tag] }) },
      {
        id: "pages.remove",
        label: "Remove from pages…",
        // Where it is a page's own tag somewhere
        when: (tag, catalog) => !!catalog.tags.get(tag)?.byContext.get("page")?.size,
        run: (tag, host) => host.show(VIEW, { checked: [...host.catalog.tags.get(tag)!.byContext.get("page")!].sort((a, b) => a.localeCompare(b)), remove: [tag] }),
      },
    ],
  };
}
