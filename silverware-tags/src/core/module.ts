// What a module gives and what the core gives it. The core knows no module:
// it shows one window of tags (core/workspace: the tags as a tree and the tag
// picked), the modules' views beside it (by pages: the pages module's), their
// parts of the tag picked (its name to rename it, its actions), and runs the
// operations they make through a review in that window.
import type { Notifier, Space } from "../space/space.ts";
import type { Catalog } from "./catalog.ts";
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

/** A module's parts of the tag picked, in the tags' view */
export type TagParts = {
  // In place of the tag's name (a field renaming it); the first module's that gives one
  readonly name?: HTMLElement;
  // Buttons under its uses, in the modules' order
  readonly actions?: readonly HTMLElement[];
};

export type TagsModule = {
  readonly commands?: () => readonly Command[];
  readonly views?: () => readonly View[];
  readonly tagParts?: (tag: string, host: WorkspaceHost) => TagParts;
};

export type ModuleHost = {
  readonly doc: Document;
  readonly space: Space;
  readonly notifier: Notifier;
  /** The window opened (or brought to) a view: "tags" (a tag picked, `state` its name) or a module's */
  open(view?: string, state?: unknown): Promise<void>;
};
