// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { evaluate } from "./index.ts";
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

  it("reads another page's tables it refers to", async () => {
    const OTHER = `| Name | Cost |\n|---|---|\n| Fig | 7 |\n| <meta core.table core.name='prices'> |\n`;
    await setup(PAGE, {}, { readPage: () => OTHER });
    started();
    expect(await evaluate("=[[Prices]]prices!B1 + fruit!B1")).toBe("10");
  });

  it("is #N/A before Silverware Table starts, or with the formulas module off", async () => {
    expect(await evaluate("=1+1")).toBe("#N/A");
    await setup(PAGE, { "silverware.table.modules.formulas.enabled": false });
    started();
    expect(await evaluate("=1+1")).toBe("#N/A");
  });
});
