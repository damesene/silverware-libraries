// Silverware Core's gate in each plugin (docs/silverware-core.md, *Loading and the version gate*): a block of Space Lua
// written into the plugin's API page (its init page where it has none), before the page's own block, checking the
// installed core's version against the plugin's need before anything of the plugin is imported. Refused, the plugin
// says why once, its Space Lua API's functions say the same where a script calls them, and its pages' blocks do
// nothing (each guarded by `silverware_internal.<key>.refused`). Run by scripts/build.mjs: `build` writes the blocks,
// `--check` fails where a page's block differs from what this script writes or a block of the plugin's runs unguarded.
import { readFile, writeFile } from "node:fs/promises";

/**
 * Each plugin's need of the core, the one place it is kept: the core's version (major.minor) the plugin is built
 * against, the oldest it starts with (a core of the same major, that minor or later). Raised where the plugin imports
 * an export of the core newer than it (each export's `@since`, scripts/coreneeds.test.ts).
 */
export const NEEDS = {
  "silverware-table": "1.0",
  "silverware-toolbar": "1.0",
  "silverware-tags": "1.0",
  "silverware-chart": "1.0",
  "silverware-database": "1.0",
  "silverware-icons": "1.0",
  "silverware-layout": "1.0",
  "silverware-assets": "1.0",
  "silverware-assets-pdf": "1.0",
  "silverware-assets-docx": "1.0",
  "silverware-assets-xlsx": "1.0",
  "silverware-editor": "1.0",
};

/** The first line of the gate's block, by which it is found in a page */
export const GATE_MARK = "-- Silverware Core's gate";

/** A plugin's key in Lua (`silverware.<key>`, `silverware_internal.<key>`): its folder's name past `silverware-` */
export const keyOf = (library) => library.slice("silverware-".length).replaceAll("-", "_");

/** The functions of a plugin's Space Lua API its API page defines (`function silverware.<key>.<name>(`), in order, once each */
export function apiFunctionsOf(key, apiPage) {
  const names = [...apiPage.matchAll(new RegExp(`^\\s*function silverware\\.${key}\\.(\\w+)\\(`, "gm"))].map(([, name]) => name);
  return [...new Set(names)];
}

const lua = (text) => JSON.stringify(text);

/**
 * The gate's block for a plugin, its fences included: `title` its name ("Silverware Table"), `need` the core's
 * major.minor it needs, `stubs` its API's functions, each refusing with the gate's message where it is refused
 */
export function gateBlock({ key, title, need, stubs }) {
  const [major, minor] = need.split(".");
  const older = `${title} needs Silverware Core ${need} or later`;
  const newer = `${title} works with Silverware Core ${major}.x only`;
  const how = "run Library: Update All, then reload the page";
  return [
    "```space-lua",
    `${GATE_MARK} (written by scripts/coregate.mjs: edit it there, never here), before the plugin's own blocks (priority`,
    `-- 55: after the core's API page, 60, before the plugins' API pages, 50): ${title} starts only with a core of major`,
    `-- ${major}, minor ${minor} or later; else it says so once, its API's functions say the same, its blocks do nothing`,
    "-- priority: 55",
    "silverware = silverware or {}",
    "silverware_internal = silverware_internal or {}",
    `silverware_internal.${key} = silverware_internal.${key} or {}`,
    `silverware_internal.${key}.refused = nil`,
    "if js and js.window then",
    `  local ok, core = pcall(js.importFromSpace, "Library/damesene/silverware-core.js")`,
    "  local installed = ok and core and core.VERSION or nil",
    "  local problem = nil",
    "  if not installed then",
    `    problem = ${lua(`${older} (not installed): ${how}`)}`,
    "  else",
    `    local major, minor = string.match(installed, "^(%d+)%.(%d+)%.")`,
    "    major, minor = tonumber(major), tonumber(minor)",
    `    if not major or not minor or major < ${major} or (major == ${major} and minor < ${minor}) then`,
    `      problem = ${lua(`${older} (installed `)} .. installed .. ${lua(`): ${how}`)}`,
    `    elseif major > ${major} then`,
    `      problem = ${lua(`${newer} (installed `)} .. installed .. ${lua(`): update ${title}: ${how}`)}`,
    "    end",
    "  end",
    "  if problem then",
    `    silverware_internal.${key}.refused = problem`,
    `    editor.flashNotification(problem, "error")`,
    ...(stubs.length
      ? [
          `    -- Its API's functions refuse with the same message, so a script calling one says why`,
          "    local function refused() error(problem) end",
          `    silverware.${key} = {}`,
          ...stubs.map((name) => `    silverware.${key}.${name} = refused`),
        ]
      : []),
    "  end",
    "end",
    "```",
  ].join("\n");
}

/** A page with the gate's block in it: the block of before replaced, else put before its first block of Space Lua */
export function withGate(page, block) {
  const blocks = [...page.matchAll(/^```space-lua\n[\s\S]*?^```$/gm)];
  const before = blocks.find((b) => b[0].startsWith(`\`\`\`space-lua\n${GATE_MARK}`));
  if (before) return page.slice(0, before.index) + block + page.slice(before.index + before[0].length);
  const first = blocks[0];
  if (!first) throw new Error("No space-lua block to put the gate before");
  return `${page.slice(0, first.index)}${block}\n\n${page.slice(first.index)}`;
}

/** A line of Lua less its strings and its comment (what the checks read: a comment or a text naming a function is no use) */
const codeOf = (line) =>
  line
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/--.*$/, "")
    .trimEnd();

/**
 * Each line of a block's code given with the blocks open around it (`if`, `for`, `while`, `do`, `function`, each closed
 * by its `end`), innermost last: an `if`'s `then` part, an `elseif`'s or an `else`'s, each a frame of its own condition
 * (`condition`, the line's code; none for an `else` and what is no `if`). Read line by line: a block's code is
 * formatted, one statement opening a block per line
 */
function walk(block, visit) {
  const frames = [];
  for (const line of block.split("\n")) {
    const code = codeOf(line);
    const branch = /^\s*(elseif|else)\b/.exec(code)?.[1];
    if (branch && frames.length) frames[frames.length - 1] = { condition: branch === "elseif" ? code : undefined };
    visit(code, frames, line);
    const ifs = (code.match(/(?<!else)\bif\b/g) ?? []).length;
    const opened = ifs + (code.match(/\bfunction\b/g) ?? []).length + (code.match(/\bdo\b/g) ?? []).length;
    const closed = (code.match(/\bend\b/g) ?? []).length;
    // (One `if` opening and staying open: its frame its condition)
    if (opened === closed + 1 && ifs === 1 && /^\s*if\b/.test(code)) frames.push({ condition: code });
    else for (let i = 0; i < opened - closed; i++) frames.push({});
    for (let i = 0; i < closed - opened; i++) frames.pop();
  }
}

/** Whether a condition holds only where `guard` does: the guard joined by `and`, no `or` beside it */
const holdsOnly = (condition, guard) => condition !== undefined && !/\bor\b/.test(condition) && new RegExp(`(?:^\\s*(?:if|elseif)|\\band)\\s+${guard}(?=\\s+(?:and|then)\\b)`).test(condition);

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Why a page's blocks of the plugin run when it is refused, as text, or undefined: each `js.window` guard also says
 * `not silverware_internal.<key>.refused`, joined by `and`, and nothing is defined (a command, a slash command, a
 * listener, a code widget, a syntax, a view) outside an `if` saying so. Read line by line: a condition over several
 * lines, or the guard in parentheses, is told as unguarded (written on one line, as the pages are)
 */
export function validateGuarded(page, key) {
  const guard = escaped(`not silverware_internal.${key}.refused`);
  for (const [block] of page.matchAll(/^```space-lua\n[\s\S]*?^```$/gm)) {
    if (block.startsWith(`\`\`\`space-lua\n${GATE_MARK}`)) continue;
    let problem;
    walk(block, (code, frames, line) => {
      if (problem) return;
      if (/^\s*(if|elseif)\b.*\bjs\.window\b/.test(code) && !holdsOnly(code, guard))
        problem = `runs where the gate refuses it: "${line.trim()}" checks no "and not silverware_internal.${key}.refused"`;
      else if (/\b(command|slashCommand|event|codeWidget|syntax|view)\.(define|listen)\b/.test(code) && !frames.some((frame) => holdsOnly(frame.condition, guard)))
        problem = `runs where the gate refuses it: "${line.trim()}" outside an if saying "and not silverware_internal.${key}.refused"`;
    });
    if (problem) return problem;
  }
  return undefined;
}

/**
 * Why a page of the plugin `key` takes another plugin's function that its gate may have replaced with a stub (`stubs`,
 * each plugin's key to its API's functions), as text, or undefined: the function is named only in an `if` saying that
 * plugin was not refused (`and not (silverware_internal.<other> and silverware_internal.<other>.refused)`) or inside
 * one; a refused plugin's stubs only refuse, and would break the plugin calling them. The function named through its
 * plugin's table alone is seen (a local alias of `silverware.<other>` is not: the pages name it whole)
 */
export function validateOthersTaken(page, key, stubs) {
  for (const [block] of page.matchAll(/^```space-lua\n[\s\S]*?^```$/gm)) {
    let problem;
    walk(block, (code, frames, line) => {
      for (const [, other, name] of code.matchAll(/\bsilverware\.(\w+)\.(\w+)\b/g)) {
        if (problem || other === key || !stubs[other]?.includes(name)) continue;
        const text = `not (silverware_internal.${other} and silverware_internal.${other}.refused)`;
        const guard = escaped(text);
        // (In the if's own condition: the guard before any call of the function, which would run the stub first)
        const own = /^\s*(if|elseif)\b/.test(code) && holdsOnly(code, guard) && !new RegExp(`silverware\\.${other}\\.${name}\\s*\\(`).test(code.slice(0, code.search(guard)));
        if (!own && !frames.some((frame) => holdsOnly(frame.condition, guard))) problem = `takes ${other}'s ${name} where its gate may have refused it: "${line.trim()}" is in no if saying "and ${text}"`;
      }
    });
    if (problem) return problem;
  }
  return undefined;
}

/** The plugins' pages: the gate's (its API page, else its init page) and each with Space Lua of its own */
export async function gatePages(library) {
  const read = (path) =>
    readFile(path, "utf8")
      .then((text) => text.replaceAll("\r\n", "\n"))
      .catch(() => undefined);
  const api = await read(`${library}/${library}-api.md`);
  const init = await read(`${library}/${library}-init.md`);
  const index = (await read(`${library}/${library}.md`)) ?? "";
  const title = /^# (.+)$/m.exec(index)?.[1];
  return { api, init, title, gatePath: api !== undefined ? `${library}/${library}-api.md` : `${library}/${library}-init.md` };
}

/** Writes each plugin's gate (or, with `check`, tells each page that differs and each block unguarded); how many failed */
export async function coreGates(check) {
  let problems = 0;
  // (Each plugin's API's functions, which its gate replaces with stubs where it refuses)
  const stubs = {};
  for (const library of Object.keys(NEEDS)) {
    const { api } = await gatePages(library);
    stubs[keyOf(library)] = api ? apiFunctionsOf(keyOf(library), api) : [];
  }
  for (const [library, need] of Object.entries(NEEDS)) {
    const key = keyOf(library);
    const { api, init, title, gatePath } = await gatePages(library);
    if (!title) {
      console.error(`${library}/${library}.md has no "# <name>" to name it by in its gate`);
      problems++;
      continue;
    }
    const page = api ?? init;
    const gated = withGate(page, gateBlock({ key, title, need, stubs: api ? apiFunctionsOf(key, api) : [] }));
    if (gated !== page) {
      if (check) {
        console.error(`${gatePath}: its gate differs from what scripts/coregate.mjs writes: run npm run build`);
        problems++;
      } else await writeFile(gatePath, gated);
    }
    for (const [path, text] of [
      [`${library}/${library}-api.md`, api],
      [`${library}/${library}-init.md`, init],
    ]) {
      const problem = text === undefined ? undefined : (validateGuarded(path === gatePath ? gated : text, key) ?? validateOthersTaken(text, key, stubs));
      if (problem) {
        console.error(`${path} ${problem}`);
        problems++;
      }
    }
  }
  return problems;
}
