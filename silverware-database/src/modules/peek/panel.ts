// The peek's panel: an item over the right of the editor's area, as Notion's
// side peek (docs/silverware-database.md, *peek*): its name, its properties
// edited as the views edit them (views/editors.ts), its body as markdown text
// in a field of ours, *Open* (its page). A floating element of ours in the
// page's `body`, its keys its own (none goes on to the page under it), Esc and
// a press beside it closing it. It reads and writes through the module's host
// (the core), the database's schema read anew with the item.
//
// Nothing lost: a value is written as its field is left (the core writes it
// only where the item is still as read); the body only where it is still as
// it was read (`was`). A body not written stays in its field with why, and
// the panel stays open over it (closed, switched, Esc, a press beside: none
// takes it away) until it is written or the user agrees to load the body as it
// is now. A change made elsewhere draws the panel anew once nothing in it is
// being edited.
import { el, openedHere } from "../../../../shared/elements.ts";
import type { Result } from "../../core/core.ts";
import type { ModuleHost, OpenedFrom } from "../../core/module.ts";
import { samePart } from "../../domain/itempart.ts";
import { textOf, typeOf } from "../../domain/listing.ts";
import type { Database, Item, ItemLook, Property, Value } from "../../model/database.ts";
import { type EditorHost, editValue, toggle } from "../../views/editors.ts";
import { reorder } from "../../../../shared/drag.ts";
import { propertyIcon, typeIcon, VIEW_ICONS } from "../../views/icons.ts";
import type { PropertiesOffer } from "../properties/index.ts";
import { type LookControls, lookControls } from "./look.ts";
import { missing, valueNodes } from "../../views/values.ts";

// The panel's width where none is set (the module's setting `width`), the narrowest it may be set to, and its share of the
// editor's area at most (the page beside it still seen)
const WIDTH = 600;
const MIN_WIDTH = 320;
const SHARE = 0.8;
// How long after a press beside the panel its click is waited for (a press moved away, a drag, has none)
const CLICK_WAIT_MS = 400;
// How far a press beside the panel moves before it is a drag (a card or a row dragged to its place), which leaves it open
const DRAG_MOVE = 6;
// An editor's area narrower than this (a phone, a narrow window): the panel takes all of it, as a page of its own
const NARROW = 720;
// What a press there is not beside the panel: a dialog over the page (a question asked), a notification
const NOT_BESIDE = 'dialog, [role="dialog"], [role="alertdialog"], .sb-modal-box, .sb-notifications, .sb-notification, .swd-settings-backdrop';
// A grip: six dots, what a property's row is dragged by
const GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></svg>';

const isRefused = (result: Result): result is Extract<Result, { problem: string }> => "problem" in result;

/** An item with a value set (undefined: taken off), as the panel shows it once it wrote it */
function withValue(item: Item, key: string, value: Value | undefined): Item {
  const { [key]: _gone, ...others } = item.values;
  return { ...item, values: value === undefined ? others : { ...others, [key]: value } };
}

type Shown = {
  readonly database: string;
  schema: Database;
  // The item as drawn: what a value edited is written against (changed since, the write is refused, never applied over it)
  item: Item;
  // The item as last read: what the body is written to (its own check is `was`)
  latest: Item;
  // The body as read as the panel opened or last wrote it, what a write is checked against; undefined until read
  body: { readonly was: string | undefined } | undefined;
  // A change made elsewhere while something in the panel was edited: drawn anew once nothing is
  stale: boolean;
  // A body typed and not written (changed since read, or refused): kept in its field through every drawing, with why, until written or loaded anew
  kept?: { readonly text: string; readonly why: string };
  // Where the focus was as the panel opened: given back as it closes
  readonly opener: Element | null;
  // The view it was opened from, followed live: the properties it hides marked (none: nothing marked); as drawn, `hiddenAt`
  readonly from?: OpenedFrom;
  hiddenAt?: string;
  // The body's field and its note: made once for the item shown and left in place as the rest is drawn anew, so a value written
  // shows at once while the body is typed in (drawn anew under it, the field lost its focus and what was typed)
  field?: { readonly body: HTMLTextAreaElement; readonly note: HTMLElement };
};

/** A content's field waiting for the content read (`readBody` fills only such a field): read only, marked */
function toRead(body: HTMLTextAreaElement): void {
  body.readOnly = true;
  body.dataset.reading = "";
  body.placeholder = "Reading…";
}

/** A button whose press takes no focus (a field being edited stays so until what it opens takes the focus): its click not lost to a redraw */
function keepFocus(button: HTMLElement): void {
  button.addEventListener("mousedown", (event) => event.preventDefault());
}

export class PeekPanel {
  private shown: Shown | undefined;
  private element: HTMLElement | undefined;
  private readonly stops: (() => void)[] = [];
  // The body's write going on (the field left): waited for before the panel closes or shows another item
  private writing: Promise<void> = Promise.resolve();
  // Writes of a value or the name going on (their editors left): waited for with the body's before the item is removed
  private readonly edits = new Set<Promise<unknown>>();
  // The panel's own writes of its item, one after another: each from the item as the one before it left the panel (`own`)
  private queue: Promise<unknown> = Promise.resolve();
  // Items asked to be shown, counted: a press beside the panel closes it only where it asked for none (`beside`)
  private asked = 0;
  // A press beside the panel being followed to its end (its listeners, its timers): ended as the panel goes or another comes
  private pressBeside: (() => void) | undefined;
  // The item being removed (asked, written): a second press of the bin meanwhile asks nothing
  private removing = false;
  // A question asked of the user: presses meanwhile are theirs, not beside the panel
  private asking = false;
  // Writes of the body going on: a body read meanwhile is not put in its field (it would replace what is being written)
  private bodyWrites = 0;
  // When the user was last told a body kept stops the panel going (a press beside, then the press's own open: told once)
  private toldKept = 0;
  // The width its edge was dragged to in this session (undefined: the module's setting)
  private dragged: number | undefined;
  // Its left edge, kept as the panel is drawn anew
  private handle: HTMLElement | undefined;
  // The item's icon and color over its name, as last drawn (a picker of theirs closed as the panel is drawn anew)
  private look: LookControls | undefined;

  constructor(private readonly host: ModuleHost) {}

  get item(): Item | undefined {
    return this.shown?.item;
  }

  /** An item shown; another shown before is left first (its field written), unless its body typed could not be written: then it stays */
  async show(item: Item, database: string, from?: OpenedFrom): Promise<void> {
    this.asked++;
    const opener = this.shown?.opener ?? this.host.document.activeElement;
    if (!(await this.leave())) return;
    const read = await this.host.database(database);
    if (!read) return;
    this.shown = { database, schema: read.value, item, latest: item, body: undefined, stale: false, opener, ...(from ? { from } : {}) };
    // (The view it was opened from followed: what it hides marked anew as it changes)
    this.stopFrom?.();
    this.stopFrom = from?.onChange(() => this.followFrom());
    if (!this.element) this.open();
    this.draw();
    void this.readBody();
    // (The panel, not its name: on a phone a field focused brings the keyboard up)
    this.element?.focus({ preventScroll: true });
  }

  /** Closed, once the field being edited is written; not where a body typed could not be written (said beside it): false then */
  async close(): Promise<boolean> {
    if (!this.element) return true;
    if (!(await this.leave())) return false;
    this.remove();
    return true;
  }

  /** The module stopped: closed whatever is shown; a body typed and not written said with its text, nothing else can keep it */
  stop(): void {
    const shown = this.shown;
    const field = this.element?.querySelector<HTMLTextAreaElement>(".swd-peek-body");
    // (A body typed and not left yet: not every browser blurs a field as it goes)
    const typed = shown && field && field.dataset.reading === undefined && shown.body && field.value !== (shown.body.was ?? "") ? field.value : undefined;
    const inField = field && field.dataset.reading === undefined ? field.value : undefined;
    const kept = shown?.kept ? { ...shown.kept, text: inField ?? shown.kept.text } : typed === undefined ? undefined : { text: typed, why: "the module stopped before it was written" };
    if (shown && kept) this.host.ui.notify(`Silverware Database: the content typed for "${shown.item.name}" was not written (${kept.why}). It was:\n${kept.text}`, { type: "error" });
    this.remove();
  }

  // The view the item shown was opened from, listened to
  private stopFrom: (() => void) | undefined;

  /** The view the item was opened from changed (another shown, Visible properties): drawn anew where what it hides did, once nothing is edited */
  private followFrom(): void {
    const shown = this.shown;
    if (!shown || hiddenKey(shown) === shown.hiddenAt) return;
    if (this.drawingPutOff()) shown.stale = true;
    else this.draw();
  }

  /** The database changed (here or elsewhere): the item and the schema read anew, drawn anew where nothing is edited now, else once it is not */
  async follow(): Promise<void> {
    const shown = this.shown;
    if (!shown) return;
    const [read, items] = await Promise.all([this.host.database(shown.database), this.host.items(shown.database)]);
    if (this.shown !== shown || !read) return;
    const now = items.find((one) => one.key === shown.item.key);
    if (!now) {
      // (Removed, here or elsewhere: nothing of it to show, unless a body typed is kept: shown until it is taken)
      if (!this.editing() && !shown.kept) return this.remove();
      shown.stale = true;
      return;
    }
    shown.latest = now;
    // (Its values compared too: a system property's change with no change of the item's own, its order as another moves past it)
    if (now.revision === shown.item.revision && JSON.stringify(now.values) === JSON.stringify(shown.item.values) && JSON.stringify(read.value) === JSON.stringify(shown.schema)) return;
    // A value or the name edited: drawn once it is not, the item kept as drawn meanwhile (a value written from it is checked
    // against it); the body typed in is no reason, as it is not drawn anew
    if (this.drawingPutOff()) {
      shown.stale = true;
      return;
    }
    shown.item = now;
    shown.schema = read.value;
    this.draw();
    void this.readBody();
  }

  /** The field being edited left (written by its own handlers), the body's write waited for: whether the panel may go (no body typed kept) */
  private async leave(): Promise<boolean> {
    const active = this.host.document.activeElement;
    if (this.element && active instanceof HTMLElement && this.element.contains(active)) active.blur();
    await this.writing;
    // (A value or the name being written too: done, with its following, before another item is shown)
    await Promise.all([...this.edits]).catch(() => undefined);
    const shown = this.shown;
    if (!shown?.kept) return true;
    // Not taken away: the field and its note shown, the user told (once for one press)
    this.draw();
    this.element?.querySelector<HTMLElement>(".swd-peek-body")?.focus({ preventScroll: true });
    if (Date.now() - this.toldKept > 1500) this.host.ui.notify("The content typed was not written: copy it, or load the content as it is now, before you leave it", { type: "error" });
    this.toldKept = Date.now();
    return false;
  }

  private remove(): void {
    if (!this.element) return;
    for (const stop of this.stops.splice(0)) stop();
    this.stopFrom?.();
    this.stopFrom = undefined;
    this.look?.close();
    this.look = undefined;
    const opener = this.shown?.opener;
    this.element.remove();
    this.element = undefined;
    this.shown = undefined;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
  }

  private open(): void {
    const doc = this.host.document;
    const element = el(doc, "aside", { class: "swd-peek", attrs: { role: "dialog", "aria-modal": "false", "aria-labelledby": "swd-peek-name", tabindex: "-1" } });
    // Its keys its own: none goes on to the page (SilverBullet would act on them); Esc closes it where no field takes it
    const keep = (event: KeyboardEvent) => event.stopPropagation();
    element.addEventListener("keydown", (event) => {
      keep(event);
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        void this.close();
      }
    });
    element.addEventListener("keyup", keep);
    element.addEventListener("keypress", keep);
    // Nothing edited any more: a change made meanwhile drawn
    element.addEventListener("focusout", () =>
      setTimeout(() => {
        const shown = this.shown;
        if (shown?.stale && !this.drawingPutOff()) {
          shown.stale = false;
          // (After the body's write, if one was just queued: what it wrote is read with the rest)
          void this.writing.then(() => this.follow()).then(() => {
            if (this.shown === shown && !this.drawingPutOff()) {
              this.draw();
              void this.readBody();
            }
          });
        }
      }),
    );
    // A press beside it closes it (what is typed written first); not one in a question asked meanwhile, nor in a dialog or a
    // notification. Once the press is over, and only where it showed no other item: a press on another item's name shows
    // that one in the panel as it is, never closed and opened anew (the panel blinked); nor a drag (a card or a row dragged
    // to its place, its item's rank written: the panel stays as it is)
    const beside = (event: PointerEvent) => {
      const target = event.target;
      if (!this.element || this.asking || !(target instanceof Element) || this.element.contains(target) || target.closest(NOT_BESIDE)) return;
      // What is being edited in it written at once, before the press does anything (as closing it would have)
      const active = doc.activeElement;
      if (active instanceof HTMLElement && this.element.contains(active)) active.blur();
      this.pressBeside?.();
      const asked = this.asked;
      const from = { x: event.clientX, y: event.clientY };
      let late: ReturnType<typeof setTimeout> | undefined;
      let after: ReturnType<typeof setTimeout> | undefined;
      const listened = ["pointerup", "pointercancel", "click"] as const;
      const end = () => {
        for (const type of listened) doc.removeEventListener(type, step, true);
        clearTimeout(late);
        clearTimeout(after);
        this.pressBeside = undefined;
      };
      // (After the click's own handlers: an item it shows asked for meanwhile, the panel then shows it as it is)
      const settle = () => {
        clearTimeout(late);
        after = setTimeout(() => {
          end();
          if (this.asked === asked) void this.close();
        }, 0);
      };
      const step = (done: Event) => {
        if (done.type === "click") return settle();
        // A drag: let go away from where it was pressed, left open
        if (done instanceof MouseEvent && done.type === "pointerup" && Math.hypot(done.clientX - from.x, done.clientY - from.y) > DRAG_MOVE) return end();
        // (No click comes of a press moved away a little: closed all the same)
        late ??= setTimeout(settle, CLICK_WAIT_MS);
      };
      for (const type of listened) doc.addEventListener(type, step, true);
      this.pressBeside = end;
    };
    doc.addEventListener("pointerdown", beside, true);
    this.stops.push(() => {
      doc.removeEventListener("pointerdown", beside, true);
      this.pressBeside?.();
    });
    const view = doc.defaultView;
    const place = () => this.place();
    view?.addEventListener("resize", place);
    this.stops.push(() => view?.removeEventListener("resize", place));
    const watching = this.host.onEditorAreaChanged?.(place);
    if (watching) this.stops.push(watching);
    // The page's text's look (the panel hangs in the document's body, where none of the editor's rules reach)
    for (const [name, value] of Object.entries(this.host.editorLook?.() ?? {})) element.style.setProperty(name, value);
    this.handle = this.resizer();
    element.append(this.handle);
    doc.body.append(element);
    this.element = element;
    this.place();
  }

  /** Over the right of the editor's area (the window where the host says none) */
  private place(): void {
    const element = this.element;
    const view = this.host.document.defaultView;
    if (!element || !view) return;
    const area = this.host.editorArea() ?? new DOMRect(0, 0, view.innerWidth, view.innerHeight);
    const whole = area.width < NARROW;
    element.classList.toggle("swd-peek-whole", whole);
    element.style.top = `${Math.max(0, area.top)}px`;
    element.style.right = `${Math.max(0, view.innerWidth - area.right)}px`;
    element.style.height = `${Math.max(0, Math.min(area.bottom, view.innerHeight) - Math.max(0, area.top))}px`;
    element.style.width = `${Math.round(whole ? Math.min(area.width, view.innerWidth) : Math.min(this.width(), area.width * SHARE, view.innerWidth))}px`;
  }

  /** The width set (the module's setting, its left edge dragged), within what a panel may be */
  private width(): number {
    const set = Number(this.dragged ?? this.host.setting("width"));
    return Number.isFinite(set) && set > 0 ? Math.max(MIN_WIDTH, Math.round(set)) : WIDTH;
  }

  /**
   * Its left edge: dragged, the panel as wide as the pointer leaves it, saved
   * as the module's setting (for every database) as it is let go; a double
   * click its default again; ← → from the keys, 40px a press
   */
  private resizer(): HTMLElement {
    const doc = this.host.document;
    const handle = el(doc, "div", { class: "swd-peek-resize", title: "Drag to set the panel's width (a double click: its default)", attrs: { role: "separator", "aria-orientation": "vertical", "aria-label": "The panel's width", tabindex: "0" } });
    // (The setting's value set first, as it is saved: the panel then placed by it)
    const save = (width: number | undefined) => {
      void this.host.saveSetting("width", width);
      this.dragged = undefined;
      this.place();
    };
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !this.element) return;
      event.preventDefault();
      const start = { x: event.clientX, width: this.element.getBoundingClientRect().width };
      handle.setPointerCapture?.(event.pointerId);
      const move = (moved: PointerEvent) => {
        this.dragged = Math.max(MIN_WIDTH, Math.round(start.width + start.x - moved.clientX));
        this.place();
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        // (As wide as it shows: a width past what the area allows is not kept)
        if (this.element) save(Math.round(this.element.getBoundingClientRect().width));
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
    handle.addEventListener("dblclick", () => save(undefined));
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      save(Math.max(MIN_WIDTH, this.width() + (event.key === "ArrowLeft" ? 40 : -40)));
    });
    return handle;
  }

  // A property's row being dragged by its grip: the list it is dragged in is the drag's, drawn anew only once it is let go
  private dragging = false;

  /**
   * Whether what is drawn anew is being edited (a value's editor open, the name changed) or a row of it dragged: the panel's
   * drawing put off until it is not (a change told meanwhile, the item's page indexed anew after a write, drew the list anew
   * under the drag, which then held a list gone: it stopped scrolling the box)
   */
  private drawingPutOff(): boolean {
    if (this.dragging) return true;
    const active = this.host.document.activeElement;
    return this.editing() && !(active instanceof HTMLElement && active.matches(".swd-peek-body"));
  }

  /** Whether something of the panel is being edited (a value's editor open, the body, the name changed) */
  private editing(): boolean {
    const active = this.host.document.activeElement;
    if (!this.element || !active || !this.element.contains(active)) return false;
    if (active.closest(".swd-editor") || active.matches(".swd-peek-body")) return true;
    // (The name focused as the panel opens is not edited until it differs)
    const shown = this.shown;
    return active instanceof HTMLInputElement && active.matches(".swd-peek-name") && !!shown && active.value !== shown.item.name;
  }

  /**
   * The item removed, the user asked by the core (Undo brings it back): what is being edited written first (a body typed
   * goes with the item and comes back with it); a body typed and not written stops it, said beside its field. Removed,
   * the panel goes as it follows the database; declined or refused, it stays as it is
   */
  private async removeItem(shown: Shown): Promise<void> {
    if (this.removing) return;
    this.removing = true;
    // (Where the item was opened from: the view drawn anew without it, the focus goes to its place's view picker)
    const place = shown.opener instanceof Element ? shown.opener.closest(".swd-place") : null;
    try {
      if (!(await this.leave())) return;
      // A value or the name being written as its editor was left: done first, so the item removed is the one they wrote
      await Promise.allSettled([...this.edits]);
      if (this.shown !== shown) return;
      // (The core's question: presses meanwhile are the user's answer, not beside the panel)
      this.asking = true;
      let done: Result;
      try {
        // As shown (its own writes taken on, `own`): removed only where what it loses is still so, as from a view
        done = await this.host.core.remove(shown.database, [shown.item]);
      } finally {
        this.asking = false;
      }
      // Declined: the panel as it is; refused (said by the core) or removed: the panel follows the database as it is now
      if (isRefused(done) && done.cause === "declined") return;
      this.host.refreshPlaces(shown.database);
      await this.follow();
      const doc = this.host.document;
      if (!this.shown && place?.isConnected && (!doc.activeElement || doc.activeElement === doc.body)) place.querySelector<HTMLElement>(".swd-view-picker")?.focus({ preventScroll: true });
    } finally {
      this.removing = false;
    }
  }

  /** What an editor of a value needs, made of the module's host: the schema as last read, the core's writes, the panel and the places following them */
  private editorHost(shown: Shown): EditorHost {
    const { core, types, ui } = this.host;

    return {
      document: this.host.document,
      get database() {
        return shown.schema;
      },
      type: (property) => typeOf(types, property),
      text: (item, key) => textOf(item, key, shown.schema, types),
      // (Its editors edit the item shown: written from the item the panel writes against then, `own`)
      update: (_item: Item, key: string, value: Value | undefined) => this.own(shown, (one) => withValue(one, key, value), (base) => core.update(shown.database, base, key, value)),
      rename: (_item: Item, name: string) => this.own(shown, (one) => ({ ...one, name: name.trim() }), (base) => core.rename(shown.database, base, name)),
      notify: (text) => ui.notify(text, { type: "error" }),
      documents: () => this.host.documents(),
      validateDocumentName: (name) => this.host.validateDocumentName(name),
      noun: this.host.noun,
      ...(this.host.folderSeparator ? { folderSeparator: this.host.folderSeparator } : {}),
      openByName: (name) => this.host.openByName(name),
    };
  }

  private draw(): void {
    const element = this.element;
    const shown = this.shown;
    if (!element || !shown) return;
    const doc = this.host.document;
    const { item } = shown;
    const editor = this.editorHost(shown);
    // What had the focus (the name, a value) has it again in the panel drawn anew
    const active = doc.activeElement;
    const rowOf = (one: Element) => `.swd-peek-row[data-property="${CSS.escape((one.closest(".swd-peek-row") as HTMLElement | null)?.dataset.property ?? "")}"]`;
    const focused =
      active && element.contains(active)
        ? active.matches(".swd-peek-name")
          ? ".swd-peek-name"
          : active.matches(".swd-peek-value")
            ? `.swd-peek-value[data-key="${CSS.escape((active as HTMLElement).dataset.key ?? "")}"]`
            : active.matches(".swd-peek-grip, .swd-peek-label")
              ? `${rowOf(active)} .${active.matches(".swd-peek-grip") ? "swd-peek-grip" : "swd-peek-label"}`
              : undefined
        : undefined;
    // Its icon and color over its name (a picker open of the item as drawn before closed)
    this.look?.close();
    this.look = lookControls(this.host, element, item, (look, refocus) => void this.writeLook(shown, look, refocus));
    const name = el(doc, "input", { class: "swd-peek-name", attrs: { id: "swd-peek-name", "aria-label": "Name", value: item.name } });
    name.addEventListener("change", () => void this.rename(shown, name));
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") name.blur();
    });
    // Its page in the editor, the panel closed first (the body is not edited in two places); a link where the page has an
    // address, so a middle click, Ctrl or Shift opens it in a tab of the browser's, the panel left as it is
    const openHere = async () => {
      if (await this.close()) await this.host.openDocument(shown.item);
    };
    const openLabel = `Open its ${this.host.noun.one}`;
    const href = this.host.documentHref?.(shown.item);
    const open = href
      ? openedHere(el(doc, "a", { class: "swd-peek-button swd-peek-open", html: VIEW_ICONS.open, title: openLabel, attrs: { href, "aria-label": openLabel } }), () => void openHere())
      : el(doc, "button", { class: "swd-peek-button swd-peek-open", html: VIEW_ICONS.open, title: openLabel, attrs: { "aria-label": openLabel }, run: () => void openHere() });
    // Closed by × beside the page, by ← where it is the whole page (a phone): the style page shows the one that fits
    const close = el(
      doc,
      "button",
      { class: "swd-peek-button swd-peek-close", attrs: { "aria-label": "Close (Esc)", title: "Close (Esc)" }, run: () => void this.close() },
      el(doc, "span", { class: "swd-peek-close-x", html: VIEW_ICONS.close }),
      el(doc, "span", { class: "swd-peek-close-back", html: VIEW_ICONS.back }),
    );
    const remove = el(doc, "button", {
      class: "swd-peek-button swd-peek-remove",
      html: VIEW_ICONS.remove,
      title: `Remove ${item.name}`,
      attrs: { "aria-label": `Remove ${item.name}` },
      run: () => void this.removeItem(shown),
    });
    // (A value or the name being edited stays so until the bin's press is taken: its write is then waited for, the bin not drawn anew under the pointer)
    keepFocus(remove);
    const head = el(doc, "div", "swd-peek-head", close, el(doc, "span", "swd-peek-gap"), remove, open);
    // The properties, every one whatever a view hides (an item's every value is shown and edited in its peek), dragged to
    // their order by their grips
    const list = el(doc, "div", "swd-peek-properties");
    // (Those the view it was opened from hides marked, in their places: the list and its order the same whatever a view hides)
    const view = shown.from?.current();
    shown.hiddenAt = hiddenKey(shown);
    const hidden = new Set(view?.hidden ?? []);
    list.append(...shown.schema.properties.map((property) => this.row(shown, property, editor, list, hidden.has(property.key) ? view!.label : undefined)));
    const properties = this.host.offered<PropertiesOffer>("properties");
    // The properties in a box of their own, scrolled past a height (the style page's), so the content under them stays in
    // view however many a database has
    const box = el(doc, "div", "swd-peek-props-box", list);
    // A property added, in Properties (the peek's own way to the schema: the properties module's where it is on)
    if (properties) {
      const add = el(doc, "button", { class: "swd-peek-add-property", text: "+ Add a property", run: () => void properties.open(shown.database, { add: true }).then(() => this.refocus(".swd-peek-add-property")) });
      keepFocus(add);
      box.append(add);
    }
    // Its controls and its name held at its top however it scrolls (a low window: the properties and the content not fitting)
    const top = el(doc, "div", "swd-peek-top", head, this.look.row, name);
    const parts: HTMLElement[] = [top, box];
    const made = this.host.itemBodies && !shown.field;
    if (this.host.itemBodies && !shown.field) {
      const body = el(doc, "textarea", { class: "swd-peek-body", attrs: { "aria-label": `Content of ${item.name}`, placeholder: "Reading…", readonly: "", "data-reading": "", rows: "8" } });
      shown.field = { body, note: el(doc, "div", "swd-peek-note") };
      body.addEventListener("blur", () => {
        this.bodyWrites++;
        this.writing = this.writing.then(async () => {
          try {
            await this.writeBody(shown, body);
          } catch (error) {
            // (Whatever failed: said, the chain of writes going on; a body typed and not written kept as one refused, never dropped)
            const why = error instanceof Error ? error.message : String(error);
            this.host.ui.notify(`Silverware Database: ${why}`, { type: "error" });
            if (shown.body && body.value !== (shown.body.was ?? "") && shown.kept?.text !== body.value && (await this.host.body(shown.database, shown.latest).catch(() => undefined)) !== body.value) {
              shown.kept = { text: body.value, why };
              if (this.shown === shown && !this.drawingPutOff()) this.draw();
              else shown.stale = true;
            }
          } finally {
            this.bodyWrites--;
            // (The content as written read again, once no write is going on: what was put off meanwhile, or changed since)
            if (!this.bodyWrites && this.shown === shown) {
              this.readAgain(shown);
              void this.readBody();
            }
          }
        });
      });
    }
    const field = shown.field;
    if (field) {
      field.body.setAttribute("aria-label", `Content of ${item.name}`);
      if (made && shown.kept) {
        // (Not read anew over what was typed: the text kept, its note again; a field kept from before has it, typed on since)
        field.body.value = shown.kept.text;
        field.body.readOnly = false;
        delete field.body.dataset.reading;
      }
      // (Drawn anew, the item changed: its content read again where nothing is typed in it, as a field made anew would be;
      // read here, as not every drawing is followed by a reading)
      else if (!made && this.readAgain(shown)) void this.readBody();
    }
    // (Drawn anew for the same item, a value edited: the box scrolled where it was; another item from its top)
    const scrolled = element.dataset.item === item.key ? (element.querySelector<HTMLElement>(".swd-peek-props-box")?.scrollTop ?? 0) : 0;
    element.dataset.item = item.key;
    // The body's field left where it is (drawn anew under the user's typing, it lost the focus and the caret): the rest put
    // in place of what it was; the item's first drawing whole
    const before = element.querySelector(".swd-peek-top");
    const was = element.querySelector(".swd-peek-props-box");
    if (!made && field && field.body.isConnected && before && was) {
      before.replaceWith(top);
      was.replaceWith(box);
    } else element.replaceChildren(...(this.handle ? [this.handle] : []), ...parts, ...(field ? [field.note, field.body] : []));
    box.scrollTop = scrolled;
    // (What the browser scrolls into view with the keys not put under the top held there)
    element.style.scrollPaddingTop = `${top.offsetHeight + 8}px`;
    this.note(shown);
    // The focus where it was; brought into view only where it is out of it (a row moved by Alt+arrows past the box's edge)
    const again = focused ? element.querySelector<HTMLElement>(focused) : null;
    again?.focus({ preventScroll: true });
    again?.scrollIntoView?.({ block: "nearest" });
  }

  /** A property's row: its label, its value as it shows, edited in place as the views edit it */
  private row(shown: Shown, property: Property, editor: EditorHost, list: HTMLElement, hiddenIn?: string): HTMLElement {
    const doc = this.host.document;
    const value = el(doc, "div", { class: "swd-peek-value", attrs: { "data-key": property.key, "aria-label": property.label } });
    const show = () => {
      const now = shown.item;
      if (editor.type(property).look === "check") return void value.replaceChildren(el(doc, "span", { class: `swd-peek-check${now.values[property.key] === true ? " swd-on" : ""}`, html: now.values[property.key] === true ? typeIcon("checkbox") : "", attrs: { "aria-label": now.values[property.key] === true ? "Yes" : "No" } }));
      const shownNodes = valueNodes(editor, now, property);
      const lacking = missing(editor, now, property);
      // A value drawn as a link takes its press, so a pencil after it edits it whatever room is left beside it: only a
      // pointer's way, the value itself being the button the keys edit (Enter, F2), its press reaching it
      const pencil = !property.readonly && shownNodes.some((node) => node instanceof Element && node.matches("a")) ? [el(doc, "span", { class: "swd-peek-edit", html: VIEW_ICONS.edit, title: `Edit ${property.label}`, attrs: { "aria-hidden": "true" } })] : [];
      value.replaceChildren(...(shownNodes.length ? shownNodes : [el(doc, "span", { class: `swd-peek-empty${lacking ? " swd-peek-missing" : ""}`, text: lacking ? "Required" : "Empty" })]), ...pencil);
    };
    show();
    if (!property.readonly) {
      value.tabIndex = 0;
      value.setAttribute("role", "button");
      const edit = () => {
        if (value.querySelector(".swd-editor")) return;
        if (editor.type(property).editor === "toggle") return void toggle(editor, shown.item, property.key);
        editValue(editor, value, shown.item, property.key, show);
      };
      value.addEventListener("click", edit);
      value.addEventListener("keydown", (event) => {
        if (event.target !== value || !["Enter", "F2", " "].includes(event.key)) return;
        event.preventDefault();
        edit();
      });
    } else value.classList.add("swd-peek-readonly");
    // Its name: opens it in Properties (its name, type, options, required, hidden, removed) where that module is on
    const properties = this.host.offered<PropertiesOffer>("properties");
    // (Hidden in the view it was opened from: an eye struck through after its name, its title saying which view)
    const hiddenMark = hiddenIn === undefined ? [] : [el(doc, "span", { class: "swd-peek-hidden-mark", html: VIEW_ICONS.hidden, title: `Hidden in ${hiddenIn}`, attrs: { "aria-hidden": "true" } })];
    const labelParts = [propertyIcon(doc, property, editor.type(property), "swd-peek-type"), el(doc, "span", { class: "swd-peek-label-name", text: property.label }), ...(property.required ? [el(doc, "span", { class: "swd-prop-required", text: "*", attrs: { "aria-hidden": "true" } })] : []), ...hiddenMark];
    const hiddenSaid = hiddenIn === undefined ? "" : `, hidden in ${hiddenIn}`;
    const label = properties
      ? el(
          doc,
          "button",
          {
            class: "swd-peek-label",
            title: `Edit ${property.label} (name, type, options…)`,
            attrs: { "aria-label": `Edit the property ${property.label}${hiddenSaid}` },
            run: () => void properties.open(shown.database, { property: property.key }).then(() => this.refocus(`.swd-peek-row[data-property="${CSS.escape(property.key)}"] .swd-peek-label`)),
          },
          ...labelParts,
        )
      : el(doc, "span", { class: "swd-peek-label", ...(hiddenIn === undefined ? {} : { attrs: { "aria-label": `${property.label}${hiddenSaid}` } }) }, ...labelParts);
    if (label instanceof HTMLButtonElement) keepFocus(label);
    const grip = el(doc, "button", { class: "swd-peek-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { "aria-label": `Move ${property.label} (Alt+Up, Alt+Down)` } });
    const row = el(doc, "div", { class: `swd-peek-row${hiddenIn === undefined ? "" : " swd-peek-hidden"}`, attrs: { "data-property": property.key } }, grip, label, value);
    // Its place among the properties (those a view hides too), written as the schema's order at once
    const keysOf = () => [...list.querySelectorAll<HTMLElement>(":scope > .swd-peek-row")].map((one) => one.dataset.property);
    // (`keys`: the list's order before the move: a drag moves the row in the list as it goes)
    const moveTo = (index: number, keys = keysOf()) => {
      const target = keys[Math.max(0, Math.min(keys.length - 1, index))];
      const to = shown.schema.properties.findIndex((one) => one.key === target);
      const from = shown.schema.properties.findIndex((one) => one.key === property.key);
      if (to < 0 || to === from) return void this.draw();
      void this.host.core
        .moveProperty(shown.database, property.key, to)
        .then(() => {
          this.host.refreshPlaces();
          return this.follow();
        })
        .catch((error: unknown) => this.host.ui.notify(`Silverware Database: ${error instanceof Error ? error.message : String(error)}`, { type: "error" }));
    };
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      // (No focus moved yet: a field being edited is written, and the panel drawn anew, only once the row is let go)
      event.preventDefault();
      const before = keysOf();
      this.dragging = true;
      reorder(event, {
        element: row,
        base: "swd-props",
        layer: this.element,
        flow: "block",
        containers: () => [list],
        items: (container) => [...container.querySelectorAll<HTMLElement>(":scope > .swd-peek-row")],
        done: (to) => {
          this.dragging = false;
          // (Moved: written, then followed. Not: the list as it was, and a change told meanwhile read and drawn now)
          if (to) {
            shown.stale = false;
            return moveTo(to.index, before);
          }
          this.draw();
          if (shown.stale && this.shown === shown && !this.drawingPutOff()) {
            shown.stale = false;
            void this.follow();
          }
        },
      });
    });
    grip.addEventListener("keydown", (event) => {
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      const keys = keysOf();
      moveTo(keys.indexOf(property.key) + (event.key === "ArrowUp" ? -1 : 1), keys);
    });
    return row;
  }

  private async rename(shown: Shown, field: HTMLInputElement): Promise<void> {
    const name = field.value.trim();
    // (Empty: the name as shown again. Any other written, the core telling the same name as it is now: one typed back while
    // a rename is written is never dropped)
    if (!name) {
      field.value = shown.item.name;
      return;
    }
    // (Against the item as drawn: the core writes the name on the item as it is now where its name is still as drawn)
    const result = await this.own(shown, (one) => ({ ...one, name }), (base) => this.host.core.rename(shown.database, base, name));
    // Refused (said to the user): the name as it is
    if (isRefused(result) && this.shown === shown && field.isConnected) field.value = shown.latest.name;
  }

  /**
   * One of the panel's own writes of its item, after the one before it, `write` given the item the panel writes against
   * (the core writes it on the item as it is now where the part written is still as given: core.ts `onItems`); the places
   * and the panel follow it, and it is kept while it goes on (the item's removal waits for it). Written while the panel's
   * drawing is put off (another field being edited), the panel shows what it wrote (`shows`: the item with it): where the
   * item as it is now is just that, it is what the panel writes against next, so a second change of the same field and a
   * name typed back go on what the panel shows; anything else of it changed meanwhile, the item as drawn stays, checked
   */
  private own(shown: Shown, shows: (item: Item) => Item, write: (base: Item) => Promise<Result>): Promise<Result> {
    const result = this.queue.then(async () => {
      const base = shown.item;
      const done = await write(base);
      this.host.refreshPlaces(shown.database);
      await this.follow();
      const all = { allValues: true, name: true, look: true };
      if (!isRefused(done) && this.shown === shown && shown.item === base && shown.item !== shown.latest && samePart(shown.latest, shows(base), all, shown.schema)) shown.item = shown.latest;
      return done;
    });
    this.queue = result.catch(() => undefined);
    const going = result.finally(() => this.edits.delete(going));
    this.edits.add(going);
    return result;
  }

  /** The item's look written (its icon, its color), against the item as drawn; the panel drawn anew, the button focused again */
  private async writeLook(shown: Shown, look: ItemLook, refocus: string): Promise<void> {
    try {
      // (Against the item as drawn: the core writes the look on the item as it is now where its look is still as drawn)
      await this.own(shown, (one) => ({ ...one, look }), (base) => this.host.core.setLook(shown.database, base, look));
      if (this.shown === shown) this.refocus(refocus);
    } catch (error) {
      this.host.ui.notify(`Silverware Database: ${error instanceof Error ? error.message : String(error)}`, { type: "error" });
    }
  }

  /** The focus back on something of the panel (what opened the dialog), drawn anew meanwhile; the panel where it is gone */
  private refocus(selector: string): void {
    if (!this.element) return;
    (this.element.querySelector<HTMLElement>(selector) ?? this.element).focus({ preventScroll: true });
  }

  /**
   * The content's field put back to be read (`readBody`) where nothing is typed
   * in it: not focused, no text kept, its text the content as last read. A
   * field made anew starts so; one kept across drawings is put back so as the
   * item changes or its write is done
   */
  private readAgain(shown: Shown): boolean {
    const body = shown.field?.body;
    if (!body || shown.kept || body.dataset.reading !== undefined || this.host.document.activeElement === body || body.value !== (shown.body?.was ?? "")) return false;
    toRead(body);
    return true;
  }

  /** The body read as it is now, into its field (unless something was typed there: a kept text, or the field taken meanwhile) */
  private async readBody(): Promise<void> {
    const shown = this.shown;
    if (!shown || !this.host.itemBodies || shown.kept) return;
    const was = await this.host.body(shown.database, shown.item);
    const field = this.element?.querySelector<HTMLTextAreaElement>(".swd-peek-body");
    // (Not over a body kept, nor while one is written: what was read may be older than what is written, or than what was typed)
    if (this.shown !== shown || !field || field.dataset.reading === undefined || shown.kept || this.bodyWrites > 0) return;
    shown.body = { was };
    field.value = was ?? "";
    field.readOnly = false;
    delete field.dataset.reading;
    field.placeholder = "Add content…";
  }

  /** The body written as its field is left, where it differs from what was read and is still so in the store; else kept in the field, said so */
  private async writeBody(shown: Shown, field: HTMLTextAreaElement): Promise<void> {
    if (!shown.body || field.dataset.reading !== undefined || field.value === (shown.body.was ?? "")) return;
    const typed = field.value;
    const was = shown.body.was;
    const write = async (item: Item): Promise<Result> => {
      try {
        return await this.host.core.setBody(shown.database, item, typed, was);
      } catch (error) {
        // (A write that failed: kept as one refused, never dropped, the panel and later writes going on)
        return { problem: error instanceof Error ? error.message : String(error), cause: "invalid" };
      }
    };
    // (The core writes it on the item as it is now: a value changed elsewhere since is no reason to leave the body, its own
    // check, `was`, still leaving a body changed elsewhere)
    const result = await write(shown.item);
    if (isRefused(result)) {
      if (result.cause === "unchanged") return;
      // Not written (changed since it was read, or refused): what was typed stays in its field, never replaced unasked
      // (the panel drawn anew meanwhile: its field given the text)
      shown.kept = { text: typed, why: result.problem };
      if (field.isConnected) this.note(shown);
      else if (this.shown === shown) this.draw();
      return;
    }
    shown.body = { was: typed };
    shown.kept = undefined;
    this.note(shown);
    this.host.refreshPlaces(shown.database);
    await this.follow();
  }

  /** A note over the body: why what was typed was not written, and a way to load the body as it is now (asked first: the text typed goes) */
  private note(shown: Shown): void {
    const note = this.element?.querySelector<HTMLElement>(".swd-peek-note");
    if (!note || this.shown !== shown) return;
    const kept = shown.kept;
    if (!kept) return void note.replaceChildren();
    const doc = this.host.document;
    const reload = el(doc, "button", {
      class: "swd-tool swd-peek-reload",
      text: "Load the content as it is now",
      run: async () => {
        this.asking = true;
        let agreed: boolean;
        try {
          agreed = !!(await this.host.ui.ask?.("Replace the text typed with the content as it is now? The text typed is lost.", { destructive: true }));
        } finally {
          this.asking = false;
        }
        if (!agreed || this.shown !== shown) return;
        // (A write of the text going on, the field left before: done first, so nothing of the text given up comes after)
        await this.writing;
        if (this.shown !== shown) return;
        shown.kept = undefined;
        if (shown.field) {
          shown.field.body.value = "";
          toRead(shown.field.body);
        }
        this.draw();
        await this.readBody();
      },
    });
    // (Pressed, the field keeps the focus: leaving it would write the text the user is asked to give up)
    keepFocus(reload);
    note.replaceChildren(el(doc, "p", { attrs: { role: "alert" }, text: `Not written: ${kept.why}. Your text is still here: copy it, or load the content as it is now.` }), reload);
  }
}

/** What the view an item was opened from hides, as it was drawn with (none: no view, or none now) */
function hiddenKey(shown: Shown): string {
  const view = shown.from?.current();
  return view ? JSON.stringify([view.label, view.hidden]) : "";
}
