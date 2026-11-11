// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { markOverWindow, OVER_WINDOW_ATTRIBUTE, overWindowShown, watchOverWindow } from "./overwindow.ts";

// The observer's records handled (a task)
const settled = () => new Promise((resolve) => setTimeout(resolve));
// An end told (it waits a moment: ENDED_MS)
const ended = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("What is shown over the whole window", () => {
  afterEach(() => document.body.replaceChildren());

  it("is any element marked, marked off again or taken out with its mark", () => {
    const view = document.createElement("div");
    document.body.append(view);
    expect(overWindowShown(document)).toBe(false);
    markOverWindow(view, true);
    expect(view.hasAttribute(OVER_WINDOW_ATTRIBUTE)).toBe(true);
    expect(overWindowShown(document)).toBe(true);
    markOverWindow(view, false);
    expect(overWindowShown(document)).toBe(false);
    markOverWindow(view, true);
    view.remove();
    expect(overWindowShown(document)).toBe(false);
  });

  it("is watched: told at once as the first is marked, a moment after the last is marked off (not for another between), and as one is put in or taken out marked", async () => {
    const told: boolean[] = [];
    const stop = watchOverWindow(document, (shown) => told.push(shown));
    const table = document.createElement("div");
    const database = document.createElement("div");
    document.body.append(table, database);
    markOverWindow(table, true);
    await settled();
    expect(told).toEqual([true]);
    markOverWindow(database, true);
    markOverWindow(table, false);
    await ended();
    expect(told).toEqual([true]);
    markOverWindow(database, false);
    await settled();
    expect(told).toEqual([true]);
    await ended();
    expect(told).toEqual([true, false]);
    // Put in marked (inside another element), taken out with its mark
    const board = document.createElement("div");
    board.append(document.createElement("div"));
    markOverWindow(board.firstElementChild!, true);
    document.body.append(board);
    await settled();
    board.remove();
    await ended();
    expect(told).toEqual([true, false, true, false]);
    stop();
    markOverWindow(table, true);
    await settled();
    expect(told).toEqual([true, false, true, false]);
  });

  it("does not end as its element is rendered anew: taken out, the new one marked a moment later", async () => {
    const told: boolean[] = [];
    const stop = watchOverWindow(document, (shown) => told.push(shown));
    const before = document.createElement("div");
    document.body.append(before);
    markOverWindow(before, true);
    await settled();
    before.remove();
    await settled();
    const after = document.createElement("div");
    document.body.append(after);
    markOverWindow(after, true);
    await ended();
    expect(told).toEqual([true]);
    stop();
  });
});
