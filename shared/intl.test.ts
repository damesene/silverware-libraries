// The browser's formatters kept: the same one for the same locale and options, another for others.
import { describe, expect, it } from "vitest";
import { dateTimeFormat, numberFormat } from "./intl.ts";

describe("formatters", () => {
  it("are made once per locale and options (making one is slow, a column or a sheet formats every cell)", () => {
    expect(numberFormat("en", { maximumFractionDigits: 2 })).toBe(numberFormat("en", { maximumFractionDigits: 2 }));
    expect(numberFormat("en", { maximumFractionDigits: 1 })).not.toBe(numberFormat("en", { maximumFractionDigits: 2 }));
    expect(numberFormat(undefined)).not.toBe(numberFormat("en"));
    // (What the browser refuses is refused still, after a formatter of a key alike is kept)
    expect(() => numberFormat("")).toThrow(RangeError);
    numberFormat("en", { maximumFractionDigits: 0 });
    expect(() => numberFormat("en", { maximumFractionDigits: NaN })).toThrow(RangeError);
    expect(dateTimeFormat("en", { dateStyle: "short" })).toBe(dateTimeFormat("en", { dateStyle: "short" }));
    expect(dateTimeFormat("en", { dateStyle: "short" }).format(new Date(Date.UTC(2026, 10, 16, 12)))).toBe(new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(new Date(Date.UTC(2026, 10, 16, 12))));
  });
});
