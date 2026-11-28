// Where code goes (docs/silverware-core.md, *Where code goes*): shared/ is bundled into each plugin, so state at a
// module's top level is each plugin's own copy. What must be one per window is Silverware Core's; shared/ holds pure
// code, or state meant to be each plugin's own, and then listed here with why. Every file of shared/ is read line by
// line: a declaration at its top level holding mutable state fails (`let` or `var`; a `const` made by `new Map`, `Set`,
// `WeakMap`, `WeakSet`, `MutationObserver`, or an array, not typed `ReadonlyMap`, `ReadonlySet` or `readonly …[]` /
// `as const`; a class's `static` field not `readonly`), unless the list below names it. Its blind spot: state made by
// a call (`const cache = makeCache()`), which a line cannot tell from a constant: a reviewer's to catch.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED = import.meta.dirname;

/**
 * The state allowed, `<file>: <name>` with why. "Until step N": one per window, moved into Silverware Core by that
 * step of docs/silverware-core-work.md, which takes it off this list. The rest: each plugin's own on purpose.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  // One per window, to the core
  "formulas/registry.ts: custom": "until step 3: the custom functions' registry, one for Table and Database",
  "formulas/registry.ts: anew": "until step 3: the registry's reset on a load of Space Lua, with it",
  "formulas/parser.ts: parsed": "until step 3: the formulas' parse cache, with the engine",
  "silverbullet/widgetmenu.ts: watched": "until step 4: SilverBullet's widget menu's watcher of the document, the core's binding's",
  "menu.ts: problemIds": "until step 6: the menus' counter of ids, with the menus",
  // Each plugin's own
  "pages/parts.ts: parts": "a plugin's page parts are its own: no other plugin's types see them",
  "pages/parts.ts: partOf": "a plugin's page parts by name, with them",
  "clipboard.ts: copying": "the copy command's guard, around the plugin's own call",
  "intl.ts: numberFormats": "a cache of Intl's formats, the bundle's own",
  "intl.ts: dateFormats": "a cache of Intl's formats, the bundle's own",
  "table/model.ts: madeFrom": "the bundle's cache of tables made from their text",
};

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

const MUTABLE = /^(?:export\s+)?const\s+(\w+)\s*(:\s*[^=]+)?=\s*(new\s+(?:Map|Set|WeakMap|WeakSet|MutationObserver)\b|\[)/;

/** The names of a text's top-level declarations holding mutable state (and a class's static fields not readonly) */
export function mutableState(text: string): string[] {
  const found: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const variable = /^(?:export\s+)?(?:let|var)\s+(\w+)/.exec(line);
    if (variable) found.push(variable[1]!);
    const made = MUTABLE.exec(line);
    if (made) {
      const typed = made[2] ?? "";
      // (Its statement whole: an array may end on a later line with `as const`)
      let statement = line;
      for (let j = i + 1; !/;\s*(\/\/.*)?$/.test(statement) && j < lines.length; j++) statement += `\n${lines[j]}`;
      const readonly = made[3] === "[" ? /\breadonly\b/.test(typed) || /\bas const\s*;/.test(statement) : /\bReadonly(Map|Set)\b/.test(typed);
      // (An array that a call makes something else of, `[…].join("")`, is no array kept)
      const array = made[3] !== "[" || /\]\s*(as const\s*)?;\s*(\/\/.*)?$/.test(statement);
      if (!readonly && array) found.push(made[1]!);
    }
    const field = /^\s+(?:(?:private|protected|public)\s+)?static\s+(?!readonly\b)(?!(?:async\s+)?\w+\s*[(<])(\w+)\s*[:=;]/.exec(line);
    if (field) found.push(field[1]!);
  }
  return found;
}

describe("state at shared/'s modules' top level", () => {
  const found = files(SHARED).flatMap((file) => mutableState(readFileSync(file, "utf8")).map((name) => `${relative(SHARED, file).replace(/\\/g, "/")}: ${name}`));

  it("is each plugin's own on purpose, or to move into Silverware Core, and listed", () => {
    expect(found.filter((entry) => !(entry in ALLOWED))).toEqual([]);
  });

  it("lists nothing that is no longer there (an entry leaves as its step moves it)", () => {
    expect(Object.keys(ALLOWED).filter((entry) => !found.includes(entry))).toEqual([]);
  });
});

describe("reading a line", () => {
  it("finds let, var, a collection or an array not typed readonly, a static field not readonly", () => {
    expect(mutableState("let a = 1;\nexport var b;\nconst c = new Map<string, number>();\nconst d: string[] = [];\nclass E {\n  static f = 1;\n  private static g: number;\n}\n")).toEqual(["a", "b", "c", "d", "f", "g"]);
  });

  it("leaves constants typed readonly, arrays as const, static methods and readonly fields, and what is indented", () => {
    expect(mutableState('const a: ReadonlyMap<string, number> = new Map();\nconst b: ReadonlySet<string> = new Set();\nconst c: readonly string[] = [];\nconst d = [\n  "x",\n] as const;\nclass E {\n  static readonly f = 1;\n  static g() {}\n  static async h() {}\n}\nfunction i() {\n  let j = 1;\n  const k = new Map();\n}\nconst l = 1;\nconst m = [\n  "a",\n].join("");\n')).toEqual([]);
  });
});
