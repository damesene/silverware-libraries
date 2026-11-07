// The tags playground: Silverware Tags (its sources, not the committed bundle)
// over a space of pages in memory (space/memory.ts, its index made by the
// scanner), kept in the browser. The page open is the one whose text shows
// on the right (the editor: a write of it changes the text there); the
// style page's space-style block is applied as SilverBullet would, and its
// commands are the header's buttons.
import { readSettings } from "../silverware-tags/src/bridge.ts";
import { defineOperations, panelActionList, panelClicked, panelMove, panelPageFirst, panelRows, panelRun, start } from "../silverware-tags/src/index.ts";
import type { SettingsStore } from "../silverware-tags/src/settings.ts";
import { memorySpace } from "../silverware-tags/src/space/memory.ts";
import stylePage from "../silverware-tags/silverware-tags-style.md";
import { flash, setUpTheme } from "./common.ts";
import { SAMPLE_PAGES } from "./tags-sample.ts";

setUpTheme();

const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(stylePage)?.[1] ?? "";
document.head.append(style);

const STORE = "silverware.tags.playground.pages";
const load = (): Record<string, string> | undefined => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
};
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(space.pages)));
  } catch {
    // A private window: kept for this visit
  }
};

const text = document.getElementById("page-text") as HTMLTextAreaElement;
// The lists and the store, drawn and written in the next frame after pages changed (0: none asked for)
let redraw = 0;
const space = memorySpace(load() ?? SAMPLE_PAGES, {
  current: "index",
  changed: (page) => {
    if (page === space.current) text.value = space.pages.get(page) ?? "";
    // Once a frame however many pages a change writes (hundreds: the lists drawn and the store written each time cost more than the change)
    if (redraw) return;
    redraw = requestAnimationFrame(() => {
      redraw = 0;
      save();
      showPages();
      void showPanel();
    });
  },
  navigated: () => {
    showPage();
    // (The navigator's view reads its rows again as another page opens)
    void showPanel();
  },
});

function showPages(): void {
  const nav = document.getElementById("pages")!;
  nav.replaceChildren(
    ...[...space.pages.keys()].sort().map((page) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = page;
      button.dataset.page = page;
      if (page === space.current) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => void space.navigate(page));
      return button;
    }),
  );
}

function showPage(): void {
  document.getElementById("page-name")!.textContent = space.current ?? "";
  text.value = space.pages.get(space.current ?? "") ?? "";
  showPages();
}

// The row actions' icons (the navigator's are Feather's, by these names) as text
const ICON_TEXT: Readonly<Record<string, string>> = { plus: "+", minus: "−", "edit-2": "✎", "external-link": "↗" };

/**
 * The tags' panel as SilverBullet's navigator shows the rows the init page
 * hands it: a tree by "/" (a level of tags a folder row), every module's row
 * actions as its buttons where the row offers them (`can`) and their keys, a
 * row dropped on a level moves it there (the navigator's onMove: the level
 * plus the row's last part)
 */
async function showPanel(): Promise<void> {
  const panel = document.getElementById("tags-panel")!;
  const rows = await panelRows();
  const actions = panelActionList();
  const byName = new Map(rows.map((row) => [row.name, row]));
  // Every level above a tag is a row too, a folder
  // (SilverBullet's own tags in a Meta segment of their own there: the playground's space has none)
  const names = [...new Set(rows.filter((row) => !row.meta).flatMap((row) => row.name.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"))))].sort();
  // The page open's tags first where the setting says so (the rows' order, which the navigator keeps)
  if (panelPageFirst()) {
    const here = (name: string) => byName.get(name.split("/")[0]!)?.here ?? false;
    names.sort((a, b) => Number(here(b)) - Number(here(a)));
  }
  const row = (name: string) => {
    const tag = byName.get(name);
    const depth = name.split("/").length - 1;
    const el = document.createElement("div");
    el.className = tag?.here ? "row here" : "row";
    el.tabIndex = 0;
    el.dataset.path = name;
    el.draggable = true;
    el.style.paddingLeft = `${6 + depth * 14}px`;
    el.innerHTML = `<span>${tag && !tag.level ? "#" : "▸"}</span><span class="label"></span><span class="count"></span>`;
    el.querySelector(".label")!.textContent = name.slice(name.lastIndexOf("/") + 1);
    el.querySelector(".count")!.textContent = tag ? String(tag.count) : "";
    // The row's actions, as the navigator's buttons of a row (a click on the row itself: nothing, as there)
    for (const action of actions.filter((a) => tag?.can?.[a.id])) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = ICON_TEXT[action.icon] ?? action.label.charAt(0);
      button.title = action.label;
      button.setAttribute("aria-label", action.label);
      button.addEventListener("click", () => void panelRun(action.id, name));
      el.append(button);
    }
    // Each click told, as the navigator's onSelect tells it (two soon after: the window)
    el.addEventListener("click", (e) => {
      if (!(e.target as Element).closest("button")) void panelClicked(name);
    });
    el.addEventListener("keydown", (e) => {
      const action = actions.find((a) => a.key === e.key && tag?.can?.[a.id]);
      if (action) void panelRun(action.id, name);
    });
    el.addEventListener("dragstart", (e) => e.dataTransfer?.setData("text/plain", name));
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("over");
      const dragged = e.dataTransfer?.getData("text/plain");
      if (dragged && dragged !== name) void panelMove(dragged, `${name}/${dragged.slice(dragged.lastIndexOf("/") + 1)}`);
    });
    return el;
  };
  const heading = document.createElement("h2");
  heading.textContent = "Tags panel (SilverBullet's navigator)";
  panel.replaceChildren(heading, ...names.map(row));
}

// The editor: what is typed is the page's text
text.addEventListener("input", () => {
  if (!space.current) return;
  space.pages.set(space.current, text.value);
  save();
});

// A larger space to try: 1000 pages in 10 folders, tags each on about 250 of them, in every form a page has them
// (the frontmatter, a tag line, a task), shared with the sample's #todo
document.getElementById("generate")!.addEventListener("click", () => {
  const kinds = ["alpha", "beta", "gamma", "delta"];
  const colors = ["red", "green", "blue", "yellow"];
  const at = [...space.pages.keys()].filter((page) => page.startsWith("Bulk/")).length;
  for (let n = at; n < at + 1000; n++) {
    const kind = kinds[n % 4]!;
    const color = colors[Math.floor(n / 250) % 4]!;
    const lines = ["---", "tags:", `  - bulk/${kind}`, "---", `#topic/${color}`, "", `Generated page ${n + 1}.`];
    if (n % 4 === 1) lines.push("", "- [ ] Check it #review");
    if (n % 4 === 2) lines.push("", "- [ ] Follow up #todo");
    space.pages.set(`Bulk/Group ${Math.floor(n / 100) + 1}/Page ${String(n + 1).padStart(4, "0")}`, `${lines.join("\n")}\n`);
  }
  save();
  showPages();
  void showPanel();
  flash(`Added 1000 pages (${at + 1000} generated in all)`);
});

document.getElementById("reset")!.addEventListener("click", () => {
  space.pages.clear();
  for (const [page, value] of Object.entries(SAMPLE_PAGES)) space.pages.set(page, value);
  save();
  void space.navigate("index");
});

// The settings by path, as config.get gives them: the playground's own store (no CONFIG page here)
const SETTINGS = "silverware.tags.playground.settings";
const readStored = (): Record<string, unknown> => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS) ?? "{}") ?? {};
  } catch {
    return {};
  }
};
const getConfig = (path: string, fallback: unknown) => (path in readStored() ? readStored()[path] : fallback);
const store: SettingsStore = {
  read: () => readSettings({ getConfig }),
  canSave: true,
  save: async (values) => {
    try {
      localStorage.setItem(SETTINGS, JSON.stringify({ ...readStored(), ...values }));
    } catch {
      // A private window: kept for this visit
    }
  },
  reload: async () => location.reload(),
  confirm: async (question) => confirm(question),
  flash: (message, type) => flash(message, type),
};
const controller = await start(space, space.platform, { flash: (message, type, actions) => flash(message, type, { actions }) }, await readSettings({ getConfig }), store);
// The commands as SilverBullet would list them, as buttons (the prefix left out)
document.getElementById("commands")!.replaceChildren(
  ...controller.commands().map(({ name }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name.replace(/^Silverware Tags: /, "");
    button.title = name;
    button.dataset.command = name;
    button.addEventListener("click", () => void controller.runCommand(name));
    return button;
  }),
);
// For the interaction tests: commands run as SilverBullet's client runs them, the space as it is, custom operations
// defined as a space's script would (the playground defines none of its own)
Object.assign(window, { playgroundTags: { runCommand: (name: string) => controller.runCommand(name), space, defineOperations } });
showPage();
void showPanel();
