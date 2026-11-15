// @vitest-environment jsdom
// Files being uploaded told in a panel: a row each with its state, how many are done; gone a moment after the last.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHOWN_AFTER, showUploadProgress } from "./uploadprogress.ts";

const entries = [
  { name: "a.png", icon: "<svg></svg>" },
  { name: "b.pdf", icon: "<svg></svg>" },
];

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("files being uploaded, told", () => {
  it("are a row each, their states and how many are done", () => {
    const progress = showUploadProgress(document, entries);
    const head = () => progress.element.querySelector(".swa-upload-progress-head")!.textContent;
    const rows = () => [...progress.element.querySelectorAll(".swa-upload-progress-row")].map((row) => [row.querySelector(".swa-upload-progress-name")!.textContent, row.getAttribute("data-swa-upload")]);
    expect(progress.element.isConnected).toBe(true);
    expect(head()).toBe("Uploading 1 of 2…");
    progress.state(0, "uploading");
    progress.state(0, "done");
    progress.state(1, "uploading");
    expect(head()).toBe("Uploading 2 of 2…");
    expect(rows()).toEqual([
      ["a.png", "done"],
      ["b.pdf", "uploading"],
    ]);
    progress.state(1, "done");
    expect(head()).toBe("All 2 uploaded");
    progress.remove();
    expect(progress.element.isConnected).toBe(false);
  });

  it("stacks uploads at once in one column, taken away with the last; tells the line of how many are done alone", () => {
    const first = showUploadProgress(document, entries);
    const second = showUploadProgress(document, entries.slice(0, 1));
    const stacks = () => document.querySelectorAll(".swa-upload-progress-stack");
    expect(stacks()).toHaveLength(1);
    expect([...stacks()[0]!.children]).toEqual([first.element, second.element]);
    expect([...first.element.querySelectorAll("[role=status]")].map((one) => one.className)).toEqual(["swa-upload-progress-head"]);
    first.remove();
    expect(stacks()).toHaveLength(1);
    second.remove();
    expect(stacks()).toHaveLength(0);
  });

  it("goes a moment after the last is done, later where one failed", () => {
    vi.useFakeTimers();
    const done = showUploadProgress(document, entries.slice(0, 1));
    done.state(0, "done");
    expect(done.element.querySelector(".swa-upload-progress-head")!.textContent).toBe("Uploaded");
    done.finish();
    vi.advanceTimersByTime(SHOWN_AFTER.done + 300);
    expect(done.element.isConnected).toBe(false);
    const failed = showUploadProgress(document, entries);
    failed.state(0, "done");
    failed.state(1, "failed");
    expect(failed.element.querySelector(".swa-upload-progress-head")!.textContent).toBe("1 of 2 uploaded");
    failed.finish();
    vi.advanceTimersByTime(SHOWN_AFTER.done + 300);
    expect(failed.element.isConnected).toBe(true);
    vi.advanceTimersByTime(SHOWN_AFTER.failed);
    expect(failed.element.isConnected).toBe(false);
  });
});
