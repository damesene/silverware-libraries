// The pages store: databases kept in a space's pages (docs/silverware-database.md,
// *The pages store*). A database is its root page (tagged `db-root`, its record
// under `_database`) and the pages of its folder tagged `db`, one an item.
// Read from the platform's index; written through the page writer alone,
// page by page where each is still as read, and undone the same way. What a
// transaction comes to is transaction.ts', the same as every store's.
//
// The index catches up with a write later: what the store wrote it holds
// (`wrote`) until the index has the page so. SilverBullet tells of a page
// indexed a moment before a query gives it (seen 2026-11-07: an item added
// shown, then gone for that moment), so being told is not enough; what the
// store holds goes HOLD_TOLD_MS after it was told of the page in any case,
// so a page changed by hand right after is shown as the index has it.
import { type PageBuilder, pageChanges } from "../../../../shared/pages/changes.ts";
import { readFrontmatter } from "../../../../shared/pages/frontmatter.ts";
import { type ApplyReport, type PagePlan, type PageWriter, pageWriter } from "../../../../shared/pages/writer.ts";
import type { IndexedObject, Platform } from "../../../../shared/platform.ts";
import type { Changes } from "../../core/changes.ts";
import type { DatabaseStore, FormatStatus, MigrationScope, Planned, SkipCause, Skipped, StoreCapabilities, Target, TransactionPlan, TransactionReport } from "../../core/store.ts";
import type { Database, DatabaseSummary, Item, ItemKey, Revised } from "../../model/database.ts";
import { draftTransaction, type ItemState, type RecordState, type StoreRules, type StoreState, takenNames, withoutClashes } from "../transaction.ts";
import { FORMATS, ITEM_TAG, type PagesFormat, ROOT_TAG, systemOf, versionOf } from "./format.ts";

export type PagesStoreOptions = {
  /** The root page a database made by the store gets (by default `db-<id>` at the space's top; the binding: beside the page showing it) */
  readonly rootPage?: (id: string) => string;
  /** The formats known, the latest last (by default those of format.ts; a test adds an older one) */
  readonly formats?: readonly PagesFormat[];
};

/** Keys SilverBullet's page objects have, beside a page's frontmatter (probe 1): no property's key */
const PAGE_KEYS = new Set(["name", "tags", "tag", "itags", "ref", "range", "aliases", "displayName", "lastModified", "created", "perm", "contentType", "size", "pageDecoration"]);

/** Why a name cannot be a page's (SilverBullet's `isValidName`, and no `/`, which would make a subpage) */
export function validatePageName(name: string): string | undefined {
  if (!name.trim()) return "an item needs a name";
  if (name !== name.trim()) return "a page's name starts or ends with no space";
  if (name.includes("/")) return `"${name}" holds a /, which would make a subpage`;
  if (/[@#|<>$]/.test(name) || name.includes("[[") || name.includes("]]")) return `"${name}" holds a character a page's name cannot: @ # | < > $ [[ ]]`;
  if (/^[.^]/.test(name)) return `"${name}" starts with . or ^, which a page's name cannot`;
  if (/\.[A-Za-z0-9]+$/.test(name)) return `"${name}" ends as a file's extension would, which makes it no page`;
  return undefined;
}

// A database as the store reads it now: its root page, which making of it this is, its record, its items by key
type Read = {
  readonly root: string;
  readonly folder: string;
  readonly made: string;
  readonly version: number;
  readonly record: RecordState;
  readonly recordRevision: string;
  readonly items: ReadonlyMap<ItemKey, { readonly page: string; readonly item: ItemState; readonly revision: string }>;
};

// What a planned part is to the store: the page it writes and the writer's plan of it, what it leaves
type Part = {
  readonly database: string;
  // The making of the database it was planned in (none: made by this plan)
  readonly made: string | undefined;
  readonly kind: "record" | "item";
  readonly page: string;
  readonly pagePlan: PagePlan;
  readonly ref?: string;
  readonly key?: ItemKey;
  readonly after: ItemState | RecordState | undefined;
  readonly withRecord: boolean;
  readonly recordRead?: string;
};

// A page the store wrote, as the index will have it (none: removed), the tags it had (a removed page's: let go only by a
// query of one of them), when the index told of the page since
type Held = { readonly object: IndexedObject | undefined; readonly tags: readonly string[]; toldAt?: number };

// How long after the index told of a page the store goes on showing the page as it wrote it, at most
const HOLD_TOLD_MS = 10_000;

// What a part wrote: the writer's report of its page, what the store had before, the making it went into
type Wrote = { readonly part: Part; readonly report: ApplyReport; readonly before: ItemState | RecordState | undefined; readonly made: string; readonly key?: ItemKey };

const CHANGED_READ = "changed since it was read: left alone";
const CHANGED_WRITTEN = "changed since it was written: left as it is";
const ANOTHER_DATABASE = "its database was removed and made again since: left alone";

/** A value's text the same whatever the order of its keys */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}

/** A revision of what the store reads: of its content (two 32-bit hashes of its text), so the index catching up with a write changes none */
const revisionOf = (value: unknown) => {
  let [a, b] = [0, 0x9e3779b9];
  for (const c of stable(value)) {
    a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
    b = Math.imul(b ^ c.charCodeAt(0), 0x01000193) | 0;
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
};

const hasTag = (object: IndexedObject, tag: string) => Array.isArray(object.tags) && object.tags.includes(tag);

export class PagesStore implements DatabaseStore {
  readonly capabilities: StoreCapabilities;
  private readonly writer: PageWriter;
  private readonly formats: readonly PagesFormat[];
  private readonly latest: PagesFormat;
  private readonly rules: StoreRules;
  // Each page's key for the session, kept when its item goes (Undo brings it back under it)
  private readonly keys = new Map<string, ItemKey>();
  private readonly pages = new Map<ItemKey, string>();
  // Each root page's making for the session: a root removed and made again is another (a part planned for one never written into the other)
  private readonly makings = new Map<string, string>();
  // Pages the store wrote, as the index will have them, until it has them so (or a while after it told of them)
  private readonly wrote = new Map<string, Held>();
  private readonly parts = new WeakMap<Planned, Part>();
  private readonly written = new WeakMap<Planned, Wrote>();
  private readonly applied = new WeakSet<Planned>();
  private readonly listeners = new Set<(change: { readonly database: string }) => void>();
  // Each database's root page as last read, to tell which database a page changed is of
  private readonly roots = new Map<string, string>();
  private counter = 0;

  constructor(
    private readonly platform: Pick<Platform, "editor" | "space" | "index">,
    private readonly options: PagesStoreOptions = {},
  ) {
    this.writer = pageWriter(platform);
    this.formats = options.formats ?? FORMATS;
    this.latest = this.formats[this.formats.length - 1]!;
    this.capabilities = { renameFollowsLinks: !!platform.space.rename, itemBody: true };
    this.rules = {
      latestFormat: this.latest.version,
      validatePropertyKey: (key) => this.validatePropertyKey(key),
      validateItemName: (name) => this.validateItemName(name),
      // A page's name whatever its case: a disk that ignores case has one page of the two
      nameKey: (name) => name.toLowerCase(),
    };
    platform.index.onChanged((change) => {
      const held = this.wrote.get(change.document);
      // A page the store wrote, deleted since (by hand, renamed): gone at once; a page it removed, indexed since: made
      // again (by hand, renamed into its name); otherwise held until a query has it as the store left it
      if (held && (held.object ? change.deleted : !change.deleted)) this.wrote.delete(change.document);
      else if (held) held.toldAt ??= Date.now();
      const tell = () => {
        for (const [id, root] of this.roots) {
          if (change.document === root || change.document.startsWith(`${root}/`)) for (const listener of this.listeners) listener({ database: id });
        }
      };
      tell();
      // Told again once what the store held of it has surely gone (the index has caught up by then, or someone else changed it)
      if (held) setTimeout(tell, HOLD_TOLD_MS + 100);
    });
  }

  async databases(): Promise<readonly DatabaseSummary[]> {
    const seen = new Set<string>();
    const out: DatabaseSummary[] = [];
    for (const object of await this.objects(ROOT_TAG)) {
      const read = this.formatOf(versionOf(object)).readRoot(object, versionOf(object));
      if ("problem" in read || seen.has(read.record.database.id)) continue;
      seen.add(read.record.database.id);
      this.roots.set(read.record.database.id, String(object.name));
      out.push({ id: read.record.database.id, name: read.record.database.name });
    }
    return out;
  }

  async database(id: string): Promise<Revised<Database> | undefined> {
    const read = await this.read(id);
    return read && { value: read.record.database, revision: read.recordRevision };
  }

  async items(id: string): Promise<Revised<readonly Item[]>> {
    const read = await this.read(id);
    if (!read) return { value: [], revision: "0" };
    const items = [...read.items.values()].map(({ item, revision }) => ({ ...item, revision }));
    return { value: items, revision: revisionOf(items.map((one) => one.revision)) };
  }

  async body(id: string, item: ItemKey): Promise<string | undefined> {
    const page = (await this.read(id))?.items.get(item)?.page;
    return page === undefined ? undefined : this.bodyOf(page);
  }

  /** A page's body as it is now (the index has none); undefined where it cannot be read (gone, the index not caught up) */
  private async bodyOf(page: string): Promise<string | undefined> {
    try {
      const text = String(await this.platform.space.read(page));
      return text.slice(readFrontmatter(text).bodyStart);
    } catch {
      return undefined;
    }
  }

  async plan(changes: Changes): Promise<TransactionPlan> {
    const id = changes.database;
    const read = await this.read(id);
    // The bodies a transaction writes, read now (the index has none): one changed since it was read is left
    const bodies = new Map<ItemKey, string>();
    for (const change of changes.changes) {
      if (change.kind !== "setBody") continue;
      const page = read?.items.get(change.item)?.page;
      const body = page === undefined ? undefined : await this.bodyOf(page);
      if (body !== undefined) bodies.set(change.item, body);
    }
    const draft = draftTransaction(this.state(read, bodies), changes, this.rules);
    const skipped: Skipped[] = [...draft.skipped];
    const root = read?.root ?? (this.options.rootPage ?? ((one: string) => `db-${one}`))(id);
    const folder = read?.folder ?? root;
    // Each part a page of its own, planned by the writer apart (a page may be removed and its name made again by another part)
    const toPlan: { readonly target: Target; readonly count: number; readonly part: Omit<Part, "pagePlan">; readonly write: (changes: ReturnType<typeof pageChanges>) => void }[] = [];
    if (draft.record) {
      const before = read?.record;
      const after = draft.record.after;
      toPlan.push({
        target: { database: id },
        count: draft.record.count,
        part: { database: id, made: read?.made, kind: "record", page: root, after, withRecord: false },
        write: (batch) => (before ? batch.page(root, (p) => this.latest.writeRoot(p, before, after)) : batch.create(root, (p) => this.latest.writeRoot(p, undefined, after))),
      });
    }
    for (const item of draft.items) {
      const was = item.key === undefined ? undefined : read?.items.get(item.key);
      const page = was?.page ?? `${folder}/${item.after!.name}`;
      const write = (p: PageBuilder) => {
        if (!item.after) return p.remove();
        if (was && item.after.name !== was.item.name) p.rename(`${folder}/${item.after.name}`);
        // (The item as the draft read it, its body read for the transaction with it: the writer checks it is still so)
        this.latest.writeItem(p, item.before ?? was?.item, item.after);
      };
      toPlan.push({
        write: (batch) => (was ? batch.page(page, write) : batch.create(page, write)),
        target: item.target,
        count: item.count,
        part: {
          database: id,
          made: read?.made,
          kind: "item",
          page,
          ...(item.ref === undefined ? {} : { ref: item.ref }),
          ...(item.key === undefined ? {} : { key: item.key }),
          after: item.after,
          withRecord: !!draft.record,
          ...(draft.recordRead === undefined ? {} : { recordRead: draft.recordRead }),
        },
      });
    }
    const planned: Planned[] = [];
    for (const of of toPlan) {
      const batch = pageChanges();
      of.write(batch);
      const pagePlan = await this.writer.plan(batch.build());
      for (const one of pagePlan.skipped) skipped.push({ target: of.target, cause: one.cause, reason: one.reason });
      for (const one of pagePlan.pages) planned.push(this.part({ target: of.target, changes: of.count, preview: () => one.preview() }, { ...of.part, pagePlan: { pages: [one], skipped: [] } }));
    }
    return { database: id, planned, skipped };
  }

  async apply(plan: TransactionPlan): Promise<TransactionReport> {
    const written: Planned[] = [];
    const skipped: Skipped[] = [...plan.skipped];
    const created = new Map<string, ItemKey>();
    const changed = plan.undoes ? CHANGED_WRITTEN : CHANGED_READ;
    const skip = (one: Planned, cause: SkipCause, reason: string) => skipped.push({ target: one.target, cause, reason });
    const records: { one: Planned; part: Part }[] = [];
    const items: { one: Planned; part: Part }[] = [];
    for (const one of plan.planned) {
      const part = this.parts.get(one);
      if (!part || part.database !== plan.database) skip(one, "refused", "not planned by this store for this database: left alone");
      else if (this.applied.has(one)) skip(one, "changed", "written already: left alone");
      else (part.kind === "record" ? records : items).push({ one, part });
    }
    let recordLeft = false;
    const writeRecord = async ({ one, part }: { one: Planned; part: Part }) => {
      const read = await this.read(plan.database);
      if (part.made !== undefined && read?.made !== part.made) {
        recordLeft = true;
        return skip(one, "missing", ANOTHER_DATABASE);
      }
      // A database goes only with nothing of it left: an item made or changed since keeps it
      if (part.after === undefined && read && read.items.size > 0) {
        recordLeft = true;
        return skip(one, "changed", "its items changed since: left as it is");
      }
      const result = await this.applyPage(part);
      if ("cause" in result) {
        recordLeft = true;
        return skip(one, result.cause, result.reason);
      }
      if (part.after === undefined) this.makings.delete(part.page);
      this.keep(written, one, { part, report: result.report, before: read?.record, made: read?.made ?? this.makingOf(part.page) });
    };
    // A record made comes before its items, one removed after them
    for (const one of records.filter(({ part }) => part.after !== undefined)) await writeRecord(one);
    const read = await this.read(plan.database);
    const ready = items.filter(({ one, part }) => {
      if (part.withRecord && recordLeft) skip(one, "changed", `its database ${changed}`);
      else if (!read) skip(one, "missing", `no database "${plan.database}"`);
      else if (part.made !== undefined && part.made !== read.made) skip(one, "missing", ANOTHER_DATABASE);
      else if (part.recordRead !== undefined && read.recordRevision !== part.recordRead) skip(one, "changed", `its database ${changed}`);
      else return true;
      return false;
    });
    const now = new Map([...(read?.items ?? [])].map(([key, { item }]) => [key, item] as const));
    const parts = ready.map((one) => ({ ...one, own: one.part, part: { key: one.part.key, ref: one.part.ref, after: one.part.after as ItemState | undefined } }));
    // Pages removed first: a name another part takes may be one of theirs
    const ordered = withoutClashes(now, parts, this.rules, ({ one: left }, reason) => skip(left, "refused", reason)).sort((a, b) => Number(a.own.after !== undefined) - Number(b.own.after !== undefined));
    for (const { one, own } of ordered) {
      const before = own.key === undefined ? undefined : read!.items.get(own.key)?.item;
      // A page made gets its key before it is written: whoever reads meanwhile (a listener told by the index) sees the key it keeps
      if (own.key === undefined && own.after) {
        this.keys.delete(own.page);
        this.keyOf(own.page);
      }
      const result = await this.applyPage(own, before);
      if ("cause" in result) {
        skip(one, result.cause, result.reason);
        continue;
      }
      // Its name written alone (the rename changed its text, so the rest was left): said, and kept for Undo
      if (result.renamedAlone) skip(one, "changed", "renamed, but the rename changed its text, so its other changes were left");
      const after = own.after as ItemState | undefined;
      const page = after ? `${read!.folder}/${after.name}` : own.page;
      const key = this.keyAfter(own, page, after);
      if (own.ref !== undefined) created.set(own.ref, key);
      this.keep(written, one, { part: own, report: result.report, before, made: read!.made, key });
    }
    for (const one of records.filter(({ part }) => part.after === undefined)) await writeRecord(one);
    return { database: plan.database, written, skipped, created, ...(plan.undoes ? { undoes: plan.undoes } : {}) };
  }

  async planUndo(report: TransactionReport): Promise<TransactionPlan> {
    const planned: Planned[] = [];
    const skipped: Skipped[] = [];
    const read = await this.read(report.database);
    const record = report.written.map((one) => ({ one, was: this.written.get(one) })).find(({ was }) => was?.part.kind === "record" && was.part.database === report.database);
    // The database made again by this undo (it was taken away): its items go into that making
    const remade = !read && !!record?.was?.before;
    const goes = new Set<ItemKey>();
    const back: { one: Planned; was: Wrote; after: ItemState | undefined }[] = [];
    for (const one of report.written) {
      const was = this.written.get(one);
      if (!was || was.part.database !== report.database) {
        skipped.push({ target: one.target, cause: "refused", reason: "not written by this store: left as it is" });
        continue;
      }
      if (was.part.kind === "record") continue;
      if (read ? read.made !== was.made : !remade) {
        skipped.push({ target: { item: was.key! }, cause: "missing", reason: ANOTHER_DATABASE });
        continue;
      }
      const after = was.before as ItemState | undefined;
      if (!after) goes.add(was.key!);
      back.push({ one, was, after });
    }
    // A name given back that another item took since: refused, as a rename would be
    const names = takenNames(read ? [...read.items.values()].map(({ item }) => item) : [], back.map(({ was, after }) => ({ key: was.key, after })), this.rules);
    for (const { one, was, after } of back) {
      if (after && after.name !== (was.part.after as ItemState | undefined)?.name && names.get(this.rules.nameKey(after.name))! > 1) {
        skipped.push({ target: { item: was.key! }, cause: "refused", reason: `an item named "${after.name}" exists already` });
        continue;
      }
      const pagePlan = await this.writer.planUndo(was.report);
      if (!pagePlan.pages.length) {
        for (const left of pagePlan.skipped) skipped.push({ target: { item: was.key! }, cause: left.cause, reason: left.reason });
        continue;
      }
      const page = pagePlan.pages[0]!.page;
      planned.push(this.part({ target: { item: was.key! }, changes: one.changes }, { database: report.database, made: read?.made, kind: "item", page, pagePlan, key: was.key!, after, withRecord: remade }));
    }
    if (record?.was) {
      const { one, was } = record;
      const leftBehind = !was.before && !!read && [...read.items.keys()].some((key) => !goes.has(key));
      const pagePlan = await this.writer.planUndo(was.report);
      if (leftBehind) skipped.push({ target: one.target, cause: "changed", reason: "its items changed since: left as it is" });
      else if (!pagePlan.pages.length) for (const left of pagePlan.skipped) skipped.push({ target: one.target, cause: left.cause, reason: left.reason });
      else {
        const own = this.part({ target: one.target, changes: one.changes }, { database: report.database, made: read?.made, kind: "record", page: was.part.page, pagePlan, after: was.before, withRecord: false });
        // A database made again goes before its items, one taken away after them
        if (was.before) planned.unshift(own);
        else planned.push(own);
      }
    }
    return { database: report.database, planned, skipped, undoes: report };
  }

  async format(id: string): Promise<FormatStatus> {
    const read = await this.read(id);
    return { version: read?.version ?? this.latest.version, latest: this.latest.version };
  }

  async planMigration(scope: MigrationScope): Promise<readonly TransactionPlan[]> {
    const all = (await this.databases()).map((one) => one.id);
    const ids = "database" in scope ? [scope.database] : "space" in scope ? all : all.filter((id) => this.roots.get(id) === scope.document);
    const plans: TransactionPlan[] = [];
    for (const id of ids) {
      const read = await this.read(id);
      if (!read || read.version >= this.latest.version) continue;
      // The record written in the latest form, its version with it (items whose form changed would be rewritten by the latest writer too)
      const after: RecordState = { ...read.record, version: this.latest.version };
      const pagePlan = await this.writer.plan(pageChanges().page(read.root, (p) => this.latest.writeRoot(p, read.record, after)).build());
      const planned = pagePlan.pages.map((one) => this.part({ target: { database: id }, changes: one.changes }, { database: id, made: read.made, kind: "record", page: read.root, pagePlan: { pages: [one], skipped: [] }, after, withRecord: false }));
      plans.push({ database: id, planned, skipped: pagePlan.skipped.map((one) => ({ target: { database: id }, cause: one.cause, reason: one.reason })) });
    }
    return plans;
  }

  onChanged(listener: (change: { readonly database: string }) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  validatePropertyKey(key: string): string | undefined {
    return PAGE_KEYS.has(key) ? `"${key}" is a key SilverBullet gives every page: name the property otherwise` : undefined;
  }

  validateItemName(name: string): string | undefined {
    return validatePageName(name);
  }

  documentOf(item: ItemKey): string | undefined {
    return this.pages.get(item);
  }

  /**
   * A part's page written by the writer, held as written until the index has
   * it; `renamedAlone`: the page was renamed but its content left (the rename
   * changed its text), so it is held as renamed with what it had
   */
  private async applyPage(part: Part, before?: ItemState): Promise<{ readonly report: ApplyReport; readonly renamedAlone?: true } | { readonly cause: SkipCause; readonly reason: string }> {
    const planned = part.pagePlan.pages[0]!;
    const to = planned.renamedTo ?? planned.page;
    // Held as written before the writer writes: an index telling of the page at once (as it is written) lets it go then
    const held = new Map([planned.page, to].map((page) => [page, this.wrote.get(page)] as const));
    const tags = [part.kind === "record" ? ROOT_TAG : ITEM_TAG];
    if (planned.renamedTo !== undefined) this.wrote.set(planned.page, { object: undefined, tags });
    this.wrote.set(to, { object: part.after === undefined ? undefined : this.objectOf(part, to), tags });
    const report = await this.writer.apply(part.pagePlan);
    const page = report.written[0];
    if (!page) {
      // Nothing written: what was held before goes back
      for (const [one, had] of held) {
        if (had) this.wrote.set(one, had);
        else this.wrote.delete(one);
      }
      const left = report.skipped[0];
      return { cause: left?.cause ?? "refused", reason: left?.reason ?? "not written" };
    }
    // (The writer gives back the page planned where it wrote it all, another where it renamed it alone)
    const renamedAlone = page !== planned && page.renamedTo !== undefined;
    if (renamedAlone) this.wrote.set(to, { object: before ? this.objectOf({ ...part, after: { ...before, name: (part.after as ItemState).name } }, to) : undefined, tags });
    return renamedAlone ? { report, renamedAlone } : { report };
  }

  /**
   * An item's key once its part is written: the key it had (renamed: under its
   * new page; brought back by an undo: again); a page made anew a new key,
   * never a key an item removed had; a page removed keeps none
   */
  private keyAfter(part: Part, page: string, after: ItemState | undefined): ItemKey {
    if (part.key !== undefined) {
      if (page !== part.page || !after) this.keys.delete(part.page);
      if (after) {
        this.keys.set(page, part.key);
        this.pages.set(part.key, page);
      }
      return part.key;
    }
    return this.keyOf(page);
  }

  /** What the index will have of a page the store wrote, as the store reads pages */
  private objectOf(part: Part, page: string): IndexedObject {
    if (part.kind === "record") {
      const record = part.after as RecordState;
      const properties = Object.fromEntries(record.database.properties.map((one) => [one.key, { type: one.type, label: one.label, ...(one.readonly ? { readonly: true } : {}), ...one.params }]));
      return { name: page, tags: [ROOT_TAG], _database: { id: record.database.id, name: record.database.name, format: record.version, properties } };
    }
    const item = part.after as ItemState;
    return { name: page, tags: [ITEM_TAG], ...item.values, ...(item.rank === undefined ? {} : { _database: { rank: item.rank } }) };
  }

  /** A database as read now: the index's objects, the pages the store wrote as it wrote them */
  private async read(id: string): Promise<Read | undefined> {
    for (const object of await this.objects(ROOT_TAG)) {
      const version = versionOf(object);
      const format = this.formatOf(version);
      const read = format.readRoot(object, version);
      if ("problem" in read || read.record.database.id !== id) continue;
      const root = String(object.name);
      this.roots.set(id, root);
      const items = new Map<ItemKey, { page: string; item: ItemState; revision: string }>();
      for (const one of await this.objects(ITEM_TAG)) {
        const page = String(one.name);
        if (!page.startsWith(`${root}/`) || page.slice(root.length + 1).includes("/")) continue;
        const key = this.keyOf(page);
        const item: ItemState = { key, ...format.readItem(one, page.slice(root.length + 1), read.record) };
        items.set(key, { page, item, revision: revisionOf({ name: item.name, values: item.values, rank: item.rank }) });
      }
      return { root, folder: root, made: this.makingOf(root), version, record: read.record, recordRevision: revisionOf(read.record), items };
    }
    // No root of the id: a root made again later is another making
    const root = this.roots.get(id);
    if (root) this.makings.delete(root);
    return undefined;
  }

  /** The index's objects of a tag, the pages the store wrote as it wrote them (one removed: none) */
  private async objects(tag: string): Promise<IndexedObject[]> {
    const out: IndexedObject[] = [];
    const seen = new Set<string>();
    const now = Date.now();
    // Held long enough after the index told of the page: what the index has is the page now (changed by hand, maybe)
    const expired = (held: Held) => held.toldAt !== undefined && now - held.toldAt > HOLD_TOLD_MS;
    for (const object of await this.platform.index.objects(tag)) {
      const page = String(object.name);
      seen.add(page);
      const held = this.wrote.get(page);
      // The index caught up (it has the page as the store wrote it), or held long enough: the index's again
      if (!held || (held.object && caughtUp(object, held.object)) || expired(held)) {
        this.wrote.delete(page);
        out.push(object);
      } else if (held.object && hasTag(held.object, tag)) out.push(held.object);
    }
    for (const [page, held] of [...this.wrote]) {
      if (seen.has(page)) continue;
      if (held.object) {
        if (expired(held)) this.wrote.delete(page);
        else if (hasTag(held.object, tag)) out.push(held.object);
      } else if (held.toldAt !== undefined && held.tags.includes(tag)) {
        // Removed, told, and a query of its tag has it no more: the index has caught up
        this.wrote.delete(page);
      }
    }
    return out;
  }

  private formatOf(version: number): PagesFormat {
    return this.formats.find((one) => one.version === version) ?? this.latest;
  }

  /** What the store has as transaction.ts reads it, the bodies read for it given */
  private state(read: Read | undefined, bodies: ReadonlyMap<ItemKey, string> = new Map()): StoreState {
    if (!read) return undefined;
    const items = new Map([...read.items].map(([key, one]) => [key, bodies.has(key) ? { ...one, item: { ...one.item, body: bodies.get(key)! } } : one]));
    return { record: { ...read.record, version: read.version }, recordRevision: read.recordRevision, items };
  }

  /** A root page's making for the session */
  private makingOf(root: string): string {
    let made = this.makings.get(root);
    if (!made) this.makings.set(root, (made = `made-${++this.counter}`));
    return made;
  }

  /** A page's key for the session (made the first time the page is read or written) */
  private keyOf(page: string): ItemKey {
    let key = this.keys.get(page);
    if (!key) {
      key = `page-${++this.counter}` as ItemKey;
      this.keys.set(page, key);
      this.pages.set(key, page);
    }
    return key;
  }

  private part(own: Planned, part: Part): Planned {
    this.parts.set(own, part);
    return own;
  }

  private keep(written: Planned[], one: Planned, was: Wrote): void {
    this.written.set(one, was);
    this.applied.add(one);
    written.push(one);
  }
}

/** Whether the index has a page as the store wrote it: its own data and its values (its tags may be more) */
function caughtUp(indexed: IndexedObject, mine: IndexedObject): boolean {
  if (stable(systemOf(indexed)) !== stable(systemOf(mine))) return false;
  return Object.entries(mine).every(([key, value]) => key === "name" || key === "tags" || key === "_database" || stable(indexed[key]) === stable(value));
}
