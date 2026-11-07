import { describe, expect, it } from "vitest";
import { filterExcelFormula } from "./filter.ts";

describe("A filter as an Excel formula", () => {
  it("writes each part of the syntax as Excel's, the cell as given", () => {
    expect(filterExcelFormula("pear", "B2")).toBe('ISNUMBER(SEARCH("pear",B2))');
    expect(filterExcelFormula('say "hi"', "B2")).toBe('ISNUMBER(SEARCH("say ""hi""",B2))');
    expect(filterExcelFormula("=done|", "B2")).toBe('OR(TRIM(B2)="done",LEN(TRIM(B2))=0)');
    expect(filterExcelFormula(">=10", "C3")).toBe("AND(ISNUMBER(C3),C3>=10)");
    expect(filterExcelFormula("!open", "B2")).toBe('NOT(ISNUMBER(SEARCH("open",B2)))');
    expect(filterExcelFormula("<2|>10", "B2")).toBe("OR(AND(ISNUMBER(B2),B2<2),AND(ISNUMBER(B2),B2>10))");
    expect(filterExcelFormula("/a|b/", "B2")).toBe('_xlfn.REGEXTEST(B2,"a|b",1)');
    expect(filterExcelFormula("/^A.b/cs", "B2")).toBe('_xlfn.REGEXTEST(B2,"(?s)^A.b",0)');
  });

  it("gives nothing for what does not filter yet", () => {
    for (const typed of ["", "=", "!", "/ab", ">"]) expect(filterExcelFormula(typed, "B2"), typed).toBeUndefined();
  });
});
