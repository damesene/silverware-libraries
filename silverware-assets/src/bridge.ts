// The SilverBullet API Silverware Assets uses, handed over by the init page's Space Lua (`editor.*`, `space.*`,
// `config.get`), so no SilverBullet internals are needed; and Silverware Layout's API, where it is installed. Only
// index.ts and host/silverbullet/ read it.

export type Bridge = {
  // The page open in the editor, its text and one edit of it (one undo step)
  readonly getCurrentPage: () => string | Promise<string>;
  readonly getText: () => string | Promise<string>;
  readonly replaceRange: (from: number, to: number, text: string) => unknown;
  // Optional, for files inserted: the editor's selection (`editor.getSelection`: its from and to)
  readonly getSelection?: () => unknown;
  readonly readPage: (name: string) => string | Promise<string>;
  readonly writePage: (name: string, text: string) => unknown;
  // Every page (space.listPages: page objects with their name, or names)
  readonly listPages: () => unknown;
  // A notification
  readonly flash: (message: string, type?: "info" | "error") => unknown;
  // Optional: without it, settings keep their defaults
  readonly getConfig?: (path: string, defaultValue: unknown) => unknown;
  // Optional, for the settings window: asks before closing it with changes (else the browser's confirm)
  readonly confirm?: (message: string) => boolean | Promise<boolean>;
  // Optional, for the settings window: the configuration page saved as SilverBullet's Configuration Manager saves it, the
  // configuration loaded again (readPage reads it)
  readonly saveConfigPage?: (text: string) => unknown;
  // Optional: one of SilverBullet's UI options (`editor.getUiOption`: `markdownSyntaxRendering`, the markdown shown as written)
  readonly getUiOption?: (name: string) => unknown;
  // Optional, for a file's card: a document's meta (`space.getDocumentMeta`: its `size` in bytes, `lastModified`)
  readonly documentMeta?: (path: string) => unknown;
  // Optional, for a file's Delete: a document deleted from the space (`space.deleteDocument`), asked first in
  // SilverBullet's dialog, its OK button the danger's (`editor.confirm(message, { destructive = true })`)
  readonly deleteDocument?: (path: string) => unknown;
  // Optional, for previews kept in the space (core/stored.ts): a file's meta, its time of change in ms
  // (`space.getFileMeta`, its content not read), a document read and written (`space.readDocument`,
  // `space.writeDocument`: a Uint8Array, handed through Space Lua as it is); with `deleteDocument`
  readonly fileMeta?: (path: string) => unknown;
  readonly readDocument?: (path: string) => unknown;
  readonly writeDocument?: (path: string, data: Uint8Array) => unknown;
  // Optional, for Clean up previews: every file of the space (`space.listFiles`: their meta, `name` their path; the
  // previews' folder too, which `listDocuments` leaves out)
  readonly listFiles?: () => unknown;
  readonly confirmDelete?: (message: string) => boolean | Promise<boolean>;
  // Optional: Silverware Layout's API (`silverware.layout.api`), where it is installed: a medium's width by its handle
  // (shared/layout.ts), what its grids draw outside the editor (its `rendered`, shared/rendered.ts)
  readonly layout?: unknown;
  // Optional: Silverware Editor's API (`silverware.editor.api`), where it is installed: the fields of other plugins
  // (a grid's cell) a file is pasted or dropped into (shared/editor.ts `surfaceOf`)
  readonly editor?: unknown;
  // Optional: a plug's function run (`system.invokeFunction`): SilverBullet's own *File: Upload* where Silverware
  // Assets' is turned off; its *Document: Rename* for a file renamed from its menu (`index.renameDocumentCommand`)
  readonly invokeFunction?: (name: string, ...args: unknown[]) => unknown;
  // Optional: the page open read again from the space (`editor.reloadPage`): a file renamed from its menu, SilverBullet
  // having rewritten the page's links to it on disk, which the editor would not show (and would save over)
  readonly reloadPage?: () => unknown;
};

/** The bridge's functions Silverware Assets cannot work without, missing from what the init page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getCurrentPage", "getText", "replaceRange", "readPage", "writePage", "listPages", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}
