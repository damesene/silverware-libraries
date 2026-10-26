// The core: follows the selection in the page's text (core/selection.ts),
// shows the toolbar by it (core/bar.ts: the favourite actions) and the popup
// of every action under the toolbar (core/popup.ts: the toolbar's …, the
// command and its key, which SilverBullet handles), and writes what an action
// changes: the page's text and selection read again for it (the context:
// core/context.ts), its change written as one edit (one undo step) unless the
// page changed meanwhile, the selection set after it (core/cursor.ts). The
// command without a selection shows the toolbar at the caret, its popup open:
// its buttons show the formats around the caret; it goes as the caret moves
// or text is typed. The modules (modules.ts) give the actions; the core knows
// none of them. The popup ends with the core's own item, the settings dialog.
import type { Bridge, Settings } from "../bridge.ts";
import { CONTENT_SELECTOR, keyboardBarTop, pageContentOf, viewTopOf } from "../dom.ts";
import { ICONS } from "../icons.ts";
import type { Action, ActionEditor, Change, Context } from "./action.ts";
import { Bar, type Shown } from "./bar.ts";
import { contextOf } from "./context.ts";
import { isActionItem, isSeparator, byTouch } from "./favorites.ts";
import type { ItemKind } from "./items.ts";
import { hideKeyboard } from "./keyboard.ts";
import { marked } from "./cursor.ts";
import type { Box } from "./place.ts";
import { Popup } from "./popup.ts";
import { SelectionWatcher } from "./selection.ts";

type State = { readonly active: boolean; readonly enabled: boolean };

/**
 * The core's own action: the popup of every action (… in the toolbar), an item
 * of the favourites as any other; favourites without it anywhere get it pinned
 * at the toolbar's end. Not in the popup itself
 */
export const MORE_ACTION: Action = {
  id: "actions.more",
  label: "Every action",
  icon: ICONS.more,
  group: "Silverware Toolbar",
  keywords: ["search", "all", "more", "popup"],
};

/** The core's own action, last in the popup (a favourite too): the settings dialog */
export const SETTINGS_ACTION: Action = {
  id: "actions.settings",
  label: "Silverware Toolbar settings…",
  icon: ICONS.settings,
  group: "Silverware Toolbar",
  keywords: ["preferences", "favorites", "options", "key"],
};

export class Controller {
  private readonly watcher: SelectionWatcher;
  private readonly bar: Bar;
  private readonly popup: Popup;
  // The selection (or the caret) the toolbar is shown by
  private range: Range | undefined;
  // Shown at the caret (the command without a selection): it goes as the caret moves or text is typed
  private atCaret = false;
  // The toolbar's reads of the selection in turn: a later one wins over one not answered yet (an action's or the popup's always go on)
  private shows = 0;
  // Stopped (a newer controller started): a read answered after it shows nothing
  private stopped = false;
  // The context the toolbar was last shown for: the state of a list's choices it opens
  private context: Context | undefined;
  // What pressed last (a pointer's type: touch, mouse, pen): a selection made by touch docks the toolbar at the bottom
  private pointer = "mouse";

  constructor(
    readonly doc: Document,
    // Handed over anew when SilverBullet loads its configuration again (the settings the same)
    public bridge: Bridge,
    readonly settings: Settings,
    // The actions offered, asked for each time they show (definitions made later count)
    private readonly actions: () => readonly Action[],
    // The kinds of favourites the modules give (core/items.ts)
    private readonly kinds: () => readonly ItemKind[],
    // The settings dialog opened (none: not offered)
    private readonly openSettings?: () => void,
  ) {
    this.watcher = new SelectionWatcher(
      doc,
      (range) => void this.selected(range),
      (node) => this.owns(node),
      (range) => void this.caretMoved(range),
    );
    this.bar = new Bar(doc, {
      run: (action) => void this.run(action),
      state: (action) => (this.context ? this.state(action, this.context) : { active: false, enabled: false }),
      choices: (action) => (this.popup.isOpen ? this.popup.close() : void this.showActions(action)),
    });
    this.popup = new Popup(doc);
  }

  start(): void {
    const win = this.doc.defaultView!;
    this.watcher.start();
    win.addEventListener("keydown", this.onKey, true);
    win.addEventListener("mousedown", this.onPress, true);
    win.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    win.addEventListener("resize", this.onScroll);
    win.addEventListener("pointerdown", this.onPointer, { capture: true, passive: true });
    this.doc.addEventListener("focusin", this.onFocus);
    this.doc.addEventListener("focusout", this.onBlur);
    // The on-screen keyboard coming or going: the docked toolbar stays over it
    win.visualViewport?.addEventListener("resize", this.onScroll);
    win.visualViewport?.addEventListener("scroll", this.onScroll);
  }

  stop(): void {
    this.stopped = true;
    const win = this.doc.defaultView!;
    this.watcher.stop();
    win.removeEventListener("keydown", this.onKey, true);
    win.removeEventListener("mousedown", this.onPress, true);
    win.removeEventListener("scroll", this.onScroll, { capture: true });
    win.removeEventListener("resize", this.onScroll);
    win.removeEventListener("pointerdown", this.onPointer, { capture: true });
    this.doc.removeEventListener("focusin", this.onFocus);
    this.doc.removeEventListener("focusout", this.onBlur);
    win.visualViewport?.removeEventListener("resize", this.onScroll);
    win.visualViewport?.removeEventListener("scroll", this.onScroll);
    this.bar.remove();
    this.popup.remove();
  }

  /** The popup of every action under the toolbar (the toolbar's …, the command): by the selection, else the toolbar at the caret; `choices`: open at that action's */
  async showActions(choices?: Action): Promise<void> {
    const context = await this.read();
    if (!context || this.stopped) return;
    const range = this.watcher.current() ?? this.watcher.caret();
    this.shows++;
    this.atCaret = context.from === context.to;
    this.showBar(context, range);
    // (… itself not among them)
    const actions = this.offered().filter((action) => action !== MORE_ACTION);
    this.popup.open({
      actions,
      state: (action) => this.state(action, context),
      rect: this.bar.shown ? this.bar.rect() : undefined,
      above: this.bar.docked,
      viewTop: viewTopOf(range?.startContainer ?? this.doc.querySelector(".cm-content")),
      run: (action) => void this.run(action),
      closed: () => this.focusEditor(),
      keeps: (node) => this.bar.owns(node),
      ...(choices ? { choices } : {}),
    });
  }

  /** The modules' actions, and the core's own (… and, where it has them, the settings) */
  private offered(): readonly Action[] {
    return [...this.actions(), MORE_ACTION, ...(this.openSettings ? [SETTINGS_ACTION] : [])];
  }

  private owns(node: Node): boolean {
    return this.bar.owns(node) || this.popup.owns(node);
  }

  /** An action's state for a context; one whose own functions fail is off and not offered */
  private state(action: Action, context: Context): State {
    try {
      return { active: !!action.active?.(context), enabled: action.enabled?.(context) ?? true };
    } catch (e) {
      console.error(`Silverware Toolbar: ${action.label}:`, e);
      return { active: false, enabled: false };
    }
  }

  /** The selection's context, read anew (undefined: reading failed) */
  private async read(): Promise<Context | undefined> {
    try {
      const selection = await this.bridge.getSelection();
      const text = await this.bridge.getText();
      return contextOf(text, selection.from, selection.to);
    } catch (e) {
      console.error("Silverware Toolbar: could not read the selection", e);
      return undefined;
    }
  }

  /**
   * The favourites' rows as shown for a context: each action by its id (an
   * action, or one of a list's choices; ids no action has left out), the
   * separators between them (none at a row's ends, none twice), rows left
   * empty left out
   */
  private favorites(context: Context): Shown[][] {
    const actions = this.offered();
    const all = [...actions, ...actions.flatMap((a) => a.choices ?? [])];
    const kinds = this.kinds();
    // Worked by a finger: touch's own where they are set
    const { touchFavorites, touchOn } = this.settings;
    const favorites = (byTouch(this.doc.defaultView) && touchOn && touchFavorites) || this.settings.favorites;
    return favorites
      .map((row) => {
        const items = row.flatMap((item): Shown[] => {
          if (isSeparator(item)) return [{ separator: true }];
          if (isActionItem(item)) {
            const action = all.find((a) => a.id === item.id);
            return action ? [{ action, labeled: item.show === "label", ...this.state(action, context) }] : [];
          }
          // A kind's: a kind no module on gives, or a slot without an action, left out
          const kind = kinds.find((k) => k.type === item.type);
          if (!kind) return [];
          const slots = kind.slots.map(({ key, optional }) => ({ key, optional, action: all.find((a) => a.id === item[key]) }));
          if (slots.some(({ optional, action }) => !optional && !action)) return [];
          const found = Object.fromEntries(slots.flatMap(({ key, action }) => (action ? [[key, action]] : [])));
          return [{ item: { kind, actions: found as Record<string, Action>, labeled: item.show === "label", item } }];
        });
        return items.filter((item, i) => !("separator" in item) || (i > 0 && i < items.length - 1 && !("separator" in items[i - 1]!)));
      })
      .filter((row) => row.some((item) => !("separator" in item)));
  }

  /** The toolbar shown for a context, by the selection or the caret */
  private showBar(context: Context, range: Range | undefined): void {
    this.range = range;
    if (!range) {
      this.bar.hide();
      return;
    }
    this.context = context;
    const rows = this.favorites(context);
    // Favourites without … anywhere (an item of it, or a slot of a kind's): pinned at the end
    const more = rows.some((row) => row.some((item) => ("action" in item && item.action === MORE_ACTION) || ("item" in item && Object.values(item.item.actions).includes(MORE_ACTION))))
      ? undefined
      : { action: MORE_ACTION, active: false, enabled: true, labeled: false };
    if (this.docks()) this.bar.dock(rows, this.dockLine(), more);
    else this.bar.show(rows, rectOf(range), viewTopOf(range.startContainer), more);
  }

  /** A selection made in the page's text: the toolbar by it; none: the toolbar goes (unless shown at the caret) */
  private async selected(range: Range | undefined): Promise<void> {
    const show = ++this.shows;
    if (!range) {
      // Shown always while writing: it goes to the caret once it settles (caretMoved)
      if (!this.atCaret && !(this.persistent() && this.writing())) {
        this.range = undefined;
        this.bar.hide();
      }
      return;
    }
    this.atCaret = false;
    if (this.popup.isOpen) return;
    const context = await this.read();
    if (!context || show !== this.shows || this.stopped) return;
    // The editor's selection is a caret (the page's selection is not its own, or was just changed): no toolbar
    if (context.from === context.to) {
      this.bar.hide();
      return;
    }
    this.showBar(context, range);
  }

  /** An action run on the selection: its change written as one edit, the selection set after it */
  private async run(action: Action): Promise<void> {
    // …: the popup opened, or closed again
    if (action === MORE_ACTION) {
      if (this.popup.isOpen) this.popup.close();
      else void this.showActions();
      return;
    }
    // Run from the toolbar while the popup is open: the popup is done
    this.popup.close(true);
    if (action === SETTINGS_ACTION) {
      this.hideBar();
      this.openSettings?.();
      return;
    }
    const context = await this.read();
    if (context && action.perform && this.state(action, context).enabled) {
      await this.perform(action, context);
      return;
    }
    if (!context || !this.state(action, context).enabled || !action.edit) {
      this.focusEditor();
      return;
    }
    try {
      const change = action.edit(context);
      if (change) await this.write(change, context);
    } catch (e) {
      void this.bridge.flash(`Silverware Toolbar: ${action.label} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
    this.focusEditor();
    // The toolbar shows what the change made (a format now on), once the editor has the selection set
    this.doc.defaultView!.requestAnimationFrame(() => void this.again());
  }

  /** Something an action does that is no change (a command): the editor focused first, as it is what it acts on; the toolbar shown again after */
  private async perform(action: Action, context: Context): Promise<void> {
    this.hideBar();
    this.focusEditor();
    const { bridge } = this;
    // The selection set again once the editor has the keyboard back (from the popup's search): a phone did not show
    // it selected again by itself, which an action done on it (the keyboard hidden) then lost
    await new Promise((resolve) => this.doc.defaultView!.requestAnimationFrame(resolve));
    await bridge.setSelection(context.from, context.to);
    const missing = (what: string) => new Error(`the library page did not hand over ${what}`);
    const editor: ActionEditor = {
      invokeCommand: async (name) => {
        if (!bridge.invokeCommand) throw missing("invokeCommand");
        await bridge.invokeCommand(name);
      },
      navigate: async (page) => {
        if (!bridge.navigate) throw missing("navigate");
        await bridge.navigate(page);
      },
      flash: (message, type) => void bridge.flash(message, type),
      select: (from, to) => void bridge.setSelection(from, to),
      // (The selection set again once the keyboard has gone: a phone may drop it as it goes)
      hideKeyboard: () => hideKeyboard(pageContentOf(this.doc.activeElement) ?? this.doc.querySelector<HTMLElement>(CONTENT_SELECTOR), () => void bridge.setSelection(context.from, context.to)),
    };
    try {
      await action.perform!(context, editor);
    } catch (e) {
      void this.bridge.flash(`Silverware Toolbar: ${action.label} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
    this.doc.defaultView!.requestAnimationFrame(() => void this.again());
  }

  /** A change written, unless the page changed since it was read: one edit, the selection it marks (else its own, else the text inserted) set */
  private async write(change: Change, context: Context): Promise<void> {
    const { text, select: marks } = marked(change.insert);
    if ((await this.bridge.getText()) !== context.text) {
      void this.bridge.flash("Silverware Toolbar: the page changed meanwhile, nothing was written: try again", "error");
      return;
    }
    await this.bridge.replaceRange(change.from, change.to, text);
    const select = marks ? { from: change.from + marks.from, to: change.from + marks.to } : (change.select ?? { from: change.from, to: change.from + text.length });
    await this.bridge.setSelection(select.from, select.to);
    change.after?.({ select: (from, to) => void this.bridge.setSelection(from, to) }, text);
  }

  /** The toolbar again after an action: by the selection, or at the caret where it was shown so */
  private async again(): Promise<void> {
    const range = this.watcher.current();
    if (range || !this.atCaret) {
      await this.selected(range);
      return;
    }
    const context = await this.read();
    if (!context || this.stopped || !this.atCaret) return;
    this.showBar(context, this.watcher.caret());
  }

  private focusEditor(): void {
    if (this.bridge.focus) void this.bridge.focus();
    else this.doc.querySelector<HTMLElement>(".cm-content")?.focus({ preventScroll: true });
  }

  private hideBar(): void {
    this.atCaret = false;
    this.range = undefined;
    this.bar.hide();
  }

  // Esc hides the toolbar (the popup's own Esc closes the popup first); shown at the caret, any key typed hides it
  private onKey = (e: KeyboardEvent): void => {
    if (this.popup.isOpen || !this.bar.shown) return;
    if (e.key === "Escape") this.hideBar();
    else if (this.atCaret && !this.persistent() && !["Shift", "Control", "Alt", "Meta"].includes(e.key)) this.hideBar();
  };

  // Shown at the caret, a press elsewhere hides it
  private onPress = (e: MouseEvent): void => {
    if (!this.atCaret || !this.bar.shown || (e.target instanceof Node && this.owns(e.target))) return;
    // Shown always, a press in the page's text moves the caret it follows
    if (this.persistent() && e.target instanceof Node && pageContentOf(e.target)) return;
    this.hideBar();
  };

  /** Whether the toolbar shows always while the page's text is edited (the show setting; mobile: where it docks) */
  private persistent(): boolean {
    const { show } = this.settings;
    return show === "always" || (show === "mobile" && this.docks());
  }

  /** Whether the page's text has the keyboard (its editor focused) */
  private writing(): boolean {
    return !!pageContentOf(this.doc.activeElement);
  }

  /** The caret moved (or came into the page's text): shown always, the toolbar goes with it, its buttons the formats around it */
  private async caretMoved(range: Range): Promise<void> {
    if (!this.persistent() || !this.writing() || this.popup.isOpen) return;
    const show = ++this.shows;
    const context = await this.read();
    if (!context || show !== this.shows || this.stopped || context.from !== context.to) return;
    this.atCaret = true;
    this.showBar(context, range);
  }

  // The page's text focused: shown always, the toolbar at the caret
  private onFocus = (e: FocusEvent): void => {
    const caret = this.watcher.caret();
    if (pageContentOf(e.target instanceof Node ? e.target : null) && caret) void this.caretMoved(caret);
  };

  // The page's text left (not for the toolbar's own controls): shown always, it goes until the page has the keyboard again
  private onBlur = (): void => {
    this.doc.defaultView!.setTimeout(() => {
      const active = this.doc.activeElement;
      if (!this.persistent() || this.writing() || this.popup.isOpen || (active && this.owns(active))) return;
      this.hideBar();
    });
  };

  /** Whether the toolbar docks at the bottom (the placement setting; auto: a selection made by touch) */
  private docks(): boolean {
    const { placement } = this.settings;
    return placement === "bottom" || (placement === "auto" && this.pointer === "touch");
  }

  /** The line the docked toolbar stands on: SilverBullet's keyboard bar's top where it shows, else the visual viewport's bottom (the on-screen keyboard's top) */
  private dockLine(): number {
    const win = this.doc.defaultView!;
    const view = win.visualViewport;
    return keyboardBarTop(this.doc) ?? (view ? view.offsetTop + view.height : win.innerHeight);
  }

  private onPointer = (e: PointerEvent): void => {
    if (!(e.target instanceof Node && this.owns(e.target))) this.pointer = e.pointerType || "mouse";
  };

  // The page scrolled or the window resized: the toolbar and the popup under it follow the selection (docked: the keyboard)
  private onScroll = (): void => {
    if (this.bar.shown && this.bar.docked) {
      this.bar.placeDocked(this.dockLine());
      if (this.popup.isOpen) this.popup.place(this.bar.rect(), viewTopOf(this.range?.startContainer ?? null), true);
      return;
    }
    const range = this.range;
    if (!range || !pageContentOf(range.startContainer) || !this.bar.shown) return;
    const viewTop = viewTopOf(range.startContainer);
    this.bar.place(rectOf(range), viewTop);
    if (this.popup.isOpen) this.popup.place(this.bar.rect(), viewTop);
  };
}

/** Where a selection (or a caret) is on screen: the box around its parts that have a width, else its own */
function rectOf(range: Range): Box {
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
  if (!rects.length) {
    const box = range.getBoundingClientRect();
    // A caret some browsers give no box: its line's
    if (box.height === 0 && box.width === 0) {
      const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      return element?.getBoundingClientRect() ?? box;
    }
    return box;
  }
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}
