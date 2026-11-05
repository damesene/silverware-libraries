// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { completions, defineFormulaPlaces, evaluated, evaluatedText, formulaErrorsIn, formulaErrorsTextIn, luaCallPlaces, onWrite, resetDefinitions, tables } from "./index.ts";
import { buttonLabel, cell, clickOn, controller, editor, edits, flush, key, menuButtons, nameInMenu, setup, text, toolbarName, useTablePage } from "./testing/page.ts";

describe("silverware.table.evaluate: a formula calculated on the page shown", () => {
  useTablePage();
  // The controller as the init page's init leaves it, for the entry's functions to find
  const started = () => ((globalThis as Record<string, unknown>).__silverwareTable = controller);
  afterEach(() => delete (globalThis as Record<string, unknown>).__silverwareTable);

  const PAGE =
    `| Item | Qty | Price |\n|---|---|---|\n| Pear <meta core.n='pear'> | 3 | 1.5 |\n| Fig | 2 | 4 |\n| VAT | 21 <meta core.cn='vat'> | |\n| <meta core.table core.name='fruit'> |\n\n` +
    `| Note |\n|---|\n| unnamed |\n`;

  const valueOf = async (formula: string) => (await evaluated(formula)).value;
  const textOf = async (formula: string) => (await evaluatedText(formula)).value;

  it("gives one value as a value: a named cell, a cell, a row's cell, a calculation, a date, a time, a logical value, none", async () => {
    await setup(PAGE);
    started();
    expect(await valueOf("=fruit!vat")).toBe(21);
    expect(await valueOf("fruit!B2")).toBe(2);
    expect(await valueOf("=fruit!pear[price]")).toBe(1.5);
    expect(await valueOf("=SUM(fruit![qty]) * 2")).toBe(52);
    expect(await valueOf('=fruit!A1 & "!"')).toBe("Pear!");
    expect(await valueOf("=DATE(2026, 11, 5)")).toBe("2026-11-05");
    expect(await valueOf("=TIME(14, 30, 0)")).toBe("14:30");
    expect(await valueOf("=fruit!B1 > 2")).toBe(true);
    // An empty cell: none, and no error
    expect(await evaluated("=fruit!C3")).toEqual({ value: null, pages: [] });
  });

  it("gives a range as a list, a range written as one however many cells: empty ones \"\", an error of one in its place", async () => {
    await setup(`${PAGE}\n| X |\n|---|\n| 5 |\n| <meta core.table core.name='one'> |\n`);
    started();
    expect(await valueOf("=fruit![item]")).toEqual(["Pear", "Fig", "VAT"]);
    expect(await valueOf("=fruit!B1:C2")).toEqual([3, 1.5, 2, 4]);
    expect(await valueOf("=fruit!B1:B1")).toEqual([3]);
    expect(await valueOf("=one![x]")).toEqual([5]);
    expect(await valueOf("=one!A1")).toBe(5);
    expect(await valueOf("=fruit![price]")).toEqual([1.5, 4, ""]);
    expect(await valueOf('=fruit![item] & "?"')).toEqual(["Pear?", "Fig?", "VAT?"]);
    const [error, ...rest] = (await valueOf("=fruit![qty] / (fruit![qty] - 3)")) as unknown[];
    expect(error).toMatchObject({ code: "#DIV/0!" });
    expect(rest[0]).toBe(-2);
  });

  it("gives an error of the formula as its code and why, the value none: no table of its own, a table not named, a slip", async () => {
    await setup(PAGE);
    started();
    expect(await evaluated("=A1")).toMatchObject({ value: null, error: { code: "#REF!" } });
    expect((await evaluated("=nope!A1")).error).toMatchObject({ code: "#REF!", detail: expect.stringContaining("nope") });
    expect((await evaluated("=1/0")).error?.code).toBe("#DIV/0!");
    expect((await evaluated("=SUM(")).error?.code).toMatch(/^#/);
  });

  it("gives text for a page, as a cell shows it: several joined, an error escaped so it is no hashtag", async () => {
    await setup(`${PAGE}\n| P |\n|---|\n| \\#DIV/0! |\n| <meta core.table core.name='pivot'> |\n`);
    started();
    expect(await textOf("=fruit!pear[price]")).toBe("1.5");
    expect(await textOf("=fruit![item]")).toBe("Pear, Fig, VAT");
    expect(await textOf("=fruit![price]")).toBe("1.5, 4, ");
    expect(await textOf("=fruit!C3")).toBe("");
    expect(await textOf("=nope!A1")).toBe("\\#REF!");
    expect(await textOf("=fruit![qty] / (fruit![qty] - 3)")).toMatch(/^\\#DIV\/0!, -2, /);
    // A pivot's cell holding an error: the error's code, as formulas read it; a text value as it is
    expect(await valueOf("=pivot!A1")).toBe("#DIV/0!");
    expect(await textOf("=pivot!A1")).toBe("\\#DIV/0!");
    expect(await textOf('="#" & "tag"')).toBe("#tag");
  });

  it("reads another page's tables it refers to, and says which pages it read", async () => {
    const OTHER = `| Name | Cost |\n|---|---|\n| Fig | 7 |\n| <meta core.table core.name='prices'> |\n`;
    await setup(PAGE, {}, { readPage: () => OTHER });
    started();
    expect(await valueOf("=[[Prices]]prices!B1 + fruit!B1")).toBe(10);
    expect(await evaluated("=[[Prices]]prices!B1")).toEqual({ value: 7, pages: ["Prices"] });
    expect(await evaluatedText("=[[Prices]]prices!B1")).toEqual({ value: "7", pages: ["Prices"] });
    expect(await evaluated("=fruit!B1")).toEqual({ value: 3, pages: [] });
  });

  it("calculates on the text it is given (the page as the init page's Lua reads it)", async () => {
    await setup(PAGE);
    started();
    expect((await evaluated("=fruit!B1", PAGE.replace("| 3 |", "| 30 |"))).value).toBe(30);
  });

  describe("silverware.table.errors: the errors formula cells show, on the pages given", () => {
    const BUDGET = `# Budget\n\n| Item | Total |\n|---|---|\n| Pear | \\#REF! <meta formulas.f='=nope!A1'> |\n| Fig | 2 <meta formulas.f='=1+1'> |\n| <meta core.table core.name='costs'> |\n\n| A | B |\n|---|---|\n| 1 | 0 <meta formulas.f='=[[Prices]]prices!B9'> |\n`;
    const PRICES = `| Name | Cost |\n|---|---|\n| Fig | 7 |\n| <meta core.table core.name='prices'> |\n`;

    it("gives each with its page, its row's place, its table, cell, column, code, why and formula, in the pages' and cells' order", async () => {
      await setup(PAGE, {}, { readPage: () => PRICES });
      started();
      const found = await formulaErrorsIn([{ page: "Budget", text: BUDGET }, { page: "Clean", text: PAGE }]);
      expect(found.errors).toEqual([
        { page: "Budget", ref: `Budget@${BUDGET.indexOf("| Pear")}`, table: "costs", cell: "B1", column: "total", code: "#REF!", detail: expect.stringContaining("nope"), formula: "=nope!A1" },
        // Calculated now, not as written: of another page read, its row past its table's
        { page: "Budget", ref: `Budget@${BUDGET.indexOf("| 1 |")}`, cell: "B1", column: "b", code: "#REF!", detail: expect.any(String), formula: "=[[Prices]]prices!B9" },
      ]);
      expect(found.pages).toEqual(["Prices"]);
      // A list as Lua gives it: a table of 1, 2, …
      expect((await formulaErrorsIn({ 1: { page: "Budget", text: BUDGET } })).errors).toHaveLength(2);
      // Its column as a reference names it: the second of two of one name
      const twice = `| Unit price | Unit price |\n|---|---|\n| 1 | 0 <meta formulas.f='=1/0'> |\n`;
      expect((await formulaErrorsIn([{ page: "Twice", text: twice }])).errors[0]).toMatchObject({ column: "unit_price:2", code: "#DIV/0!" });
    });

    it("gives records of markdown for a page: links, the code escaped so it is no hashtag; none, a line saying so", async () => {
      await setup(PAGE, {}, { readPage: () => PRICES });
      started();
      const [first] = (await formulaErrorsTextIn([{ page: "Budget", text: BUDGET }])).errors as Record<string, string>[];
      expect(first).toEqual({ page: "[[Budget]]", table: "costs", cell: `[[Budget@${BUDGET.indexOf("| Pear")}|B1]]`, error: "\\#REF!", reason: expect.stringContaining("nope") });
      expect(Object.keys(first!)).toEqual(["page", "table", "cell", "error", "reason"]);
      expect((await formulaErrorsTextIn([{ page: "Clean", text: PAGE }])).errors).toBe("No formula errors");
    });

    it("says the formulas are off, before Silverware Table starts or with the module off", async () => {
      expect(await formulaErrorsIn([])).toEqual({ errors: [], error: { code: "#N/A", detail: "formulas are off" }, pages: [] });
      expect((await formulaErrorsTextIn([])).errors).toBe("\\#N/A formulas are off");
    });
  });

  describe("completions of the name typed at the end of a formula", () => {
    const at = (formula: string) => completions(formula, PAGE);

    it("offers the functions a name typed may be, with their syntax and description, and how long the name is", async () => {
      await setup(PAGE);
      started();
      const found = at("=SUM(XLOO")!;
      expect(found.typed).toBe(4);
      expect(found.choices.map((c) => c.text)).toEqual(["XLOOKUP("]);
      expect(found.choices[0]).toMatchObject({ kind: "function" });
      expect(found.choices[0]!.syntax).toContain("XLOOKUP(");
      expect(found.choices[0]!.description).toBeTruthy();
    });

    it("offers the page's named tables, after one and ! its named cells; without the = too", async () => {
      await setup(PAGE);
      started();
      expect(at("fru")).toEqual({ typed: 3, choices: [{ text: "fruit!", kind: "table" }] });
      expect(at("=fruit!v")).toEqual({ typed: 1, choices: [{ text: "vat", kind: "cell" }] });
    });

    it("completes the name before the caret, given in the middle of the formula; none in the middle of a name", async () => {
      await setup(PAGE);
      started();
      expect(completions("=SUM(fruit!B1) + AVE)", PAGE, "=SUM(fruit!B1) + AVE".length)).toMatchObject({ typed: 3, choices: [{ text: "AVERAGE(" }, { text: "AVERAGEIFS(" }] });
      expect(completions("=SUM(fruit!B1)", PAGE, 3)).toBeUndefined();
      expect(completions("SUM(fru)", PAGE, 7)).toEqual({ typed: 3, choices: [{ text: "fruit!", kind: "table" }] });
    });

    it("offers nothing in a text in quotes, with nothing that starts so, or with the formulas module off", async () => {
      await setup(PAGE);
      started();
      expect(at('=fruit!A1 & "SU')).toBeUndefined();
      expect(at("=zzqq")).toBeUndefined();
      await setup(PAGE, { "silverware.table.modules.formulas.enabled": false });
      started();
      expect(at("=SU")).toBeUndefined();
    });
  });

  describe("for other plugins: a text's tables as data, edits written with the tables' writes", () => {
    const TABLE = "| Name | Price #euro <meta core.n='cost'> |\n|---|---|\n| Pear <meta core.n='pear'> | 12 |\n| Fig \\| date | 3 |\n| <meta core.table core.name='prices'> |\n";
    afterEach(() => {
      resetDefinitions();
      onWrite(() => []);
    });

    it("gives each table's name, place, columns and body as it shows", () => {
      const page = `Intro\n\n${TABLE}\n| A |\n|---|\n| x |\n`;
      const [named, plain] = tables(page);
      expect(named).toEqual({
        name: "prices",
        from: 7,
        to: 7 + TABLE.trimEnd().length,
        columns: [
          { name: "Name", key: "name" },
          { name: "cost", key: "price" },
        ],
        rows: [
          ["Pear", "12"],
          ["Fig | date", "3"],
        ],
      });
      expect(plain).toMatchObject({ columns: [{ name: "A", key: "a" }], rows: [["x"]] });
      expect(plain).not.toHaveProperty("name");
    });

    it("gives a formula's error as it shows, its # unescaped", () => {
      const [table] = tables("| A | B |\n|---|---|\n| \\#REF! <meta formulas.f='=x!A1'> | #tag |\n");
      expect(table!.rows).toEqual([["#REF!", "#tag"]]);
    });

    it("writes the listeners' edits in the same edit as the table, each told the text as the table was written", async () => {
      await setup(`${TABLE}\nChart: 12, 3\n`, { "silverware.table.metadata": true });
      const told: string[] = [];
      onWrite((written: string) => {
        told.push(written);
        const at = written.indexOf("Chart: ") + "Chart: ".length;
        const values = tables(written)[0]!.rows.map((row) => row[1]).join(", ");
        return [{ from: at, to: written.indexOf("\n", at), text: values }];
      });
      await controller.scan();
      clickOn(cell(1, 1));
      const field = editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
      field.value = "40";
      const writes = edits;
      key(field, "Enter");
      await flush();
      expect(edits).toBe(writes + 1);
      expect(told).toHaveLength(1);
      expect(told[0]).toContain("| Pear <meta core.n='pear'> | 40 |");
      expect(text.endsWith("Chart: 40, 3\n")).toBe(true);
    });

    it("tells a listener what the write renamed: the table's name now and a column's, by their names before or the table's place", async () => {
      await setup(`${TABLE}\nafter\n`, { "silverware.table.metadata": true });
      const seen: unknown[] = [];
      onWrite((written: string, context: { renamed(): boolean; table(name: string): { name?: string; column(name: string): string | undefined } | undefined; tableAt(at: number): { name?: string } | undefined }) => {
        seen.push({ renamed: context.renamed(), name: context.table("PRICES")?.name, Name: context.table("prices")?.column("name"), byKey: context.table("prices")?.column("price"), cost: context.table("prices")?.column("cost"), at: context.tableAt(3)?.name, none: context.table("nope"), outside: context.tableAt(written.length - 2) });
        return [];
      });
      await controller.scan();
      // A header renamed: the column of it renamed, the table's name as it was
      clickOn(cell(0, 0));
      const field = editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
      field.value = "Fruit";
      key(field, "Enter");
      await flush();
      expect(seen.at(-1)).toEqual({ renamed: true, name: "prices", Name: "Fruit", byKey: "cost", cost: "cost", at: "prices", none: undefined, outside: undefined });
      // The table renamed by its name in the toolbar
      await controller.scan();
      toolbarName("table");
      expect(await nameInMenu("costs")).toBeUndefined();
      // (its columns by their names before this write: "name" is Fruit's no more)
      expect(seen.at(-1)).toMatchObject({ renamed: true, name: "costs", Name: undefined, cost: "cost", at: "costs" });
    });

    it("leaves out an edit that touches a table, reaches past the text or overlaps another; a listener's throw writes the table all the same", async () => {
      await setup(`${TABLE}\nafter\n`, { "silverware.table.metadata": true });
      onWrite((written: string) => [
        { from: 0, to: 3, text: "x" },
        { from: 0, to: written.length + 5, text: "x" },
        { from: written.length - 6, to: written.length - 1, text: "AFTER" },
        { from: written.length - 5, to: written.length - 2, text: "y" },
        "nonsense",
      ]);
      onWrite(() => {
        throw new Error("broken");
      });
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      await controller.scan();
      toolbarName("table");
      expect(await nameInMenu("costs")).toBeUndefined();
      expect(text).toContain("core.name='costs'");
      expect(text.endsWith("\nAFTER\n")).toBe(true);
      expect(errors).toHaveBeenCalled();
      errors.mockRestore();
    });
  });

  describe("formulas written in the page's text, where the host's finder says: their references follow the tables' edits", () => {
    // (paste( is no call the finder is given: its formula stays as written)
    const LINES = (name: string, column: string, row: string) => `Total: \${te("=SUM(${name}![${column}])")}, the first: \${te('=${name}!B${row}')}, not this: \${paste("=prices!B1")}\n`;
    const TABLE = `| Name | Price |\n|---|---|\n| Pear | 12 |\n| Fig | 3 |\n| <meta core.table core.name='prices'> |\n\n`;
    afterEach(() => defineFormulaPlaces(undefined));

    it("follows a row inserted, a column renamed and the table renamed, each in the same edit as the table", async () => {
      await setup(TABLE + LINES("prices", "price", "1"), { "silverware.table.metadata": true });
      defineFormulaPlaces(luaCallPlaces("te"));
      // A row inserted above Pear, from its row menu: B1 is B2 now
      cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      document.querySelector(".swt-grip:not(.swt-grip-column)")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
      const writes = edits;
      menuButtons().find((b) => buttonLabel(b) === "Insert row above")!.click();
      await flush();
      expect(edits).toBe(writes + 1);
      expect(text.endsWith(LINES("prices", "price", "2"))).toBe(true);
      // The column renamed in its header
      await controller.scan();
      clickOn(cell(0, 1));
      const field = editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
      field.value = "Cost";
      key(field, "Enter");
      await flush();
      expect(text.endsWith(LINES("prices", "cost", "2"))).toBe(true);
      // The table renamed by its name in the toolbar
      await controller.scan();
      toolbarName("table");
      expect(await nameInMenu("costs")).toBeUndefined();
      expect(text.endsWith(LINES("costs", "cost", "2"))).toBe(true);
    });

    it("leaves them as written without a finder, and where the finder gives places that are none", async () => {
      await setup(TABLE + LINES("prices", "price", "1"), { "silverware.table.metadata": true });
      toolbarName("table");
      expect(await nameInMenu("costs")).toBeUndefined();
      expect(text.endsWith(LINES("prices", "price", "1"))).toBe(true);
      // Places out of the text, or overlapping: left out, the table still written
      defineFormulaPlaces(() => [{ from: -1, to: 3 }, { from: 0, to: 10 }, { from: 5, to: 4 }, { from: 2, to: 99999 }]);
      await controller.scan();
      toolbarName("table");
      expect(await nameInMenu("again")).toBeUndefined();
      expect(text).toContain("core.name='again'");
      expect(text.endsWith(LINES("prices", "price", "1"))).toBe(true);
    });
  });

  it("is #N/A before Silverware Table starts, or with the formulas module off", async () => {
    const OFF = { value: null, error: { code: "#N/A", detail: "formulas are off" }, pages: [] };
    expect(await evaluated("=1+1")).toEqual(OFF);
    await setup(PAGE, { "silverware.table.modules.formulas.enabled": false });
    started();
    expect(await evaluated("=1+1")).toEqual(OFF);
    expect((await evaluatedText("=1+1")).value).toBe("\\#N/A");
  });
});
