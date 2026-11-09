// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { openConflict } from "./conflictdialog.ts";
import type { ItemConflict, Result } from "./core.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function conflict(force: () => Promise<Result>): ItemConflict {
  return {
    problem: '"Fix login" changed since it was shown: left as it is',
    written: () => false,
    lines: [{ name: "Fix login", document: "Tasks/Fix login", field: "Status", shown: "Todo", now: "Doing", wanted: "Done" }],
    preview: async () => ({ documents: [{ document: "Tasks/Fix login", runs: [{ line: 2, removed: ["status: Doing"], added: ["status: Done"] }] }] }),
    force,
  };
}

afterEach(() => document.body.replaceChildren());

describe("a conflict's dialog", () => {
  it("shows what changed and the lines writing it would change, a page opened from it", async () => {
    const opened: string[] = [];
    openConflict({ document, open: (name) => void opened.push(name) }, conflict(async () => ({ problem: "x", cause: "left" })));
    await settle();
    const cells = [...document.querySelectorAll(".swd-conflict-lines tbody td")].map((one) => one.textContent);
    expect(cells).toEqual(["Fix login", "Status", "Todo", "Doing", "Done"]);
    expect([...document.querySelectorAll(".swd-diff-removed, .swd-diff-added")].map((one) => one.textContent)).toEqual(["status: Doing", "status: Done"]);
    document.querySelector<HTMLButtonElement>(".swd-conflict-open")!.click();
    expect(opened).toEqual(["Tasks/Fix login"]);
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
