// Wrap in new grid over a host of memory: the blocks selected, the mode and the number of columns asked (the mode not
// where it is given), nothing where the user picks nothing or there is no block.
import { describe, expect, it } from "vitest";
import { type PutHost, wrapInNewGrid } from "./build.ts";

function hostOf(text: string, selection: { from: number; to: number }, picks: (number | undefined)[]) {
  const state = { asked: [] as string[], put: [] as unknown[][], problems: [] as string[] };
  const host: PutHost = {
    selection: async () => selection,
    pageText: async () => text,
    pick: async (label, options) => {
      state.asked.push(`${label}: ${options.map((one) => one.name).join(", ")}`);
      return picks.shift();
    },
    put: async (...args) => void state.put.push(args),
    problem: (message) => void state.problems.push(message),
  };
  return { state, host };
}

const TEXT = "Top\n\n- a\n- b\n- c\n\nEnd";

describe("Wrap in new grid", () => {
  it("asks the mode and the number of columns, and puts the blocks the selection touches", async () => {
    const { state, host } = hostOf(TEXT, { from: TEXT.indexOf("- a") + 1, to: TEXT.indexOf("- c") + 1 }, [1, 0]);
    await wrapInNewGrid(host);
    expect(state.asked).toEqual(["Wrap 3 blocks in a new grid: Gallery, Split", "How many columns: 2 columns, 3 columns, 4 columns, 5 columns, 6 columns, 7 columns, 8 columns"]);
    expect(state.put).toEqual([[TEXT.indexOf("- a"), TEXT.indexOf("- c") + 3, "- a\n- b\n- c", "split", 2]]);
  });

  it("asks the number of columns alone where the mode is given (a toolbar's button), its range too", async () => {
    const { state, host } = hostOf(TEXT, { from: 0, to: 0 }, [1]);
    await wrapInNewGrid(host, { mode: "gallery", from: TEXT.indexOf("End"), to: TEXT.indexOf("End") });
    // (A gallery's first choice: as many to a row as fit)
    expect(state.asked).toEqual(["How many columns: Auto, 2 columns, 3 columns, 4 columns, 5 columns, 6 columns, 7 columns, 8 columns"]);
    expect(state.put).toEqual([[TEXT.indexOf("End"), TEXT.length, "End", "gallery", 2]]);
  });

  it("puts a gallery of as many to a row as fit where Auto is picked", async () => {
    const { state, host } = hostOf(TEXT, { from: 0, to: 0 }, [0]);
    await wrapInNewGrid(host, { mode: "gallery", from: TEXT.indexOf("End"), to: TEXT.indexOf("End") });
    expect(state.put).toEqual([[TEXT.indexOf("End"), TEXT.length, "End", "gallery", "auto"]]);
  });

  it("puts nothing where the user picks nothing, says so where there is no block", async () => {
    const picked = hostOf(TEXT, { from: 0, to: 0 }, [undefined]);
    await wrapInNewGrid(picked.host);
    expect(picked.state.put).toEqual([]);
    const empty = hostOf("", { from: 0, to: 0 }, []);
    await wrapInNewGrid(empty.host);
    expect(empty.state.problems).toHaveLength(1);
  });
});
