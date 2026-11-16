// A key event matched against a key by CodeMirror's names (`Mod-Shift-z`, `Escape`; SilverBullet names its shortcuts
// the same way, `Ctrl-k`, `Cmd-Shift-8`). Pure: shared/editor.ts (an editor's user's keys) and shared/silverbullet/keptkeys.ts
// (SilverBullet's shortcuts a surface keeps) take it.

/** Whether the keyboard is a Mac's: `Mod` is Cmd there, and SilverBullet's commands give a Mac's keys apart */
export function isMac(): boolean {
  return /Mac|iP(hone|ad)/.test(globalThis.navigator?.platform ?? "");
}

/** Whether a key event is a key of CodeMirror's name (`Mod-Shift-z`), on its key alone, modifiers exactly */
export function keyMatches(name: string, event: KeyboardEvent): boolean {
  const parts = name.split(/-(?!$)/);
  const key = parts.pop()!;
  const has = new Set(parts.map((part) => part.toLowerCase()));
  const mac = isMac();
  const ctrl = has.has("ctrl") || (has.has("mod") && !mac);
  const meta = has.has("meta") || has.has("cmd") || (has.has("mod") && mac);
  if (event.ctrlKey !== ctrl || event.metaKey !== meta || event.altKey !== has.has("alt")) return false;
  // (Shift named: held; not named: not held, but where the key is itself a shifted one, as `?` or `+`: a letter or a
  // named key is not, `Mod-z` is not Ctrl+Shift+Z)
  if (has.has("shift") ? !event.shiftKey : event.shiftKey && (key.length > 1 || /^\p{L}$/u.test(key))) return false;
  if (event.key.toLowerCase() === key.toLowerCase() || (key === "Space" && event.key === " ")) return true;
  // Where Ctrl, Alt or Cmd is held, also the key's base name by its key code, as CodeMirror's keymaps (SilverBullet's)
  // take it: `Ctrl-Shift-8` where the key typed is `*`, `Ctrl-k` on a layout typing another letter there. Shift as named
  // (`Mod-1` is not Ctrl+Shift+1); never Ctrl with Alt off a Mac, which is AltGr typing a sign (CodeMirror's rule too)
  if (!(event.ctrlKey || event.metaKey || event.altKey) || (event.ctrlKey && event.altKey && !mac) || event.shiftKey !== has.has("shift")) return false;
  return baseKey(event.keyCode) === key.toLowerCase();
}

// The signs' key codes, as the key names them (CodeMirror's `w3c-keyname` base names)
const SIGNS: Readonly<Record<number, string>> = { 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\", 221: "]", 222: "'" };

/** A key's base name by its key code (a letter, a digit, a sign), none for another key */
function baseKey(code: number): string | undefined {
  if (code >= 65 && code <= 90) return String.fromCharCode(code + 32);
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  return SIGNS[code];
}
