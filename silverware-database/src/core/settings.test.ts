// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModuleDefinition } from "./module.ts";
import { SettingsDialog } from "./settings.ts";
import { pageSize } from "./general.ts";
import type { ViewDefinition } from "./view.ts";
import { ViewRegistry } from "./views.ts";

const VIEWS: ViewDefinition[] = [
  { name: "board", label: "Board", icon: "B", settings: [{ key: "columns", label: "Columns", control: "number", default: 3 }, { key: "dense", label: "Dense", control: "switch", default: false }, { key: "look", label: "Look", control: "choice", choices: ["a", "b"], default: "a" }], render: () => {} },
  { name: "list", label: "List", icon: "L", render: () => {} },
];

const MODULES: ModuleDefinition[] = [{ name: "peek", label: "Peek", description: "An item beside the page", settings: [{ key: "width", label: "Width", control: "number", default: 400 }], start: () => {} }];

function setup(configured: Record<string, unknown> = {}, canSave = true) {
  const saves: Record<string, unknown>[] = [];
  let saved = 0;
  const settings = {
    get: (path: string, fallback: unknown) => (path in configured ? configured[path] : fallback),
    ...(canSave ? { save: async (values: Readonly<Record<string, unknown>>) => void saves.push({ ...values }) } : {}),
  };
  const dialog = new SettingsDialog(document, { views: new ViewRegistry(VIEWS), modules: MODULES, settings, ui: { notify: () => {}, ask: () => true }, saved: () => void saved++ });
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
    await vi.waitFor(() => expect(saves).toEqual([{ "silverware.database.views.board.columns": 4, "silverware.database.views.list.enabled": false }]), { timeout: 5_000 });
    expect(saved()).toBe(1);
    expect(dialog.isOpen).toBe(false);
  });

  it("shows each module with its switch and its settings on the Modules tab, saved under silverware.database.modules", async () => {
    const { dialog, saves, saved, q } = setup({ "silverware.database.modules.peek.width": 500 });
    await dialog.open();
    const peek = q<HTMLInputElement>('[data-swd-module="peek"]');
    expect(peek.checked).toBe(true);
    const width = q<HTMLInputElement>('[data-swd-setting="silverware.database.modules.peek.width"]');
    expect(width.value).toBe("500");
    width.value = "320";
    width.dispatchEvent(new Event("input"));
    peek.checked = false;
    peek.dispatchEvent(new Event("change"));
    q<HTMLButtonElement>(".swd-settings-save").click();
    await vi.waitFor(() => expect(saves).toEqual([{ "silverware.database.modules.peek.width": 320, "silverware.database.modules.peek.enabled": false }]), { timeout: 5_000 });
    expect(saved()).toBe(1);
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

describe("Silverware Database's own settings", () => {
  it("are on the General tab: the items shown at first, 50 by default, one outside 10 to 10,000 or not whole kept back, said why", async () => {
    const { dialog, saves, q } = setup();
    await dialog.open();
    const size = q<HTMLInputElement>('[data-swd-setting="silverware.database.pageSize"]');
    expect(size.value).toBe("50");
    for (const wrong of ["5", "20000", "12.5"]) {
      size.value = wrong;
      size.dispatchEvent(new Event("input"));
      expect([wrong, size.classList.contains("swd-settings-invalid"), size.title.startsWith("Not saved: ")]).toEqual([wrong, true, true]);
      expect(q<HTMLButtonElement>(".swd-settings-save").disabled).toBe(true);
    }
    size.value = "120";
    size.dispatchEvent(new Event("input"));
    q<HTMLButtonElement>(".swd-settings-save").click();
    await vi.waitFor(() => expect(saves).toEqual([{ "silverware.database.pageSize": 120 }]), { timeout: 5_000 });
  });

  it("mark one configured outside its range as the dialog opens, holding no other change back; a number setting of no range taking any number", async () => {
    const { dialog, saves, q } = setup({ "silverware.database.pageSize": 5 });
    await dialog.open();
    const size = q<HTMLInputElement>('[data-swd-setting="silverware.database.pageSize"]');
    expect([size.classList.contains("swd-settings-invalid"), size.title]).toEqual([true, "Read as 50: 10 or more"]);
    expect(q<HTMLInputElement>('[data-swd-setting="silverware.database.modules.peek.width"]').step).toBe("any");
    const list = q<HTMLInputElement>('[data-swd-view="list"]');
    list.checked = false;
    list.dispatchEvent(new Event("change"));
    q<HTMLButtonElement>(".swd-settings-save").click();
    await vi.waitFor(() => expect(saves).toEqual([{ "silverware.database.views.list.enabled": false }]), { timeout: 5_000 });
  });

  it("are read as configured, the default where a hand wrote one outside the range", async () => {
    const read = (value: unknown) => pageSize({ get: (path: string, fallback: unknown) => (path === "silverware.database.pageSize" && value !== undefined ? value : fallback) });
    expect(await read(undefined)).toBe(50);
    expect(await read(200)).toBe(200);
    for (const wrong of [5, 20_000, 12.5, "100", null]) expect(await read(wrong)).toBe(50);
  });
});
