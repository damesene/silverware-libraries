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
import { el } from "../../../../shared/elements.ts";
import type { Result } from "../../core/core.ts";
import type { ModuleHost } from "../../core/module.ts";
import { textOf, typeOf } from "../../domain/listing.ts";
import type { Database, Item, Property, Value } from "../../model/database.ts";
import { type EditorHost, editValue, toggle } from "../../views/editors.ts";

const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
// The panel's width at most, and its share of the editor's area at most
const WIDTH = 460;
const SHARE = 0.5;
// What a press there is not beside the panel: a dialog over the page (a question asked), a notification
const NOT_BESIDE = 'dialog, [role="dialog"], [role="alertdialog"], .sb-modal-box, .sb-notifications, .sb-notification';

const isRefused = (result: Result): result is Extract<Result, { problem: string }> => "problem" in result;

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
};

export class PeekPanel {
  private shown: Shown | undefined;
  private element: HTMLElement | undefined;
  private readonly stops: (() => void)[] = [];
  // The body's write going on (the field left): waited for before the panel closes or shows another item
  private writing: Promise<void> = Promise.resolve();
  // A question asked of the user: presses meanwhile are theirs, not beside the panel
  private asking = false;
  // Writes of the body going on: a body read meanwhile is not put in its field (it would replace what is being written)
  private bodyWrites = 0;
  // When the user was last told a body kept stops the panel going (a press beside, then the press's own open: told once)
  private toldKept = 0;

  constructor(private readonly host: ModuleHost) {}

  get item(): Item | undefined {
    return this.shown?.item;
  }

  /** An item shown; another shown before is left first (its field written), unless its body typed could not be written: then it stays */
  async show(item: Item, database: string): Promise<void> {
    const opener = this.shown?.opener ?? this.host.document.activeElement;
    if (!(await this.leave())) return;
    const read = await this.host.database(database);
    if (!read) return;
    this.shown = { database, schema: read.value, item, latest: item, body: undefined, stale: false, opener };
    if (!this.element) this.open();
    this.draw();
    void this.readBody();
    this.element?.querySelector<HTMLElement>(".swd-peek-name")?.focus({ preventScroll: true });
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
    const kept = shown?.kept ?? (typed === undefined ? undefined : { text: typed, why: "the module stopped before it was written" });
    if (shown && kept) this.host.ui.notify(`Silverware Database: the content typed for "${shown.item.name}" was not written (${kept.why}). It was:\n${kept.text}`, { type: "error" });
    this.remove();
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
    if (now.revision === shown.item.revision && JSON.stringify(read.value) === JSON.stringify(shown.schema)) return;
    // Something edited: drawn once it is not, the item kept as drawn meanwhile (a value written from it is checked against it)
    if (this.editing()) {
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
        if (shown?.stale && !this.editing()) {
          shown.stale = false;
          // (After the body's write, if one was just queued: what it wrote is read with the rest)
          void this.writing.then(() => this.follow()).then(() => {
            if (this.shown === shown && !this.editing()) {
              this.draw();
              void this.readBody();
            }
          });
        }
      }),
    );
    // A press beside it closes it (what is typed written first); not one in a question asked meanwhile, nor in a dialog or a notification
    const beside = (event: PointerEvent) => {
      const target = event.target;
      if (!this.element || this.asking || !(target instanceof Element) || this.element.contains(target) || target.closest(NOT_BESIDE)) return;
      void this.close();
    };
    doc.addEventListener("pointerdown", beside, true);
    this.stops.push(() => doc.removeEventListener("pointerdown", beside, true));
    const view = doc.defaultView;
    const place = () => this.place();
    view?.addEventListener("resize", place);
    this.stops.push(() => view?.removeEventListener("resize", place));
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
    element.style.top = `${Math.max(0, area.top)}px`;
    element.style.right = `${Math.max(0, view.innerWidth - area.right)}px`;
    element.style.height = `${Math.max(0, Math.min(area.bottom, view.innerHeight) - Math.max(0, area.top))}px`;
    element.style.width = `${Math.round(Math.min(WIDTH, area.width * SHARE, view.innerWidth))}px`;
  }

  /** Whether something of the panel is being edited (a value's editor open, the body, the name changed): nothing drawn anew under it */
  private editing(): boolean {
    const active = this.host.document.activeElement;
    if (!this.element || !active || !this.element.contains(active)) return false;
    if (active.closest(".swd-editor") || active.matches(".swd-peek-body")) return true;
    // (The name focused as the panel opens is not edited until it differs)
    return active instanceof HTMLInputElement && active.matches(".swd-peek-name") && active.value !== this.shown?.item.name;
  }

  /** What an editor of a value needs, made of the module's host: the schema as last read, the core's writes, the panel and the places following them */
  private editorHost(shown: Shown): EditorHost {
    const { core, types, ui } = this.host;
    const written = async (result: Promise<Result>) => {
      const done = await result;
      this.host.refreshPlaces(shown.database);
      await this.follow();
      return done;
    };
    return {
      document: this.host.document,
      get database() {
        return shown.schema;
      },
      type: (property) => typeOf(types, property),
      text: (item, key) => textOf(item, key, shown.schema, types),
      update: (item: Item, key: string, value: Value | undefined) => written(core.update(shown.database, item, key, value)),
      rename: (item: Item, name: string) => written(core.rename(shown.database, item, name)),
      notify: (text) => ui.notify(text, { type: "error" }),
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
    const focused = active && element.contains(active) ? (active.matches(".swd-peek-name") ? ".swd-peek-name" : active.matches(".swd-peek-value") ? `.swd-peek-value[data-key="${CSS.escape((active as HTMLElement).dataset.key ?? "")}"]` : undefined) : undefined;
    const name = el(doc, "input", { class: "swd-peek-name", attrs: { id: "swd-peek-name", "aria-label": "Name", value: item.name } });
    name.addEventListener("change", () => void this.rename(shown, name, editor));
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") name.blur();
    });
    const open = el(doc, "button", {
      class: "swd-tool swd-peek-open",
      text: "Open",
      title: "Open its page",
      run: async () => {
        // (Its page in the editor, the panel closed first: the body is not edited in two places)
        if (await this.close()) await this.host.openDocument(shown.item);
      },
    });
    const close = el(doc, "button", { class: "swd-peek-close", html: CLOSE, attrs: { "aria-label": "Close (Esc)", title: "Close (Esc)" }, run: () => void this.close() });
    const head = el(doc, "div", "swd-peek-head", name, open, close);
    const rows = shown.schema.properties.map((property) => this.row(shown, property, editor));
    const parts: HTMLElement[] = [head, el(doc, "div", "swd-peek-properties", ...rows)];
    if (this.host.itemBodies) {
      const body = el(doc, "textarea", { class: "swd-peek-body", attrs: { "aria-label": `Content of ${item.name}`, placeholder: "Reading…", readonly: "", "data-reading": "" } });
      body.addEventListener("blur", () => {
        this.bodyWrites++;
        this.writing = this.writing.then(async () => {
          try {
            await this.writeBody(shown, body);
          } catch (error) {
            // (Whatever failed: said, the chain of writes going on; a body typed and not written kept as one refused, never dropped)
            const why = error instanceof Error ? error.message : String(error);
            this.host.ui.notify(`Silverware Database: ${why}`, { type: "error" });
            if (shown.body && body.value !== (shown.body.was ?? "") && !shown.kept && (await this.host.body(shown.database, shown.latest).catch(() => undefined)) !== body.value) {
              shown.kept = { text: body.value, why };
              if (this.shown === shown) this.draw();
            }
          } finally {
            this.bodyWrites--;
            // (A field drawn anew while bodies were written, its reading put off: read now, once none is written)
            if (!this.bodyWrites) void this.readBody();
          }
        });
      });
      parts.push(el(doc, "div", "swd-peek-note"), body);
      if (shown.kept) {
        // (Not read anew over what was typed: the text kept, its note again)
        body.value = shown.kept.text;
        body.readOnly = false;
        delete body.dataset.reading;
      }
    }
    element.replaceChildren(...parts);
    this.note(shown);
    if (focused) element.querySelector<HTMLElement>(focused)?.focus({ preventScroll: true });
  }

  /** A property's row: its label, its value as it shows, edited in place as the views edit it */
  private row(shown: Shown, property: Property, editor: EditorHost): HTMLElement {
    const doc = this.host.document;
    const value = el(doc, "div", { class: "swd-peek-value", attrs: { "data-key": property.key, "aria-label": property.label } });
    const show = () => {
      const now = shown.item;
      const text = editor.type(property).name === "checkbox" ? (now.values[property.key] === true ? "✓" : "☐") : editor.text(now, property.key);
      value.replaceChildren(text || el(doc, "span", { class: "swd-peek-empty", text: "Empty" }));
    };
    show();
    if (!property.readonly) {
      value.tabIndex = 0;
      value.setAttribute("role", "button");
      const edit = () => {
        if (value.querySelector(".swd-editor")) return;
        if (editor.type(property).name === "checkbox") return void toggle(editor, shown.item, property.key);
        editValue(editor, value, shown.item, property.key, show);
      };
      value.addEventListener("click", edit);
      value.addEventListener("keydown", (event) => {
        if (event.target !== value || !["Enter", "F2", " "].includes(event.key)) return;
        event.preventDefault();
        edit();
      });
    } else value.classList.add("swd-peek-readonly");
    return el(doc, "div", "swd-peek-row", el(doc, "span", { class: "swd-peek-label", text: property.label }), value);
  }

  private async rename(shown: Shown, field: HTMLInputElement, editor: EditorHost): Promise<void> {
    const name = field.value.trim();
    if (!name || name === shown.item.name) {
      field.value = shown.item.name;
      return;
    }
    // Against the item as read now (a value changed elsewhere meanwhile is no reason to refuse it); refused where its name changed elsewhere since it was shown
    if (shown.latest.name !== shown.item.name) {
      this.host.ui.notify(`"${shown.item.name}" was renamed "${shown.latest.name}" elsewhere meanwhile: not renamed`, { type: "error" });
      field.value = shown.latest.name;
      return;
    }
    const result = await editor.rename(shown.latest, name);
    // Refused (said to the user): the name as it is
    if (isRefused(result) && this.shown === shown && field.isConnected) field.value = shown.latest.name;
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
    field.placeholder = "No content";
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
    // Against the item as read right now: a value changed elsewhere since the panel read it is no reason to leave the
    // body (its own check, `was`, still leaves a body changed elsewhere)
    try {
      const now = (await this.host.items(shown.database)).find((one) => one.key === shown.latest.key);
      if (now) shown.latest = now;
    } catch {
      // (Not read: the item as last read, the store's checks deciding)
    }
    const result = await write(shown.latest);
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
        shown.kept = undefined;
        this.draw();
        await this.readBody();
      },
    });
    note.replaceChildren(el(doc, "p", { attrs: { role: "alert" }, text: `Not written: ${kept.why}. Your text is still here: copy it, or load the content as it is now.` }), reload);
  }
}
