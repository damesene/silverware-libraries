// The SilverBullet API Silverware Layout uses, handed over by the init page's Space Lua (`editor.*`, `space.*`,
// `config.get`), so no SilverBullet internals are needed. Only index.ts and host/silverbullet/ read it.

export type Bridge = {
  // The page open in the editor, its text and one edit of it (one undo step)
  readonly getCurrentPage: () => string | Promise<string>;
  readonly getText: () => string | Promise<string>;
  readonly replaceRange: (from: number, to: number, text: string) => unknown;
  readonly readPage: (name: string) => string | Promise<string>;
  readonly writePage: (name: string, text: string) => unknown;
  // Every page (space.listPages: page objects with their name, or names)
  readonly listPages: () => unknown;
  // A notification
  readonly flash: (message: string, type?: "info" | "error") => unknown;
  // Optional: without it, settings keep their defaults
  readonly getConfig?: (path: string, defaultValue: unknown) => unknown;
  // Optional, for the dialog: asks before closing it with changes (else the browser's confirm)
  readonly confirm?: (message: string) => boolean | Promise<boolean>;
  // Optional, for the dialog's default text width: the CONFIG page saved as SilverBullet's Configuration Manager saves
  // it, the configuration loaded again (readPage reads it)
  readonly saveConfigPage?: (text: string) => unknown;
  // Optional, for the grids: markdown rendered to HTML as SilverBullet renders a page, its embeds expanded, each
  // element marked with its offset in the text (`markdown.markdownToHtml(text, { expand = true, annotationPositions = true })`)
  readonly renderMarkdown?: (text: string) => string | Promise<string>;
  // Optional, for a grid's Alt+click: the cursor put at an offset of the page's text, centred in view (`editor.moveCursor`)
  readonly moveCursor?: (at: number, center?: boolean) => unknown;
};

/** The bridge's functions Silverware Layout cannot work without, missing from what the init page gave */
export function missingBridgeFunctions(bridge: Partial<Bridge>): string[] {
  return (["getCurrentPage", "getText", "replaceRange", "readPage", "writePage", "listPages", "flash"] as const).filter((name) => typeof bridge[name] !== "function");
}
