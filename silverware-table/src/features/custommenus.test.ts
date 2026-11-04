// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { LineMenuBuilder } from "../core/feature.ts";
import { clearCustomMenuEntries, customMenuEntries, defineCustomMenuEntries, type MenuEntriesContext } from "../menus/custom.ts";
import { buttonLabel, cell, flashes, menuButtons, PAGE, setup, useTablePage } from "../testing/page.ts";

describe("Custom menu entries in a row's or a column's menu", () => {
  useTablePage();
  afterEach(() => clearCustomMenuEntries());

  // Defined before the page is set up, as Space Lua defines them before a page shows
  const define = async (definitions: unknown) => {
    defineCustomMenuEntries(customMenuEntries(definitions).list);
    await setup(PAGE);
  };
  const openMenu = (row: number, axis: "row" | "column", column = 0) => {
    if (document.querySelector(".swt-menu")) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    cell(row, column).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    const grip = document.querySelector<HTMLElement>(axis === "row" ? ".swt-grip:not(.swt-grip-column)" : ".swt-grip-column")!;
    grip.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
    return document.querySelector(".swt-menu")!;
  };
  const labels = (menu: Element) => menuButtons(menu).map(buttonLabel);

  it("go where they say: a section of their own of primary or secondary actions, or beside the table's own of a kind", async () => {
    await define([
      {
        name: "mine",
        lineMenu: (context: MenuEntriesContext, menu: LineMenuBuilder) =>
          context.axis !== "column"
            ? []
            : [
                menu.slot.custom({ name: "Mine", position: "primary" }, [menu.item({ label: "Top one", run: () => undefined })]),
                menu.slot.view([menu.item({ label: "Viewed", run: () => undefined })]),
                menu.slot.custom({ name: "Later" }, [menu.item({ label: "Bottom one", run: () => undefined })]),
              ],
      },
    ]);
    const shown = labels(openMenu(1, "column", 1));
    const at = (label: string) => shown.indexOf(label);
    expect(at("Top one")).toBeGreaterThan(at("Clear column"));
    expect(at("Top one")).toBeLessThan(at("Insert column left"));
    expect(at("Viewed")).toBeGreaterThan(at("Filter this column"));
    expect(at("Viewed")).toBeLessThan(at("Align left"));
    expect(at("Bottom one")).toBeGreaterThan(at("Align right"));
    expect(at("Bottom one")).toBeLessThan(at("Delete column"));
    // A row's menu: none, as the definition says
    expect(labels(openMenu(1, "row"))).not.toContain("Top one");
  });

  it("are given the menu's line and its table as data; run, they close the menu", async () => {
    let given: MenuEntriesContext | undefined;
    let ran = 0;
    await define([
      {
        name: "mine",
        lineMenu: (context: MenuEntriesContext, menu: LineMenuBuilder) => {
          given = context;
          return [menu.slot.custom({ name: "Mine" }, [menu.item({ label: "Run it", run: () => void ran++ })])];
        },
      },
    ]);
    const menu = openMenu(2, "row");
    expect(given).toMatchObject({ axis: "row", at: 2, lines: [2], table: { columns: [{ name: "Name", key: "name" }, { name: "Qty", key: "qty" }] } });
    expect(given!.table.rows[given!.at - 1]).toEqual(["apple", "10"]);
    menuButtons(menu).find((b) => buttonLabel(b) === "Run it")!.click();
    expect(ran).toBe(1);
    expect(document.querySelector(".swt-menu")).toBeNull();
  });

  it("a submenu's entries made as it opens", async () => {
    let made = 0;
    await define([
      {
        name: "mine",
        lineMenu: (_: MenuEntriesContext, menu: LineMenuBuilder) => [
          menu.slot.custom({ name: "Mine" }, [
            menu.submenu({ label: "More" }, () => {
              made++;
              return [menu.item({ label: "Inside", run: () => undefined })];
            }),
          ]),
        ],
      },
    ]);
    const menu = openMenu(1, "column");
    expect(made).toBe(0);
    menuButtons(menu).find((b) => buttonLabel(b).startsWith("More"))!.click();
    expect(made).toBe(1);
    expect(labels(document.querySelector(".swt-menu")!)).toContain("Inside");
  });

  it("a definition that fails gives none, said once; an entry whose run fails is said, the menu going on", async () => {
    await define([
      { name: "broken", lineMenu: () => { throw new Error("oops"); } },
      { name: "wrong", lineMenu: () => "no list" },
      { name: "fine", lineMenu: (_: MenuEntriesContext, menu: LineMenuBuilder) => [menu.slot.custom({ name: "Fine" }, [menu.item({ label: "Fails", run: () => { throw new Error("bad"); } })])] },
    ]);
    // Asked again (another menu): not said again
    openMenu(1, "row");
    const menu = openMenu(2, "column", 1);
    expect(flashes.filter((f) => f.includes("broken"))).toEqual(["Silverware Table: the menu entries broken are not shown: oops"]);
    expect(flashes.filter((f) => f.includes("wrong"))).toHaveLength(1);
    menuButtons(menu).find((b) => buttonLabel(b) === "Fails")!.click();
    expect(flashes).toContain("Silverware Table: the menu entries fine failed: bad");
  });

  it("a submenu that fails as it opens is said; a position or priority none, an async lineMenu, give none and are said", async () => {
    await define([
      { name: "sub", lineMenu: (_: MenuEntriesContext, menu: LineMenuBuilder) => [menu.slot.custom({ name: "Sub" }, [menu.submenu({ label: "Broken" }, () => { throw new Error("no entries"); })])] },
      { name: "old", lineMenu: (_: MenuEntriesContext, menu: LineMenuBuilder) => [menu.slot.custom({ name: "Old", position: "top" as never }, [menu.item({ label: "Old one", run: () => undefined })])] },
      { name: "nan", lineMenu: (_: MenuEntriesContext, menu: LineMenuBuilder) => [menu.slot.custom({ name: "Nan", priority: Number.NaN }, [menu.item({ label: "Nan one", run: () => undefined })])] },
      { name: "later", lineMenu: async () => [] },
    ]);
    const menu = openMenu(1, "column");
    expect(labels(menu)).not.toContain("Old one");
    expect(labels(menu)).not.toContain("Nan one");
    expect(flashes).toContain(`Silverware Table: the menu entries old are not shown: a custom section's position is "primary" or "secondary", not "top"`);
    expect(flashes).toContain("Silverware Table: the menu entries nan are not shown: a custom section's priority is no number: NaN");
    expect(flashes.some((f) => f.startsWith("Silverware Table: the menu entries later are not shown: its lineMenu gave a promise"))).toBe(true);
    menuButtons(menu).find((b) => buttonLabel(b).startsWith("Broken"))!.click();
    expect(flashes).toContain("Silverware Table: the menu entries sub failed: no entries");
  });

  it("each definition is given its own copy of the context: one changing it changes nothing the next sees", async () => {
    const seen: string[][] = [];
    await define([
      { name: "first", lineMenu: (context: MenuEntriesContext) => { (context.table.rows as string[][]).reverse(); return []; } },
      { name: "second", lineMenu: (context: MenuEntriesContext) => { seen.push(context.table.rows.map((row) => row[0]!)); return []; } },
    ]);
    openMenu(1, "column");
    expect(seen).toEqual([["Pear", "apple", "Fig"]]);
  });
});
