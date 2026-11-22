// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markSidePanel, sidePanelOpen, watchSidePanel } from "./sidepanel.ts";
import { ENDED_MS } from "./watchmark.ts";

// Fake timers: the watcher's moment (ENDED_MS) passes as the test moves it, not as a loaded machine lets a real wait end
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const panel = () => {
  const element = document.createElement("aside");
  markSidePanel(element, true);
  return element;
};

describe("A side panel", () => {
  it("is open while an element marked so is in the document, whoever's, several at once", async () => {
    const told: boolean[] = [];
    const stop = watchSidePanel(document, (open) => told.push(open));
    const one = panel();
    const other = panel();
    document.body.append(one);
    await vi.advanceTimersByTimeAsync(0);
    expect(sidePanelOpen(document)).toBe(true);
    expect(told).toEqual([true]);
    document.body.append(other);
    one.remove();
    await vi.advanceTimersByTimeAsync(ENDED_MS);
    // (The other still open: no end told)
    expect(told).toEqual([true]);
    other.remove();
    await vi.advanceTimersByTimeAsync(ENDED_MS);
    expect(told).toEqual([true, false]);
    stop();
  });

  it("drawn anew (the old one gone, the new one marked a moment later) is not closed", async () => {
    const told: boolean[] = [];
    const stop = watchSidePanel(document, (open) => told.push(open));
    const one = panel();
    document.body.append(one);
    await vi.advanceTimersByTimeAsync(0);
    one.remove();
    await vi.advanceTimersByTimeAsync(ENDED_MS / 2);
    document.body.append(panel());
    await vi.advanceTimersByTimeAsync(ENDED_MS);
    expect(told).toEqual([true]);
    stop();
  });
});
