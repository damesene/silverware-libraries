// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectionWatcher } from "./selection.ts";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** A page's text with a word selected in it, the watcher started on it and what it told */
function watched() {
  vi.useFakeTimers();
  const content = document.createElement("div");
  content.className = "cm-content";
  content.textContent = "The end";
  document.body.append(content);
  const told: (string | undefined)[] = [];
  const watcher = new SelectionWatcher(document, (range) => told.push(range?.toString()), () => false);
  watcher.start();
  const select = () => {
    const range = document.createRange();
    range.setStart(content.firstChild!, 4);
    range.setEnd(content.firstChild!, 7);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  };
  return { watcher, told, select };
}

describe("The selection watcher", () => {
  it("tells a selection a moment after it changed", () => {
    const { watcher, told, select } = watched();
    select();
    expect(told).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(told).toEqual(["end"]);
    watcher.stop();
  });

  it("tells not the selection waited for once dismissed (Esc as the focus brought it back), and again once it changes", () => {
    const { watcher, told, select } = watched();
    select();
    vi.advanceTimersByTime(500);
    // The same selection given back (the editor focused as a popup closed), Esc pressed at once
    document.dispatchEvent(new Event("selectionchange"));
    watcher.dismiss();
    vi.advanceTimersByTime(500);
    expect(told).toEqual(["end"]);
    select();
    vi.advanceTimersByTime(500);
    expect(told).toEqual(["end", "end"]);
    watcher.stop();
  });

  it("tells not the caret's move waited for once dismissed", () => {
    vi.useFakeTimers();
    const content = document.createElement("div");
    content.className = "cm-content";
    content.textContent = "The end";
    document.body.append(content);
    const moved: number[] = [];
    const watcher = new SelectionWatcher(document, () => undefined, () => false, (range) => void moved.push(range.startOffset));
    watcher.start();
    document.getSelection()!.collapse(content.firstChild!, 2);
    // (jsdom's own selectionchange of it told first)
    vi.advanceTimersByTime(0);
    document.dispatchEvent(new Event("selectionchange"));
    watcher.dismiss();
    vi.advanceTimersByTime(500);
    expect(moved).toEqual([]);
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(500);
    expect(moved).toEqual([2]);
    watcher.stop();
  });
});
