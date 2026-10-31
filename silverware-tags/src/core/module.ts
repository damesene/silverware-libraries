// What a module gives and what the core gives it. The core knows no module:
// it shows their commands (SilverBullet's, named by them) and their actions on
// a tag (the manager's), and runs the operations they make.
import type { Notifier, Space } from "../space/space.ts";
import type { Catalog } from "./catalog.ts";
import type { Operation } from "./operation.ts";

export type Command = {
  // As SilverBullet lists it ("Silverware Tags: Tag pages")
  readonly name: string;
  readonly run: () => unknown;
};

/** An action on a tag the manager shows, in the modules' order */
export type TagAction = {
  readonly id: string;
  readonly label: string;
  readonly danger?: boolean;
  // Done: true where it changed something (the manager reads the tags anew), or the tag to show then (a rename's new name)
  readonly run: () => Promise<boolean | string | void> | boolean | string | void;
};

export type TagsModule = {
  readonly commands?: () => readonly Command[];
  readonly tagActions?: (tag: string, catalog: Catalog) => readonly TagAction[];
};

export type ModuleHost = {
  readonly doc: Document;
  readonly space: Space;
  readonly notifier: Notifier;
  /** The tags of the space, read anew */
  catalog(): Promise<Catalog>;
  /** An operation planned, previewed and, once the user applies it, applied and said (true: applied) */
  run(operation: Operation): Promise<boolean>;
  /** An operation applied without a preview (one page, as the user edited its tags in a dialog) */
  apply(operation: Operation): Promise<boolean>;
};
