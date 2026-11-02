// A small popup menu for any of the plugins, its classes by a base the caller
// gives (`swt`: swt-menu-item, swt-icon…): icon items, separators, a row of
// icon buttons after a label (a choice or a pair of actions), a bar of actions
// with a caption under each icon, tiles (a gallery), an element of the
// caller's, a title naming what it is about (a pencil turning it into a field),
// a way back to the menu a submenu replaced; operable with the mouse or the
// keyboard (arrows, Home/End, Enter). What it holds is data (MenuEntry); the
// caller puts it in the page, places and closes it. Bundled into each plugin
// apart: nothing is shared at run time.
import { el, pressed, type ElementChild, type ElementProps } from "./elements.ts";

/** How a plugin's menus look: its classes' base, its icons */
export type MenuLook = {
  readonly base: string;
  // The pencil naming what the menu is about (a menu that names nothing needs none)
  readonly renameIcon?: string;
  // The × closing it (else a plain one)
  readonly closeIcon?: string;
};

/** What an item is about, shown in a bubble beside the menu while it is hovered or focused */
export type MenuDetail = {
  readonly title: string;
  // Ways to write it, shown as code
  readonly code?: readonly string[];
  // What it does (none: the title and content alone, a theme's preview)
  readonly text?: string;
  // Lines after the text, less prominent
  readonly notes?: readonly string[];
  // An element after them, made (or set) as the bubble shows: a theme's preview
  readonly content?: () => HTMLElement;
};

export type MenuEntry =
  | {
      readonly kind: "item";
      readonly label: string;
      // A line icon (an SVG); none: its place left empty
      readonly icon?: string;
      readonly run: () => void;
      readonly danger?: boolean;
      // It opens a submenu in the menu's place (a mark after its label)
      readonly submenu?: boolean;
      readonly checked?: boolean;
      // Why the item cannot be used now; shown as its tooltip
      readonly disabled?: string;
      // What the item does, as its tooltip
      readonly hint?: string;
      // What the item does, at more length: a bubble instead of the tooltip
      readonly detail?: MenuDetail;
      // What the item is set to, after its label and a colon (Type: ☆ Stars)
      readonly value?: { readonly text: string; readonly icon?: string };
      // While it is hovered or focused (true), and no longer (false): what it would do shown elsewhere (where a table goes)
      readonly highlight?: (on: boolean) => void;
    }
  | { readonly kind: "separator" }
  | {
      readonly kind: "segmented";
      readonly label: string;
      // What the row is about (a class of its own: <base>-menu-row-<key>)
      readonly key?: string;
      // Something missing (a table shown as a sheet on none): its label in the danger color
      readonly attention?: boolean;
      // Its label's tooltip
      readonly hint?: string;
      readonly options: readonly {
        readonly icon: string;
        readonly title: string;
        // A choice: whether it is the one set (Align); none: an action (Move up)
        readonly active?: boolean;
        readonly run: () => void;
        // Why it cannot be used now; shown as its tooltip
        readonly disabled?: string;
      }[];
    }
  | {
      // Actions side by side, a caption under each icon (Copy, Cut, Paste)
      readonly kind: "actions";
      readonly options: readonly {
        readonly icon: string;
        readonly caption: string;
        // Its full name (Copy 3 rows), the tooltip and what assistive technology reads
        readonly title: string;
        readonly run: () => void;
        readonly disabled?: string;
      }[];
    }
  | {
      // Choices laid out as tiles, an icon over each label (a gallery: a chart's types)
      readonly kind: "tiles";
      readonly options: readonly {
        readonly icon: string;
        readonly label: string;
        readonly checked?: boolean;
        readonly run: () => void;
        readonly disabled?: string;
      }[];
    }
  // An element of the caller's own, as it is (a line saying the items are being read)
  | { readonly kind: "element"; readonly element: HTMLElement };

/** The entries with every run wrapped (a menu closing before its entry runs): items', and the buttons' of rows and bars */
export function wrapRuns(entries: readonly MenuEntry[], wrap: (run: () => void) => () => void): MenuEntry[] {
  return entries.map((entry): MenuEntry =>
    entry.kind === "item"
      ? { ...entry, run: wrap(entry.run) }
      : entry.kind === "segmented" || entry.kind === "actions" || entry.kind === "tiles"
        ? ({ ...entry, options: entry.options.map((option) => ({ ...option, run: wrap(option.run) })) } as MenuEntry)
        : entry,
  );
}

/** A submenu's way back to the menu it replaced: an arrow before its title (and the Left key) */
export type MenuBack = { readonly icon: string; readonly run: () => void };

/**
 * What the menu is about can be named in its title: a pencil after it turns
 * the title into a field (Enter saves, Esc leaves it as it was); `save` gives
 * why a name is refused (shown under the field), or nothing once it is saved
 */
export type MenuNaming = {
  readonly name?: string;
  // What the pencil does (Name this row), its tooltip
  readonly label: string;
  // Why it cannot be named now
  readonly disabled?: string;
  // A button under the field saving no name, where it has one (Remove from sheet): what an empty field does
  readonly clear?: { readonly label: string; readonly title: string };
  readonly save: (name: string) => Promise<string | undefined>;
};

/** A menu's naming whose save also closes the menu, once the name is saved */
export function namingThatCloses(naming: MenuNaming | undefined, close: () => void): MenuNaming | undefined {
  if (!naming) return undefined;
  return {
    ...naming,
    save: async (name) => {
      const why = await naming.save(name);
      if (why === undefined) close();
      return why;
    },
  };
}

/** A press in a menu keeps the focus where it is (on its button, in the page), but in its field (a name typed) */
export function keepFocus(menu: HTMLElement): void {
  menu.addEventListener("mousedown", (e) => {
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
  });
}

/** What closes the menu when its × is pressed (as Esc does: the one who shows it knows how) */
export function onMenuClose(menu: HTMLElement, look: MenuLook, close: () => void): void {
  menu.addEventListener(`${look.base}-menu-close`, close);
}

/** The menu's title as a field, its name to type (the pencil pressed) */
export function startNaming(menu: HTMLElement, look: MenuLook): void {
  menu.querySelector<HTMLButtonElement>(`.${look.base}-menu-rename:not([aria-disabled])`)?.click();
}

/**
 * A menu of entries, its classes by `look.base` (`swt`: swt-menu-item…), to
 * put where the caller shows it; its × sends the caller `<base>-menu-close`
 * (onMenuClose)
 */
export function renderMenu(doc: Document, look: MenuLook, title: string, entries: readonly MenuEntry[], back?: MenuBack, naming?: MenuNaming): HTMLElement {
  const p = look.base;
  // A list to pick from (a submenu: Type, a table's Theme): focusMenu starts at its choice
  const menu = el(doc, "div", { attrs: { role: "menu", "aria-label": title, [`data-${p}-list`]: back ? "" : undefined } });
  const heading = el(
    doc,
    "div",
    `${p}-menu-title`,
    back && el(doc, "button", { class: `${p}-menu-back`, title: "Back", attrs: { "aria-label": "Back" }, html: back.icon, run: back.run }),
    el(doc, "span", { class: `${p}-menu-title-text`, text: title, title }),
  );
  menu.append(heading);
  if (naming) addNaming(doc, look, menu, heading, naming);
  // A × closing it, as Esc or a press beside it do (on a touch screen a tap beside it may land on something)
  heading.append(
    el(doc, "button", { class: `${p}-menu-close`, title: "Close", attrs: { "aria-label": "Close" }, html: look.closeIcon ?? CLOSE, run: () => menu.dispatchEvent(new Event(`${p}-menu-close`)) }),
  );

  // One bubble for the menu's details, beside it: right, or left where the right has no room
  let bubble: HTMLElement | undefined;
  const showDetail = (item: HTMLElement, detail: MenuDetail) => {
    if (!bubble) {
      bubble = el(doc, "div", { class: `${p}-menu-detail`, attrs: { role: "tooltip" } });
      menu.append(bubble);
    }
    const parts = [
      el(doc, "div", { class: `${p}-menu-detail-title`, text: detail.title }),
      detail.code?.length && el(doc, "div", `${p}-menu-detail-code`, ...detail.code.map((form) => el(doc, "code", { text: form }))),
      detail.text && el(doc, "p", { text: detail.text }),
      ...(detail.notes ?? []).map((note) => el(doc, "p", { class: `${p}-menu-detail-note`, text: note })),
      detail.content?.(),
    ];
    bubble.replaceChildren(...parts.filter((part): part is HTMLElement => part instanceof Node));
    bubble.hidden = false;
    bubble.classList.remove(`${p}-left`);
    bubble.style.top = `${item.offsetTop}px`;
    const view = doc.defaultView;
    if (view && bubble.getBoundingClientRect().right > view.innerWidth - 8) bubble.classList.add(`${p}-left`);
    // Inside the window: a tall bubble (a theme's preview) beside an item low in the menu goes up
    const below = view ? bubble.getBoundingClientRect().bottom - (view.innerHeight - 8) : 0;
    if (below > 0) bubble.style.top = `${item.offsetTop - below}px`;
  };
  const hideDetail = () => {
    if (bubble) bubble.hidden = true;
  };

  // An entry's button; a disabled one says why in its title and does nothing
  const button = (className: string, run: () => void, disabled?: string, props: Omit<ElementProps, "class" | "run"> = {}, ...children: ElementChild[]) =>
    el(
      doc,
      "button",
      {
        ...props,
        class: className,
        ...(disabled ? { title: props.title ?? disabled } : {}),
        attrs: { ...props.attrs, "aria-disabled": disabled ? "true" : undefined },
        run: () => {
          if (!disabled) run();
        },
      },
      ...children,
    );
  const icon = (svg: string | undefined) => el(doc, "span", { class: `${p}-icon`, html: svg ?? "" });

  for (const entry of entries) {
    if (entry.kind === "separator") {
      menu.append(el(doc, "div", { class: `${p}-menu-separator`, attrs: { role: "separator" } }));
    } else if (entry.kind === "item") {
      const detail = entry.detail;
      const shows = detail && !entry.disabled;
      const value = entry.value;
      const item = button(
        `${p}-menu-item${entry.danger ? ` ${p}-danger` : ""}${entry.submenu ? ` ${p}-menu-sub` : ""}`,
        entry.run,
        entry.disabled,
        {
          ...(!shows && entry.hint && !entry.disabled ? { title: entry.hint } : {}),
          attrs: { role: entry.checked === undefined ? "menuitem" : "menuitemcheckbox", "aria-checked": pressed(entry.checked), "aria-haspopup": entry.submenu ? "menu" : undefined },
        },
        icon(entry.icon),
        el(
          doc,
          "span",
          `${p}-label`,
          entry.label,
          value && ": ",
          value?.icon && el(doc, "span", { class: `${p}-menu-value-icon`, html: value.icon }),
          value?.text,
        ),
      );
      const highlight = entry.highlight;
      if (highlight) {
        item.addEventListener("mouseenter", () => highlight(true));
        item.addEventListener("focus", () => highlight(true));
        item.addEventListener("mouseleave", () => highlight(false));
        item.addEventListener("blur", () => highlight(false));
      }
      if (shows) {
        item.addEventListener("mouseenter", () => showDetail(item, detail));
        item.addEventListener("focus", () => showDetail(item, detail));
        item.addEventListener("mouseleave", hideDetail);
        item.addEventListener("blur", hideDetail);
      }
      menu.append(item);
    } else if (entry.kind === "actions") {
      menu.append(
        el(
          doc,
          "div",
          { class: `${p}-menu-actions`, attrs: { role: "group" } },
          ...entry.options.map((option) =>
            button(
              `${p}-action`,
              option.run,
              option.disabled,
              // As a row's buttons say it: the action, and why it cannot be used now
              { title: option.disabled ? `${option.title}: ${option.disabled}` : option.title, attrs: { role: "menuitem", "aria-label": option.title } },
              icon(option.icon),
              el(doc, "span", { class: `${p}-action-caption`, text: option.caption }),
            ),
          ),
        ),
      );
    } else if (entry.kind === "tiles") {
      menu.append(
        el(
          doc,
          "div",
          { class: `${p}-menu-tiles`, attrs: { role: "group" } },
          ...entry.options.map((option) =>
            button(
              `${p}-menu-tile`,
              option.run,
              option.disabled,
              { attrs: { role: option.checked === undefined ? "menuitem" : "menuitemradio", "aria-checked": pressed(option.checked) } },
              icon(option.icon),
              el(doc, "span", { class: `${p}-label`, text: option.label }),
            ),
          ),
        ),
      );
    } else if (entry.kind === "element") {
      menu.append(entry.element);
    } else {
      menu.append(
        el(
          doc,
          "div",
          `${p}-menu-segmented${entry.key ? ` ${p}-menu-row-${entry.key}` : ""}`,
          el(doc, "span", { class: `${p}-label${entry.attention ? ` ${p}-attention` : ""}`, text: entry.label, ...(entry.hint ? { title: entry.hint } : {}) }),
          el(
            doc,
            "div",
            { class: `${p}-segments`, attrs: { role: "group", "aria-label": entry.label } },
            ...entry.options.map((option) =>
              button(`${p}-segment`, option.run, option.disabled, {
                title: option.disabled ? `${option.title}: ${option.disabled}` : option.title,
                attrs: {
                  role: option.active === undefined ? "menuitem" : "menuitemradio",
                  "aria-checked": pressed(option.active),
                  "aria-label": option.title,
                },
                html: option.icon,
              }),
            ),
          ),
        ),
      );
    }
  }

  menu.addEventListener("keydown", (e) => {
    // SilverBullet hands stray keys back to the editor; keys in the menu stay here
    e.stopPropagation();
    // A name typed in the title: its keys are the field's
    if (e.target instanceof HTMLInputElement) return;
    // The title's buttons (the pencil) are Tab's, the arrows go along the entries
    const buttons = Array.from(
      menu.querySelectorAll<HTMLButtonElement>(`button:not([aria-disabled]):not(.${p}-menu-rename):not(.${p}-menu-close)`),
    );
    const index = buttons.indexOf(doc.activeElement as HTMLButtonElement);
    const focus = (i: number) =>
      buttons[(i + buttons.length) % buttons.length]?.focus({ preventScroll: true });
    // Left and right go along a row of buttons too
    const inRow =
      index >= 0 &&
      [`${p}-segment`, `${p}-action`, `${p}-menu-tile`].some((c) => buttons[index]!.classList.contains(c));
    if (e.key === "ArrowDown" || (e.key === "ArrowRight" && inRow)) {
      e.preventDefault();
      focus(index + 1);
    } else if (e.key === "ArrowUp" || (e.key === "ArrowLeft" && inRow)) {
      e.preventDefault();
      focus(index < 0 ? -1 : index - 1);
    } else if (e.key === "ArrowLeft" && back) {
      e.preventDefault();
      back.run();
    } else if (e.key === "Home") {
      e.preventDefault();
      focus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focus(-1);
    }
  });
  return menu;
}

/** The pencil after the title, and the field it turns the title into */
function addNaming(doc: Document, look: MenuLook, menu: HTMLElement, heading: HTMLElement, naming: MenuNaming): void {
  const p = look.base;
  const pencil = el(doc, "button", {
    class: `${p}-menu-rename`,
    html: look.renameIcon ?? "",
    title: naming.disabled ? `${naming.label}: ${naming.disabled}` : naming.label,
    attrs: { "aria-label": naming.label, "aria-disabled": naming.disabled ? "true" : undefined },
  });
  heading.append(pencil);
  // One save at a time, whichever field asked for it (Esc and the pencil again make a new one)
  let saving = false;
  pencil.addEventListener("click", (e) => {
    e.preventDefault();
    if (naming.disabled) return;
    const problem = el(doc, "div", { class: `${p}-menu-name-problem`, attrs: { id: `${p}-menu-name-problem-${++problemIds}`, role: "alert", hidden: "" } });
    const field = el(doc, "input", {
      class: `${p}-menu-name`,
      attrs: { type: "text", placeholder: "name", "aria-label": naming.label, autocomplete: "off", spellcheck: "false", "aria-describedby": problem.id },
    });
    field.value = naming.name ?? "";
    const titled = Array.from(heading.childNodes);
    heading.replaceChildren(field);
    heading.after(problem);
    heading.classList.add(`${p}-naming`);
    const save = (name: string) => {
      saving = true;
      problem.hidden = true;
      field.removeAttribute("aria-invalid");
      void naming.save(name).then((why) => {
        saving = false;
        // Left meanwhile (Esc, the menu closed): nothing to show
        if (why === undefined || !field.isConnected) return;
        problem.textContent = why;
        problem.hidden = false;
        field.setAttribute("aria-invalid", "true");
        field.focus();
      });
    };
    const clear =
      naming.clear && naming.name
        ? el(
            doc,
            "button",
            { class: `${p}-menu-item ${p}-menu-name-clear`, title: naming.clear.title, run: () => !saving && save("") },
            el(doc, "span", { class: `${p}-icon`, html: look.closeIcon ?? CLOSE }),
            el(doc, "span", `${p}-label`, naming.clear.label),
          )
        : undefined;
    if (clear) problem.after(clear);
    const leave = () => {
      heading.classList.remove(`${p}-naming`);
      heading.replaceChildren(...titled);
      problem.remove();
      clear?.remove();
      menu.focus({ preventScroll: true });
    };
    field.addEventListener("keydown", (ev) => {
      // Keys composing a character (an IME; Safari ends one with an Enter not marked composing) are the composition's
      if (ev.isComposing || ev.keyCode === 229) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        leave();
      } else if (ev.key === "Enter" && !saving) {
        ev.preventDefault();
        ev.stopPropagation();
        save(field.value.trim());
      }
    });
    field.focus();
    field.select();
  });
}

// Ids tying a name field to its refusal (aria-describedby)
let problemIds = 0;

// A ×: what closes
const CLOSE =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';


/**
 * Focuses the menu itself: arrow keys then reach its entries, none looks
 * selected yet. A list to pick from starts at its choice instead (the item
 * checked): focused and highlighted, while the item that came under the
 * pointer as the list opened in the menu's place is not, until the pointer moves.
 */
export function focusMenu(menu: HTMLElement, look: MenuLook): void {
  const p = look.base;
  const current = menu.hasAttribute(`data-${p}-list`) ? menu.querySelector<HTMLElement>(`:is(.${p}-menu-item, .${p}-menu-tile)[aria-checked="true"]`) : null;
  if (!current) {
    menu.tabIndex = -1;
    menu.focus({ preventScroll: true });
    return;
  }
  menu.classList.add(`${p}-menu-still`);
  current.classList.add(`${p}-menu-current`);
  current.focus({ preventScroll: true });
  menu.addEventListener("pointermove", () => menu.classList.remove(`${p}-menu-still`), { once: true });
  current.addEventListener("blur", () => current.classList.remove(`${p}-menu-current`), { once: true });
}
