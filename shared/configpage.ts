// The plugins' settings in the space's configuration page (CONFIG), in a
// space-lua block starting with a marker, one `config.set(path, value)` line
// per setting. A plugin edits only its own lines there, every other line
// (other libraries, shortcuts) is kept as written. Verified in SilverBullet's
// source (plugs/configuration-manager/config_block.ts, configuration.ts, lua.ts,
// ui/use_config_editor.ts).
//
// Two blocks: SilverBullet's Configuration Manager's (MANAGED_MARKER), for
// values it reads back (a boolean, a number, a string), so either shows and
// changes what the other wrote; and a plugin's own (its marker) for tables (the
// toolbar's favourites): the Configuration Manager reads no table
// (`parseLuaLiteral`), and on any save it writes its block anew from what it
// read, so a table in its block would be lost. It leaves other blocks alone.

export const CONFIG_PAGE = "CONFIG";
export const MANAGED_MARKER = "-- managed-by: configuration-manager";

const LUA_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function luaString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
}

/** A setting's value as Lua, on one line: a boolean, a number, a string, or a table of them (a list, or fields by name) */
export function toLua(value: unknown): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? `{ ${value.map(toLua).join(", ")} }` : "{}";
  if (value !== null && typeof value === "object") {
    const fields = Object.entries(value).filter(([, v]) => v !== undefined && v !== null);
    if (!fields.length) return "{}";
    return `{ ${fields.map(([k, v]) => `${LUA_NAME.test(k) ? k : `[${luaString(k)}]`} = ${toLua(v)}`).join(", ")} }`;
  }
  return luaString(String(value));
}

/**
 * The path a `config.set("path", value)` line sets, where the whole call is on
 * the line (a value spanning lines is left alone: the line written after it
 * wins, Lua running them in order)
 */
function pathOf(line: string): string | undefined {
  const m = /^\s*config\.set\(\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1\s*,.*\)\s*$/.exec(line);
  return m ? m[2]!.replace(/\\(.)/g, "$1") : undefined;
}

/**
 * The configuration page's text with `values` set in the block that starts with
 * `marker` (the Configuration Manager's by default): a value replaces its
 * path's line (or is added at the end), undefined removes it. The block is
 * added where there is none, and removed when nothing is left in it. The page's
 * line endings are kept.
 */
export function withConfigSettings(text: string, values: Readonly<Record<string, unknown>>, marker = MANAGED_MARKER): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  // (Spaces after a fence, not the lines after it)
  const fence = /^```space-lua[ \t]*\r?\n([\s\S]*?)^```[ \t]*(?=\r?$)/gm;
  let block: { start: number; end: number; inner: string } | undefined;
  for (let m = fence.exec(text); m; m = fence.exec(text)) {
    if (m[1]!.trimStart().startsWith(marker)) {
      block = { start: m.index, end: m.index + m[0].length, inner: m[1]! };
      break;
    }
  }
  const lines = block ? block.inner.replace(/\r?\n$/, "").split(/\r?\n/) : [marker];
  const pending = new Map(Object.entries(values));
  const kept: string[] = [];
  for (const line of lines) {
    const path = pathOf(line);
    if (path === undefined || !pending.has(path)) {
      kept.push(line);
      continue;
    }
    const value = pending.get(path);
    pending.delete(path);
    if (value !== undefined) kept.push(`config.set(${toLua(path)}, ${toLua(value)})`);
  }
  for (const [path, value] of pending) {
    if (value !== undefined) kept.push(`config.set(${toLua(path)}, ${toLua(value)})`);
  }
  const empty = kept.every((line) => line.trim() === "" || line.trim() === marker);
  if (!block) {
    if (empty) return text;
    const separator = text === "" || text.endsWith(eol + eol) ? "" : text.endsWith(eol) ? eol : eol + eol;
    return `${text}${separator}\`\`\`space-lua${eol}${kept.join(eol)}${eol}\`\`\`${eol}`;
  }
  if (empty) {
    // The block goes, with the line it ended
    const end = text.startsWith(eol, block.end) ? block.end + eol.length : block.end;
    return text.slice(0, block.start) + text.slice(end);
  }
  return `${text.slice(0, block.start)}\`\`\`space-lua${eol}${kept.join(eol)}${eol}\`\`\`${text.slice(block.end)}`;
}

/** What saving into the configuration page needs of SilverBullet (the library page's Lua hands it over) */
export type ConfigPageAccess = {
  readPage(name: string): string | undefined | Promise<string | undefined>;
  // Written, synced and indexed, the configuration loaded again (as the Configuration Manager saves)
  saveConfigPage(text: string): unknown;
};

/**
 * The configuration page read, changed by `update` (withConfigSettings, once or
 * per block) and written. No page yet: it is made; any other failure to read it
 * writes nothing (an empty text would replace the page); a sync conflict left in
 * it (its markers) neither: its Lua is broken, written over it would be worse.
 */
export async function saveConfigPage(access: ConfigPageAccess, update: (text: string) => string): Promise<void> {
  let text = "";
  try {
    text = (await access.readPage(CONFIG_PAGE)) ?? "";
  } catch (e) {
    if (!/not.?found|does not exist|no such/i.test(String(e))) throw e;
  }
  if (/^(<{7}|={7}|>{7})( |$)/m.test(text)) throw new Error("the CONFIG page has a sync conflict: resolve it there first");
  await access.saveConfigPage(update(text));
}
