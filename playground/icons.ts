// The icons playground: Silverware Icons' picker in a panel, as a plugin opens it, and the icon picked drawn as the
// plugins draw it (markup in text, a button, a button on, large). Its style page's CSS applied as SilverBullet would;
// its sets' files beside this page's bundle, as SilverBullet has them beside the library's (scripts/playground.mjs).
import stylePage from "../silverware-icons/silverware-icons-style.md";
import { api } from "../silverware-icons/src/index.ts";
import { setUpTheme } from "./common.ts";

setUpTheme();
const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(stylePage)?.[1] ?? "";
document.head.append(style);

const panel = document.querySelector<HTMLElement>("#picker")!;
const emojiOnly = document.querySelector<HTMLInputElement>("#emoji-only")!;
const SEARCH = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`;

const show = (value: string) => {
  document.querySelector("#value")!.textContent = `${value} (${api.text(value)})`;
  for (const slot of document.querySelectorAll(".slot")) slot.innerHTML = api.markup(value, "sample");
};
let stop = () => undefined as void;
const open = () => {
  stop();
  stop = api.pick(panel, { ...(emojiOnly.checked ? { sets: ["emoji"] } : {}), picked: show, searchIcon: SEARCH });
};
emojiOnly.addEventListener("change", open);
open();
show("lucide:house");
