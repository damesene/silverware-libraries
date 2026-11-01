// The one window of Silverware Tags: its views as tabs at the top (by tags,
// the core's; the modules' beside it: by pages), and a change's review in the
// same window, in place of the view it came from (Back to it, Esc too; Apply
// writes it and goes back, the tags read anew). Nothing opens over it.
//
// By tags: left the tags of the space as a tree by "/" (each with the pages
// using it; a search cuts it to the tags holding what is typed; ↑ ↓ → ←),
// right the tag picked: its name (a module's field renaming it), where it is
// used, the modules' actions, its pages (each opening it).
import { type Catalog, pageCounts, pagesWith, subtagsOf, type TagInfo } from "../core/catalog.ts";
import type { TagAction, TagParts, TagsAction, View, WorkspaceHost } from "../core/module.ts";
import { counted, type Operation } from "../core/operation.ts";
import type { Applied, Plan, Progress } from "../core/plan.ts";
import { hashtagOf, isMetaTag, nameProblem } from "../tags/names.ts";
import { filterTree, type TagNode, tagTree } from "../tags/tree.ts";
import { buttons, openDialog } from "./dialog.ts";
import { el } from "./elements.ts";
import { ICONS } from "./icons.ts";
import { suggestions, tagField } from "./chips.ts";
import { checkbox, choice, labelled, note } from "./form.ts";
import { reviewList } from "./review.ts";

export type WorkspaceOptions = {
  readonly catalog: () => Promise<Catalog>;
  // The modules' views (beside the tags')
  readonly views: () => readonly View[];
  // The modules' parts of the tag picked, in their order
  readonly tagParts: (tag: string, host: WorkspaceHost) => readonly TagParts[];
  // The modules' actions on a tag, and on several picked together, in their order
  readonly tagActions: () => readonly TagAction[];
  readonly tagsActions: () => readonly TagsAction[];
  readonly navigate: (page: string) => unknown;
  readonly plan: (operation: Operation, progress: Progress) => Promise<Plan>;
  // Applied, kept for Undo and said
  readonly apply: (plan: Plan, progress: Progress, waiting?: () => void) => Promise<Applied>;
  // The last change to undo, while there is one
  readonly undo: () => { readonly label: string; readonly run: () => Promise<void> } | undefined;
  // Whether SilverBullet's own tags are shown, apart (Tags | Meta); else they are left out (the setting protecting meta pages)
  readonly metaApart: boolean;
  // The settings dialog, where there is one: a gear in the window's foot
  readonly settings?: () => void;
};

// What a context is called where a tag is used (SilverBullet's `parent`): of several pages, of one
const CONTEXTS: Readonly<Record<string, string>> = { page: "pages", item: "items", task: "tasks", table: "tables", header: "headings", paragraph: "paragraphs", data: "data" };
const CONTEXT: Readonly<Record<string, string>> = { page: "page", item: "item", task: "task", table: "table", header: "heading", paragraph: "paragraph", data: "data" };

// A tag's pages listed at first (the rest at a click)
const PAGES_SHOWN = 100;

export const TAGS_VIEW = "tags";

// How long after it opens the window takes its focus back from what takes it (keepFocus)
const KEEP_FOCUS_MS = 500;

export class Workspace {
  private dialog: ReturnType<typeof openDialog> | undefined;
  private catalog: Catalog | undefined;
  private view = TAGS_VIEW;
  private state: unknown;
  // The review shown, and whether its pages are being written
  private reviewing: { readonly operation: Operation; applying: boolean } | undefined;
  // The tags' view as it was left
  private picked: string | undefined;
  // Several tags picked together (Ctrl or Shift and a click): two or more, else the one picked alone
  private readonly chosen = new Set<string>();
  private readonly opened = new Set<string>();
  private query = "";
  // Whether the tags' view shows SilverBullet's own tags (meta and under it), apart from the others as its tree shows meta pages
  private meta = false;

  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;
  private readonly foot: HTMLElement;

  constructor(
    private readonly doc: Document,
    private readonly options: WorkspaceOptions,
  ) {
    this.tabs = el(doc, "div", { class: "swg-views", attrs: { role: "tablist" } });
    this.body = el(doc, "div", "swg-workspace-body");
    this.foot = el(doc, "div", "swg-foot-row");
  }

  get isOpen(): boolean {
    return !!this.dialog;
  }

  /** The window opened at a view (or brought to it); "tags" with a tag's name shows that tag */
  async show(view = TAGS_VIEW, state?: unknown): Promise<void> {
    // (A change being written stays shown until it is: the panel, a command or Undo would take its place meanwhile)
    if (this.reviewing?.applying) return;
    const catalog = await this.options.catalog();
    // (Apply clicked meanwhile)
    if (this.reviewing?.applying) return;
    this.catalog = catalog;
    this.reviewing = undefined;
    // The tags' view at a tag: its name, or { tag, focus: "name" } with the field of its name focused
    const at = view === TAGS_VIEW ? (typeof state === "string" ? { tag: state } : ((state ?? {}) as { tag?: string; focus?: string })) : {};
    if (at.tag) {
      this.picked = at.tag;
      this.query = "";
      // A meta tag (from the panel's Meta) shown among SilverBullet's own
      this.meta = isMetaTag(at.tag);
    }
    this.go(view, view === TAGS_VIEW ? undefined : state);
    this.opening();
    const focus = () => (at.focus === "name" ? this.focusName() : this.focusView());
    focus();
    this.keepFocus(focus);
  }

  /**
   * The focus taken back where something outside takes it right after the
   * window opened from it: SilverBullet's navigator focuses its own filter field
   * once the key (F2) it handed over is handled, which left the window's keys to
   * the navigator
   */
  private keepFocus(focus: () => void): void {
    const win = this.doc.defaultView;
    const dialog = this.dialog;
    if (!win || !dialog) return;
    const taken = () => {
      if (this.dialog === dialog && !dialog.element.contains(this.doc.activeElement)) focus();
    };
    this.doc.addEventListener("focusin", taken, true);
    win.setTimeout(() => this.doc.removeEventListener("focusin", taken, true), KEEP_FOCUS_MS);
  }

  /** The window opened at an operation's review, the tags' view (at `tag`) under it for Back */
  async showReview(operation: Operation, tag?: string): Promise<void> {
    if (this.reviewing?.applying) return;
    await this.show(TAGS_VIEW, tag);
    if (this.reviewing?.applying) return;
    await this.review(operation);
  }

  /** The dialog made, where it is not open yet */
  private opening(): void {
    if (this.dialog) return;
    this.dialog = openDialog(this.doc, {
      title: "Tags",
      className: "swg-workspace",
      bar: this.tabs,
      content: this.body,
      footer: this.foot,
      // Esc in a review goes back to the view it came from; while its pages are written, nothing
      dismiss: () => {
        if (!this.reviewing) return true;
        if (!this.reviewing.applying) this.back();
        return false;
      },
      closed: () => {
        this.dialog = undefined;
        this.reviewing = undefined;
      },
    });
    this.focusView();
  }

  close(): void {
    this.dialog?.close();
  }

  private host(): WorkspaceHost {
    return {
      doc: this.doc,
      catalog: this.catalog!,
      review: (operation) => void this.review(operation),
      show: (view, state) => this.go(view, state),
      pick: (tag) => {
        this.picked = tag;
        this.go(TAGS_VIEW);
      },
      navigate: (page) => {
        this.close();
        void this.options.navigate(page);
      },
      remember: (state) => {
        this.state = state;
      },
    };
  }

  /** A view shown */
  private go(view: string, state?: unknown): void {
    const views = this.options.views();
    this.view = view === TAGS_VIEW || views.some((v) => v.id === view) ? view : TAGS_VIEW;
    this.state = state;
    this.reviewing = undefined;
    this.renderTabs(views);
    this.renderFoot();
    if (this.view === TAGS_VIEW) this.body.replaceChildren(this.tagsView());
    else this.body.replaceChildren(views.find((v) => v.id === this.view)!.render(this.host(), state));
    this.focusView();
  }

  private renderTabs(views: readonly View[]): void {
    const all = [{ id: TAGS_VIEW, label: "By tag" }, ...views];
    this.tabs.hidden = all.length < 2 || !!this.reviewing;
    this.tabs.replaceChildren(
      ...all.map((view) =>
        el(this.doc, "button", {
          class: "swg-view-tab",
          text: view.label,
          attrs: { role: "tab", "aria-selected": String(view.id === this.view), "data-swg-view": view.id },
          run: () => this.go(view.id),
        }),
      ),
    );
  }

  private renderFoot(): void {
    const { doc } = this;
    const undo = this.options.undo();
    const undoButton = undo
      ? el(doc, "button", {
          class: "swg-button swg-undo",
          html: ICONS.undo,
          title: `Undo: ${undo.label}`,
          attrs: { "aria-label": `Undo: ${undo.label}` },
          // Its review in the window, as any change's
          run: () => void undo.run(),
        })
      : null;
    undoButton?.append(` Undo: ${undo!.label}`);
    const settings = this.options.settings;
    const gear = settings ? el(doc, "button", { class: "swg-button swg-settings-open", html: ICONS.gear, title: "Silverware Tags settings", attrs: { "aria-label": "Silverware Tags settings" }, run: () => settings() }) : null;
    this.foot.replaceChildren(buttons(doc, ...(undoButton ? [undoButton] : []), el(doc, "span", "swg-spacer"), ...(gear ? [gear] : []), el(doc, "button", { class: "swg-button", text: "Close", run: () => this.close() })));
  }

  /** The field of the tag's name focused, its text selected (a module's part in the name's place) */
  private focusName(): void {
    const field = this.body.querySelector<HTMLInputElement>(".swg-detail [data-swg-name] input, .swg-detail input[data-swg-name]");
    field?.focus({ preventScroll: true });
    field?.select();
  }

  private focusView(): void {
    const field = this.body.querySelector<HTMLElement>("[data-swg-focus]") ?? this.body.querySelector<HTMLElement>("input");
    field?.focus({ preventScroll: true });
  }

  // ---- The review

  /** The operation's changes shown in place of the view: read first (counted), then each page's lines; `chose` the label of the choice that made it, focused again */
  private async review(operation: Operation, chose?: string): Promise<void> {
    const { doc } = this;
    const reviewing = { operation, applying: false };
    this.reviewing = reviewing;
    this.tabs.hidden = true;
    const line = el(doc, "p", { class: "swg-note", text: "Reading the pages…" });
    const bar = el(doc, "progress", { class: "swg-progress" });
    this.body.replaceChildren(el(doc, "div", "swg-review", el(doc, "h3", { class: "swg-review-title", text: operation.label }), line, bar));
    const back = el(doc, "button", { class: "swg-button swg-back", text: "Back", run: () => this.back() });
    this.foot.replaceChildren(buttons(doc, back));
    let plan: Plan;
    try {
      plan = await this.options.plan(operation, (done, of) => {
        line.textContent = `Reading page ${done} of ${of}…`;
        bar.max = of;
        bar.value = done;
      });
    } catch (e) {
      // (A custom operation's pages failing): said in the review, Back to the view
      if (this.reviewing !== reviewing) return;
      line.textContent = e instanceof Error ? e.message : String(e);
      line.classList.add("swg-error");
      bar.remove();
      return;
    }
    // (Gone back, or another review asked for, meanwhile)
    if (this.reviewing !== reviewing) return;
    const changes = plan.changes.reduce((sum, change) => sum + change.changes, 0);
    const options = (operation.options ?? []).map((option) => {
      const element =
        "toggled" in option
          ? checkbox(doc, option.label, option.on, () => void this.review(option.toggled(), option.label)).element
          : choice(doc, option.label, option.choices, option.chosen, (i) => void this.review(option.choose(i), option.label), option.buttons);
      return { label: option.label, element };
    });
    this.body.replaceChildren(
      el(
        doc,
        "div",
        "swg-review",
        el(doc, "h3", { class: "swg-review-title", text: operation.label }),
        el(doc, "p", { class: "swg-note", text: plan.changes.length ? `${counted(changes, "tag")} on ${counted(plan.changes.length, "page")} change. Nothing is written until you apply it.` : "Nothing to change." }),
        options.length ? el(doc, "div", "swg-review-options", ...options.map((o) => o.element)) : null,
        reviewList(doc, plan),
      ),
    );
    const label = `Apply to ${counted(plan.changes.length, "page")}`;
    const apply = el(doc, "button", {
      class: "swg-button swg-primary swg-apply",
      text: label,
      run: () => void this.apply(plan, reviewing, apply, back),
    });
    apply.disabled = !plan.changes.length;
    this.foot.replaceChildren(buttons(doc, back, el(doc, "span", "swg-spacer"), apply));
    // A choice made from the keyboard keeps its place: its control focused again, else Apply (Back where nothing changes)
    const again = options.find((o) => o.label === chose)?.element.querySelector<HTMLElement>("select, input:checked, input");
    (again ?? (plan.changes.length ? apply : back)).focus({ preventScroll: true });
  }

  private async apply(plan: Plan, reviewing: { readonly operation: Operation; applying: boolean }, button: HTMLButtonElement, back: HTMLButtonElement): Promise<void> {
    if (reviewing.applying || this.reviewing !== reviewing) return;
    reviewing.applying = true;
    button.disabled = true;
    back.disabled = true;
    try {
      await this.options.apply(
        plan,
        (done, of) => (button.textContent = `Applying ${done} of ${of}…`),
        () => (button.textContent = "Waiting for SilverBullet's index…"),
      );
    } catch (e) {
      reviewing.applying = false;
      back.disabled = false;
      button.textContent = "Apply";
      button.disabled = false;
      this.body.prepend(el(this.doc, "p", { class: "swg-error", text: `Not applied: ${e instanceof Error ? e.message : String(e)}` }));
      return;
    }
    try {
      this.catalog = await this.options.catalog();
    } catch (e) {
      // (Applied: the tags as read before, else the window would stay at the review, applying, for good)
      console.error("Silverware Tags: the tags could not be read again", e);
    }
    if (reviewing.operation.shows) this.picked = reviewing.operation.shows;
    this.chosen.clear();
    const view = this.options.views().find((v) => v.id === this.view);
    // Back where it was asked for (a rename's new name shown where that is the tags' view; a module's view stays its own)
    this.go(this.view, view?.applied ? view.applied(this.state) : this.state);
  }

  /** Back from the review to the view it came from, as it was */
  private back(): void {
    this.go(this.view, this.state);
  }

  // ---- By tags

  private tagsView(): HTMLElement {
    const { doc } = this;
    const catalog = this.catalog!;
    const tree = tagTree(new Map([...pageCounts(catalog)].filter(([name]) => isMetaTag(name) === this.meta)));
    if (this.picked && (!this.exists(this.picked) || isMetaTag(this.picked) !== this.meta)) this.picked = undefined;
    this.picked ??= tree[0]?.name;
    this.openTo(this.picked);
    const search = el(doc, "input", { class: "swg-field swg-search", attrs: { type: "search", placeholder: "Search tags", "aria-label": "Search tags", spellcheck: "false", "data-swg-focus": "" } });
    search.value = this.query;
    const list = el(doc, "ul", { class: "swg-tags", attrs: { role: "tree", "aria-label": "Tags", tabindex: "0" } });
    const detail = el(doc, "div", "swg-detail");

    const shownNodes = () => filterTree(tree, this.query);
    // A level's pages, counted once for this showing of the view (the tree is drawn anew at each key)
    const levelCounts = new Map<string, number>();
    const levelCount = (name: string) => levelCounts.get(name) ?? levelCounts.set(name, pagesWith(catalog, name, true).length).get(name)!;
    // The tags in the order they show (those open), for the arrows
    const visible = (): string[] => {
      const out: string[] = [];
      const walk = (nodes: readonly TagNode[]) => {
        for (const node of nodes) {
          out.push(node.name);
          if (node.children.length && (this.opened.has(node.name) || this.query)) walk(node.children);
        }
      };
      walk(shownNodes());
      return out;
    };
    const renderTree = () => {
      const item = (node: TagNode): HTMLElement => {
        const folder = node.children.length > 0;
        const expanded = folder && (this.opened.has(node.name) || !!this.query);
        const li = el(
          doc,
          "li",
          { class: "swg-tag-item", attrs: { role: "treeitem", "data-swg-tag": node.name, "aria-selected": String(this.chosen.size > 1 ? this.chosen.has(node.name) : node.name === this.picked), "aria-expanded": folder ? String(expanded) : undefined } },
          el(
            doc,
            "div",
            { class: "swg-tag-row", on: { click: (e) => pickWith(node.name, e) } },
            folder
              ? el(doc, "button", {
                  class: "swg-tree-toggle",
                  html: ICONS.chevron,
                  attrs: { "aria-expanded": String(expanded), "aria-label": `${expanded ? "Close" : "Open"} ${node.name}`, tabindex: "-1" },
                  on: {
                    click: (e) => {
                      e.stopPropagation();
                      if (this.opened.has(node.name)) this.opened.delete(node.name);
                      else this.opened.add(node.name);
                      renderTree();
                    },
                  },
                })
              : el(doc, "span", "swg-tree-toggle swg-tree-leaf"),
            el(doc, "span", { class: node.own ? "swg-tag-name" : "swg-tag-name swg-level", text: node.label, title: hashtagOf(node.name) }),
            // A tag with tags under it counts the pages using it or any of them, each once (as the panel does)
            ((count) => el(doc, "span", { class: "swg-count", text: String(count || ""), title: count ? (folder ? `${counted(count, "page")} using it or a tag under it` : counted(count, "page")) : "" }))(folder ? levelCount(node.name) : node.own),
          ),
        );
        if (expanded) li.append(el(doc, "ul", { class: "swg-tree-children", attrs: { role: "group" } }, ...node.children.map(item)));
        return li;
      };
      const nodes = shownNodes();
      list.replaceChildren(...(nodes.length ? nodes.map(item) : [el(doc, "li", { class: "swg-empty", text: tree.length ? "No tag holds that." : "No tags in this space yet." })]));
    };
    const showDetail = () =>
      detail.replaceChildren(
        ...(this.chosen.size > 1 ? this.tagsDetail([...this.chosen].sort((a, b) => a.localeCompare(b)), () => showAll()) : this.picked ? this.tagDetail(this.picked) : [el(doc, "p", { class: "swg-empty", text: "Pick a tag." })]),
      );
    const showAll = () => {
      renderTree();
      showDetail();
    };
    // A tag picked alone (a click, the arrows)
    const pick = (tag: string) => {
      this.picked = tag;
      this.chosen.clear();
      showAll();
    };
    // Ctrl (Cmd) and a click adds a tag to those picked or takes it off, Shift and a click picks those from the one picked before
    const pickWith = (tag: string, e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (!this.chosen.size && this.picked) this.chosen.add(this.picked);
        if (this.chosen.has(tag)) this.chosen.delete(tag);
        else this.chosen.add(tag);
        this.picked = tag;
        if (this.chosen.size < 2) {
          this.picked = [...this.chosen][0] ?? tag;
          this.chosen.clear();
        }
        showAll();
      } else if (e.shiftKey && this.picked) {
        const shown = visible();
        const [a, b] = [shown.indexOf(this.picked), shown.indexOf(tag)].sort((x, y) => x - y);
        this.chosen.clear();
        for (const name of shown.slice(a!, b! + 1)) this.chosen.add(name);
        if (this.chosen.size < 2) this.chosen.clear();
        showAll();
      } else pick(tag);
    };

    search.addEventListener("input", () => {
      this.query = search.value;
      const shown = visible();
      if (!this.picked || !shown.includes(this.picked)) this.picked = shown[0];
      this.chosen.clear();
      showAll();
    });
    // ↑ ↓ through the tags shown, → opens a level, ← closes it (from the search field too)
    const keys = (e: KeyboardEvent) => {
      const shown = visible();
      const at = this.picked ? shown.indexOf(this.picked) : -1;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = shown[Math.min(shown.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
        if (next) pick(next);
        list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.currentTarget === list && this.picked) {
        e.preventDefault();
        if (e.key === "ArrowRight") this.opened.add(this.picked);
        else this.opened.delete(this.picked);
        renderTree();
      } else if (e.currentTarget === list && this.chosen.size > 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // The tags picked together: an action's key of theirs
        const action = this.options.tagsActions().find((a) => a.key === e.key && !a.ask);
        if (action) {
          e.preventDefault();
          void this.runTagsAction(action, [...this.chosen]);
        }
      } else if (e.currentTarget === list && this.picked && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // The tag's keys in the tree (not the search field, whose keys are its text's): F2 its name's field, an action's own
        if (e.key === "F2") {
          e.preventDefault();
          this.focusName();
          return;
        }
        const tag = this.picked;
        const action = this.options.tagActions().find((a) => a.key === e.key && (a.when?.(tag, catalog) ?? true));
        if (action) {
          e.preventDefault();
          void this.runAction(action, tag);
        }
      }
    };
    search.addEventListener("keydown", keys);
    list.addEventListener("keydown", keys);

    // (Those picked before that are gone, renamed or deleted, left out)
    for (const name of [...this.chosen]) if (!this.exists(name)) this.chosen.delete(name);
    if (this.chosen.size < 2) this.chosen.clear();
    renderTree();
    showDetail();
    // Tags | Meta, as SilverBullet's tree has its pages and its meta pages apart
    const kinds = el(
      doc,
      "div",
      { class: "swg-segments", attrs: { role: "group", "aria-label": "Which tags" } },
      ...[
        { meta: false, label: "Tags", title: "The tags of your pages" },
        { meta: true, label: "Meta", title: "SilverBullet's own tags (meta and under it), marking libraries, templates and its API" },
      ].map((kind) =>
        el(doc, "button", {
          class: "swg-segment",
          text: kind.label,
          title: kind.title,
          attrs: { "aria-pressed": String(kind.meta === this.meta), "data-swg-segment": kind.meta ? "meta" : "tags" },
          run: () => {
            if (kind.meta === this.meta) return;
            this.meta = kind.meta;
            this.picked = undefined;
            this.go(TAGS_VIEW);
          },
        }),
      ),
    );
    return el(doc, "div", "swg-manager-body", el(doc, "div", "swg-manager-tags", this.options.metaApart ? kinds : null, search, list), detail);
  }

  /** Whether a tag is in the tree (used, or a level above one) */
  private exists(tag: string): boolean {
    return [...this.catalog!.tags.keys()].some((name) => name === tag || name.startsWith(`${tag}/`));
  }

  private openTo(tag: string | undefined): void {
    const parts = tag?.split("/") ?? [];
    for (let i = 1; i < parts.length; i++) this.opened.add(parts.slice(0, i).join("/"));
  }

  /** The tag picked: its name (or a module's field), its uses, the modules' actions, its pages */
  private tagDetail(tag: string): HTMLElement[] {
    const { doc } = this;
    const catalog = this.catalog!;
    const info = catalog.tags.get(tag);
    const under = pagesWith(catalog, tag, true).length;
    const subtags = subtagsOf(catalog, tag).length;
    const uses = info ? [...info.byContext].map(([context, pages]) => `${counted(pages.size, "page")} in ${CONTEXTS[context] ?? context}`) : [];
    const parts = this.options.tagParts(tag, this.host());
    const name = parts.find((part) => part.name)?.name ?? el(doc, "h3", { class: "swg-detail-name", text: hashtagOf(tag) });
    // (Where the window is asked to focus the tag's name: whatever a module put there)
    name.setAttribute("data-swg-name", "");
    const pages = info ? [...info.pages].sort((a, b) => a.localeCompare(b)) : [];
    return [
      name,
      el(doc, "p", {
        class: "swg-detail-uses",
        text: [info ? `Used on ${counted(info.pages.size, "page")}` : "No page uses it itself", ...(uses.length > 1 ? [uses.join(", ")] : []), ...(subtags ? [`${counted(subtags, "tag")} under it, on ${counted(under, "page")} in all`] : [])].join(" · "),
      }),
      el(
        doc,
        "div",
        "swg-actions",
        ...this.options
          .tagActions()
          .filter((action) => action.when?.(tag, catalog) ?? true)
          .map((action) =>
            el(doc, "button", {
              class: action.danger ? "swg-button swg-danger" : "swg-button",
              text: action.label,
              title: action.key ? `${action.label} (${action.key})` : undefined,
              attrs: { "data-swg-action": action.id },
              run: () => void this.runAction(action, tag),
            }),
          ),
      ),
      ...(pages.length ? [this.pageList(tag, pages, info)] : []),
    ];
  }

  /**
   * Several tags picked together: them (each × leaving it out), how many
   * pages they are on, the modules' actions on them all (one asking for a name
   * first: a field, the space's tags offered)
   */
  private tagsDetail(tags: readonly string[], changed: () => void): HTMLElement[] {
    const { doc } = this;
    const catalog = this.catalog!;
    const pages = new Set(tags.flatMap((tag) => [...(catalog.tags.get(tag)?.pages ?? [])]));
    const asking = el(doc, "div", "swg-ask");
    const labelOf = (action: TagsAction) => action.label.replace("{n}", String(tags.length));
    const ask = (action: TagsAction) => {
      const field = tagField(doc, { placeholder: "A tag's name", suggest: (typed) => suggestions([...catalog.tags.keys()], typed) });
      const said = note(doc);
      const submit = () => {
        const name = field.value();
        const problem = nameProblem(name) ?? action.ask?.problem?.(name, tags);
        if (problem) {
          said.say(problem, true);
          return;
        }
        void this.runTagsAction(action, tags, name);
      };
      const go = el(doc, "button", { class: "swg-button swg-primary swg-ask-go", text: labelOf(action).replace(/…$/, ""), run: () => submit() });
      field.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.defaultPrevented) {
          e.preventDefault();
          submit();
        }
      });
      asking.replaceChildren(labelled(doc, action.ask!.label, field.element), el(doc, "div", "swg-actions", go), said.element);
      field.input.focus();
    };
    return [
      el(doc, "h3", { class: "swg-detail-name", text: `${counted(tags.length, "tag")} picked` }),
      el(doc, "p", { class: "swg-detail-uses", text: `On ${counted(pages.size, "page")} in all · Ctrl or Shift and a click picks more` }),
      el(
        doc,
        "div",
        "swg-chips swg-chosen",
        ...tags.map((tag) =>
          el(
            doc,
            "span",
            { class: "swg-chip", attrs: { "data-swg-chip": tag } },
            el(doc, "span", { class: "swg-chip-name", text: hashtagOf(tag) }),
            el(doc, "button", {
              class: "swg-chip-remove",
              html: ICONS.close,
              title: `Leave ${hashtagOf(tag)} out`,
              attrs: { "aria-label": `Leave ${hashtagOf(tag)} out` },
              run: () => {
                this.chosen.delete(tag);
                if (this.chosen.size < 2) {
                  this.picked = [...this.chosen][0] ?? this.picked;
                  this.chosen.clear();
                }
                changed();
              },
            }),
          ),
        ),
      ),
      el(
        doc,
        "div",
        "swg-actions",
        ...this.options.tagsActions().map((action) =>
          el(doc, "button", {
            class: action.danger ? "swg-button swg-danger" : "swg-button",
            text: labelOf(action),
            title: action.key ? `${labelOf(action)} (${action.key})` : undefined,
            attrs: { "data-swg-action": action.id },
            run: () => (action.ask ? ask(action) : void this.runTagsAction(action, tags)),
          }),
        ),
      ),
      asking,
    ];
  }

  /** An action on several tags run: what it gives reviewed */
  private async runTagsAction(action: TagsAction, tags: readonly string[], name?: string): Promise<void> {
    let operation: Operation | void;
    try {
      operation = await action.run(tags, this.host(), name);
    } catch (e) {
      this.body.prepend(el(this.doc, "p", { class: "swg-error", text: `${action.label}: ${e instanceof Error ? e.message : String(e)}` }));
      return;
    }
    if (operation) await this.review(operation);
  }

  /** An action on a tag run: what it gives reviewed; a failure said where the window is */
  private async runAction(action: TagAction, tag: string): Promise<void> {
    let operation: Operation | void;
    try {
      operation = await action.run(tag, this.host());
    } catch (e) {
      this.body.prepend(el(this.doc, "p", { class: "swg-error", text: `${action.label}: ${e instanceof Error ? e.message : String(e)}` }));
      return;
    }
    if (operation) await this.review(operation);
  }

  /** A tag's pages, the first PAGES_SHOWN of them until all are asked for (a tag may be on hundreds) */
  private pageList(tag: string, pages: readonly string[], info: TagInfo | undefined): HTMLElement {
    const { doc } = this;
    const item = (page: string) =>
      el(
        doc,
        "li",
        {},
        el(doc, "button", { class: "swg-page-link", text: page, title: `Open ${page}`, attrs: { "data-swg-page": page }, run: () => this.host().navigate(page) }),
        el(doc, "span", { class: "swg-page-contexts", text: info ? [...info.byContext].filter(([, set]) => set.has(page)).map(([context]) => CONTEXT[context] ?? context).join(", ") : "" }),
      );
    const list = el(doc, "ul", { class: "swg-pages", attrs: { "aria-label": `Pages tagged ${hashtagOf(tag)}` } }, ...pages.slice(0, PAGES_SHOWN).map(item));
    if (pages.length <= PAGES_SHOWN) return list;
    const more = el(doc, "button", {
      class: "swg-button swg-more",
      text: `Show all ${counted(pages.length, "page")}`,
      run: () => {
        list.append(...pages.slice(PAGES_SHOWN).map(item));
        more.remove();
      },
    });
    return el(doc, "div", "swg-pages-wrap", list, more);
  }
}

