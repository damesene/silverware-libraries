// @vitest-environment jsdom
// A task in a cell as SilverBullet 2.12.1's markdownToHtml draws it (a task of another page: a link to its ref):
// the page's own, the link and the ref gone.
import { describe, expect, it } from "vitest";
import { ownTasks } from "./tasks.ts";

describe("a cell's tasks", () => {
  it("lose the link to their ref and the ref, their box and text kept", () => {
    const html =
      '<ul data-pos="4"><li data-pos="4"><span class="sb-task" data-external-task-ref="P@4" data-pos="6"><input type="checkbox" data-state=" " data-pos="6"> <a href="/P%404" class="wiki-link" data-ref="P@4">P@4</a> aaaabbb</span></li></ul>';
    expect(ownTasks(html)).toBe('<ul data-pos="4"><li data-pos="4"><span class="sb-task" data-pos="6"><input type="checkbox" data-state=" " data-pos="6"> aaaabbb</span></li></ul>');
  });

  it("enables a task's box SilverBullet drew disabled", () => {
    expect(ownTasks('<span class="sb-task" data-pos="2"><input type="checkbox" data-pos="2" disabled="disabled"> one</span>')).toBe('<span class="sb-task" data-pos="2"><input type="checkbox" data-pos="2"> one</span>');
  });

  it("leaves a link of the task's own text, and HTML without tasks, alone", () => {
    const html = '<span class="sb-task" data-external-task-ref="P@0"><input type="checkbox"> <a href="/P%400" class="wiki-link" data-ref="P@0">P@0</a> see <a class="wiki-link" data-ref="Other">Other</a></span>';
    expect(ownTasks(html)).toContain('<a class="wiki-link" data-ref="Other">Other</a>');
    expect(ownTasks("<p>plain</p>")).toBe("<p>plain</p>");
  });
});
