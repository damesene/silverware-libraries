// The tags playground: Silverware Tags (its sources, not the committed bundle)
// over a space of pages in memory (space/memory.ts, its index made by the
// scanner), kept in the browser. The page open is the one whose text shows
// on the right (the editor: a write of it changes the text there); the
// library page's space-style block is applied as SilverBullet would, and its
// commands are the header's buttons.
import { readSettings } from "../silverware-tags/src/bridge.ts";
import { defineOperations, panelMove, panelRename, panelRows, panelSelect, start } from "../silverware-tags/src/index.ts";
import type { SettingsStore } from "../silverware-tags/src/settings.ts";
import { memorySpace } from "../silverware-tags/src/space/memory.ts";
import libraryPage from "../silverware-tags/silverware-tags.md";
import { flash, setUpTheme } from "./common.ts";
import { SAMPLE_PAGES } from "./tags-sample.ts";

setUpTheme();

const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(libraryPage)?.[1] ?? "";
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
const space = memorySpace(load() ?? SAMPLE_PAGES, {
  current: "index",
  changed: (page) => {
    save();
    if (page === space.current) text.value = space.pages.get(page) ?? "";
    showPages();
    void showPanel();
  },
  navigated: () => showPage(),
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

/**
 * The tags' panel as SilverBullet's navigator shows the rows the library page
 * hands it: a tree by "/" (a level of tags a folder row), a click or Enter
 * picks, F2 renames, a row dropped on a level moves it there (the navigator's
 * onMove: the level plus the row's last part)
 */
async function showPanel(): Promise<void> {
  const panel = document.getElementById("tags-panel")!;
  const rows = await panelRows();
  const byName = new Map(rows.map((row) => [row.name, row]));
  // Every level above a tag is a row too, a folder
  // (SilverBullet's own tags in a Meta segment of their own there: the playground's space has none)
  const names = [...new Set(rows.filter((row) => !row.meta).flatMap((row) => row.name.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/"))))].sort();
  const row = (name: string) => {
    const tag = byName.get(name);
    const depth = name.split("/").length - 1;
    const el = document.createElement("div");
    el.className = "row";
    el.tabIndex = 0;
    el.dataset.path = name;
    el.draggable = true;
    el.style.paddingLeft = `${6 + depth * 14}px`;
    el.innerHTML = `<span>${tag ? "#" : "▸"}</span><span class="label"></span><span class="count"></span>`;
    el.querySelector(".label")!.textContent = name.slice(name.lastIndexOf("/") + 1);
    el.querySelector(".count")!.textContent = tag ? String(tag.count) : "";
    el.addEventListener("click", () => void panelSelect(name));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void panelSelect(name);
      else if (e.key === "F2") void panelRename(name);
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
const controller = await start(space, { flash: (message, type, actions) => flash(message, type, { actions }) }, await readSettings({ getConfig }), store);
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
