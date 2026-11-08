// What a plugin asks of the platform it runs on (SilverBullet, the playground,
// memory in tests), apart from which platform it is: the document open in the
// editor, the space of documents, the index, the user, the settings.
// Interfaces only, no code: each plugin's binding makes them of what its host
// hands over (in SilverBullet the init page's `editor.*`, `space.*`, the
// index's queries and events, `config.*`), and a plugin takes the parts it
// needs (`Pick<Platform, "editor" | "space">`). Shared so that Silverware
// Database and Silverware Table's store plan take the same
// (docs/silverware-database.md, *Layers*); a change here is made for both.
// What only one plugin needs (the table's markdown rendered) is an interface
// of its own beside these. A member a platform may lack is optional; whoever
// uses it says what it does without it. A document is what the platform keeps
// by name (in SilverBullet a page). Any part may read; `Editor.replace` and
// `Space.write` are for the page writer alone (`shared/pages/`,
// docs/silverware-database.md, *Shared with Silverware Table and Silverware
// Tags*), so that one place knows how anything is written in a document.

/** A value now or later: SilverBullet answers with promises, memory at once */
export type Awaitable<T> = T | Promise<T>;

export type Platform = {
  readonly editor: Editor;
  readonly space: Space;
  readonly index: Index;
  readonly ui: UserInterface;
  readonly settings: Settings;
};

/** The document open in the editor */
export interface Editor {
  /** Its name (in SilverBullet the page's) */
  documentName(): Awaitable<string>;
  /** Its text as the editor has it now */
  text(): Awaitable<string>;
  /** `from` to `to` of its text made `insert`: one edit, one step of the editor's undo */
  replace(from: number, to: number, insert: string): Awaitable<void>;
  /** Where the cursor is, as an offset in the text */
  cursor?(): Awaitable<number>;
  /** The cursor put at an offset and scrolled into view (to the view's middle where `center`) */
  moveCursor?(at: number, center?: boolean): Awaitable<void>;
  /** What is selected, as offsets in the text (the same twice: a cursor) */
  selection?(): Awaitable<TextRange>;
  /** `from` to `to` selected */
  select?(from: number, to: number): Awaitable<void>;
  /** The editor's own undo and redo */
  undo?(): Awaitable<void>;
  redo?(): Awaitable<void>;
  /** The keyboard's focus given to the editor */
  focus?(): Awaitable<void>;
  /** The editor opened at a reference (a document's name, a place in it, as the platform writes one) */
  open?(ref: string): Awaitable<void>;
  /** Told as the open document is edited (typed in, undone): its text as it is now; the function given back stops it */
  onEdited?(listener: (text: string) => void): () => void;
  /** Told as another document is opened in the editor: its name; the function given back stops it */
  onOpened?(listener: (name: string) => void): () => void;
}

export type TextRange = { readonly from: number; readonly to: number };

/** The space: documents by name, whether open in the editor or not (the one open read through the editor) */
export interface Space {
  /** A document's text (the editor's, for the one open in it) */
  read(name: string): Awaitable<string>;
  /** A document's text written whole (a new one made) */
  write(name: string, text: string): Awaitable<void>;
  /** Every document's name */
  list(): Awaitable<readonly string[]>;
  /** A document taken out of the space */
  remove?(name: string): Awaitable<void>;
  /**
   * A document renamed, the links to it followed where the platform does
   * (SilverBullet: in other pages' text and frontmatter). The binding checks
   * what happened, as a platform may answer the same whether it renamed or not.
   */
  rename?(from: string, to: string): Awaitable<Renamed>;
  /** Every document whose name starts with `from` renamed to start with `to` instead, links followed as by `rename` */
  renamePrefix?(from: string, to: string): Awaitable<Renamed>;
  /** Why a name cannot be a document's (characters the platform does not take in one), undefined where it can */
  validateName?(name: string): string | undefined;
}

/** A rename asked of the space: `problem` why nothing was renamed (a name taken, one the space cannot hold) */
export type Renamed = { readonly problem?: string };

/** What the platform's index knows of the documents: read only, every write goes through the page writer */
export interface Index {
  /** The objects the index has of a tag (in SilverBullet: `page`, `db`, `table`), each its fields as indexed */
  objects(tag: string): Awaitable<readonly IndexedObject[]>;
  /** Told as the index changes: a document indexed anew, or deleted; the function given back stops it */
  onChanged(listener: (change: IndexChange) => void): () => void;
  /** Keys the index gives every document's object beside the document's own data (its name, its tags, its dates): none of that data can be kept under them */
  readonly reservedKeys?: ReadonlySet<string>;
  /** When a document was made and last written, as the index has them in the document's own object; none where it does not say */
  documentDates?(object: IndexedObject): DocumentDates;
  /** The tasks in the documents given, counted per document (one without tasks left out); none where the index keeps no tasks */
  tasks?(documents: ReadonlySet<string>): Awaitable<ReadonlyMap<string, TaskCount>>;
}

/** An object of the index: its fields as indexed, among them `name` (its document's name, for a document's own object) and `tags` (a list of texts) */
export type IndexedObject = Readonly<Record<string, unknown>>;

/** A document's dates as local ISO text (`2026-11-08T14:30:05.123`) */
export type DocumentDates = { readonly created?: string; readonly modified?: string };

/** A document's tasks: how many, how many done */
export type TaskCount = { readonly done: number; readonly total: number };

/**
 * A change the index told: a document indexed anew, or deleted. `early`: told
 * as the index is still part way through it (a query may not have the
 * document yet, or have none of it); the platform tells it again without
 * `early` once a query has it whole. A platform whose index is always whole
 * tells it early, then whole, at once
 */
export type IndexChange = { readonly document: string; readonly deleted: boolean; readonly early?: boolean };

/** The user: told, asked, given a choice */
export interface UserInterface {
  /** A notification; `timeout` 0: shown until closed */
  notify(message: string, options?: NotifyOptions): void;
  /** A question answered yes or no; `destructive`: something is lost if yes */
  ask?(message: string, options?: { readonly destructive?: boolean }): Awaitable<boolean>;
  /** One of `choices` picked (in SilverBullet its own picker), undefined where none was */
  pick?<T extends Choice>(label: string, choices: readonly T[]): Awaitable<T | undefined>;
  /** The platform's UI loaded anew (for settings read only as a plugin starts) */
  reload?(): Awaitable<void>;
}

export type NotifyOptions = {
  readonly type?: "info" | "error";
  readonly timeout?: number;
  readonly actions?: readonly { readonly name: string; readonly run: () => unknown }[];
};

/** One of the choices `UserInterface.pick` offers */
export type Choice = { readonly name: string; readonly description?: string };

/** The settings, by path (`silverware.<plugin>.<setting>`) */
export interface Settings {
  /** A setting's value, `fallback` where it has none */
  get(path: string, fallback: unknown): Awaitable<unknown>;
  /** Settings saved where the user keeps them (in SilverBullet the CONFIG page); undefined: back to the default */
  save?(values: Readonly<Record<string, unknown>>): Awaitable<void>;
}
