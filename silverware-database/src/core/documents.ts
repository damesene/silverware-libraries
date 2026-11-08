// The space's documents as a reference names them (domain/types/reference.ts):
// those it may name, the space's rules of a new one's name, one opened by
// its name. Made once from what the host gives, for the views' host and the
// modules' alike.
import type { Awaitable, Platform, UserInterface } from "../../../shared/platform.ts";
import type { Noun } from "../domain/noun.ts";

/** What the host gives of its documents for references: those a reference may name; why a new one cannot have a name; one opened */
export type DocumentsSource = {
  list(): Awaitable<readonly string[]>;
  validateName?(name: string): string | undefined;
  open?(name: string): Awaitable<void>;
  /** What is between a document's folders and its name (none: documents are in no folders) */
  readonly folderSeparator?: string;
};

/** What a host offers of the documents (`ViewHost`, `ModuleHost`) */
export type DocumentsHost = {
  /** What the place the items are kept in calls its documents, for what is said to the user (SilverBullet: page) */
  readonly noun: Noun;
  /** What is between a document's folders and its name (domain/folders.ts), undefined where documents are in no folders */
  readonly folderSeparator?: string;
  /** The documents a reference may name, by their names (in SilverBullet its pages, meta pages left out); none where the host lists none */
  documents(): Promise<readonly string[]>;
  /** Why no document can have a name (a new one a reference names), undefined where one can */
  validateDocumentName(name: string): string | undefined;
  /** The document a reference names opened in the editor (a heading after `#` too); a failure is said to the user */
  openByName(name: string): Promise<void>;
};

/** The documents of a platform: those its index says a value may refer to, else every one its space lists; its rules of a name; opened in its editor */
export function platformDocuments(platform: Pick<Platform, "index" | "space" | "editor">): DocumentsSource {
  return {
    list: () => (platform.index.referableDocuments ? platform.index.referableDocuments() : platform.space.list()),
    ...(platform.space.validateName ? { validateName: (name: string) => platform.space.validateName!(name) } : {}),
    ...(platform.editor.open ? { open: (name: string) => platform.editor.open!(name) } : {}),
    ...(platform.space.folderSeparator ? { folderSeparator: platform.space.folderSeparator } : {}),
  };
}

/** A host's documents from a source (none: no document offered nor opened), said in the core's word (`noun`), a failure to open one said */
export function documentsHost(source: DocumentsSource | undefined, noun: Noun, ui: Pick<UserInterface, "notify">): DocumentsHost {
  return {
    noun,
    ...(source?.folderSeparator ? { folderSeparator: source.folderSeparator } : {}),
    documents: async () => (await source?.list()) ?? [],
    validateDocumentName: (name) => source?.validateName?.(name),
    openByName: async (name) => {
      if (!source?.open) return;
      try {
        await source.open(name);
      } catch (error) {
        ui.notify(`"${name}" could not be opened: ${error instanceof Error ? error.message : String(error)}`, { type: "error" });
      }
    },
  };
}
