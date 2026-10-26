import { describe, expect, it } from "vitest";
import { CONFIG_PAGE, MANAGED_MARKER, saveConfigPage, toLua, withConfigSettings } from "./configpage.ts";

describe("A plugin's settings in the configuration page", () => {
  const block = (...lines: string[]) => "```space-lua\n" + [MANAGED_MARKER, ...lines].join("\n") + "\n```";

  it("adds the Configuration Manager's block where there is none, after what the page has", () => {
    expect(withConfigSettings("", { "silverware.table.metadata": true })).toBe(`${block('config.set("silverware.table.metadata", true)')}\n`);
    expect(withConfigSettings("# Configuration\n", { "silverware.table.maxHeight": 300 })).toBe(
      `# Configuration\n\n${block('config.set("silverware.table.maxHeight", 300)')}\n`,
    );
  });

  it("changes its own lines, adds new ones, and keeps every other line as written", () => {
    const page = [
      "# Configuration",
      "",
      "```space-lua",
      'config.set("theme", "dark")',
      "```",
      "",
      block('config.set("shortWikiLinks", true)', 'config.set("silverware.table.metadata", false)', 'command.update { name = "Navigate: Home", key = "Ctrl-h" }'),
      "",
      "Notes after it.",
      "",
    ].join("\n");
    const next = withConfigSettings(page, { "silverware.table.metadata": true, "silverware.table.modules.longText.overflow": 'ell"ipsis' });
    expect(next).toBe(
      page.replace(
        block('config.set("shortWikiLinks", true)', 'config.set("silverware.table.metadata", false)', 'command.update { name = "Navigate: Home", key = "Ctrl-h" }'),
        block(
          'config.set("shortWikiLinks", true)',
          'config.set("silverware.table.metadata", true)',
          'command.update { name = "Navigate: Home", key = "Ctrl-h" }',
          'config.set("silverware.table.modules.longText.overflow", "ell\\"ipsis")',
        ),
      ),
    );
  });

  it("keeps a page's CRLF line endings, finds single-quoted lines, leaves a value spanning lines (the line after it wins)", () => {
    const crlf = ["Intro", "", "```space-lua", MANAGED_MARKER, "config.set('silverware.table.metadata', false)", 'config.set("silverware.table.modules.filters", {', "  enabled = false,", "})", "```", ""].join("\r\n");
    expect(withConfigSettings(crlf, { "silverware.table.metadata": true, "silverware.table.modules.filters.enabled": true })).toBe(
      ["Intro", "", "```space-lua", MANAGED_MARKER, 'config.set("silverware.table.metadata", true)', 'config.set("silverware.table.modules.filters", {', "  enabled = false,", "})", 'config.set("silverware.table.modules.filters.enabled", true)', "```", ""].join("\r\n"),
    );
  });

  it("removes a setting back at its default, and the block once nothing is left in it", () => {
    const page = `Intro\n\n${block('config.set("silverware.table.metadata", true)', 'config.set("silverware.table.maxHeight", 300)')}\n\nEnd\n`;
    expect(withConfigSettings(page, { "silverware.table.maxHeight": undefined })).toBe(`Intro\n\n${block('config.set("silverware.table.metadata", true)')}\n\nEnd\n`);
    expect(withConfigSettings(page, { "silverware.table.maxHeight": undefined, "silverware.table.metadata": undefined })).toBe("Intro\n\n\nEnd\n");
    // Nothing to set, no block: the page as it was
    expect(withConfigSettings("Intro\n", { "silverware.table.metadata": undefined })).toBe("Intro\n");
  });

  it("writes a table as Lua on one line: lists, fields by name, a name that is no Lua name in brackets", () => {
    expect(toLua([[{ id: "actions.turnInto", show: "label" }], [{ id: "formats.bold" }, { type: "separator" }]])).toBe(
      '{ { { id = "actions.turnInto", show = "label" } }, { { id = "formats.bold" }, { type = "separator" } } }',
    );
    expect(toLua({ "a-b": 1, ok: true, gone: undefined })).toBe('{ ["a-b"] = 1, ok = true }');
    expect(toLua([])).toBe("{}");
    expect(toLua('say "hi"\n')).toBe('"say \\"hi\\"\\n"');
  });

  it("keeps a plugin's own block apart from the Configuration Manager's (which would drop a table it cannot read)", () => {
    const own = "-- managed-by: silverware-toolbar";
    const page = `# Configuration\n\n${block('config.set("silverware.toolbar.shortcut", "Ctrl-Shift-q")')}\n`;
    const favorites = [[{ id: "formats.bold" }]];
    const next = withConfigSettings(page, { "silverware.toolbar.favorites": favorites }, own);
    expect(next).toBe(`${page}\n\`\`\`space-lua\n${own}\nconfig.set("silverware.toolbar.favorites", { { { id = "formats.bold" } } })\n\`\`\`\n`);
    // Its line replaced in place; the Configuration Manager's block untouched
    expect(withConfigSettings(next, { "silverware.toolbar.favorites": [] }, own)).toBe(next.replace('{ { { id = "formats.bold" } } }', "{}"));
    expect(withConfigSettings(next, { "silverware.toolbar.favorites": undefined }, own)).toBe(`${page}\n`);
  });

  it("saves into the page read (none yet: made), writing nothing when it cannot be read or has a sync conflict", async () => {
    const saved: string[] = [];
    const access = (read: () => string | undefined) => ({ readPage: (name: string) => (expect(name).toBe(CONFIG_PAGE), read()), saveConfigPage: (text: string) => void saved.push(text) });
    await saveConfigPage(access(() => "Intro\n"), (text) => `${text}more\n`);
    await saveConfigPage(access(() => { throw new Error("Not found"); }), (text) => `${text}new\n`);
    expect(saved).toEqual(["Intro\nmore\n", "new\n"]);
    await expect(saveConfigPage(access(() => { throw new Error("offline"); }), (t) => t)).rejects.toThrow("offline");
    await expect(saveConfigPage(access(() => "<<<<<<< SB sha256:1\nx\n"), (t) => t)).rejects.toThrow("sync conflict");
    expect(saved).toHaveLength(2);
  });
});
