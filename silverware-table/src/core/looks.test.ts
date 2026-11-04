// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mergeLooks } from "./looks.ts";
import { applyCellLook } from "./silverbullet/looks.ts";

describe("Looks' vars", () => {
  it("merges the features' vars, a later one's value of a name winning, Silverware Table's own names only", () => {
    const merged = mergeLooks([
      { cells: [{ row: 1, column: 0, vars: { "--swt-a": "1", "--swt-b": "2" } }] },
      { cells: [{ row: 1, column: 0, vars: { "--swt-b": "3", color: "red", "--other": "x" } }] },
    ]);
    expect(merged.cells.get("1:0")!.vars).toEqual({ "--swt-a": "1", "--swt-b": "3" });
  });

  it("sets the vars on the cell and takes them back, a value the cell had before restored", () => {
    const td = document.createElement("td");
    td.style.setProperty("--swt-kept", "before");
    applyCellLook(td, { marks: ["x"], titles: [], vars: { "--swt-fill": "red", "--swt-kept": "now" } }, false);
    expect(td.style.getPropertyValue("--swt-fill")).toBe("red");
    expect(td.style.getPropertyValue("--swt-kept")).toBe("now");
    applyCellLook(td, undefined, false);
    expect(td.style.getPropertyValue("--swt-fill")).toBe("");
    expect(td.style.getPropertyValue("--swt-kept")).toBe("before");
    expect(td.classList.contains("swt-x")).toBe(false);
  });

  it("leaves a cell's look as it is when the same look comes again, changes it when it differs or what it shows is gone", () => {
    const td = document.createElement("td");
    td.textContent = "12.99";
    const look = { display: "€12.99", marks: ["cf"], titles: [], vars: { "--swt-cf-fill": "red" } };
    applyCellLook(td, look, false);
    const shown = td.firstChild;
    expect(td.textContent).toBe("€12.99");
    // The same look (another object): nothing made anew
    applyCellLook(td, { ...look, marks: ["cf"], vars: { "--swt-cf-fill": "red" } }, false);
    expect(td.firstChild).toBe(shown);
    // Another look: applied
    applyCellLook(td, { ...look, vars: { "--swt-cf-fill": "green" } }, false);
    expect(td.style.getPropertyValue("--swt-cf-fill")).toBe("green");
    expect(td.firstChild).not.toBe(shown);
    // What it shows taken out by someone else: the same look shows it again
    td.firstChild!.remove();
    applyCellLook(td, { ...look, vars: { "--swt-cf-fill": "green" } }, false);
    expect(td.textContent).toBe("€12.99");
    // None: taken back, its text as rendered
    applyCellLook(td, undefined, false);
    expect([td.textContent, td.classList.contains("swt-cf")]).toEqual(["12.99", false]);
  });
});
