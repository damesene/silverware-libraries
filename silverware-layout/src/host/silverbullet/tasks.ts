// A task in markdown rendered outside the editor (a grid's cell): SilverBullet's `markdownToHtml` draws it as a task of
// another page (2.12.1, probed 2026-11-13: `span.sb-task[data-external-task-ref="<page>@<offset>"]`, a wiki link to
// that ref before its text, the offset the cell's, not the page's), as a query's result shows one. In a cell it is the
// page's own: the link taken out (the user saw `page@30` before the task's text), the ref too (a click on its box
// would have SilverBullet toggle the task at that offset of the page, another place), its box the grid's to toggle.

/** A cell's HTML with its tasks as the page's own: no link to their ref, no ref, their box enabled (the grid toggles it) */
export function ownTasks(html: string): string {
  if (!html.includes("sb-task")) return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  // (SilverBullet draws a task's box disabled where it cannot toggle it itself: a click would reach nothing)
  for (const box of template.content.querySelectorAll<HTMLInputElement>('.sb-task > input[type="checkbox"]')) box.removeAttribute("disabled");
  for (const task of template.content.querySelectorAll<HTMLElement>("[data-external-task-ref]")) {
    const ref = task.getAttribute("data-external-task-ref");
    task.removeAttribute("data-external-task-ref");
    const link = [...task.querySelectorAll(":scope > a[data-ref]")].find((one) => one.getAttribute("data-ref") === ref);
    if (!link) continue;
    // (The space before the link kept, the one after it taken: `[ ] text`)
    const after = link.nextSibling;
    if (after?.nodeType === Node.TEXT_NODE) after.textContent = after.textContent!.replace(/^ /, "");
    link.remove();
  }
  return template.innerHTML;
}
