// What Silverware Toolbar's core and its modules share: a module gives
// actions, the core shows them (the toolbar, the popup of every action) and
// applies what they do. An action is a function of the selection's context
// that gives one change of the page's text, so a module knows nothing of what
// shows it, nor how the change is written (one edit, one undo step).

/** A line of the page's text: where it is (its end before the line break) and its text */
export type Line = { readonly from: number; readonly to: number; readonly text: string };

/** The selection an action works on, and the page around it */
export type Context = {
  // The page's text as it was read for the selection
  readonly text: string;
  readonly from: number;
  readonly to: number;
  // The lines the selection touches, whole
  readonly lines: readonly Line[];
};

/** What an action that does something (`perform`) may use of the editor, through the core; each may be awaited */
export type ActionEditor = {
  // A SilverBullet command run, by its name
  invokeCommand(name: string): Promise<void>;
  // A page opened, by its name (a link's: `Page#heading` too)
  navigate(page: string): Promise<void>;
  flash(message: string, type?: "info" | "error"): void;
  // The selection set, positions in the page's text
  select(from: number, to: number): void;
};

/** What an action may do once its change is written: the core's editor, positions in the page's text */
export type Editor = {
  select(from: number, to: number): void;
};

/**
 * One change of the page's text. The selection after it: where `insert` marks
 * it (core/cursor.ts), else `select`, else the text inserted. `after`: called
 * once it is written, with the text written (`insert` without its marks).
 */
export type Change = {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
  readonly select?: { readonly from: number; readonly to: number };
  readonly after?: (editor: Editor, written: string) => void;
};

export type Action = {
  // Unique: what it is, a dot, its name (formats.bold, actions.clear); favourites list them
  readonly id: string;
  readonly label: string;
  // An SVG icon (24×24, currentColor)
  readonly icon: string;
  // The group it is listed under in the popup (Format, Turn into, …)
  readonly group: string;
  // More words the popup's search finds it by
  readonly keywords?: readonly string[];
  // Shown as on (bold around the selection already)
  readonly active?: (context: Context) => boolean;
  // Offered (else shown dimmed, not run)
  readonly enabled?: (context: Context) => boolean;
  // The change it makes of the page's text, which the core writes; undefined: nothing. A throw is shown as the action failing
  readonly edit?: (context: Context) => Change | undefined;
  // Instead of a change: something it does (a SilverBullet command, a page opened), the editor focused first, with the
  // selection's context and the editor's API; a throw or a rejection is shown as it failing
  readonly perform?: (context: Context, editor: ActionEditor) => unknown;
  // false: found by the popup's search only, not listed as it opens (there are many: the commands)
  readonly listed?: boolean;
  // Instead of running: a list to pick from (Turn into: the block formats). The toolbar shows the choice on
  // (its icon and label; none on: `mixed`, else the label), a click opens the list under it
  readonly choices?: readonly Action[];
  // What a list shows in the toolbar when no choice is on for the selection (several at once: "Multiple types")
  readonly mixed?: string;
};

/** A module: the actions it offers, asked each time they show (definitions made later count), created once Silverware Toolbar starts (only the modules turned on) */
export type ToolbarModule = {
  readonly actions: () => readonly Action[];
};

/** What a module may ask of the editor beyond the page's text: SilverBullet's commands (each optional: the library page hands them over) */
export type ModuleHost = {
  readonly listCommands?: () => unknown;
  readonly invokeCommand?: (name: string) => unknown;
  // A caret touching a word stands for the word, as if selected (the setting wordAtCaret)
  readonly wordAtCaret?: boolean;
};
