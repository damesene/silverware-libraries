// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { SettingsDialog } from "./settings.ts";
import type { ViewDefinition } from "./view.ts";
import { ViewRegistry } from "./views.ts";

const VIEWS: ViewDefinition[] = [
  { name: "board", label: "Board", icon: "B", settings: [{ key: "columns", label: "Columns", control: "number", default: 3 }, { key: "dense", label: "Dense", control: "switch", default: false }, { key: "look", label: "Look", control: "choice", choices: ["a", "b"], default: "a" }], render: () => {} },
  { name: "list", label: "List", icon: "L", render: () => {} },
];

function setup(configured: Record<string, unknown> = {}, canSave = true) {
  const saves: Record<string, unknown>[] = [];
  let saved = 0;
  const settings = {
    get: (path: string, fallback: unknown) => (path in configured ? configured[path] : fallback),
    ...(canSave ? { save: async (values: Readonly<Record<string, unknown>>) => void saves.push({ ...values }) } : {}),
  };
  const dialog = new SettingsDialog(document, { views: new ViewRegistry(VIEWS), settings, ui: { notify: () => {}, ask: () => true }, saved: () => void saved++ });
  const q = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
  return { dialog, saves, saved: () => saved, q };
}

afterEach(() => document.body.replaceChildren());

describe("the settings dialog", () => {
  it("shows each view's switch and its own settings, as configured or by their defaults", async () => {
    const { dialog, q } = setup({ "silverware.database.views.list.enabled": false, "silverware.database.views.board.columns": 5 });
    await dialog.open();
    expect(q<HTMLInputElement>('[data-swd-view="board"]').checked).toBe(true);
    expect(q<HTMLInputElement>('[data-swd-view="list"]').checked).toBe(false);
    expect(q<HTMLInputElement>('[data-swd-setting="silverware.database.views.board.columns"]').value).toBe("5");
    expect(q<HTMLButtonElement>(".swd-settings-save").disabled).toBe(true);
  });

  it("saves only what changed, a number that does not read kept back, then has what is shown drawn anew", async () => {
    const { dialog, saves, saved, q } = setup();
    await dialog.open();
    const columns = q<HTMLInputElement>('[data-swd-setting="silverware.database.views.board.columns"]');
    columns.value = "x";
    columns.dispatchEvent(new Event("input"));
    expect(columns.classList.contains("swd-settings-invalid")).toBe(true);
    columns.value = "4";
    columns.dispatchEvent(new Event("input"));
    const list = q<HTMLInputElement>('[data-swd-view="list"]');
    list.checked = false;
    list.dispatchEvent(new Event("change"));
    q<HTMLButtonElement>(".swd-settings-save").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(saves).toEqual([{ "silverware.database.views.board.columns": 4, "silverware.database.views.list.enabled": false }]);
    expect(saved()).toBe(1);
    expect(dialog.isOpen).toBe(false);
  });

  it("says where the settings cannot be saved", async () => {
    const { dialog, q } = setup({}, false);
    await dialog.open();
    expect(q(".swd-settings-note").textContent).toBe("Settings cannot be saved here.");
  });

  it("shows a value kept that is none of its choices as it is, so picking a choice is a change", async () => {
    const { dialog, q } = setup({ "silverware.database.views.board.look": "zzz" });
    await dialog.open();
    const select = q<HTMLSelectElement>('[data-swd-setting="silverware.database.views.board.look"]');
    expect(select.value).toBe("zzz");
    select.value = "a";
    select.dispatchEvent(new Event("change"));
    expect(q<HTMLButtonElement>(".swd-settings-save").disabled).toBe(false);
  });

  it("saves nothing while a number does not read, and opens once however often it is asked", async () => {
    const { dialog, q } = setup();
    await Promise.all([dialog.open(), dialog.open()]);
    expect(document.querySelectorAll(".swd-settings")).toHaveLength(1);
    const list = q<HTMLInputElement>('[data-swd-view="list"]');
    list.checked = false;
    list.dispatchEvent(new Event("change"));
    const columns = q<HTMLInputElement>('[data-swd-setting="silverware.database.views.board.columns"]');
    columns.value = "";
    columns.dispatchEvent(new Event("input"));
    expect(q<HTMLButtonElement>(".swd-settings-save").disabled).toBe(true);
  });
});
