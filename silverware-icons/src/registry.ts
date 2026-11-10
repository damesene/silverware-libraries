// The sets of icons there are: the built-in ones of the manifest, their files loaded as first needed (drawing an icon
// loads its set's drawing file, picking its search file), and the user's (`defineSets`), a built-in one's name
// replacing it in place. Space Lua loaded again makes the user's anew: those of before stay until the first new one
// (as the other plugins' definitions do), so what is drawn meanwhile keeps its icons.
import type { IconReference } from "../../shared/icons.ts";
import { type DefinedSet, type DrawData, type IconNode, type SearchData, type SetEntry, type SetKind, setOf } from "./set.ts";

/** A module beside the bundle, its default export (the sets' files) */
export type Loader = (file: string) => Promise<unknown>;

/** A set as the picker's tabs show it */
export type SetInfo = { readonly name: string; readonly label: string; readonly kind: SetKind };

/** What drawing an icon of a set finds: its nodes, its set still loading, or none (why) */
export type Found = { readonly nodes: readonly IconNode[] } | { readonly loading: true } | { readonly missing: string };

export class Registry {
  private own = new Map<string, DefinedSet>();
  private anew = false;
  private readonly draws = new Map<string, DrawData>();
  private readonly searches = new Map<string, SearchData>();
  private readonly loads = new Map<string, Promise<unknown>>();
  private readonly settled = new Set<string>();
  private readonly failed = new Set<string>();

  /**
   * `load` a file of the manifest's; `loading(on)` told as loading starts and as the last ends (the drawing watches
   * the page meanwhile); `changed` told as icons of a set can be drawn (loaded, or a user's set defined)
   */
  constructor(
    private readonly builtIn: readonly SetEntry[],
    private readonly load: Loader,
    private readonly loading: (on: boolean) => void,
    private readonly changed: () => void,
  ) {}

  /** Every set, in the picker's order: the built-in ones (a user's of the same name in its place), then the user's */
  sets(): SetInfo[] {
    const builtIn = this.builtIn.map((entry) => this.own.get(entry.name) ?? entry);
    const own = [...this.own.values()].filter((set) => !this.builtIn.some((entry) => entry.name === set.name));
    return [...builtIn, ...own].map(({ name, label, kind }) => ({ name, label, kind }));
  }

  /** An icon of a set to draw: its nodes where its set is in hand (an alias followed), else its set loading (started) or none */
  find(reference: IconReference): Found {
    const own = this.own.get(reference.set);
    const entry = own ? undefined : this.builtIn.find((one) => one.name === reference.set);
    if (!own && !entry) return { missing: `No set of icons ${reference.set}` };
    const kind = own?.kind ?? entry!.kind;
    if (kind !== "svg") return { missing: `${reference.set} is a set of characters, written as themselves` };
    const data = own ? own.draw : this.drawData(entry!);
    if (!data) return this.failed.has(entry!.draw ?? "") ? { missing: `The icons of ${reference.set} could not be loaded` } : { loading: true };
    const nodes = data.icons[reference.name] ?? data.icons[data.aliases[reference.name] ?? ""];
    return nodes ? { nodes } : { missing: `No icon ${reference.name} in ${reference.set}` };
  }

  /** A set's picking data where it is in hand, nothing loaded for it (a label for a tooltip is not worth its file) */
  search(name: string): SearchData | undefined {
    return this.own.get(name)?.search ?? this.searches.get(name);
  }

  /** A set's picking data, loaded where needed (the picker); undefined where there is no such set or it could not be loaded */
  async searchLoaded(name: string): Promise<SearchData | undefined> {
    const entry = this.own.has(name) ? undefined : this.builtIn.find((one) => one.name === name);
    if (entry && !this.searches.has(name)) await this.loadFile(entry.search, (value) => this.searches.set(name, value as SearchData));
    return this.search(name);
  }

  /** A set's drawing data loaded where it has a file of it (the picker draws a grid of its icons at once) */
  async drawLoaded(name: string): Promise<void> {
    const entry = this.own.has(name) ? undefined : this.builtIn.find((one) => one.name === name);
    if (entry?.draw && !this.draws.has(name)) await this.loadFile(entry.draw, (value) => this.draws.set(name, value as DrawData), true);
  }

  /** The user's sets given (one, or a list), each checked; a set again replaces the one before; what was wrong said */
  define(value: unknown): { problems: string[]; again: string[] } {
    const before = this.anew ? new Map<string, DefinedSet>() : this.own;
    this.anew = false;
    const problems: string[] = [];
    const again: string[] = [];
    const made = new Map(before);
    for (const one of Array.isArray(value) ? value : [value]) {
      const { set, problems: wrong } = setOf(one);
      problems.push(...wrong);
      if (!set) continue;
      // (Defined before in this load of Space Lua, or twice now: the last counts)
      if (made.has(set.name)) again.push(set.name);
      made.set(set.name, set);
    }
    this.own = made;
    this.changed();
    return { problems, again };
  }

  /** Space Lua is loaded (again): the user's sets are made anew, those of before kept until the first new one */
  anewDefinitions(): void {
    this.anew = true;
  }

  private drawData(entry: SetEntry): DrawData | undefined {
    const data = this.draws.get(entry.name);
    if (!data && entry.draw) void this.loadFile(entry.draw, (value) => this.draws.set(entry.name, value as DrawData), true);
    return data;
  }

  /** A file loaded once (a failure said once, not tried again until the page is loaded anew) */
  private loadFile(file: string, keep: (value: unknown) => void, drawn = false): Promise<unknown> {
    const started = this.loads.get(file);
    if (started || this.failed.has(file)) return started ?? Promise.resolve();
    if (!this.pending()) this.loading(true);
    const promise = this.load(file).then(
      (value) => {
        keep(value);
        if (drawn) this.changed();
      },
      (e: unknown) => {
        this.failed.add(file);
        console.error(`Silverware Icons: ${file} could not be loaded`, e);
        if (drawn) this.changed();
      },
    );
    this.loads.set(file, promise);
    void promise.finally(() => {
      this.settled.add(file);
      if (!this.pending()) this.loading(false);
    });
    return promise;
  }

  private pending(): boolean {
    return [...this.loads.keys()].some((file) => !this.settled.has(file));
  }
}
