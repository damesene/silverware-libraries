// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { openConflict } from "./conflictdialog.ts";
import type { ItemConflict, Result } from "./core.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function conflict(force: () => Promise<Result>): ItemConflict {
  return {
    problem: '"Fix login" changed since it was shown: left as it is',
    written: () => false,
    preview: async () => ({ documents: [{ document: "Tasks/Fix login", runs: [{ line: 2, removed: ["status: Doing"], added: ["status: Done"] }] }] }),
    force,
  };
}

afterEach(() => document.body.replaceChildren());

describe("a conflict's dialog", () => {
  it("shows the lines writing yours would change on each page, a page opened from it", async () => {
    const opened: string[] = [];
    openConflict({ document, open: (name) => void opened.push(name) }, conflict(async () => ({ problem: "x", cause: "left" })));
    await settle();
    expect(document.querySelector(".swd-conflict-name")!.textContent).toBe("Tasks/Fix login");
    expect([...document.querySelectorAll(".swd-diff-removed, .swd-diff-added")].map((one) => one.textContent)).toEqual(["status: Doing", "status: Done"]);
    document.querySelector<HTMLButtonElement>(".swd-conflict-open")!.click();
    expect(opened).toEqual(["Tasks/Fix login"]);
  });

  it("makes Open a link to the page where it has an address: a click opens it in the editor, Ctrl or a middle click left to the browser", async () => {
    const opened: string[] = [];
    openConflict({ document, open: (name) => void opened.push(name), href: (name) => `/${name}` }, conflict(async () => ({ problem: "x", cause: "left" })));
    await settle();
    const link = document.querySelector<HTMLAnchorElement>("a.swd-conflict-open")!;
    expect(link.getAttribute("href")).toBe("/Tasks/Fix login");
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(plain);
    // (Ctrl: left to the browser, its default seen before jsdom would follow it, which it cannot)
    let left = false;
    link.addEventListener("click", (event) => {
      left = !event.defaultPrevented;
      event.preventDefault();
    });
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));
    expect([opened, plain.defaultPrevented, left]).toEqual([["Tasks/Fix login"], true, true]);
  });

  it("opens one dialog of a conflict however often Show conflict is pressed; one written over only closes", async () => {
    const one = conflict(async () => ({ problem: "x", cause: "left" }));
    openConflict({ document }, one);
    openConflict({ document }, one);
    expect(document.querySelectorAll(".swd-conflict")).toHaveLength(1);
    document.querySelector<HTMLButtonElement>(".swd-settings-cancel")!.click();
    openConflict({ document }, { ...one, written: () => true });
    expect([document.querySelector<HTMLButtonElement>(".swd-conflict-force")!.hidden, document.querySelector(".swd-settings-cancel")!.textContent]).toEqual([true, "Close"]);
  });

  it("keeps the dialog where Write mine is refused but for a new conflict, saying why once", async () => {
    openConflict({ document }, conflict(async () => ({ problem: "The name is taken", cause: "invalid" })));
    for (let i = 0; i < 2; i++) {
      document.querySelector<HTMLButtonElement>(".swd-conflict-force")!.click();
      await settle();
    }
    expect([...document.querySelectorAll(".swd-conflict-failed")].map((one) => one.textContent)).toEqual(["Not written: The name is taken"]);
    expect(document.querySelector<HTMLButtonElement>(".swd-conflict-force")!.disabled).toBe(false);
  });

  it("writes mine by force, then closes and tells the places; Keep theirs closes, nothing written", async () => {
    let forced = 0;
    let written = 0;
    openConflict({ document, written: () => void written++ }, conflict(async () => (forced++, { report: { database: "tasks", written: [], skipped: [], created: new Map() } })));
    document.querySelector<HTMLButtonElement>(".swd-conflict-force")!.click();
    await settle();
    expect([forced, written, document.querySelector(".swd-conflict")]).toEqual([1, 1, null]);
    openConflict({ document }, conflict(async () => (forced++, { problem: "x", cause: "left" })));
    [...document.querySelectorAll<HTMLButtonElement>(".swd-settings-cancel")].find((one) => one.textContent === "Keep theirs")!.click();
    expect([forced, document.querySelector(".swd-conflict")]).toEqual([1, null]);
  });
});
