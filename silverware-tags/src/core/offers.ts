// What modules offer each other and the host, each under the name of the module
// offering it (`ModuleHost.offer`, `offered(module)`): the contracts only, so a
// module using another's offer imports the core, never that module. Undefined
// while the module offering it is off.

/** `rename` (the rename module): a rename reviewed in the window */
export type RenameOffer = {
  /** Reviewed in the window (its subtags too, as the review offers) */
  review(from: string, to: string): Promise<void>;
  /** What is wrong with it (nothing: undefined) */
  problem(from: string, to: string): string | undefined;
};
// (The module's name, bridge.ts MODULE_NAMES)
export const RENAME_OFFER = "rename";

/** A row of the tags' panel: a tag (or a level of them), as a host's tree of rows shows it */
export type PanelRow = {
  // The whole name, the tree's path ("project/alpha"), and its last level
  readonly name: string;
  readonly label: string;
  // The pages using it (none: a level only), and whether any uses it as a page's tag, in a task, an item
  readonly count: number;
  readonly onPages: boolean;
  readonly inTasks: boolean;
  readonly inItems: boolean;
  // SilverBullet's own (`meta` and under it): shown apart, as its tree shows meta pages
  readonly meta: boolean;
};

/**
 * `panel` (the panel module): the tags as a panel beside the page shows them,
 * whatever draws it (SilverBullet's navigator, through the library page; the
 * playground's list). What the panel does goes to the window
 */
export type PanelOffer = {
  rows(): Promise<readonly PanelRow[]>;
  /** A tag picked: the window at it */
  select(tag: string): Promise<void>;
  /** Rename asked for (F2): the window at it, its name's field focused */
  rename(tag: string): Promise<void>;
  /** A tag dragged under another level: renamed so (reviewed), its subtags with it */
  move(tag: string, to: string): Promise<void>;
};
// (The module's name)
export const PANEL_OFFER = "panel";
