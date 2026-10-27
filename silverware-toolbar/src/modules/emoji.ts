// The emoji module: an action (`actions.emoji`) opening a picker of every
// emoji in its panel (core/panel.ts): its groups over the search as filters
// (All, then each group by its icon: only that group's shown, the search too), a search by name and keywords (English, as Unicode's CLDR has
// them), the emoji in Unicode's groups, those used last first; one picked is written at the cursor (the selection replaced). The
// emoji are not the popup's actions (too many among the formats): only the
// picker finds them. Their data is a file beside the bundle
// (silverware-toolbar-emoji.js, scripts/emoji.mjs), imported the first time the
// picker opens: with the module off it is never loaded.
import type { ActionPanel, Change, Context, ToolbarModule } from "../core/action.ts";
import { cursor } from "../core/cursor.ts";
import { findByWords } from "../core/search.ts";
import { ICONS } from "../icons.ts";

/** An emoji: its character, name and keywords */
export type Emoji = readonly [emoji: string, name: string, keywords: string];
// A group's `icon`: its emoji in the filters (else its first)
export type EmojiData = { readonly groups: readonly { readonly name: string; readonly icon?: string; readonly items: readonly Emoji[] }[] };

// Those used last, kept per browser (not a setting)
const RECENT_KEY = "silverware.toolbar.recentEmoji";
const RECENT_MAX = 24;

/** The data beside the bundle, as SilverBullet installs the library's files (a page of the playground: beside its bundle too) */
const loadBeside = (): Promise<EmojiData> => import(new URL("./silverware-toolbar-emoji.js", import.meta.url).href).then((m: { default: EmojiData }) => m.default);

export function emojiModule(load: () => Promise<EmojiData> = loadBeside): ToolbarModule {
  // Loaded once, the first time the picker opens
  let data: Promise<EmojiData> | undefined;
  const loaded = () => {
    data ??= load().catch((e: unknown) => {
      data = undefined;
      throw e;
    });
    return data;
  };
  return {
    actions: () => [
      {
        id: "actions.emoji",
        label: "Emoji",
        icon: ICONS.emoji,
        group: "Insert",
        keywords: ["smiley", "emoticon", "symbol", "icon"],
        panel: (panel) => picker(panel, loaded),
      },
    ],
  };
}

/** An emoji written over the selection, the cursor after it */
export function emojiChange(emoji: string, context: Context): Change {
  return { from: context.from, to: context.to, insert: emoji + cursor() };
}

function readRecent(win: Window): string[] {
  try {
    const value = JSON.parse(win.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function keepRecent(win: Window, emoji: string): void {
  try {
    win.localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...readRecent(win).filter((e) => e !== emoji)].slice(0, RECENT_MAX)));
  } catch {
    // (No storage: a private window)
  }
}

/** The picker in the panel: its groups as filters, its search, the emoji by groups (found: one list), the current one's name under them */
function picker(panel: ActionPanel, loaded: () => Promise<EmojiData>): () => void {
  const { doc, element } = panel;
  const win = doc.defaultView!;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const e = doc.createElement(tag);
    e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  element.classList.add("swb-emoji-panel");
  const search = el("label", "swb-search");
  search.innerHTML = ICONS.search;
  const input = el("input", "swb-search-field");
  input.type = "text";
  input.placeholder = "Search emoji";
  input.setAttribute("aria-label", "Search emoji");
  input.autocomplete = "off";
  input.spellcheck = false;
  search.append(input);
  const list = el("div", "swb-emoji-list");
  list.setAttribute("role", "listbox");
  const name = el("div", "swb-emoji-name");
  // The groups as filters, made once the emoji are loaded
  const tabs = el("div", "swb-emoji-tabs");
  tabs.setAttribute("role", "radiogroup");
  tabs.setAttribute("aria-label", "Emoji groups");
  // A press there keeps the search's focus
  tabs.addEventListener("mousedown", (e) => e.preventDefault());
  element.append(tabs, search, list, name);
  // A press on an emoji keeps the search's focus (the keyboard stays on a phone)
  list.addEventListener("mousedown", (e) => e.preventDefault());

  let all: (Emoji & { readonly group?: string })[] = [];
  let groups: EmojiData["groups"] = [];
  let shown: HTMLButtonElement[] = [];
  let current = -1;
  // The group shown alone (undefined: All)
  let only: number | undefined;

  const pick = (emoji: string) => {
    keepRecent(win, emoji);
    panel.write((context) => emojiChange(emoji, context));
  };
  // Left and right the field's (its text edited) until ↓ goes into the emoji, and again once it is typed in
  let inGrid = false;
  const setCurrent = (i: number, scroll = true) => {
    shown[current]?.classList.remove("swb-current");
    current = Math.max(0, Math.min(i, shown.length - 1));
    const button = shown[current];
    if (!button) {
      name.textContent = "";
      return;
    }
    button.classList.add("swb-current");
    // (Not as the pointer goes over it: the list would move under it)
    if (scroll) button.scrollIntoView?.({ block: "nearest" });
    name.textContent = button.title;
    input.setAttribute("aria-activedescendant", button.id);
  };
  const button = (emoji: Emoji) => {
    const b = el("button", "swb-emoji", emoji[0]);
    b.type = "button";
    b.title = emoji[1];
    b.id = `swb-emoji-${shown.length}`;
    b.setAttribute("role", "option");
    b.setAttribute("aria-label", emoji[1]);
    const index = shown.length;
    b.addEventListener("click", () => pick(emoji[0]));
    b.addEventListener("mouseenter", () => setCurrent(index, false));
    shown.push(b);
    return b;
  };
  const section = (title: string, items: readonly Emoji[]) => {
    const grid = el("div", "swb-emoji-grid");
    grid.append(...items.map(button));
    return [el("div", "swb-group", title), grid];
  };
  const draw = () => {
    shown = [];
    current = -1;
    const query = input.value;
    const group = only === undefined ? undefined : groups[only];
    if (query.trim()) {
      const found = findByWords(group ? group.items : all, query, (e) => `${e[1]} ${e[2]}`, (e) => e[1]);
      list.replaceChildren(...(found.length ? section(group ? `Found in ${group.name}` : "Found", found) : [el("div", "swb-none", "No emoji found")]));
    } else if (group) list.replaceChildren(...section(group.name, group.items));
    else {
      const byEmoji = new Map(all.map((e) => [e[0], e]));
      // (Each an array itself: not flattened)
      const recent = readRecent(win)
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

  list.replaceChildren(el("div", "swb-none", "Loading emoji…"));
  let open = true;
  loaded().then(
    (data) => {
      if (!open) return;
      groups = data.groups;
      all = groups.flatMap((group) => group.items);
      const tab = (label: string, title: string, index: number | undefined) => {
        const button = el("button", "swb-emoji-tab", label);
        button.type = "button";
        button.title = title;
        button.setAttribute("role", "radio");
        button.setAttribute("aria-label", title);
        button.setAttribute("aria-checked", String(index === only));
        if (index !== undefined) button.dataset.swbGroup = String(index);
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
      panel.place();
    },
    (e: unknown) => {
      console.error("Silverware Toolbar: the emoji could not be loaded", e);
      if (open) list.replaceChildren(el("div", "swb-none", "The emoji could not be loaded"));
    },
  );
  input.focus({ preventScroll: true });
  return () => {
    open = false;
  };
}
