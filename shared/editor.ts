// What Silverware Editor (docs/silverware-editor.md) and the plugins editing markdown in a field of their own agree on: a
// `TextEditor` (the text, the selection, a range replaced, read-only, focus, where the selection is on screen), made by
// Silverware Editor's API as the init page hands it over (`silverware.editor.api`), or, without it, by the stand-in
// here: the same editor drawn as a `<textarea>`. A plugin writes against `TextEditor` alone and works the same either
// way; no plugin needs Silverware Editor. What draws the editor (CodeMirror) is never seen through it. An editor that
// Silverware Toolbar may act on is an `EditingSurface`, found by `surfaceOf` (the stand-in's none).

/** The version of the editor's API this file is written for: another is taken as none (updated apart) */
export const EDITOR_VERSION = 1;

/** A selection: from, to (the same: a caret), which way it was made */
export type TextSelection = { readonly from: number; readonly to: number; readonly backward?: boolean };

/**
 * Keys of the editor's user's own, by CodeMirror's names (`Mod-Enter`, `Escape`, `Shift-Tab`; Mod: Ctrl, Cmd on a Mac),
 * each run before the editor's own: true where it took the key
 */
export type EditorKeys = Readonly<Record<string, () => boolean>>;

export type EditorOptions = {
  readonly text: string;
  // Classes of the editor's element (the plugin's look of it)
  readonly className?: string;
  // What a screen reader names it
  readonly label?: string;
  readonly placeholder?: string;
  readonly readOnly?: boolean;
  // Where the caret is, or a selection (none: at the text's end)
  readonly selection?: number | TextSelection;
  readonly keys?: EditorKeys;
  // The keys it does not take go on to its user's elements, which keep them from the page's editor themselves (a panel
  // stopping keys at its own element, its Esc closing it); none: kept at the editor (the page's editor takes none)
  readonly passKeys?: boolean;
  readonly spellcheck?: boolean;
  // Told of each change of the text, of the focus come and gone
  readonly onChange?: (text: string) => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
};

/** What Silverware Toolbar acts on: an editor's text and selection, where the selection is, its element */
export type EditingSurface = {
  // The element the editor is drawn in (what is focused, what a press in it is in)
  readonly element: HTMLElement;
  getText(): string;
  getSelection(): TextSelection;
  setSelection(from: number, to?: number, backward?: boolean): void;
  replaceRange(from: number, to: number, text: string): void;
  // Where the selection is on screen (none: not drawn)
  selectionRect(): DOMRect | undefined;
  focus(): void;
};

export type TextEditor = EditingSurface & {
  // Whether it shows the markdown as the page shows it (its marks hidden, a task's box): its user draws it in the look
  // of the rendering around it, not as source (the stand-in's none: a `<textarea>` shows the source)
  readonly preview: boolean;
  setText(text: string): void;
  readOnly: boolean;
  // What it shows while it is empty
  setPlaceholder(text: string): void;
  hasFocus(): boolean;
  // Taken out of its element's listeners and the editor's own; its element left to its user to take away
  destroy(): void;
};

/** What a plugin makes editors with */
export type Editors = {
  readonly version: number;
  create(doc: Document, options: EditorOptions): TextEditor;
  // The editing surface a node is in (an editor focused, for Silverware Toolbar), none where it is in none
  surfaceOf(node: Node): EditingSurface | undefined;
};

/**
 * Marks an element that acts on an editor from outside it (Silverware Toolbar's bar, its popup, its panel): the focus
 * going there (the popup's search) is not the editor left, its `onBlur` told only once the focus is out of both
 */
export const COMPANION_ATTRIBUTE = "data-silverware-editor-companion";

/** Whether a node is in an element acting on an editor (`COMPANION_ATTRIBUTE`) */
export function inCompanion(node: EventTarget | null): boolean {
  const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
  return !!element?.closest(`[${COMPANION_ATTRIBUTE}]`);
}

/**
 * An editor's blur told to its user as the editor is left: at once, or, the focus gone to a companion, once it goes
 * from there elsewhere (not back into the editor: then nothing), or to nothing. What the editor's own blur listener
 * calls with its event; `inside` says whether a node is the editor's
 */
export function companionBlur(doc: Document, inside: (node: EventTarget | null) => boolean, told: () => void, signal: AbortSignal): (event: FocusEvent) => void {
  let waiting: AbortController | undefined;
  return (event) => {
    if (!inCompanion(event.relatedTarget)) {
      told();
      return;
    }
    if (waiting) return;
    const wait = (waiting = new AbortController());
    const done = (left: boolean) => {
      if (waiting !== wait) return;
      wait.abort();
      clearInterval(look);
      waiting = undefined;
      if (left) told();
    };
    doc.addEventListener("focusin", (focus) => !inCompanion(focus.target) && done(!inside(focus.target)), { capture: true, signal: wait.signal });
    // Where the focus is, looked at as it leaves an element and a while after: gone to nothing (a press beside the
    // companion; the companion taken away while it had the focus, which tells nothing at all), the editor left
    const check = () => {
      const active = doc.activeElement;
      if (!active || active === doc.body) done(true);
      else if (inside(active)) done(false);
      else if (!inCompanion(active)) done(true);
    };
    doc.addEventListener("focusout", () => setTimeout(check, 0), { capture: true, signal: wait.signal });
    const look = setInterval(check, COMPANION_LOOK_MS);
    // (The editor destroyed meanwhile: nothing told; the listener goes with the wait)
    signal.addEventListener("abort", () => done(false), { once: true, signal: wait.signal });
  };
}

// While the focus is in a companion, how often where it is is looked at (the companion taken away tells nothing)
const COMPANION_LOOK_MS = 500;

/**
 * How the page an editor is in behaves, where an editor allows for it: told by the plugin's binding to its host (its
 * SilverBullet's), never assumed here. None said: a page that leaves the editor its keys
 */
export type EditorHost = {
  // The page takes undo and redo at the window, before an editor gets them: the editor takes them there after it
  // (`ownHistory`)
  readonly historyAtWindow?: boolean;
};

/** Silverware Editor's API as handed over, where it is of this version; else the stand-in, a `<textarea>` each, in a page that behaves as `host` says */
export function editorsOf(given: unknown, host: EditorHost = {}): Editors {
  if (given && typeof given === "object") {
    const api = given as Partial<Editors>;
    if (api.version === EDITOR_VERSION && typeof api.create === "function" && typeof api.surfaceOf === "function") return api as Editors;
  }
  return host.historyAtWindow ? STAND_IN_HISTORY_AT_WINDOW : STAND_IN;
}

/** Whether a key event is a key of CodeMirror's name (`Mod-Shift-z`), on its key alone, modifiers exactly */
export function keyMatches(name: string, event: KeyboardEvent): boolean {
  const parts = name.split(/-(?!$)/);
  const key = parts.pop()!;
  const has = new Set(parts.map((part) => part.toLowerCase()));
  const mac = /Mac|iP(hone|ad)/.test(globalThis.navigator?.platform ?? "");
  const ctrl = has.has("ctrl") || (has.has("mod") && !mac);
  const meta = has.has("meta") || has.has("cmd") || (has.has("mod") && mac);
  if (event.ctrlKey !== ctrl || event.metaKey !== meta || event.altKey !== has.has("alt")) return false;
  // (Shift named: held; not named: not held, but where the key is itself a shifted one, as `?` or `+`: a letter or a
  // named key is not, `Mod-z` is not Ctrl+Shift+Z)
  if (has.has("shift") ? !event.shiftKey : event.shiftKey && (key.length > 1 || /^\p{L}$/u.test(key))) return false;
  return event.key.toLowerCase() === key.toLowerCase() || (key === "Space" && event.key === " ");
}

/**
 * Undo and redo an editor's own, as the window gets them, for a page that takes Ctrl+Z (Ctrl+Y, Ctrl+Shift+Z) at the
 * window before the field (`EditorHost.historyAtWindow`): taken after it, at the window too, and done in the editor by
 * `run`. What takes the listener off given back
 */
export function ownHistory(win: Window, inside: (target: EventTarget | null) => boolean, run: (redo: boolean) => void): () => void {
  const history = (event: KeyboardEvent) => {
    if (!inside(event.target) || !(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const redo = key === "y" || (key === "z" && event.shiftKey);
    if (key !== "z" && !redo) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    run(redo);
  };
  win.addEventListener("keydown", history, true);
  return () => win.removeEventListener("keydown", history, true);
}

/** The stand-in's editor: a `<textarea>`, as tall as its text, its keys and history its own (at the window where the page takes them there) */
export function textareaEditor(doc: Document, options: EditorOptions, host: EditorHost = {}): TextEditor {
  const field = doc.createElement("textarea");
  if (options.className) field.className = options.className;
  if (options.label) field.setAttribute("aria-label", options.label);
  if (options.placeholder) field.placeholder = options.placeholder;
  field.spellcheck = options.spellcheck ?? true;
  field.value = options.text;
  field.readOnly = !!options.readOnly;
  const grow = () => {
    if (!field.isConnected) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };
  const win = doc.defaultView;
  const stopHistory = win && host.historyAtWindow ? ownHistory(win, (target) => target === field, (redo) => doc.execCommand(redo ? "redo" : "undo")) : () => undefined;
  const control = new AbortController();
  const signal = control.signal;
  field.addEventListener("input", () => {
    grow();
    options.onChange?.(field.value);
  }, { signal });
  field.addEventListener("focus", () => options.onFocus?.(), { signal });
  field.addEventListener("blur", companionBlur(doc, (node) => node === field, () => options.onBlur?.(), signal), { signal });
  field.addEventListener("keydown", (event) => {
    // (The page's editor takes no key typed here, its shortcuts, its own handling of a widget's keys; or its user's
    // elements keep them from it, where they pass on)
    if (!options.passKeys) event.stopPropagation();
    for (const [name, run] of Object.entries(options.keys ?? {})) {
      if (keyMatches(name, event) && run()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
  }, { signal });
  const within = (offset: number) => Math.max(0, Math.min(field.value.length, offset));
  const editor: TextEditor = {
    element: field,
    preview: false,
    getText: () => field.value,
    setText: (text) => {
      field.value = text;
      grow();
    },
    getSelection: () => ({ from: field.selectionStart, to: field.selectionEnd, backward: field.selectionDirection === "backward" }),
    setSelection: (from, to = from, backward = false) => field.setSelectionRange(within(Math.min(from, to)), within(Math.max(from, to)), backward ? "backward" : "forward"),
    replaceRange: (from, to, text) => {
      field.setRangeText(text, within(from), within(to), "end");
      grow();
      options.onChange?.(field.value);
    },
    get readOnly() {
      return field.readOnly;
    },
    set readOnly(readOnly: boolean) {
      field.readOnly = readOnly;
    },
    setPlaceholder: (text) => void (field.placeholder = text),
    selectionRect: () => undefined,
    focus: () => field.focus(),
    hasFocus: () => doc.activeElement === field,
    destroy: () => {
      control.abort();
      stopHistory();
    },
  };
  const at = options.selection;
  if (at === undefined || typeof at === "number") editor.setSelection(at ?? options.text.length);
  else editor.setSelection(at.from, at.to, at.backward);
  // (As tall as its text once it is in the page: its user puts it there)
  queueMicrotask(grow);
  return editor;
}

const standIn = (host: EditorHost): Editors => ({
  version: EDITOR_VERSION,
  create: (doc, options) => textareaEditor(doc, options, host),
  surfaceOf: () => undefined,
});
const STAND_IN = standIn({});
const STAND_IN_HISTORY_AT_WINDOW = standIn({ historyAtWindow: true });
