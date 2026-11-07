// The page writer: the one place that knows how anything is written in a
// page. A plugin gives it changes in the model's terms (changes.ts) and gets
// back what happened; it never sees a page's text. Two steps:
//
// - `plan`: each page read, how it was read kept (its text, compared again
//   before writing), its new text made in memory; a summary (how many
//   changes), a preview of lines ready to show, the pages left alone and why.
//   Nothing written.
// - `apply`: page by page, each where it is still as read (the page open in
//   the editor through the editor: one edit, one undo step there; another
//   through the space), the rest left and reported.
//
// Undo is a plan too (`planUndo`): each page written back where it is still
// as `apply` left it. The texts stay here, out of what the plugin is given
// (`texts`): a plan's pages show themselves (`preview`) and nothing more.
import type { Editor, Platform, Space } from "../platform.ts";
import { inBatches, type Progress } from "./batch.ts";
import type { Changes, PageChange, PageEntry } from "./changes.ts";
import { type DiffRun, diffLines, minimalEdit } from "./diff.ts";
import { type WriterOptions, written } from "./parts.ts";
import { type EditResult, type TagUse, tagUses } from "./tags/edit.ts";

export type { Progress } from "./batch.ts";
export type { WriterOptions } from "./parts.ts";

/** A page left alone, and why */
export type Skipped = { readonly page: string; readonly reason: string };

/** A page as a plan would change it: what it shows of itself */
export type PlannedPage = {
  readonly page: string;
  // Its new name, where it is renamed
  readonly renamedTo?: string;
  // How many things change on it (each tag, each property)
  readonly changes: number;
  // The tags it has no more and those it has now, as an index would read them (what to wait for), made as asked
  tagChanges(): { readonly gone: readonly string[]; readonly added: readonly string[] };
  // The lines changed, before and after, ready to show
  preview(): readonly DiffRun[];
};

export type PagePlan = {
  readonly pages: readonly PlannedPage[];
  readonly skipped: readonly Skipped[];
  // The report this plan undoes (made by `planUndo`)
  readonly undoes?: ApplyReport;
};

/** What `apply` did: the pages written, those left and why */
export type ApplyReport = {
  readonly written: readonly PlannedPage[];
  readonly skipped: readonly Skipped[];
  // The report it undoes, where its plan was an undo
  readonly undoes?: ApplyReport;
};

/** A page as read, as a plan's `leaveAlone` asks about it */
export type PageRead = { readonly name: string; tagUses(): readonly TagUse[] };

export type PlanOptions = {
  readonly progress?: Progress;
  // Why a page is left alone whatever the changes would do (a meta page, protected); undefined: it is not
  readonly leaveAlone?: (page: PageRead) => string | undefined;
};

export interface PageWriter {
  plan(changes: Changes, options?: PlanOptions): Promise<PagePlan>;
  apply(plan: PagePlan, options?: { readonly progress?: Progress }): Promise<ApplyReport>;
  /** Planned and applied at once, no preview (a value changed in a cell) */
  write(changes: Changes, options?: PlanOptions): Promise<ApplyReport>;
  /** What `report` wrote, put back where each page is still as it left it */
  planUndo(report: ApplyReport, options?: { readonly progress?: Progress }): Promise<PagePlan>;
}

// A planned page's texts, kept by the writer that planned it (a plugin has one writer): the plugin is given
// the page, never them
type Texts = { readonly before: string; readonly after: string };

function planned(texts: WeakMap<PlannedPage, Texts>, page: string, changes: number, own: Texts, renamedTo?: string): PlannedPage {
  let tags: ReturnType<PlannedPage["tagChanges"]> | undefined;
  const tagChanges = () => {
    if (tags) return tags;
    const names = (text: string) => new Set(tagUses(text).map((use) => use.name));
    const was = names(own.before);
    const now = names(own.after);
    return (tags = { gone: [...was].filter((name) => !now.has(name)), added: [...now].filter((name) => !was.has(name)) });
  };
  const one: PlannedPage = { page, ...(renamedTo === undefined ? {} : { renamedTo }), changes, tagChanges, preview: () => diffLines(own.before, own.after) };
  texts.set(one, own);
  return one;
}

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Why a page changed meanwhile is left: since it was read, or (an undo) since it was written */
const changedReason = (plan: PagePlan) => (plan.undoes ? "changed since it was written: left as it is" : "changed since it was read: left alone");

/** A page's changes applied in turn: its new text and how many changed, or the first problem */
async function changedPage(text: string, changes: readonly PageChange[], options: WriterOptions): Promise<EditResult> {
  let result: EditResult = { text, changes: 0 };
  for (const change of changes) {
    const next = await written(result.text, change, options);
    if (next.problem) return next;
    result = { text: next.text, changes: result.changes + next.changes };
  }
  return result;
}

/** The writer over the platform's editor (the page open in it) and space (every other page) */
export function pageWriter(platform: Pick<Platform, "editor" | "space">, options: WriterOptions = {}): PageWriter {
  const { editor, space } = platform;
  const texts = new WeakMap<PlannedPage, Texts>();
  const isOpen = async (page: string) => {
    try {
      return (await editor.documentName()) === page;
    } catch {
      return false;
    }
  };
  const read = async (page: string) => (await isOpen(page) ? String(await editor.text()) : String(await space.read(page)));
  const writeText = (page: string, before: string, after: string) => writeIfAsRead(editor, space, isOpen, page, before, after);

  const plan = async (changes: Changes, planOptions: PlanOptions = {}): Promise<PagePlan> => {
    const outcomes = await inBatches(
      changes,
      async (entry: PageEntry): Promise<PlannedPage | Skipped | undefined> => {
        const { page } = entry;
        let before: string;
        try {
          before = await read(page);
        } catch (e) {
          return { page, reason: `could not be read (${reasonOf(e)})` };
        }
        // (Told by its text as it is now: an index may not have caught up with it)
        const left = planOptions.leaveAlone?.({ name: page, tagUses: () => tagUses(before) });
        if (left) return { page, reason: left };
        let result: EditResult;
        try {
          result = await changedPage(before, entry.changes, options);
        } catch (e) {
          return { page, reason: `its edit failed (${reasonOf(e)}): left alone` };
        }
        if (result.problem) return { page, reason: result.problem };
        const renamed = entry.renameTo !== undefined && entry.renameTo !== page;
        if (!renamed && (!result.changes || result.text === before)) return undefined;
        return planned(texts, page, result.changes + (renamed ? 1 : 0), { before, after: result.text }, renamed ? entry.renameTo : undefined);
      },
      planOptions.progress,
    );
    return { pages: outcomes.filter(isPlanned), skipped: outcomes.filter(isSkipped) };
  };

  const apply = async (toApply: PagePlan, applyOptions: { readonly progress?: Progress } = {}): Promise<ApplyReport> => {
    const outcomes = await inBatches(
      toApply.pages,
      async (one): Promise<PlannedPage | Skipped> => {
        const own = texts.get(one);
        if (!own) return { page: one.page, reason: "not planned by this writer: left alone" };
        try {
          let page = one.page;
          if (one.renamedTo !== undefined) {
            // (Renamed first only where it is still as read, so a page changed meanwhile is neither renamed nor written)
            if ((await read(page)) !== own.before) return { page, reason: changedReason(toApply) };
            if (!space.rename) return { page, reason: "this space cannot rename pages: left alone" };
            const { problem } = await space.rename(page, one.renamedTo);
            if (problem) return { page, reason: `could not be renamed (${problem})` };
            page = one.renamedTo;
          }
          const written = own.before === own.after ? "written" : await writeText(page, own.before, own.after);
          if (written === "written") return one;
          if (one.renamedTo === undefined) return { page: one.page, reason: changedReason(toApply) };
          // Renamed, its text changed by the rename itself (a link to itself followed): the name is written, its
          // content left, and so it is reported, so that Undo can give the name back
          const now = await read(page);
          return planned(texts, one.page, 1, { before: now, after: now }, one.renamedTo);
        } catch (e) {
          return { page: one.page, reason: `could not be written (${reasonOf(e)})` };
        }
      },
      applyOptions.progress,
    );
    return {
      written: outcomes.filter(isPlanned),
      skipped: [...toApply.skipped, ...outcomes.filter(isSkipped)],
      ...(toApply.undoes ? { undoes: toApply.undoes } : {}),
    };
  };

  const planUndo = async (report: ApplyReport, undoOptions: { readonly progress?: Progress } = {}): Promise<PagePlan> => {
    const outcomes = await inBatches(
      report.written,
      async (one): Promise<PlannedPage | Skipped> => {
        const own = texts.get(one);
        // Where it is now: under its new name where it was renamed
        const page = one.renamedTo ?? one.page;
        if (!own) return { page, reason: "not written by this writer: left as it is" };
        let now: string;
        try {
          now = await read(page);
        } catch (e) {
          return { page, reason: `could not be read (${reasonOf(e)})` };
        }
        if (now !== own.after) return { page, reason: "changed since it was written: left as it is" };
        return planned(texts, page, one.changes, { before: own.after, after: own.before }, one.renamedTo === undefined ? undefined : one.page);
      },
      undoOptions.progress,
    );
    return { pages: outcomes.filter(isPlanned), skipped: outcomes.filter(isSkipped), undoes: report };
  };

  return {
    plan,
    apply,
    write: async (changes, planOptions) => apply(await plan(changes, planOptions)),
    planUndo,
  };
}

const isPlanned = (outcome: PlannedPage | Skipped | undefined): outcome is PlannedPage => !!outcome && "changes" in outcome;
const isSkipped = (outcome: PlannedPage | Skipped | undefined): outcome is Skipped => !!outcome && "reason" in outcome;

/**
 * A page's text written where it is still `before` (else "changed", nothing
 * written): the page open in the editor through it, as one edit (never its
 * file, which the platform would take for a change made elsewhere: in
 * SilverBullet a sync conflict), another through the space
 */
async function writeIfAsRead(editor: Editor, space: Space, isOpen: (page: string) => Promise<boolean>, page: string, before: string, after: string): Promise<"written" | "changed"> {
  if (await isOpen(page)) {
    const now = String(await editor.text());
    if (now !== before) return "changed";
    const edit = minimalEdit(now, after);
    if (edit) await editor.replace(edit.from, edit.to, edit.insert);
    return "written";
  }
  let now: string;
  try {
    now = String(await space.read(page));
  } catch {
    return "changed";
  }
  if (now !== before) return "changed";
  await space.write(page, after);
  return "written";
}
