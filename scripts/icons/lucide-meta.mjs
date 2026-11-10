// Lucide's categories and aliases, which no npm package of it has (lucide-static has the icons' nodes and tags only,
// checked 2026-11-10): read from its repository's archive at the tag of the version installed, written into
// lucide-meta.json beside this script, committed, so the build needs no network. Run again with each update of
// lucide-static:
//   node scripts/icons/lucide-meta.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const version = JSON.parse(readFileSync(require.resolve("lucide-static/package.json"), "utf8")).version;

const response = await fetch(`https://codeload.github.com/lucide-icons/lucide/tar.gz/refs/tags/${version}`);
if (!response.ok) throw new Error(`Lucide ${version}: ${response.status} ${response.statusText}`);
const files = tarFiles(gunzipSync(Buffer.from(await response.arrayBuffer())));

/** A folder's JSON files of the archive (its one top folder left out), by name without .json, in order */
const read = (folder) =>
  [...files]
    .map(([path, data]) => [path.split("/").slice(1), data])
    .filter(([parts]) => parts.length === 2 && parts[0] === folder && parts[1].endsWith(".json") && !parts[1].endsWith(".schema.json"))
    .map(([parts, data]) => [parts[1].slice(0, -".json".length), JSON.parse(data.toString("utf8"))])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const categories = read("categories").map(([id, one]) => ({ id, title: one.title, icon: one.icon }));
const raw = new Map(read("icons"));
// An icon's categories, `$extends:<icon>` the categories of that icon (followed, each once)
const categoriesOf = (name, seen = new Set()) => {
  if (seen.has(name)) return [];
  seen.add(name);
  return (raw.get(name)?.categories ?? []).flatMap((one) => (one.startsWith("$extends:") ? categoriesOf(one.slice("$extends:".length), seen) : [one]));
};
const icons = Object.fromEntries(
  [...raw].map(([name, one]) => [
    name,
    {
      categories: [...new Set(categoriesOf(name))],
      // (An alias is a name it had: { name, deprecated, … } in the repository, a text in older releases)
      aliases: (one.aliases ?? []).map((alias) => (typeof alias === "string" ? alias : alias.name)),
    },
  ]),
);
if (!categories.length || !Object.keys(icons).length) throw new Error(`Lucide ${version}: no categories or icons found in its archive`);
writeFileSync(new URL("./lucide-meta.json", import.meta.url), `${JSON.stringify({ version, categories, icons })}\n`);
console.log(`lucide-meta.json: Lucide ${version}, ${categories.length} categories, ${Object.keys(icons).length} icons`);

/** The regular files of a tar archive by path (ustar: 512-byte headers, the name's prefix field, pax long names) */
function tarFiles(tar) {
  const out = new Map();
  let longName;
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (from, length) => header.subarray(from, from + length).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(text(124, 12).trim() || "0", 8);
    const type = text(156, 1);
    const body = tar.subarray(at + 512, at + 512 + size);
    const prefix = text(345, 155);
    const name = longName ?? (prefix ? `${prefix}/${text(0, 100)}` : text(0, 100));
    longName = undefined;
    // A pax header's path, for the entry after it
    if (type === "x") longName = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString("utf8"))?.[1];
    else if (type === "L") longName = body.toString("utf8").replace(/\0.*$/s, "");
    else if (type === "0" || type === "") out.set(name, body);
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
