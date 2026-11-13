import { describe, expect, it } from "vitest";
import { columnTemplate, DEFAULT_MAX_COLUMNS, validateColumns } from "./columns.ts";

describe("validateColumns", () => {
  it("takes a count of 1 to 12 and widths of fr, %, px or auto", () => {
    for (const value of ["1", "12", "1fr 2fr", "30% 70%", "200px 1fr auto", " 2 "]) expect(validateColumns(value), value).toBeUndefined();
  });

  it("says why not of others", () => {
    expect(validateColumns("")).toBe("no columns given");
    expect(validateColumns("0")).toBe("0 columns: from 1 to 12");
    expect(validateColumns("13")).toBe("13 columns: from 1 to 12");
    expect(validateColumns("1fr wide")).toBe('"wide" is no column\'s width (as 1fr, 30%, 200px or auto)');
  });
});

describe("columnTemplate", () => {
  it("makes a count equal columns, widths each, a share never wider than its content allows to shrink", () => {
    expect(columnTemplate("3", 2)).toBe("repeat(3, minmax(0, 1fr))");
    expect(columnTemplate("1fr 2fr", 2)).toBe("minmax(0, 1fr) minmax(0, 2fr)");
    expect(columnTemplate("200px 30% auto", 2)).toBe("200px 30% auto");
  });

  it("makes a column per cell where columns are none or not read, at most the default, one at least", () => {
    expect(columnTemplate(undefined, 2)).toBe("repeat(2, minmax(0, 1fr))");
    expect(columnTemplate("wide", 3)).toBe("repeat(3, minmax(0, 1fr))");
    expect(columnTemplate(undefined, 9)).toBe(`repeat(${DEFAULT_MAX_COLUMNS}, minmax(0, 1fr))`);
    expect(columnTemplate(undefined, 0)).toBe("repeat(1, minmax(0, 1fr))");
  });
});
