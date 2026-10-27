// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Action } from "./action.ts";
import { Popup } from "./popup.ts";

const action = (id: string, extra: Partial<Action> = {}): Action => ({ id, label: id, icon: "", group: "G", ...extra });

/** The popup open on actions, what it shows */
function open(actions: readonly Action[], choices?: Action) {
  const popup = new Popup(document);
  popup.open({ actions, state: () => ({ active: false, enabled: true }), rect: undefined, viewTop: 0, run: () => undefined, closed: () => undefined, ...(choices ? { choices } : {}) });
  const shown = () => Array.from(document.querySelectorAll(".swb-option")).map((o) => (o as HTMLElement).dataset.swbAction);
  const current = () => (document.querySelector(".swb-option.swb-current") as HTMLElement | null)?.dataset.swbAction;
  return { popup, shown, current };
}

afterEach(() => document.body.replaceChildren());

describe("The popup's actions read anew (setActions)", () => {
  it("lists them, the one current kept where it is still there", () => {
    const { popup, shown, current } = open([action("a"), action("b")]);
    document.querySelector(".swb-option:nth-child(3)")!.dispatchEvent(new Event("mousemove"));
    expect(current()).toBe("b");
    popup.setActions([action("a"), action("b"), action("c")]);
    expect(shown()).toEqual(["a", "b", "c"]);
    expect(current()).toBe("b");
    // Gone: the first
    popup.setActions([action("a"), action("c")]);
    expect(current()).toBe("a");
  });

  it("keeps the choices shown, found among the new actions (new objects of the same id): back goes to it", () => {
    const list = () => action("turn", { choices: [action("x"), action("y")] });
    const first = list();
    const { popup, shown, current } = open([action("a"), first], first);
    expect(shown()).toEqual(["x", "y"]);
    popup.setActions([action("a"), list()]);
    expect(shown()).toEqual(["x", "y"]);
    (document.querySelector(".swb-back") as HTMLButtonElement).click();
    expect(current()).toBe("turn");
  });
});
