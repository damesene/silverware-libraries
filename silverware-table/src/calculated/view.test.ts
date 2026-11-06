import { describe, expect, it } from "vitest";
import { FormulaError, Grid } from "../formulas/index.ts";
import { renamedViewIds, viewCalculated } from "./view.ts";

describe("a view's result as a calculated table", () => {
  it("names each column after its source column, else its letter, with ids by them", () => {
    const grid = Grid.ofRows(
      [
        ["anna", 3, "x", "y"],
        ["petr", null, "z", "w"],
      ],
      ["Assignee", "Hours", undefined, "assignee"],
    );
    const calculated = viewCalculated(grid);
    expect(calculated.columns).toEqual([
      { id: "name:Assignee", header: "Assignee", numeric: false },
      { id: "name:Hours", header: "Hours", numeric: true },
      { id: "at:3", header: "C", numeric: false },
      // A second column of the same source column (ignoring case)
      { id: "name:assignee:2", header: "assignee", numeric: false },
    ]);
    expect(calculated.body).toEqual([
      ["anna", "3", "x", "y"],
      ["petr", "", "z", "w"],
    ]);
    expect([calculated.totalRow, calculated.totalColumns]).toEqual([false, 0]);
  });

  it("right-aligns a column only where all its values not empty are numbers; an error is its code", () => {
    const calculated = viewCalculated(Grid.ofRows([[1, new FormulaError("#DIV/0!", "")], [null, 2]], ["A", "B"]));
    expect(calculated.columns.map((c) => c.numeric)).toEqual([true, false]);
    expect(calculated.body[0]).toEqual(["1", "#DIV/0!"]);
    // A column of empty cells only: not numbers
    expect(viewCalculated(Grid.ofRows([[null]], ["A"])).columns[0]!.numeric).toBe(false);
  });

  it("moves the renamed headers' ids to their source columns' new names", () => {
    const renames = { "name:Assignee": "Who", "name:Assignee:2": "Who too", "at:2": "Second", "name:Hours": "Time" };
    expect(renamedViewIds(renames, new Map([["assignee", "Owner"]]))).toEqual({ "name:Owner": "Who", "name:Owner:2": "Who too", "at:2": "Second", "name:Hours": "Time" });
    expect(renamedViewIds(renames, new Map())).toBe(renames);
  });
});
