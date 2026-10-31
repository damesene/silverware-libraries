// The core: the window of tags (ui/workspace.ts) with the modules' views and
// parts, operations planned, reviewed there, applied and kept for Undo, its
// own commands (the window, Undo) and the modules' commands. Knows no module
// by name.
import type { Notifier, Space } from "../space/space.ts";
import { TAGS_VIEW, Workspace } from "../ui/workspace.ts";
import { isMetaTag } from "../tags/names.ts";
import { tagUses } from "../tags/edit.ts";
import { readCatalog } from "./catalog.ts";
import { History } from "./history.ts";
import type { Command, ModuleHost, TagsModule } from "./module.ts";
import { counted } from "./operation.ts";
import { type Applied, applyPlan, type Guard, makePlan, type Skipped, undoOperation } from "./plan.ts";

// Pages left alone a notification names (the rest counted)
const NAMED = 3;

/** The pages left alone and why, the first few named */
function leftAlone(skipped: readonly Skipped[]): string {
  const named = skipped.slice(0, NAMED).map((skip) => `${skip.page} ${skip.reason}`);
  return [...named, ...(skipped.length > NAMED ? [`and ${counted(skipped.length - NAMED, "more page")}`] : [])].join("; ");
}

export const MANAGER_COMMAND = "Silverware Tags: Manager";
export const UNDO_COMMAND = "Silverware Tags: Undo last change";
export const SETTINGS_COMMAND = "Silverware Tags: Settings";

export type ControllerOptions = {
  // SilverBullet's meta pages left out of everything and never changed (the setting)
  readonly protectMeta?: boolean;
  // The settings dialog, where the host has one (index.ts makes it of the bridge)
  readonly settings?: () => Promise<void>;
};

export class Controller {
  // What every module's host has; each module gets its own of it (`hostFor`)
  private readonly host: Omit<ModuleHost, "offer">;
  private readonly history = new History();
  private modules: readonly TagsModule[] = [];
  private readonly workspace: Workspace;
  // What the modules offer each other, by the name of the module offering it (made as they are created)
  private readonly offers = new Map<string, unknown>();

  constructor(
    doc: Document,
    space: Space,
    private readonly notifier: Notifier,
    private readonly options: ControllerOptions = {},
  ) {
    const catalog = () => readCatalog(space, { hideMeta: this.options.protectMeta });
    // A meta page as read now is never changed (the index may not have caught up with it); its tags as the
    // index has the page's (the catalog hides by them): the frontmatter's, tag lines', a paragraph's hashtags
    const meta = (text: string) => tagUses(text).some((use) => (use.context === "page" || use.context === "paragraph") && isMetaTag(use.name));
    const guard: Guard | undefined = this.options.protectMeta ? (text) => (meta(text) ? "a meta page: left alone (Hide and protect meta pages)" : undefined) : undefined;
    this.workspace = new Workspace(doc, {
      catalog,
      metaApart: !this.options.protectMeta,
      settings: this.options.settings ? () => void this.openSettings() : undefined,
      views: () => this.modules.flatMap((module) => module.views?.() ?? []),
      tagParts: (tag, host) => this.modules.flatMap((module) => (module.tagParts ? [module.tagParts(tag, host)] : [])),
      tagActions: () => this.modules.flatMap((module) => module.tagActions?.() ?? []),
      navigate: (page) => space.navigate(page),
      // An undo not guarded: it puts back text the guard let through, where the page is as written (a change that made a page a meta page is undone too)
      plan: async (operation, progress) => makePlan(space, await catalog(), operation, progress, operation.undoes ? undefined : guard),
      apply: async (plan, progress) => {
        const applied = await applyPlan(space, plan, progress);
        this.said(applied);
        return applied;
      },
      undo: () => (this.history.last ? { label: this.history.last.operation.label, run: () => this.undo() } : undefined),
    });
    this.host = {
      doc,
      space,
      notifier,
      catalog,
      open: (view, state) => this.workspace.show(view, state),
      review: (operation, tag) => this.workspace.showReview(operation, tag),
      offered: <T>(name: string) => this.offers.get(name) as T | undefined,
    };
  }

  /**
   * The host a module gets, made for it: what it offers is its own, under its
   * name (as Silverware Table's modules get theirs: the module never says who
   * it is, and cannot offer as another)
   */
  hostFor(name: string): ModuleHost {
    return { ...this.host, offer: (api) => void this.offers.set(name, api) };
  }

  /** The modules, made each with its host (modules.ts) */
  setModules(modules: readonly TagsModule[]): void {
    this.modules = modules;
  }

  /** What the module of that name offers (index.ts hands the panel's to the library page) */
  offered<T>(name: string): T | undefined {
    return this.offers.get(name) as T | undefined;
  }

  /** Every command: the core's, then the modules' in their order */
  commands(): Command[] {
    return [
      { name: MANAGER_COMMAND, run: () => this.workspace.show(TAGS_VIEW) },
      ...this.modules.flatMap((module) => module.commands?.() ?? []),
      { name: UNDO_COMMAND, run: () => this.undo() },
      ...(this.options.settings ? [{ name: SETTINGS_COMMAND, run: () => this.openSettings() }] : []),
    ];
  }

  /** A command run by its name (the library page's commands call it) */
  async runCommand(name: string): Promise<void> {
    const command = this.commands().find((c) => c.name === name);
    if (!command) {
      this.notifier.flash(`Silverware Tags: no command "${name}" (its module turned off?)`, "error");
      return;
    }
    try {
      await command.run();
    } catch (e) {
      this.failed(e);
    }
  }

  /** The settings dialog, the window closed first (its settings start Silverware Tags anew) */
  private async openSettings(): Promise<void> {
    this.workspace.close();
    await this.options.settings?.();
  }

  /** What was applied said, with Undo, and kept for it; an undo takes the change it undid off instead */
  private said(applied: Applied): void {
    const undid = applied.operation.undoes;
    if (undid) this.history.remove(undid);
    else this.history.push(applied);
    const changes = applied.written.reduce((sum, change) => sum + change.changes, 0);
    const skipped = applied.skipped.length ? ` (${leftAlone(applied.skipped)})` : "";
    const undo = applied.written.length && !undid ? [{ name: "Undo", run: () => void this.undo() }] : undefined;
    this.notifier.flash(`${applied.operation.done(applied.written.length, changes)}${skipped}`, applied.written.length ? "info" : "error", undo);
  }

  /** The last change applied, reviewed to be undone in the window (as any change: what goes back, page by page) */
  async undo(): Promise<void> {
    const last = this.history.last;
    if (!last) {
      this.notifier.flash("Silverware Tags: nothing to undo");
      return;
    }
    await this.workspace.showReview(undoOperation(last));
  }

  private failed(e: unknown): void {
    console.error("Silverware Tags:", e);
    this.notifier.flash(`Silverware Tags: ${e instanceof Error ? e.message : String(e)}`, "error");
  }
}
