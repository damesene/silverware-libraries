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
// none of them.
import type { Bridge, Settings } from "../bridge.ts";
import { pageContentOf, viewTopOf } from "../dom.ts";
import type { Action, Change, Context } from "./action.ts";
import { Bar, type Shown } from "./bar.ts";
import { contextOf } from "./context.ts";
import { marked } from "./cursor.ts";
import type { Box } from "./place.ts";
import { Popup } from "./popup.ts";
import { SelectionWatcher } from "./selection.ts";

type State = { readonly active: boolean; readonly enabled: boolean };

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

  constructor(
    readonly doc: Document,
    readonly bridge: Bridge,
    readonly settings: Settings,
    // The actions offered, asked for each time they show (definitions made later count)
    private readonly actions: () => readonly Action[],
  ) {
    this.watcher = new SelectionWatcher(doc, (range) => void this.selected(range), (node) => this.owns(node));
    this.bar = new Bar(doc, {
      run: (action) => void this.run(action),
      more: () => (this.popup.isOpen ? this.popup.close() : void this.showActions()),
      state: (action) => (this.context ? this.state(action, this.context) : { active: false, enabled: false }),
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
  }

  stop(): void {
    this.stopped = true;
    const win = this.doc.defaultView!;
    this.watcher.stop();
    win.removeEventListener("keydown", this.onKey, true);
    win.removeEventListener("mousedown", this.onPress, true);
    win.removeEventListener("scroll", this.onScroll, { capture: true });
    win.removeEventListener("resize", this.onScroll);
    this.bar.remove();
    this.popup.remove();
  }

  /** The popup of every action under the toolbar (the toolbar's …, the command): by the selection, else the toolbar at the caret */
  async showActions(): Promise<void> {
    const context = await this.read();
    if (!context || this.stopped) return;
    const range = this.watcher.current() ?? this.watcher.caret();
    this.shows++;
    this.atCaret = context.from === context.to;
    this.showBar(context, range);
    const actions = this.actions();
    this.popup.open({
      actions,
      state: (action) => this.state(action, context),
      rect: this.bar.shown ? this.bar.rect() : undefined,
      viewTop: viewTopOf(range?.startContainer ?? this.doc.querySelector(".cm-content")),
      run: (action) => void this.run(action),
      closed: () => this.focusEditor(),
      keeps: (node) => this.bar.owns(node),
    });
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
    const actions = this.actions();
    const all = [...actions, ...actions.flatMap((a) => a.choices ?? [])];
    return this.settings.favorites
      .map((row) => {
        const items = row.flatMap((item): Shown[] => {
          if (item.type === "separator") return [{ separator: true }];
          const action = all.find((a) => a.id === item.id);
          return action ? [{ action, labeled: item.show === "label", ...this.state(action, context) }] : [];
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
    this.bar.show(this.favorites(context), rectOf(range), viewTopOf(range.startContainer));
  }

  /** A selection made in the page's text: the toolbar by it; none: the toolbar goes (unless shown at the caret) */
  private async selected(range: Range | undefined): Promise<void> {
    const show = ++this.shows;
    if (!range) {
      if (!this.atCaret) {
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
    // Run from the toolbar while the popup is open: the popup is done
    this.popup.close(true);
    const context = await this.read();
    if (!context || !this.state(action, context).enabled || !action.run) {
      this.focusEditor();
      return;
    }
    try {
      const change = action.run(context);
      if (change) await this.write(change, context);
    } catch (e) {
      void this.bridge.flash(`Silverware Toolbar: ${action.label} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
    this.focusEditor();
    // The toolbar shows what the change made (a format now on), once the editor has the selection set
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
    else if (this.atCaret && !["Shift", "Control", "Alt", "Meta"].includes(e.key)) this.hideBar();
  };

  // Shown at the caret, a press elsewhere hides it
  private onPress = (e: MouseEvent): void => {
    if (this.atCaret && this.bar.shown && !(e.target instanceof Node && this.owns(e.target))) this.hideBar();
  };

  // The page scrolled or the window resized: the toolbar and the popup under it follow the selection
  private onScroll = (): void => {
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
