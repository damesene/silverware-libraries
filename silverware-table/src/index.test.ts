// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { completion, evaluate, evaluated } from "./index.ts";
import { controller, setup, useTablePage } from "./testing/page.ts";

describe("silverware.table.evaluate: a formula calculated on the page shown", () => {
  useTablePage();
  // The controller as the library page's init leaves it, for the entry's functions to find
  const started = () => ((globalThis as Record<string, unknown>).__silverwareTable = controller);
  afterEach(() => delete (globalThis as Record<string, unknown>).__silverwareTable);

  const PAGE =
    `| Item | Qty | Price |\n|---|---|---|\n| Pear <meta core.n='pear'> | 3 | 1.5 |\n| Fig | 2 | 4 |\n| VAT | 21 <meta core.cn='vat'> | |\n| <meta core.table core.name='fruit'> |\n\n` +
    `| Note |\n|---|\n| unnamed |\n`;

  it("gives one value as its text: a named cell, a cell, a row's cell, a calculation", async () => {
    await setup(PAGE);
    started();
    expect(await evaluate("=fruit!vat")).toBe("21");
    expect(await evaluate("fruit!B2")).toBe("2");
    expect(await evaluate("=fruit!pear[price]")).toBe("1.5");
    expect(await evaluate("=SUM(fruit![qty]) * 2")).toBe("52");
    expect(await evaluate('=fruit!A1 & "!"')).toBe("Pear!");
  });

  it("gives several values as a JSON list of their texts, a range of one cell as its value", async () => {
    await setup(PAGE);
    started();
    expect(await evaluate("=fruit![item]")).toBe('["Pear","Fig","VAT"]');
    expect(await evaluate("=fruit!B1:C2")).toBe('["3","1.5","2","4"]');
    expect(await evaluate("=fruit!B1:B1")).toBe("3");
    expect(await evaluate('=fruit![item] & "?"')).toBe('["Pear?","Fig?","VAT?"]');
  });

  it("gives an error by its code: no table of its own, a table not named, a slip", async () => {
    await setup(PAGE);
    started();
    expect(await evaluate("=A1")).toBe("#REF!");
    expect(await evaluate("=nope!A1")).toBe("#REF!");
    expect(await evaluate("=1/0")).toBe("#DIV/0!");
    expect(await evaluate("=SUM(")).toMatch(/^#/);
  });

  it("reads another page's tables it refers to, and says which pages it read", async () => {
    const OTHER = `| Name | Cost |\n|---|---|\n| Fig | 7 |\n| <meta core.table core.name='prices'> |\n`;
    await setup(PAGE, {}, { readPage: () => OTHER });
    started();
    expect(await evaluate("=[[Prices]]prices!B1 + fruit!B1")).toBe("10");
    expect(await evaluated("=[[Prices]]prices!B1")).toEqual({ value: "7", pages: ["Prices"] });
    expect(await evaluated("=fruit!B1")).toEqual({ value: "3", pages: [] });
  });

  it("calculates on the text it is given (the page as the library page's Lua reads it)", async () => {
    await setup(PAGE);
    started();
    expect((await evaluated("=fruit!B1", PAGE.replace("| 3 |", "| 30 |"))).value).toBe("30");
  });

  describe("completion in a formula given to it, as SilverBullet's editor:complete asks", () => {
    const at = (line: string) => completion(line, 100 + line.length, PAGE);

    it("offers the functions a name typed may be, with their syntax, from where the name starts", async () => {
      await setup(PAGE);
      started();
      const line = 'x ${silverware.table.evaluate("=SUM(XLOO';
      const found = at(line)!;
      expect(found.from).toBe(100 + line.length - 4);
      expect(found.options.map((o) => o.label)).toEqual(["XLOOKUP("]);
      expect(found.options[0]).toMatchObject({ apply: "XLOOKUP(", type: "function" });
      expect(found.options[0]!.detail).toContain("XLOOKUP(");
    });

    it("offers the page's named tables, after one and ! its named cells; without the = and in apostrophes too", async () => {
      await setup(PAGE);
      started();
      expect(at('${silverware.table.evaluate("fru')!.options.map((o) => o.label)).toEqual(["fruit!"]);
      const cells = at("${silverware.table.evaluate('=fruit!v")!;
      expect(cells.options.map((o) => o.label)).toEqual(["vat"]);
      expect(cells.options[0]).toMatchObject({ type: "variable", detail: "cell" });
    });

    it("offers nothing outside such a formula, in a text in quotes, or with nothing that starts so", async () => {
      await setup(PAGE);
      started();
      expect(at("=SUM")).toBeUndefined();
      expect(at('${silverware.table.evaluate("=fruit!A1 & ')).toBeUndefined();
      expect(at('${silverware.table.evaluate("=zzqq')).toBeUndefined();
      expect(at('${silverware.table.evaluate("=SUM(1)") .. x')).toBeUndefined();
    });
  });

  it("is #N/A before Silverware Table starts, or with the formulas module off", async () => {
    expect(await evaluate("=1+1")).toBe("#N/A");
    await setup(PAGE, { "silverware.table.modules.formulas.enabled": false });
    started();
    expect(await evaluate("=1+1")).toBe("#N/A");
  });
});
