// A modal dialog over the page, for any of the plugins (bundled into each:
// nothing is shared at run time). Its look is given by a class base (`base`:
// the table's `swt-dialog` and `swt-settings`, the toolbar's `swb-dialog`):
// `${base}-backdrop` (with the caller's classes beside it), the box `${base}`,
// `${base}-head` with `${base}-titles` (`${base}-title`, `${base}-subtitle`)
// and `${base}-close`, an optional bar under the head (a row of tabs),
// `${base}-body` and an optional `${base}-foot`. Its keys and presses are its
// own (no key reaches the page), Tab stays in it, Esc, × or a press on the
// backdrop close it once `dismiss` agrees (the settings ask where changes
// would be lost), and the focus goes back where it was.

export type DialogLook = {
  // The classes' base
  readonly base: string;
  // Classes beside the backdrop's own (the table's UI_CLASS)
  readonly backdropClass?: string;
  // The × button's icon (an SVG's markup)
  readonly closeIcon: string;
};

export type DialogOptions = {
  readonly title: string;
  // A line under the title (what the dialog is for)
  readonly subtitle?: string;
  // A class of the dialog's box, for its own look
  readonly className?: string;
  // Between the head and the body (a row of tabs)
  readonly bar?: Node;
  readonly content: Node;
  // Buttons under the content
  readonly footer?: Node;
  // The element to focus first (else the dialog itself)
  readonly focus?: HTMLElement;
  // Esc, × or a press beside it: whether it closes (else it stays)
  readonly dismiss?: () => boolean | Promise<boolean>;
  // Closed, whichever way
  readonly closed?: () => void;
};

export type Dialog = {
  readonly element: HTMLElement;
  // Closed as Esc closes it: once `dismiss` agrees
  dismiss(): Promise<void>;
  // Closed at once
  close(): void;
};

type Shown = { readonly backdrop: HTMLElement; readonly returnFocus: Element | null; readonly options: DialogOptions; readonly unfollow: () => void };

/**
 * The part of the window the visual viewport shows (what an on-screen keyboard
 * leaves) on the backdrop, as `--sw-view-top` and `--sw-view-height`, kept as
 * it changes: a plugin's CSS fits its dialog in it (a phone's keyboard hid its
 * bottom, the list of a search under its field too). Focused, a field (with
 * what holds it marked `data-sw-reveal`) is scrolled into what is left once
 * the keyboard has come
 */
function followView(backdrop: HTMLElement): () => void {
  const win = backdrop.ownerDocument.defaultView;
  const view = win?.visualViewport;
  if (!win || !view) return () => undefined;
  const place = () => {
    backdrop.style.setProperty("--sw-view-top", `${view.offsetTop}px`);
    backdrop.style.setProperty("--sw-view-height", `${view.height}px`);
    const active = backdrop.ownerDocument.activeElement;
    if (active instanceof HTMLElement && backdrop.contains(active) && active.matches("input, textarea")) {
      // With what belongs to it (a search's list), where the caller marks that
      const shown = active.closest<HTMLElement>("[data-sw-reveal]") ?? active;
      win.requestAnimationFrame(() => shown.scrollIntoView?.({ block: "nearest" }));
    }
  };
  place();
  view.addEventListener("resize", place);
  view.addEventListener("scroll", place);
  return () => {
    view.removeEventListener("resize", place);
    view.removeEventListener("scroll", place);
  };
}

export class Dialogs {
  private shown: Shown | undefined;

  constructor(
    private readonly doc: Document,
    private readonly look: DialogLook,
  ) {}

  get isOpen(): boolean {
    return !!this.shown?.backdrop.isConnected;
  }

  /** Whether a node is the open dialog's */
  contains(node: Node): boolean {
    return !!this.shown?.backdrop.contains(node);
  }

  open(options: DialogOptions): Dialog {
    this.close();
    const { doc } = this;
    const { base } = this.look;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
      const e = doc.createElement(tag);
      e.className = className;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const backdrop = el("div", `${this.look.backdropClass ? `${this.look.backdropClass} ` : ""}${base}-backdrop`);
    const dialog = el("div", `${base}${options.className ? ` ${options.className}` : ""}`);
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", options.title);
    dialog.tabIndex = -1;
    const head = el("div", `${base}-head`);
    const titles = el("div", `${base}-titles`);
    titles.append(el("h2", `${base}-title`, options.title));
    if (options.subtitle) titles.append(el("p", `${base}-subtitle`, options.subtitle));
    const close = el("button", `${base}-close`);
    close.type = "button";
    close.title = "Close (Esc)";
    close.setAttribute("aria-label", close.title);
    close.innerHTML = this.look.closeIcon;
    close.addEventListener("click", () => void this.dismiss());
    head.append(titles, close);
    dialog.append(head);
    if (options.bar) dialog.append(options.bar);
    const body = el("div", `${base}-body`);
    body.append(options.content);
    dialog.append(body);
    if (options.footer) {
      const foot = el("div", `${base}-foot`);
      foot.append(options.footer);
      dialog.append(foot);
    }
    backdrop.append(dialog);
    backdrop.addEventListener("keydown", (e) => this.onKeyDown(e, dialog));
    // A press beside the dialog closes it; one in it stays in it
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) {
        e.preventDefault();
        void this.dismiss();
      }
    });
    const shown: Shown = { backdrop, returnFocus: doc.activeElement, options, unfollow: followView(backdrop) };
    this.shown = shown;
    doc.body.append(backdrop);
    (options.focus ?? dialog).focus({ preventScroll: true });
    return {
      element: dialog,
      dismiss: () => (this.shown === shown ? this.dismiss() : Promise.resolve()),
      close: () => {
        if (this.shown === shown) this.close();
      },
    };
  }

  /** Closes the open dialog once its `dismiss` agrees */
  async dismiss(): Promise<void> {
    const shown = this.shown;
    if (!shown) return;
    if (shown.options.dismiss && !(await shown.options.dismiss())) return;
    if (this.shown === shown) this.close();
  }

  close(): void {
    const shown = this.shown;
    if (!shown) return;
    this.shown = undefined;
    shown.unfollow();
    shown.backdrop.remove();
    if (shown.returnFocus instanceof HTMLElement && shown.returnFocus.isConnected) shown.returnFocus.focus({ preventScroll: true });
    shown.options.closed?.();
  }

  // Esc closes; Tab stays in the dialog; no key goes on to the page
  private onKeyDown(e: KeyboardEvent, dialog: HTMLElement): void {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      void this.dismiss();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex='0']")).filter(
      (f) => !(f as HTMLButtonElement).disabled && f.offsetParent !== null,
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = this.doc.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
