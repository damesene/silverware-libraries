// Put into grid over a host of memory: the blocks selected, the mode and the number of columns asked (the mode not
// where it is given), nothing where the user picks nothing or there is no block.
import { describe, expect, it } from "vitest";
import { type PutHost, putIntoGrid } from "./build.ts";

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

describe("Put into grid", () => {
  it("asks the mode and the number of columns, and puts the blocks the selection touches", async () => {
    const { state, host } = hostOf(TEXT, { from: TEXT.indexOf("- a") + 1, to: TEXT.indexOf("- c") + 1 }, [1, 0]);
    await putIntoGrid(host);
    expect(state.asked).toEqual(["Put 3 blocks into a grid: Gallery, Split", "How many columns: 2 columns, 3 columns, 4 columns"]);
    expect(state.put).toEqual([[TEXT.indexOf("- a"), TEXT.indexOf("- c") + 3, "- a\n- b\n- c", "split", 2]]);
  });

  it("asks the number of columns alone where the mode is given (a toolbar's button), its range too", async () => {
    const { state, host } = hostOf(TEXT, { from: 0, to: 0 }, [1]);
    await putIntoGrid(host, { mode: "gallery", from: TEXT.indexOf("End"), to: TEXT.indexOf("End") });
    expect(state.asked).toEqual(["How many columns: 2 columns, 3 columns, 4 columns"]);
    expect(state.put).toEqual([[TEXT.indexOf("End"), TEXT.length, "End", "gallery", 3]]);
  });

  it("puts nothing where the user picks nothing, says so where there is no block", async () => {
    const picked = hostOf(TEXT, { from: 0, to: 0 }, [undefined]);
    await putIntoGrid(picked.host);
    expect(picked.state.put).toEqual([]);
    const empty = hostOf("", { from: 0, to: 0 }, []);
    await putIntoGrid(empty.host);
    expect(empty.state.problems).toHaveLength(1);
  });
});
