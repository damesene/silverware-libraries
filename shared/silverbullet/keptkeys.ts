// SilverBullet's shortcuts a plugin's surface keeps from it (docs/silverware-blocked-keys.md): a grid's cell edited, a
// database's peek, a document's reader stop the keys they get, and SilverBullet, which takes its shortcuts at the
// document, never sees them. One pressed there is told ("Open Command Palette doesn't work here"), so nothing happening
// is no puzzle. Which keys are SilverBullet's: its commands' (`system.listCommands()`, as the init page's Lua hands it
// over, read by ./commands.ts), CodeMirror's editing left out ("Editor: …", what a field does itself). Knows no surface:
// each calls what `keptKeys` gives with every key it stops.
import { isMac, keyMatches } from "../keys.ts";
import { commandsOf, shortcutsOn } from "./commands.ts";

/** A command and its shortcuts on this keyboard, by CodeMirror's names; a sequence of keys with a space between (`Ctrl-q q`) */
export type CommandShortcuts = { readonly name: string; readonly keys: readonly string[] };

/** What a surface calls with each key it keeps from SilverBullet */
export type KeptKeys = (event: KeyboardEvent) => void;

// CodeMirror's editing, which SilverBullet lists as its commands too (on arrows, Enter, Backspace): a field's own
const EDITING = /^Editor: /;
// The same message not told again within (ms), a key held or pressed again
const REPEAT_MS = 2000;
// The commands read again after (ms): Space Lua loaded again adds or changes them
const STALE_MS = 30_000;

/**
 * The commands' shortcuts on this keyboard (a Mac's where a command gives them), of what `system.listCommands()` gives;
 * CodeMirror's editing and commands without a shortcut left out (a hidden command's still runs by its keys: kept)
 */
export function shortcutsOf(listed: unknown, mac: boolean): CommandShortcuts[] {
  return commandsOf(listed).flatMap((command) => {
    const keys = shortcutsOn(command, mac);
    return !EDITING.test(command.name) && keys.length ? [{ name: command.name, keys }] : [];
  });
}

/**
 * What a key kept from SilverBullet tells, where it is a shortcut of its: the command named, or the keys a sequence
 * starts with where it starts several; none where it is none
 */
export function messageOf(shortcuts: readonly CommandShortcuts[], event: KeyboardEvent): string | undefined {
  const firstOf = (key: string) => key.trim().split(/\s+/)[0]!;
  const whole = shortcuts.find((shortcut) => shortcut.keys.some((key) => !/\s/.test(key.trim()) && keyMatches(key, event)));
  if (whole) return `${whole.name} doesn't work here`;
  const started = shortcuts.flatMap((shortcut) => shortcut.keys.filter((key) => keyMatches(firstOf(key), event)).map((key) => ({ name: shortcut.name, first: firstOf(key) })));
  const names = new Set(started.map((one) => one.name));
  if (names.size === 1) return `${started[0]!.name} doesn't work here`;
  return started.length ? `${started[0]!.first} shortcuts don't work here` : undefined;
}

/**
 * What a surface calls with each key it keeps from SilverBullet: told by `tell` where it is a shortcut of SilverBullet's
 * that the surface's field did not take itself (`defaultPrevented`). None without `listCommands` (nothing known of
 * SilverBullet's shortcuts: an older init page, another host)
 */
export function keptKeys(listCommands: (() => unknown) | undefined, tell: ((message: string) => void) | undefined, now: () => number = Date.now): KeptKeys | undefined {
  if (!listCommands || !tell) return undefined;
  let read: { readonly at: number; readonly shortcuts: Promise<CommandShortcuts[]> } | undefined;
  let told: { readonly message: string; readonly at: number } | undefined;
  const shortcuts = () => {
    if (!read || now() - read.at > STALE_MS) {
      const reading: { at: number; shortcuts: Promise<CommandShortcuts[]> } = {
        at: now(),
        shortcuts: Promise.resolve()
          .then(listCommands)
          .then(
            (listed) => shortcutsOf(listed, isMac()),
            () => {
              // (Not read, Space Lua loading, say: read again at the next key, not after the time a reading is kept)
              if (read === reading) read = undefined;
              return [];
            },
          ),
      };
      read = reading;
    }
    return read.shortcuts;
  };
  return (event) => {
    if (event.type !== "keydown" || event.defaultPrevented || event.isComposing) return;
    // (Typing and plain keys are never SilverBullet's but its editing's: not looked up; nor what AltGr types)
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !/^F\d+$/.test(event.key)) return;
    if (event.getModifierState?.("AltGraph")) return;
    void shortcuts().then((known) => {
      const message = messageOf(known, event);
      if (!message || (told?.message === message && now() - told.at < REPEAT_MS)) return;
      told = { message, at: now() };
      tell(message);
    });
  };
}
