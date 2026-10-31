import type { Catalog } from "./catalog.ts";
import type { Operation } from "./operation.ts";

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
  /** Several tags merged into one, as an operation to review where the asker is (their subtags under it) */
  merge(tags: readonly string[], into: string, catalog: Catalog): Operation;
};
// (The module's name, bridge.ts MODULE_NAMES)
export const RENAME_OFFER = "rename";

/** A row of the tags' panel: a tag (or a level of them), as a host's tree of rows shows it */
export type PanelRow = {
  // The whole name, the tree's path ("project/alpha"), and its last level
  readonly name: string;
  readonly label: string;
  // The pages using it, or any tag under it (each page once)
  readonly count: number;
  // A level of tags only (no tag of its name); with tags under it
  readonly level: boolean;
  readonly parent: boolean;
  // Whether it, or a tag under it, is a page's own tag somewhere, in a task, in an item
  readonly onPages: boolean;
  readonly inTasks: boolean;
  readonly inItems: boolean;
  // SilverBullet's own (`meta` and under it): shown apart, as its tree shows meta pages
  readonly meta: boolean;
  // On the page open (it, or a tag under it): shown first and marked
  readonly here: boolean;
  // One of the page open's own tags (its frontmatter's, its tag lines'): it offers to take it off, not to add it
  readonly own: boolean;
  // The row's actions offered for it, by id (the modules' panelActions)
  readonly can?: Readonly<Record<string, boolean>>;
};

/** A row action as a host draws it (its run by id: `PanelOffer.run`) */
export type PanelActionInfo = { readonly id: string; readonly icon: string; readonly label: string; readonly key?: string };

/**
 * `panel` (the panel module): the tags as a panel beside the page shows them,
 * whatever draws it (SilverBullet's navigator, through the library page; the
 * playground's list). Its row actions are the modules' (`panelActions`),
 * the panel's own among them: it knows none of the others
 */
export type PanelOffer = {
  /** The rows, each with the actions offered for it (`can`) */
  rows(): Promise<readonly PanelRow[]>;
  /** Every module's row actions, in their order (buttons of a row, a key where one has it) */
  actions(): readonly PanelActionInfo[];
  /** A row's action run on its tag */
  run(id: string, tag: string): Promise<void>;
  /** A tag dragged under another level: renamed so (reviewed), its subtags with it */
  move(tag: string, to: string): Promise<void>;
};
// (The module's name)
export const PANEL_OFFER = "panel";
