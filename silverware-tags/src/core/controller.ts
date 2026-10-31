// The core: the host the modules get (the space, the catalog, operations run
// through a preview and kept for Undo), its own commands (the manager, Undo)
// and the modules' commands. Knows no module by name.
import type { Notifier, Space } from "../space/space.ts";
import { showManager } from "../ui/manager.ts";
import { showPreview } from "../ui/preview.ts";
import { showProgress } from "../ui/progress.ts";
import { type Catalog, readCatalog } from "./catalog.ts";
import { History } from "./history.ts";
import type { Command, ModuleHost, TagsModule } from "./module.ts";
import { counted, type Operation } from "./operation.ts";
import { type Applied, applyPlan, makePlan, type Skipped, undoApplied } from "./plan.ts";

// Pages left alone a notification names (the rest counted)
const NAMED = 3;

/** The pages left alone and why, the first few named */
function leftAlone(skipped: readonly Skipped[]): string {
  const named = skipped.slice(0, NAMED).map((skip) => `${skip.page} ${skip.reason}`);
  return [...named, ...(skipped.length > NAMED ? [`and ${counted(skipped.length - NAMED, "more page")}`] : [])].join("; ");
}

export const MANAGER_COMMAND = "Silverware Tags: Manager";
export const UNDO_COMMAND = "Silverware Tags: Undo last change";

export class Controller {
  readonly host: ModuleHost;
  private readonly history = new History();
  private modules: readonly TagsModule[] = [];

  constructor(
    private readonly doc: Document,
    private readonly space: Space,
    private readonly notifier: Notifier,
  ) {
    this.host = {
      doc,
      space,
      notifier,
      catalog: () => readCatalog(space),
      run: (operation) => this.run(operation),
      apply: (operation) => this.apply(operation),
    };
  }

  /** The modules, made with the host (modules.ts) */
  setModules(modules: readonly TagsModule[]): void {
    this.modules = modules;
  }

  /** Every command: the core's, then the modules' in their order */
  commands(): Command[] {
    return [
      { name: MANAGER_COMMAND, run: () => this.openManager() },
      ...this.modules.flatMap((module) => module.commands?.() ?? []),
      { name: UNDO_COMMAND, run: () => this.undo() },
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

  async openManager(tag?: string): Promise<void> {
    await showManager(this.doc, {
      catalog: () => readCatalog(this.space),
      actions: (name, catalog: Catalog) => this.modules.flatMap((module) => module.tagActions?.(name, catalog) ?? []),
      navigate: (page) => this.space.navigate(page),
      undo: () => (this.history.last ? { label: this.history.last.operation.label, run: () => this.undo() } : undefined),
      tag,
    });
  }

  private async run(operation: Operation): Promise<boolean> {
    const progress = showProgress(this.doc, operation.label, "Reading page");
    let plan;
    try {
      plan = await makePlan(this.space, await readCatalog(this.space), operation, (done, of) => progress.update(done, of));
    } finally {
      progress.close();
    }
    if (!plan.changes.length && !plan.skipped.length) {
      this.notifier.flash(`${operation.label}: nothing to change`);
      return false;
    }
    let applied: Applied | undefined;
    const done = await showPreview(this.doc, plan, async (progress) => {
      applied = await applyPlan(this.space, plan, progress);
    });
    if (!done || !applied) return false;
    this.said(applied);
    return true;
  }

  private async apply(operation: Operation): Promise<boolean> {
    const plan = await makePlan(this.space, await readCatalog(this.space), operation);
    if (plan.skipped.length && !plan.changes.length) {
      this.notifier.flash(`${operation.label}: ${leftAlone(plan.skipped)}`, "error");
      return false;
    }
    const applied = await applyPlan(this.space, plan);
    this.said(applied);
    return applied.written.length > 0;
  }

  /** What was applied said, with Undo; kept for it */
  private said(applied: Applied): void {
    this.history.push(applied);
    const changes = applied.written.reduce((sum, change) => sum + change.changes, 0);
    const skipped = applied.skipped.length ? ` (${counted(applied.skipped.length, "page")} left alone)` : "";
    this.notifier.flash(`${applied.operation.done(applied.written.length, changes)}${skipped}`, applied.written.length ? "info" : "error", applied.written.length ? [{ name: "Undo", run: () => void this.undo() }] : undefined);
  }

  /** The last change applied undone, where its pages are still as written */
  async undo(): Promise<void> {
    const last = this.history.pop();
    if (!last) {
      this.notifier.flash("Silverware Tags: nothing to undo");
      return;
    }
    const progress = showProgress(this.doc, `Undo: ${last.operation.label}`, "Writing page");
    let undone;
    try {
      undone = await undoApplied(this.space, last, (done, of) => progress.update(done, of));
    } finally {
      progress.close();
    }
    const { restored, skipped } = undone;
    const left = skipped.length ? `; ${leftAlone(skipped)}` : "";
    this.notifier.flash(`Undone: ${last.operation.label} (${counted(restored.length, "page")})${left}`, skipped.length ? "error" : "info");
  }

  private failed(e: unknown): void {
    console.error("Silverware Tags:", e);
    this.notifier.flash(`Silverware Tags: ${e instanceof Error ? e.message : String(e)}`, "error");
  }
}
