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
import type { Bridge, Device, Settings } from "../bridge.ts";
import { CONTENT_SELECTOR, inEditor, pageContentOf, viewTopOf } from "../dom.ts";
import { ICONS } from "../icons.ts";
import type { Action, ActionEditor, Change, Context } from "./action.ts";
import { Bar, type Dock, type Shown } from "./bar.ts";
import { contextOf } from "./context.ts";
import { Docking } from "./dock.ts";
import { byTouch, isActionItem, isSeparator, type Look, ownIconHtml, type Pin, type SlotRef, slotOf } from "./favorites.ts";
import type { ItemKind } from "./items.ts";
import { hideKeyboard } from "./keyboard.ts";
import { marked } from "./cursor.ts";
import type { Box } from "./place.ts";
import { Panel } from "./panel.ts";
import { Popup } from "./popup.ts";
import { SelectionWatcher } from "./selection.ts";

type State = { readonly active: boolean; readonly enabled: boolean };

// After a read of the modules' actions failed, how long before it is tried again
const RETRY_MS = 5000;

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

/** The core's own action, the popup's icon by its search (found by it too; a favourite too): the settings dialog */
export const SETTINGS_ACTION: Action = {
  id: "actions.settings",
  label: "Silverware Toolbar settings…",
  icon: ICONS.settings,
  group: "Silverware Toolbar",
  keywords: ["preferences", "favorites", "options", "key"],
  // In the popup's head as an icon; its search finds it
  listed: false,
};

export class Controller {
  private readonly watcher: SelectionWatcher;
  private readonly bar: Bar;
  private readonly popup: Popup;
  // An action's own panel (the emoji picker)
  private readonly panel: Panel;
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
  // SilverBullet's keyboard bar put in or taken out (it renders it as the keyboard comes and goes, after the events
  // that tell those): the docked toolbar placed again where its line moved, looked at once a frame at most; watched
  // only while docked
  // Where the docked toolbar goes, and what moves it (SilverBullet's editor, the keyboard)
  private readonly docking: Docking;
  // The modules' actions to read anew as the toolbar next shows: after each load of Space Lua (its scripts define
  // commands after the toolbar starts, `reloaded`), or after a read that failed, not before `retryAt`
  private stale = true;
  private retryAt = 0;

  constructor(
    readonly doc: Document,
    // Handed over anew when SilverBullet loads its configuration again (the settings the same)
    public bridge: Bridge,
    readonly settings: Settings,
    // The actions offered, asked for each time they show (definitions made later count)
    private readonly actions: () => readonly Action[],
    // The kinds of favourites the modules give (core/items.ts)
    private readonly kinds: () => readonly ItemKind[],
    // The modules' actions read anew (a popup open lists them once read)
    private readonly refresh: () => Promise<void>,
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
    this.panel = new Panel(doc);
    this.docking = new Docking(doc, () => (this.bar.shown ? this.bar.dockedAt : undefined), this.onScroll);
  }

  start(): void {
    const win = this.doc.defaultView!;
    this.watcher.start();
    win.addEventListener("keydown", this.onKey, true);
    win.addEventListener("mousedown", this.onPress, true);
    win.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    win.addEventListener("resize", this.onScroll);
    this.doc.addEventListener("focusin", this.onFocus);
    this.doc.addEventListener("focusout", this.onBlur);
    this.docking.start();
    // Shown always: from the start
    void this.showStaying();
  }

  stop(): void {
    this.stopped = true;
    const win = this.doc.defaultView!;
    this.watcher.stop();
    win.removeEventListener("keydown", this.onKey, true);
    win.removeEventListener("mousedown", this.onPress, true);
    win.removeEventListener("scroll", this.onScroll, { capture: true });
    win.removeEventListener("resize", this.onScroll);
    this.doc.removeEventListener("focusin", this.onFocus);
    this.doc.removeEventListener("focusout", this.onBlur);
    this.docking.stop();
    this.bar.remove();
    this.popup.remove();
    this.panel.remove();
  }

  /** Space Lua loaded again (the library page's init with the same settings): the modules' actions read anew as the toolbar next shows */
  reloaded(): void {
    this.stale = true;
  }

  /** The popup of every action under the toolbar (the toolbar's …, the command): by the selection, else the toolbar at the caret; `choices`: open at that action's */
  async showActions(choices?: Action): Promise<void> {
    // The popup in a panel's place (the toolbar's … or a list's button while it is open): the panel done
    this.panel.close(true);
    // (Also where no toolbar shows: no selection, no caret)
    this.refreshIfStale();
    const context = await this.read();
    if (!context || this.stopped) return;
    const range = this.watcher.current() ?? this.watcher.caret();
    this.shows++;
    this.atCaret = context.from === context.to;
    this.showBar(context, range);
    this.popup.open({
      actions: this.listed(),
      state: (action) => this.state(action, context),
      rect: this.bar.shown ? this.bar.rect() : undefined,
      above: this.bar.docked && !this.bar.dockedTop,
      viewTop: viewTopOf(range?.startContainer ?? this.doc.querySelector(CONTENT_SELECTOR)),
      run: (action) => void this.run(action),
      tools: this.openSettings ? [SETTINGS_ACTION] : [],
      closed: () => this.focusEditor(),
      keeps: (node) => this.bar.owns(node),
      ...(choices ? { choices } : {}),
    });
  }

  /**
   * The modules' actions read anew (nothing waits for it): once read, the popup
   * open lists them and the toolbar is shown again by the selection as it is
   * then (a favourite of a script's command); a read that failed is tried again
   * as the toolbar next shows
   */
  refreshActions(): void {
    this.stale = false;
    this.refresh().then(
      () => {
        if (this.stopped) return;
        if (this.popup.isOpen) this.popup.setActions(this.listed());
        // (Not under an action's panel: its button stays as it is)
        else if (this.bar.shown && !this.panel.isOpen) void this.again();
      },
      (e: unknown) => {
        // Tried again as the toolbar shows, not sooner than RETRY_MS
        this.stale = true;
        this.retryAt = Date.now() + RETRY_MS;
        console.error("Silverware Toolbar: the actions could not be read anew", e);
      },
    );
  }

  /** The actions read anew where they may lack some (`stale`), not before a failed read's retry is due */
  private refreshIfStale(): void {
    if (this.stale && Date.now() >= this.retryAt) this.refreshActions();
  }

  /** The actions the popup lists: the offered ones but … itself */
  private listed(): readonly Action[] {
    return this.offered().filter((action) => action !== MORE_ACTION);
  }

  /** The modules' actions, and the core's own (… and, where it has them, the settings) */
  private offered(): readonly Action[] {
    return [...this.actions(), MORE_ACTION, ...(this.openSettings ? [SETTINGS_ACTION] : [])];
  }

  private owns(node: Node): boolean {
    return this.bar.owns(node) || this.popup.owns(node) || this.panel.owns(node);
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
            return action ? [{ action, ...lookOf(item), ...(item.icon ? { ownIcon: item.icon } : {}), ...(item.label ? { ownLabel: item.label } : {}), ...this.state(action, context) }] : [];
          }
          // A kind's: a kind no module on gives, or a slot without an action, left out
          const kind = kinds.find((k) => k.type === item.type);
          if (!kind || kind.check?.(item)) return [];
          // A slot's action with its own icon and label where the slot has them: the kind draws it as it is given
          const slots = kind.slots.map(({ key, optional }) => {
            const ref = slotOf(item[key]);
            const found = ref && all.find((a) => a.id === ref.id);
            return { key, optional, action: found && ref ? withOwnLook(found, ref) : found };
          });
          if (slots.some(({ optional, action }) => !optional && !action)) return [];
          const found = Object.fromEntries(slots.flatMap(({ key, action }) => (action ? [[key, action]] : [])));
          return [{ item: { kind, actions: found as Record<string, Action>, ...lookOf(item), item } }];
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
      this.panel.close(true);
      return;
    }
    this.context = context;
    // The first show after Space Lua loaded: the actions read anew (a script's commands), shown once read
    this.refreshIfStale();
    const rows = this.favorites(context);
    // Favourites without … anywhere (an item of it, or a slot of a kind's): pinned at the end
    const more = rows.some((row) => row.some((item) => ("action" in item && item.action === MORE_ACTION) || ("item" in item && Object.values(item.item.actions).some((a) => a.id === MORE_ACTION.id))))
      ? undefined
      : { action: MORE_ACTION, active: false, enabled: true, labeled: false };
    if (this.docks()) {
      // (Shown while writing or always: room kept for it, so it covers no text; shown by a selection alone, the
      // editor would jump with each)
      this.bar.dock(rows, this.dockAt(), more, this.persistent());
      this.docking.follow(true);
    } else this.bar.show(rows, rectOf(range), viewTopOf(range.startContainer), more);
  }

  /** A selection made in the page's text: the toolbar by it; none: the toolbar goes (unless shown at the caret) */
  private async selected(range: Range | undefined): Promise<void> {
    const show = ++this.shows;
    if (!range) {
      // Shown always while writing: it goes to the caret once it settles (caretMoved)
      if (!this.atCaret && !(this.persistent() && (this.writing() || this.stays()))) {
        this.range = undefined;
        this.bar.hide();
        this.panel.close(true);
      }
      return;
    }
    this.atCaret = false;
    if (this.popup.isOpen) return;
    const context = await this.read();
    if (!context || show !== this.shows || this.stopped) return;
    // The editor's selection is a caret (the page's selection is not its own, or was just changed): no toolbar
    // (shown always: it stays as it is)
    if (context.from === context.to) {
      if (this.stays()) return;
      this.bar.hide();
      this.panel.close(true);
      return;
    }
    this.showBar(context, range);
  }

  /** An action run on the selection: its change written as one edit, the selection set after it */
  private async run(action: Action): Promise<void> {
    // …: the popup opened, or closed again
    // (By its id: a gesture button's slot gives it with an icon or label of its own, another object)
    if (action.id === MORE_ACTION.id) {
      if (this.popup.isOpen) this.popup.close();
      else void this.showActions();
      return;
    }
    // Run from the toolbar while the popup is open: the popup is done
    this.popup.close(true);
    if (action.panel) {
      this.togglePanel(action);
      return;
    }
    this.panel.close(true);
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

  /** An action's own panel opened (by the toolbar, as the popup is), or closed again by its button */
  private togglePanel(action: Action): void {
    if (this.panel.isOpenFor(action)) {
      this.panel.close();
      return;
    }
    const range = this.range;
    this.panel.open(
      action,
      {
        rect: this.bar.shown ? this.bar.rect() : undefined,
        viewTop: viewTopOf(range?.startContainer ?? this.doc.querySelector(CONTENT_SELECTOR)),
        above: this.bar.docked && !this.bar.dockedTop,
        keeps: (node) => this.bar.owns(node),
        closed: () => this.focusEditor(),
      },
      (element) =>
        action.panel!({
          doc: this.doc,
          element,
          docked: this.bar.docked,
          write: (edit) => void this.panelWrite(edit),
          close: () => this.panel.close(),
          place: () => this.panel.place(),
        }),
    );
  }

  /** What a panel writes: the selection read anew, its change written as an action's */
  private async panelWrite(edit: (context: Context) => Change | undefined): Promise<void> {
    this.panel.close(true);
    const context = await this.read();
    if (context) {
      try {
        const change = edit(context);
        if (change) await this.write(change, context);
      } catch (e) {
        void this.bridge.flash(`Silverware Toolbar: writing failed: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    }
    this.focusEditor();
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
    else this.doc.querySelector<HTMLElement>(CONTENT_SELECTOR)?.focus({ preventScroll: true });
  }

  private hideBar(keepRoom = false): void {
    this.atCaret = false;
    this.range = undefined;
    this.bar.hide(keepRoom);
    this.panel.close(true);
  }

  // Esc hides the toolbar (the popup's own Esc closes the popup first); shown at the caret, any key typed hides it
  private onKey = (e: KeyboardEvent): void => {
    // (A panel's keys its own: its Esc closes it alone)
    if (this.popup.isOpen || this.panel.isOpen || !this.bar.shown) return;
    // (Shown always: it stays, Esc is the editor's)
    if (e.key === "Escape") {
      if (!this.persistent()) this.hideBar();
    } else if (this.atCaret && !this.persistent() && !["Shift", "Control", "Alt", "Meta"].includes(e.key)) this.hideBar();
  };

  // Shown at the caret, a press elsewhere hides it (shown always: it stays)
  private onPress = (e: MouseEvent): void => {
    if (!this.atCaret || !this.bar.shown || this.stays() || (e.target instanceof Node && this.owns(e.target))) return;
    // Shown always, a press in the page's text moves the caret it follows
    if (this.persistent() && e.target instanceof Node && pageContentOf(e.target)) return;
    // (Docked, a press elsewhere in the editor, a table's: the room kept for it stays, the editor does not jump)
    this.hideBar(e.target instanceof Node && inEditor(e.target));
  };

  /** Whether the toolbar shows while the page's text is edited, with nothing selected too (the show setting, this device's: writing, always) */
  private persistent(): boolean {
    return this.settings.show[this.device()] !== "selection";
  }

  /** Whether the toolbar shows always, the page's text edited or not (the show setting, this device's) */
  private stays(): boolean {
    return this.settings.show[this.device()] === "always";
  }

  /** Shown always: the toolbar at once, as the caret is (docked, also where the page's text has no focus) */
  private async showStaying(): Promise<void> {
    if (!this.stays() || this.bar.shown) return;
    const show = ++this.shows;
    const context = await this.read();
    if (!context || show !== this.shows || this.stopped || this.bar.shown) return;
    const range = this.watcher.caret() ?? (this.docks() ? this.doc.createRange() : undefined);
    if (!range) return;
    this.atCaret = context.from === context.to;
    this.showBar(context, range);
  }

  /** This device as the settings tell them apart (worked by a finger or not) */
  private device(): Device {
    return byTouch(this.doc.defaultView) ? "touch" : "click";
  }

  /** Whether the page's text has the keyboard (its editor focused) */
  private writing(): boolean {
    return !!pageContentOf(this.doc.activeElement);
  }

  /** The caret moved (or came into the page's text): shown always, the toolbar goes with it, its buttons the formats around it */
  private async caretMoved(range: Range): Promise<void> {
    if (!this.persistent() || !(this.writing() || this.stays()) || this.popup.isOpen) return;
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

  // The page's text left (not for the toolbar's own controls): shown while writing, it goes until the page has the
  // keyboard again; the focus still in SilverBullet's editor (a table's cell edited), the room kept for it docked
  // stays, else the editor would jump under the finger each time
  private onBlur = (): void => {
    this.doc.defaultView!.setTimeout(() => {
      const active = this.doc.activeElement;
      if (!this.bar.shown) {
        if (!this.docking.stillEditing(active)) this.bar.dropRoom();
        return;
      }
      if (!this.persistent() || this.stays() || this.writing() || this.popup.isOpen || (active && this.owns(active))) return;
      this.hideBar(this.docking.stillEditing(active));
    });
  };

  /** Whether the toolbar docks, at the bottom or the top (the placement setting, this device's) */
  private docks(): boolean {
    return this.settings.placement[this.device()] !== "selection";
  }

  /** Where the toolbar docks now (the placement setting's edge) */
  private dockAt(): Dock {
    return this.docking.at(this.settings.placement[this.device()] === "top" ? "top" : "bottom");
  }

  // The page scrolled or the window resized: the toolbar and the popup under it follow the selection (docked: the keyboard)
  private onScroll = (): void => {
    if (this.bar.shown && this.bar.docked) {
      this.bar.placeDocked(this.dockAt());
      const above = !this.bar.dockedTop;
      if (this.popup.isOpen) this.popup.place(this.bar.rect(), viewTopOf(this.range?.startContainer ?? null), above);
      if (this.panel.isOpen) this.panel.place(this.bar.rect(), viewTopOf(this.range?.startContainer ?? null), above);
      return;
    }
    const range = this.range;
    if (!range || !pageContentOf(range.startContainer) || !this.bar.shown) return;
    const viewTop = viewTopOf(range.startContainer);
    this.bar.place(rectOf(range), viewTop);
    if (this.popup.isOpen) this.popup.place(this.bar.rect(), viewTop);
    if (this.panel.isOpen) this.panel.place(this.bar.rect(), viewTop, false);
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

/** How an item shows: with its label (and that label's fixed width), pinned at an end where docked */
function lookOf(item: Look): { labeled: boolean; width?: number; pin?: Pin } {
  const labeled = item.show === "label";
  return { labeled, ...(labeled && item.width ? { width: item.width } : {}), ...(item.pin ? { pin: item.pin } : {}) };
}

/** An action as a slot shows it: its own icon (a character, an emoji) and label in place of the action's, the rest the action's */
function withOwnLook(action: Action, ref: SlotRef): Action {
  if (!ref.icon && !ref.label) return action;
  return { ...action, ...(ref.icon ? { icon: ownIconHtml(ref.icon) } : {}), ...(ref.label ? { label: ref.label } : {}) };
}
