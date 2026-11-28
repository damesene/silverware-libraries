// Silverware Core's gate as scripts/coregate.mjs writes it into a plugin's page (its Lua run in SilverBullet:
// silverware-core/ui-tests/gate.spec.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apiFunctionsOf, GATE_MARK, gateBlock, keyOf, NEEDS, validateGuarded, validateOthersTaken, withGate } from "./coregate.mjs";
import { LIBRARIES } from "./libraries.mjs";

// (The repository's files, wherever vitest runs from)
const read = (path: string) => readFileSync(join(import.meta.dirname, "..", path), "utf8");

const block = gateBlock({ key: "table", title: "Silverware Table", need: "1.2", stubs: ["defineFunctions", "tables"] });

describe("the gate's block", () => {
  it("is Space Lua of priority 55, found by its mark", () => {
    expect(block.startsWith(`\`\`\`space-lua\n${GATE_MARK} `)).toBe(true);
    expect(block).toMatch(/^-- priority: 55$/m);
    expect(block.endsWith("\n```")).toBe(true);
  });

  it("imports the core in a pcall, so a core missing is caught, and never the plugin's bundle", () => {
    expect(block).toContain('pcall(js.importFromSpace, "Library/damesene/silverware-core.js")');
    expect(block).not.toContain("silverware-table.js");
  });

  it("refuses an older minor, an older major and a newer major, each saying what to do", () => {
    expect(block).toContain("major < 1 or (major == 1 and minor < 2)");
    expect(block).toContain('"Silverware Table needs Silverware Core 1.2 or later (installed " .. installed .. "): run Library: Update All, then reload the page"');
    expect(block).toContain('"Silverware Table needs Silverware Core 1.2 or later (not installed): run Library: Update All, then reload the page"');
    expect(block).toContain('elseif major > 1 then');
    expect(block).toContain('"Silverware Table works with Silverware Core 1.x only (installed " .. installed .. "): update Silverware Table: run Library: Update All, then reload the page"');
  });

  it("marks the plugin refused anew on each load of Space Lua, and its API's functions refuse with the message", () => {
    expect(block).toContain("silverware_internal.table.refused = nil\n");
    expect(block).toContain("    silverware_internal.table.refused = problem\n");
    expect(block).toContain("local function refused() error(problem) end");
    expect(block).toContain("    silverware.table.defineFunctions = refused\n    silverware.table.tables = refused\n");
  });

  it("has no stubs where the plugin has no API", () => {
    expect(gateBlock({ key: "assets_pdf", title: "Silverware Assets PDF", need: "1.0", stubs: [] })).not.toContain("refused()");
  });
});

describe("a page with the gate", () => {
  const page = "---\ntags: meta\n---\n# API\n\nText.\n\n```space-lua\n-- priority: 50\nx = 1\n```\n";

  it("has it before its first block of Space Lua", () => {
    expect(withGate(page, block)).toBe(`---\ntags: meta\n---\n# API\n\nText.\n\n${block}\n\n\`\`\`space-lua\n-- priority: 50\nx = 1\n\`\`\`\n`);
  });

  it("has it replaced, not added again", () => {
    const once = withGate(page, block);
    expect(withGate(once, block)).toBe(once);
    const other = gateBlock({ key: "table", title: "Silverware Table", need: "1.3", stubs: [] });
    expect(withGate(once, other)).toBe(withGate(page, other));
  });
});

describe("the plugin's blocks guarded", () => {
  it("each window's check also checks the plugin refused", () => {
    expect(validateGuarded("```space-lua\nif js and js.window and not silverware_internal.tags.refused then\nend\n```\n", "tags")).toBeUndefined();
    expect(validateGuarded("```space-lua\nif js and js.window then\nend\n```\n", "tags")).toContain('"if js and js.window then" checks no "and not silverware_internal.tags.refused"');
    expect(validateGuarded("```space-lua\nif js and js.window or silverware_internal.tags.refused then\nend\n```\n", "tags")).toBeDefined();
    expect(validateGuarded('```space-lua\ncommand.define { name = "X" }\n```\n', "tags")).toContain("outside an if");
    expect(validateGuarded('```space-lua\nif js and js.window and not silverware_internal.tags.refused then\n  command.define { name = "X" }\nend\n```\n', "tags")).toBeUndefined();
    expect(validateGuarded("```space-lua\nif js and js.window and not silverware_internal.table.refused then\nend\n```\n", "tags")).toBeDefined();
    expect(validateGuarded("```space-lua\nif js and js.window and x or not silverware_internal.tags.refused then\nend\n```\n", "tags")).toBeDefined();
  });

  it("each definition inside an if saying the plugin was not refused, however deep, never after it", () => {
    const guarded = (body: string) => validateGuarded(`\`\`\`space-lua\n${body}\n\`\`\`\n`, "tags");
    const define = 'command.define({ name = "X", run = function() f() end })';
    // Indented, yet in no guard: a block of its own, a loop
    expect(guarded(`do\n  ${define}\nend`)).toContain("outside an if");
    expect(guarded(`for _, n in ipairs(names) do\n  ${define}\nend`)).toContain("outside an if");
    // After the guard's end, or in its else
    expect(guarded(`if js and js.window and not silverware_internal.tags.refused then\n  f()\nend\n${define}`)).toContain("outside an if");
    expect(guarded(`if js and js.window and not silverware_internal.tags.refused then\n  f()\nelse\n  ${define}\nend`)).toContain("outside an if");
    // Deep inside it, past functions and loops closed on their own lines and one line
    expect(guarded(`if js and js.window and not silverware_internal.tags.refused then\n  local g = function() return 1 end\n  for _, n in ipairs(names) do\n    if n then\n      ${define}\n    end\n  end\nelseif not silverware_internal.tags.refused then\n  ${define}\nend`)).toBeUndefined();
    // Past an end on the same line, or taken as a value: defined all the same; a syntax and a view too
    expect(guarded(`if js and js.window and not silverware_internal.tags.refused then f() end ${define}`)).toContain("outside an if");
    expect(guarded(`local c = ${define}`)).toContain("outside an if");
    expect(guarded('syntax.define({ name = "X" })')).toContain("outside an if");
    expect(guarded('view.define({ name = "X" })')).toContain("outside an if");
    // A comment or a text naming `end` or `if` changes nothing
    expect(guarded(`if js and js.window and not silverware_internal.tags.refused then -- the end\n  f("end")\n  ${define}\nend`)).toBeUndefined();
  });
});

describe("another plugin's functions taken", () => {
  const stubs = { toolbar: ["defineActions"], layout: [] };
  const guard = "not (silverware_internal.toolbar and silverware_internal.toolbar.refused)";

  it("only under an if saying its gate did not refuse it", () => {
    expect(validateOthersTaken(`\`\`\`space-lua\nif silverware.toolbar and silverware.toolbar.defineActions and ${guard} then\n  silverware.toolbar.defineActions(x)\nend\n\`\`\`\n`, "assets", stubs)).toBeUndefined();
    expect(validateOthersTaken("```space-lua\nif silverware.toolbar and silverware.toolbar.defineActions then\n  silverware.toolbar.defineActions(x)\nend\n```\n", "assets", stubs)).toContain("in no if saying");
    expect(validateOthersTaken("```space-lua\nsilverware.toolbar.defineActions(x)\n```\n", "assets", stubs)).toContain("in no if saying");
  });

  it("the guard joined by and, the function within its if alone, a comment naming it left alone", () => {
    const taken = (body: string) => validateOthersTaken(`\`\`\`space-lua\n${body}\n\`\`\`\n`, "assets", stubs);
    expect(taken(`if silverware.toolbar.defineActions(x) and ${guard} then\nend`)).toContain("in no if saying");
    expect(taken(`if x or ${guard} then\n  silverware.toolbar.defineActions(x)\nend`)).toBeDefined();
    expect(taken(`if silverware.toolbar and ${guard} then\n  silverware.toolbar.defineActions(x)\nend\nsilverware.toolbar.defineActions(y)`)).toContain("in no if saying");
    expect(taken(`if silverware.toolbar and ${guard} then\n  f()\nelse\n  silverware.toolbar.defineActions(x)\nend`)).toBeDefined();
    expect(taken("-- Its actions go to silverware.toolbar.defineActions where it is there\nlocal s = \"silverware.toolbar.defineActions\"")).toBeUndefined();
  });

  it("leaves its own functions, and what no gate replaces (an `api` field)", () => {
    expect(validateOthersTaken("```space-lua\nsilverware.toolbar.defineActions(x)\nlocal a = silverware.layout.api\n```\n", "toolbar", stubs)).toBeUndefined();
    expect(validateOthersTaken("```space-lua\nlocal a = silverware.layout.api\n```\n", "assets", stubs)).toBeUndefined();
  });
});

describe("the repository's plugins", () => {
  it("each but the core has a need, a major.minor", () => {
    expect(Object.keys(NEEDS).sort()).toEqual(LIBRARIES.filter((name: string) => name !== "silverware-core").sort());
    for (const need of Object.values(NEEDS)) expect(need).toMatch(/^\d+\.\d+$/);
  });

  it("each library page requires the core", () => {
    for (const library of Object.keys(NEEDS)) expect(read(`${library}/${library}.md`), library).toMatch(/^requires:\n- \.\.\/silverware-core\/silverware-core\.md$/m);
  });

  it("an API's functions are read from its page, once each", () => {
    expect(apiFunctionsOf("tags", "function silverware.tags.a(x)\n  function silverware.tags.b()\nfunction silverware.tags.a()\nfunction silverware.other.c()\n")).toEqual(["a", "b"]);
    expect(apiFunctionsOf(keyOf("silverware-table"), read("silverware-table/silverware-table-api.md"))).toContain("defineFunctions");
  });

  it("a plugin's key is its folder's name past silverware-, as Lua names it", () => {
    expect(keyOf("silverware-assets-pdf")).toBe("assets_pdf");
  });
});
