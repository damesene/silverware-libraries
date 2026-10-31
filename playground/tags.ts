// The tags playground: Silverware Tags (its sources, not the committed bundle)
// over a space of pages in memory (space/memory.ts, its index made by the
// scanner), kept in the browser. The page open is the one whose text shows
// on the right (the editor: a write of it changes the text there); the
// library page's space-style block is applied as SilverBullet would, and its
// commands are the header's buttons.
import { readSettings } from "../silverware-tags/src/bridge.ts";
import { start } from "../silverware-tags/src/index.ts";
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

const controller = await start(space, { flash: (message, type, actions) => flash(message, type, { actions }) }, await readSettings({}));
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
// For the interaction tests: commands run as SilverBullet's client runs them, the space as it is
Object.assign(window, { playgroundTags: { runCommand: (name: string) => controller.runCommand(name), space } });
showPage();
