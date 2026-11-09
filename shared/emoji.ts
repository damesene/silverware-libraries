// The emoji picker, for any plugin (the toolbar's Emoji action, a database
// item's icon): its groups over the search as filters (All, then each group by
// its icon: only that group's shown, the search too), a search by name and
// keywords (English, as Unicode's CLDR has them), the emoji in Unicode's
// groups, those used last first, the keys (↓ into the emoji, arrows, Enter).
// It fills an element the caller gives (a panel, a popover) and tells it the
// emoji picked; what is done with it is the caller's. Its data is a file of
// each plugin's, beside its bundle (scripts/emoji.mjs writes them all: a
// plugin is installed without the others), loaded the first time a picker
// opens. Its classes by the caller's base (`swb-emoji-…`), its look the
// template shared/emoji.css in each plugin's style page.
import { findByWords } from "./search.ts";

/** An emoji: its character, name and keywords */
export type Emoji = readonly [emoji: string, name: string, keywords: string];
// A group's `icon`: its emoji in the filters (else its first)
export type EmojiData = { readonly groups: readonly { readonly name: string; readonly icon?: string; readonly items: readonly Emoji[] }[] };

const RECENT_MAX = 24;

/** The data in a file of the plugin's (beside its bundle: `new URL("./<plugin>-emoji.js", import.meta.url)`), imported once (again after a failure) */
export function emojiLoader(url: URL | string): () => Promise<EmojiData> {
  let data: Promise<EmojiData> | undefined;
  return () => {
    data ??= import(String(url))
      .then((m: { default: EmojiData }) => m.default)
      .catch((e: unknown) => {
        data = undefined;
        throw e;
      });
    return data;
  };
}

export type EmojiPickerOptions = {
  readonly doc: Document;
  /** What the picker fills (its children replaced) */
  readonly element: HTMLElement;
  /** The caller's prefix of classes (`swb`: `swb-emoji-tabs`…) */
  readonly base: string;
  readonly load: () => Promise<EmojiData>;
  /** An emoji picked (pressed, or Enter) */
  readonly pick: (emoji: string) => void;
  /** Where those used last are kept in the browser (localStorage), the caller's key */
  readonly recentKey: string;
  /** The search field's icon (markup of the caller's icons); none: no icon */
  readonly searchIcon?: string;
  /** The classes of the parts the caller already has a look for (the toolbar's search field); else `<base>-emoji-search`… */
  readonly classes?: { readonly search?: string; readonly field?: string; readonly group?: string; readonly none?: string; readonly current?: string };
  /** Told once the emoji are shown (the picker grew: placed anew) */
  readonly shown?: () => void;
};

function readRecent(win: Window, key: string): string[] {
  try {
    const value = JSON.parse(win.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function keepRecent(win: Window, key: string, emoji: string): void {
  try {
    win.localStorage.setItem(key, JSON.stringify([emoji, ...readRecent(win, key).filter((e) => e !== emoji)].slice(0, RECENT_MAX)));
  } catch {
    // (No storage: a private window)
  }
}

/** The picker in `element`: its groups as filters, its search (focused), the emoji by groups (found: one list), the current one's name under them; the function given back ends it */
export function emojiPicker(options: EmojiPickerOptions): () => void {
  const { doc, element, base } = options;
  const win = doc.defaultView!;
  const css = {
    search: options.classes?.search ?? `${base}-emoji-search`,
    field: options.classes?.field ?? `${base}-emoji-field`,
    group: options.classes?.group ?? `${base}-emoji-group`,
    none: options.classes?.none ?? `${base}-emoji-none`,
    current: options.classes?.current ?? `${base}-emoji-current`,
  };
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const e = doc.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const search = el("label", css.search);
  if (options.searchIcon) search.innerHTML = options.searchIcon;
  const input = el("input", css.field);
  input.type = "text";
  input.placeholder = "Search emoji";
  input.setAttribute("aria-label", "Search emoji");
  input.autocomplete = "off";
  input.spellcheck = false;
  search.append(input);
  const list = el("div", `${base}-emoji-list`);
  list.setAttribute("role", "listbox");
  const name = el("div", `${base}-emoji-name`);
  // The groups as filters, made once the emoji are loaded
  const tabs = el("div", `${base}-emoji-tabs`);
  tabs.setAttribute("role", "radiogroup");
  tabs.setAttribute("aria-label", "Emoji groups");
  // A press there keeps the search's focus
  tabs.addEventListener("mousedown", (e) => e.preventDefault());
  element.replaceChildren(tabs, search, list, name);
  // A press on an emoji keeps the search's focus (the keyboard stays on a phone)
  list.addEventListener("mousedown", (e) => e.preventDefault());

  let all: Emoji[] = [];
  let groups: EmojiData["groups"] = [];
  let shown: HTMLButtonElement[] = [];
  let current = -1;
  // The group shown alone (undefined: All)
  let only: number | undefined;

  const pick = (emoji: string) => {
    keepRecent(win, options.recentKey, emoji);
    options.pick(emoji);
  };
  // Left and right the field's (its text edited) until ↓ goes into the emoji, and again once it is typed in
  let inGrid = false;
  const setCurrent = (i: number, scroll = true) => {
    shown[current]?.classList.remove(css.current);
    current = Math.max(0, Math.min(i, shown.length - 1));
    const button = shown[current];
    if (!button) {
      name.textContent = "";
      return;
    }
    button.classList.add(css.current);
    // (Not as the pointer goes over it: the list would move under it)
    if (scroll) button.scrollIntoView?.({ block: "nearest" });
    name.textContent = button.title;
    input.setAttribute("aria-activedescendant", button.id);
  };
  const button = (emoji: Emoji) => {
    const b = el("button", `${base}-emoji`, emoji[0]);
    b.type = "button";
    b.title = emoji[1];
    b.id = `${base}-emoji-${shown.length}`;
    b.setAttribute("role", "option");
    b.setAttribute("aria-label", emoji[1]);
    const index = shown.length;
    b.addEventListener("click", () => pick(emoji[0]));
    b.addEventListener("mouseenter", () => setCurrent(index, false));
    shown.push(b);
    return b;
  };
  const section = (title: string, items: readonly Emoji[]) => {
    const grid = el("div", `${base}-emoji-grid`);
    grid.append(...items.map(button));
    return [el("div", css.group, title), grid];
  };
  const draw = () => {
    shown = [];
    current = -1;
    const query = input.value;
    const group = only === undefined ? undefined : groups[only];
    if (query.trim()) {
      const found = findByWords(group ? group.items : all, query, (e) => `${e[1]} ${e[2]}`, (e) => e[1]);
      list.replaceChildren(...(found.length ? section(group ? `Found in ${group.name}` : "Found", found) : [el("div", css.none, "No emoji found")]));
    } else if (group) list.replaceChildren(...section(group.name, group.items));
    else {
      const byEmoji = new Map(all.map((e) => [e[0], e]));
      // (Each an array itself: not flattened)
      const recent = readRecent(win, options.recentKey)
        .map((e) => byEmoji.get(e))
        .filter((e): e is Emoji => !!e);
      list.replaceChildren(...(recent.length ? section("Used last", recent) : []), ...groups.flatMap((group) => section(group.name, group.items)));
    }
    list.scrollTop = 0;
    setCurrent(0);
  };
  /** How many emoji a row has, of the grid the current one is in (as laid out: its first row's) */
  const columns = () => {
    const row = Array.from(shown[current]?.parentElement?.children ?? []) as HTMLElement[];
    const top = row[0]?.offsetTop;
    const count = row.findIndex((b) => b.offsetTop !== top);
    return count > 0 ? count : Math.max(1, row.length);
  };
  input.addEventListener("input", () => {
    inGrid = false;
    draw();
  });
  input.addEventListener("keydown", (e) => {
    // (An input method composing: its keys)
    if (e.isComposing) return;
    const across = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const down = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!shown.length || (across && !inGrid && input.value)) {
      if (e.key !== "Enter") return;
    }
    if (down || across) {
      e.preventDefault();
      if (down > 0) inGrid = true;
      setCurrent(current + (down ? down * columns() : across));
    } else if (e.key === "Enter") {
      e.preventDefault();
      shown[current]?.click();
    }
  });

  list.replaceChildren(el("div", css.none, "Loading emoji…"));
  let open = true;
  options.load().then(
    (data) => {
      if (!open) return;
      groups = data.groups;
      all = groups.flatMap((group) => group.items);
      const tab = (label: string, title: string, index: number | undefined) => {
        const button = el("button", `${base}-emoji-tab`, label);
        button.type = "button";
        button.title = title;
        button.setAttribute("role", "radio");
        button.setAttribute("aria-label", title);
        button.setAttribute("aria-checked", String(index === only));
        if (index !== undefined) button.dataset.group = String(index);
        button.addEventListener("click", () => {
          only = index;
          for (const other of tabs.children) other.setAttribute("aria-checked", String(other === button));
          inGrid = false;
          draw();
        });
        return button;
      };
      tabs.replaceChildren(tab("All", "All", undefined), ...groups.map((group, i) => tab(group.icon ?? group.items[0]?.[0] ?? "?", group.name, i)));
      draw();
      options.shown?.();
    },
    (e: unknown) => {
      console.error("Silverware: the emoji could not be loaded", e);
      if (open) list.replaceChildren(el("div", css.none, "The emoji could not be loaded"));
    },
  );
  input.focus({ preventScroll: true });
  return () => {
    open = false;
  };
}
