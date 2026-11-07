// What a module gives and what the core gives it. The core knows no module:
// it shows one window of tags (core/workspace: the tags as a tree and the tag
// picked), the modules' views beside it (by pages: the pages module's), their
// parts of the tag picked (its name to rename it, its actions), and runs the
// operations they make through a review in that window.
import type { Notifier, Space } from "../space/space.ts";
import type { Catalog } from "./catalog.ts";
import type { PanelRow } from "./offers.ts";
import type { Operation } from "./operation.ts";

export type Command = {
  // As SilverBullet lists it ("Silverware Tags: Page tags")
  readonly name: string;
  readonly run: () => unknown;
};

/** What the window offers a module's parts and views while it is open */
export type WorkspaceHost = {
  readonly doc: Document;
  /** The tags of the space as last read */
  readonly catalog: Catalog;
  /** The operation's changes shown in the window (in place of what it shows), applied once the user applies them */
  review(operation: Operation): void;
  /** Another view shown (a module's by its id, "tags" the core's), with what it starts from */
  show(view: string, state?: unknown): void;
  /** A tag shown in the tags' view */
  pick(tag: string): void;
  /** What the view shown is at (checked, typed): given back to its render when it is shown again (Back from a review) */
  remember(state: unknown): void;
  /** The window closed, the page opened */
  navigate(page: string): void;
};

/** A view of the window beside the tags' (a tab above it): what a module shows, made anew each time it is shown */
export type View = {
  readonly id: string;
  readonly label: string;
  readonly render: (host: WorkspaceHost, state: unknown) => HTMLElement;
  // What it starts from once a change from it is applied (else what it was at)
  readonly applied?: (state: unknown) => unknown;
};

/** A module's parts of the tag picked, in the tags' view: UI of its own, where data would not do */
export type TagParts = {
  // In place of the tag's name (a field renaming it); the first module's that gives one
  readonly name?: HTMLElement;
};

/**
 * Something done with a tag, as data: the core shows it (a button of the tag
 * picked, in the modules' order) and runs it. What it gives is reviewed (an
 * operation: planned, shown, applied, kept for Undo, meta pages protected), or
 * it does what it does itself through the window (another view shown)
 */
export type TagAction = {
  // Its id (the button's data-swg-action)
  readonly id: string;
  readonly label: string;
  // Taking something away (Delete): shown so
  readonly danger?: boolean;
  // A key running it while the tag is picked in the window's tree (KeyboardEvent.key: "Delete"), shown in its tooltip
  readonly key?: string;
  // Whether it is offered for this tag (left out: always)
  readonly when?: (tag: string, catalog: Catalog) => boolean;
  readonly run: (tag: string, host: WorkspaceHost) => Operation | void | Promise<Operation | void>;
};

/**
 * Something done with several tags picked together (Ctrl or Shift and a
 * click in the window's tree), as data the core shows and runs: what it gives
 * is reviewed. Where it needs a name (Merge into…) it asks for it first, a
 * field the core shows with the space's tags offered
 */
export type TagsAction = {
  readonly id: string;
  readonly label: string;
  readonly danger?: boolean;
  // A key running it while the tags are picked (KeyboardEvent.key)
  readonly key?: string;
  // A tag's name asked for first: the field's label, and what is wrong with a name typed (nothing: undefined)
  readonly ask?: { readonly label: string; readonly validate?: (name: string, tags: readonly string[]) => string | undefined };
  readonly run: (tags: readonly string[], host: WorkspaceHost, name?: string) => Operation | void | Promise<Operation | void>;
};

/**
 * An action of a row of the Tags panel (a button of the row, a key where it
 * has one), as data a module gives: the panel draws every module's and runs
 * them. `order` places it among the others (less first)
 */
export type PanelAction = {
  readonly id: string;
  // An icon's name as SilverBullet's navigator takes it (Feather's: "plus", "edit-2")
  readonly icon: string;
  readonly label: string;
  // A key running it on the row picked (KeyboardEvent.key: "F2")
  readonly key?: string;
  readonly order?: number;
  // Whether it is offered for a row (left out: always)
  readonly when?: (row: PanelRow) => boolean;
  readonly run: (tag: string) => unknown;
};

export type TagsModule = {
  readonly commands?: () => readonly Command[];
  readonly views?: () => readonly View[];
  readonly tagParts?: (tag: string, host: WorkspaceHost) => TagParts;
  readonly tagActions?: () => readonly TagAction[];
  readonly tagsActions?: () => readonly TagsAction[];
  readonly panelActions?: () => readonly PanelAction[];
};

export type ModuleHost = {
  readonly doc: Document;
  readonly space: Space;
  readonly notifier: Notifier;
  /** The tags of the space, read anew (SilverBullet's meta pages left out where the setting protects them) */
  catalog(): Promise<Catalog>;
  /**
   * The window opened (or brought to) a view: "tags" (a tag picked: `state`
   * its name, or `{ tag, focus: "name" }` with its name's field focused) or a
   * module's
   */
  open(view?: string, state?: unknown): Promise<void>;
  /** The window opened at an operation's review (Back: the tags, `tag` picked) */
  review(operation: Operation, tag?: string): Promise<void>;
  /** An operation applied at once, without a review (one page the user asked a change of: said, with Undo), meta pages protected */
  apply(operation: Operation): Promise<void>;
  /** Every module's row actions of the Tags panel, in their order (the panel module draws them) */
  panelActions(): readonly PanelAction[];
  /** What this module offers the others, under its own name (a module uses another's only so: none imports another) */
  offer(api: unknown): void;
  /** What the module of that name offers; undefined while it is off or offers nothing */
  offered<T>(module: string): T | undefined;
};
