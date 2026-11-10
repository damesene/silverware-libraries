// The picker of icons (docs/silverware-icons.md, *The picker*), for any plugin (the toolbar's own icons and its Emoji
// action, a database item's icon): a tab per set (the one used last first), the set's groups as a filter (a row of
// their icons, or a dropdown of their names where there are more than ROW_GROUPS), a search by label and keywords,
// the set's icons (those used last first), the keys (↓ into the icons, arrows, Enter). It fills an element the caller
// gives and tells it the value picked, as it is written (an emoji's character, `lucide:house`); what is done with it
// is the caller's. Its markup and look are its own (`swi-`, its style page), the same wherever it opens.
import type { PickOptions } from "../../shared/icons.ts";
import { findByWords } from "../../shared/search.ts";
import type { Drawing } from "./draw.ts";
import type { Registry, SetInfo } from "./registry.ts";
import type { SearchData, SearchIcon } from "./set.ts";

// Up to this many groups a row of their icons; more, a dropdown of their names (emoji: 9, Lucide: 43)
export const ROW_GROUPS = 10;
const RECENT_MAX = 24;
const RECENT_KEY = "silverware.icons.recent";
const SET_KEY = "silverware.icons.lastSet";
// The emoji pickers' lists of before (the toolbar's and the database's), read once into RECENT_KEY
const OLD_RECENT_KEYS = ["silverware.toolbar.recentEmoji", "silverware.database.recentEmoji"];


/** The picker in `into` (its children replaced), its search focused; the function given back ends it */
export function picker(registry: Registry, drawing: Drawing, into: HTMLElement, options: PickOptions): () => void {
  const doc = into.ownerDocument;
  const win = doc.defaultView!;
  const sets = registry.sets().filter((set) => !options.sets || options.sets.includes(set.name));
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const e = doc.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const root = el("div", "swi-picker");
  const tabs = el("div", "swi-sets");
  tabs.setAttribute("role", "tablist");
  const groupsRow = el("div", "swi-groups");
  groupsRow.setAttribute("role", "radiogroup");
  groupsRow.setAttribute("aria-label", "Groups");
  // The search row: the field (with the caller's icon) and, beside it, a dropdown of the groups where they are many
  const search = el("div", "swi-search");
  const label = el("label", "swi-search-label");
  if (options.searchIcon) label.innerHTML = options.searchIcon;
  const input = el("input", "swi-field");
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  const select = el("select", "swi-group-select");
  select.setAttribute("aria-label", "Group");
  label.append(input);
  search.append(label);
  const list = el("div", "swi-list");
  list.setAttribute("role", "listbox");
  const name = el("div", "swi-name");
  root.append(...(sets.length > 1 ? [tabs] : []), groupsRow, search, list, name);
  into.replaceChildren(root);
  // A press on a tab, a group or an icon keeps the search's focus (the keyboard stays on a phone)
  for (const part of [tabs, groupsRow, list]) part.addEventListener("mousedown", (e) => e.preventDefault());

  let open = true;
  let set: SetInfo | undefined;
  let data: SearchData | undefined;
  let only: string | undefined;
  let shown: HTMLButtonElement[] = [];
  let current = -1;
  // Left and right the field's (its text edited) until ↓ goes into the icons, and again once it is typed in
  let inGrid = false;

  const valueOf = (icon: SearchIcon) => (set?.kind === "svg" ? `${set.name}:${icon[0]}` : icon[0]);
  const pick = (value: string) => {
    keepRecent(win, value);
    options.picked(value);
  };
  const setCurrent = (i: number, scroll = true) => {
    shown[current]?.classList.remove("swi-current");
    current = Math.max(0, Math.min(i, shown.length - 1));
    const button = shown[current];
    if (!button) {
      name.textContent = "";
      return;
    }
    button.classList.add("swi-current");
    // (Not as the pointer goes over it: the list would move under it)
    if (scroll) button.scrollIntoView?.({ block: "nearest" });
    name.textContent = button.title;
    input.setAttribute("aria-activedescendant", button.id);
  };
  const button = (icon: SearchIcon) => {
    const value = valueOf(icon);
    const b = el("button", "swi-item");
    b.type = "button";
    b.innerHTML = drawing.markup(value, "swi-item");
    b.title = icon[1];
    b.id = `swi-item-${shown.length}`;
    b.dataset.swiValue = value;
    b.setAttribute("role", "option");
    b.setAttribute("aria-label", icon[1]);
    const index = shown.length;
    b.addEventListener("click", () => pick(value));
    b.addEventListener("mouseenter", () => setCurrent(index, false));
    shown.push(b);
    return b;
  };
  const section = (title: string, icons: readonly SearchIcon[]) => {
    const grid = el("div", "swi-grid");
    grid.append(...icons.map(button));
    return [el("div", "swi-section", title), grid];
  };
  const draw = () => {
    shown = [];
    current = -1;
    if (!data) return;
    const query = input.value;
    const group = data.groups.find((one) => one.id === only);
    const icons = group ? data.icons.filter((icon) => icon[3].includes(group.id)) : data.icons;
    if (query.trim()) {
      const found = findByWords(icons, query, (icon) => `${icon[1]} ${icon[2]}`, (icon) => icon[1]);
      list.replaceChildren(...(found.length ? section(group ? `Found in ${group.label}` : "Found", found) : [el("div", "swi-none", "Nothing found")]));
    } else if (group) list.replaceChildren(...section(group.label, icons));
    else {
      const byValue = new Map(data.icons.map((icon) => [valueOf(icon), icon]));
      const recent = readRecent(win)
        .map((value) => byValue.get(value))
        .filter((icon): icon is SearchIcon => !!icon);
      // A set of characters by its groups, as its data orders them (an emoji in one); an SVG set's in one grid by name
      // (an icon in several groups shown once)
      const all = set?.kind === "text" ? data.groups.flatMap((one) => section(one.label, data!.icons.filter((icon) => icon[3][0] === one.id))) : section(set?.label ?? "", data.icons);
      list.replaceChildren(...(recent.length ? section("Used last", recent) : []), ...all);
    }
    list.scrollTop = 0;
    setCurrent(0);
  };
  /** The groups' filter: a row of their icons (up to ROW_GROUPS) or a dropdown of their names, All first */
  const filters = (one: SearchData) => {
    only = undefined;
    if (one.groups.length > ROW_GROUPS) {
      groupsRow.replaceChildren();
      groupsRow.hidden = true;
      select.replaceChildren(new Option("All", ""), ...one.groups.map((group) => new Option(group.label, group.id)));
      select.value = "";
      search.append(select);
      return;
    }
    select.remove();
    groupsRow.hidden = !one.groups.length;
    const tab = (id: string | undefined, label: string, title: string, markup?: string) => {
      const b = el("button", "swi-group");
      b.type = "button";
      b.title = title;
      if (markup) b.innerHTML = markup;
      else b.textContent = label;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", title);
      b.setAttribute("aria-checked", String(id === only));
      b.addEventListener("click", () => {
        only = id;
        for (const other of groupsRow.children) other.setAttribute("aria-checked", String(other === b));
        inGrid = false;
        draw();
      });
      return b;
    };
    groupsRow.replaceChildren(tab(undefined, "All", "All"), ...one.groups.map((group) => tab(group.id, group.label, group.label, drawing.markup(group.icon, "swi-group"))));
  };
  select.addEventListener("change", () => {
    only = select.value || undefined;
    inGrid = false;
    draw();
  });
  /** A set shown: its tab marked, its data loaded (its drawing too, for an SVG set), its filter and icons */
  const show = (next: SetInfo) => {
    set = next;
    data = undefined;
    keepSet(win, next.name);
    for (const tab of tabs.children) tab.setAttribute("aria-selected", String((tab as HTMLElement).dataset.swiSet === next.name));
    input.value = "";
    input.placeholder = `Search ${next.label.toLowerCase()}`;
    input.setAttribute("aria-label", `Search ${next.label.toLowerCase()}`);
    groupsRow.replaceChildren();
    select.remove();
    list.replaceChildren(el("div", "swi-none", "Loading…"));
    name.textContent = "";
    void Promise.all([registry.searchLoaded(next.name), registry.drawLoaded(next.name)]).then(([loaded]) => {
      if (!open || set !== next) return;
      if (!loaded) {
        list.replaceChildren(el("div", "swi-none", `${next.label} could not be loaded`));
        return;
      }
      data = loaded;
      filters(loaded);
      draw();
      options.shown?.();
    });
  };
  for (const one of sets) {
    const tab = el("button", "swi-set", one.label);
    tab.type = "button";
    tab.dataset.swiSet = one.name;
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => {
      if (set !== one) show(one);
      input.focus({ preventScroll: true });
    });
    tabs.append(tab);
  }

  /** How many icons a row has, of the grid the current one is in (as laid out: its first row's) */
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

  const last = readSet(win);
  const first = sets.find((one) => one.name === last) ?? sets[0];
  if (first) show(first);
  else list.replaceChildren(el("div", "swi-none", "No icons"));
  input.focus({ preventScroll: true });
  return () => {
    open = false;
  };
}

/** Those used last, of every set (the emoji pickers' lists of before read in once, then removed) */
function readRecent(win: Window): string[] {
  try {
    const storage = win.localStorage;
    if (storage.getItem(RECENT_KEY) === null) {
      const old = OLD_RECENT_KEYS.flatMap((key) => listOf(storage.getItem(key)));
      storage.setItem(RECENT_KEY, JSON.stringify([...new Set(old)].slice(0, RECENT_MAX)));
      for (const key of OLD_RECENT_KEYS) storage.removeItem(key);
    }
    return listOf(storage.getItem(RECENT_KEY));
  } catch {
    // (No storage: a private window)
    return [];
  }
}

function keepRecent(win: Window, value: string): void {
  try {
    win.localStorage.setItem(RECENT_KEY, JSON.stringify([value, ...readRecent(win).filter((one) => one !== value)].slice(0, RECENT_MAX)));
  } catch {
    // (No storage)
  }
}

function readSet(win: Window): string | undefined {
  try {
    return win.localStorage.getItem(SET_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function keepSet(win: Window, name: string): void {
  try {
    win.localStorage.setItem(SET_KEY, name);
  } catch {
    // (No storage)
  }
}

function listOf(text: string | null): string[] {
  try {
    const value: unknown = JSON.parse(text ?? "[]");
    return Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : [];
  } catch {
    return [];
  }
}
