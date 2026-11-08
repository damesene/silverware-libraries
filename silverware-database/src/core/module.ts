// What a module is and what it gets (docs/silverware-database.md, *Modules*):
// a whole one may want to turn off, on or replace, working across the views
// (the properties' dialog, later the peek), each with its settings
// (`silverware.database.modules.<name>`: `enabled` and its own). The core
// knows none by name: it starts those on with a host of their own and asks
// them what they add (the place's tools; commands when a module has one: the
// binding defines its commands as it starts, before the modules are). Modules use each other's
// only through what one offers (`offer`, `offered`), as Silverware Table's and
// Silverware Tags' do. Modules import only types from here.
import type { Settings, UserInterface } from "../../../shared/platform.ts";
import type { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item, Revised } from "../model/database.ts";
import type { DatabaseCore } from "./core.ts";
import type { PlaceMenuBuilder, PlaceMenuGroup } from "./placemenu.ts";
import type { ViewSetting } from "./view.ts";

/** A module's setting: as a view's (`silverware.database.modules.<module>.<key>`) */
export type ModuleSetting = ViewSetting;

/** A place a module adds to, asked each time the place is drawn (a module's open UI may follow the database by it): the database shown, the document */
export type PlaceContext = {
  readonly document: Document;
  readonly database: Database;
};

/** What a started module adds; each part optional */
export type ModuleInstance = {
  /** Its entries in a place's menu (⋯), asked as it opens: given the menu's builder, groups in its slots (`data`: Properties) or sections of their own */
  placeMenu?(place: PlaceContext, menu: PlaceMenuBuilder): readonly PlaceMenuGroup[];
  /** Told as a place is drawn (anew: a change made elsewhere, an Undo), so what it shows for a database follows (a dialog open, the peek) */
  placeDrawn?(place: PlaceContext): void;
  /**
   * An item a view opens (a click on its name, its ↗): true where the module
   * shows it in its own way (the peek), the first module to say so taking it;
   * else it opens where the store says (its page). The module reads and
   * writes the item through its own host (`items`, `core`), as of the
   * database `database` (its id).
   */
  openItem?(item: Item, database: string): boolean;
  /** The module turned off, or started again: what it listens to stops, what it shows closes */
  stop?(): void;
};

/** What a module gets: the core's writes, the store's reads, the types, the user, its own settings, the others' offers */
export type ModuleHost = {
  readonly document: Document;
  /** The core's writes (each checked, said where refused, kept for Undo) */
  readonly core: DatabaseCore;
  readonly types: TypeRegistry;
  readonly ui: Pick<UserInterface, "notify" | "ask">;
  database(id: string): Promise<Revised<Database> | undefined>;
  items(id: string): Promise<readonly Item[]>;
  /** Whether the store keeps an item's body (its content), which `body` reads */
  readonly itemBodies: boolean;
  /** An item's body as kept now (none: it has none), to write it back with `core.setBody` */
  body(id: string, item: Item): Promise<string | undefined>;
  /** The item's document opened in the editor (its page), past every module's own way; a failure said to the user */
  openDocument(item: Item): Promise<void>;
  /** The editor's area on screen, where a panel beside the document goes (undefined: the window) */
  editorArea(): DOMRect | undefined;
  /** How the page's text looks (CSS properties: its font, size, line height, color), for what a module shows beside it; none: the style page's */
  editorLook?(): Readonly<Record<string, string>> | undefined;
  /** One of the module's settings (declared in its `settings`), its default where not set */
  setting(key: string): unknown;
  /**
   * One of the module's settings saved where the user keeps them (SilverBullet's
   * CONFIG: for every database), `undefined` back to its default; false where
   * settings cannot be saved here (said to no one: the value then holds for this
   * session alone)
   */
  saveSetting(key: string, value: unknown): Promise<boolean>;
  /** What this module offers the others (one offer a module, by its name) */
  offer(api: unknown): void;
  /** What another module offers, undefined where it is off or offers none, or starts after this one (the modules start in their order: ask as it is needed, not as it starts) */
  offered<T>(module: string): T | undefined;
  /** Told as a database's data change (a write here or elsewhere, by its id); the function given back stops it */
  onChanged(listener: (database: string) => void): () => void;
  /** Told as another document is opened in the editor (in SilverBullet a page): its name; the function given back stops it */
  onDocumentOpened(listener: (name: string) => void): () => void;
  /** Places drawn anew: every one whole (a schema changed: every view of it shows it), or those of `database` with its data read anew (an item written) */
  refreshPlaces(database?: string): void;
};

export type ModuleDefinition = {
  /** Its name, as its settings name it: lower case, no spaces */
  readonly name: string;
  readonly label: string;
  /** What it does, as the settings dialog says it */
  readonly description: string;
  readonly settings?: readonly ModuleSetting[];
  start(host: ModuleHost): ModuleInstance | void;
};

// A module's name as its settings name it
const MODULE_NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Why a module cannot be one, undefined where it can */
export function validateModule(module: ModuleDefinition): string | undefined {
  if (typeof module?.name !== "string" || !MODULE_NAME_RE.test(module.name)) return `"${String(module?.name)}" is no module's name: lower case letters, digits and -, starting with a letter`;
  if (typeof module.label !== "string" || !module.label.trim()) return `the module "${module.name}" has no label`;
  if (typeof module.start !== "function") return `the module "${module.name}" has no start`;
  return undefined;
}

/** The settings' path of a module's setting */
export const moduleSettingPath = (module: string, key: string) => `silverware.database.modules.${module}.${key}`;

/**
 * The modules started (those on), each with its host: started anew as the
 * settings change (a module turned on or off), what each adds asked as it is
 * needed
 */
export class Modules {
  private started: { readonly definition: ModuleDefinition; readonly instance: ModuleInstance }[] = [];
  private readonly offers = new Map<string, unknown>();
  // Each start and stop counted: a start overtaken by another (settings saved twice, Space Lua loaded again) starts nothing more
  private generation = 0;

  constructor(
    readonly all: readonly ModuleDefinition[],
    private readonly host: Omit<ModuleHost, "setting" | "saveSetting" | "offer" | "offered">,
    private readonly settings: Pick<Settings, "get" | "save">,
  ) {}

  /** The modules on started, those of before stopped first */
  async start(): Promise<void> {
    this.stop();
    const run = this.generation;
    for (const definition of this.all) {
      const on = (await this.settings.get(moduleSettingPath(definition.name, "enabled"), true)) !== false;
      const values = new Map<string, unknown>();
      if (on) for (const setting of definition.settings ?? []) values.set(setting.key, await this.settings.get(moduleSettingPath(definition.name, setting.key), setting.default));
      if (run !== this.generation) return;
      if (!on) continue;
      const host: ModuleHost = {
        ...this.host,
        setting: (key) => values.get(key),
        saveSetting: async (key, value) => {
          const declared = definition.settings?.find((one) => one.key === key);
          values.set(key, value === undefined ? declared?.default : value);
          if (!this.settings.save) return false;
          await this.settings.save({ [moduleSettingPath(definition.name, key)]: value });
          return true;
        },
        offer: (api) => void this.offers.set(definition.name, api),
        offered: <T>(module: string) => this.offers.get(module) as T | undefined,
      };
      try {
        this.started.push({ definition, instance: definition.start(host) ?? {} });
      } catch (error) {
        this.host.ui.notify(`Silverware Database: the module ${definition.label} failed to start (${error instanceof Error ? error.message : String(error)})`, { type: "error" });
      }
    }
  }

  stop(): void {
    this.generation++;
    for (const { instance } of this.started) {
      try {
        instance.stop?.();
      } catch {
        // A module failing as it stops takes nothing else down
      }
    }
    this.started = [];
    this.offers.clear();
  }

  /** An item a view opens taken by the first module that shows it in its own way: whether one did */
  openItem(item: Item, database: string): boolean {
    for (const { definition, instance } of this.started) {
      try {
        if (instance.openItem?.(item, database)) return true;
      } catch (error) {
        this.host.ui.notify(`Silverware Database: the module ${definition.label} failed to open "${item.name}" (${error instanceof Error ? error.message : String(error)})`, { type: "error" });
      }
    }
    return false;
  }

  /** The modules' entries in a place's menu, in their order */
  placeMenu(place: PlaceContext, menu: PlaceMenuBuilder): PlaceMenuGroup[] {
    return this.started.flatMap(({ instance }) => [...(instance.placeMenu?.(place, menu) ?? [])]);
  }

  /** The modules told a place was drawn */
  placeDrawn(place: PlaceContext): void {
    for (const { instance } of this.started) instance.placeDrawn?.(place);
  }
}
