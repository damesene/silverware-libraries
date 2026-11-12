// @vitest-environment jsdom
// The plugins' layers (shared/layers.ts): one scale every style page takes its z-index from, so one plugin's elements
// never come out over another's where they should not (a table's + showed over a database's peek, each page's own
// number deciding). The scale in order, set as CSS variables, and no style page laying anything over the page by a
// number of its own.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyLayers, type Layer, LAYERS, layerVariable } from "./layers.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");

/** Every plugin's style page */
const stylePages = () =>
  readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("silverware-"))
    .flatMap((entry) => readdirSync(join(root, entry.name)).filter((file) => file.endsWith("-style.md")).map((file) => `${entry.name}/${file}`));

describe("the plugins' layers", () => {
  it("are in order: a widget over the window, the controls, the menus, a sheet, its panels, the dialogs, what is dragged in them", () => {
    const order: Layer[] = ["lifted", "overWindow", "control", "menu", "sheet", "sheetPanel", "dialog", "dragged"];
    expect(Object.keys(LAYERS)).toEqual(order);
    const values = order.map((layer) => LAYERS[layer]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    // A plugin's own steps within a layer (calc(… + 7) at most) stay under the next one
    expect(LAYERS.menu - LAYERS.control).toBeGreaterThan(7);
  });

  it("are set as CSS variables on the root as a plugin starts, each named after its layer", () => {
    expect(layerVariable("sheetPanel")).toBe("--sw-layer-sheet-panel");
    applyLayers(document);
    for (const [layer, z] of Object.entries(LAYERS)) expect(document.documentElement.style.getPropertyValue(layerVariable(layer as Layer))).toBe(String(z));
  });

  it("every style page takes a layer it lays out by from them", () => {
    for (const page of stylePages()) {
      for (const [, name] of read(page).matchAll(/var\(--sw-layer-([a-z-]+)\)/g)) {
        expect(Object.keys(LAYERS).map((layer) => layerVariable(layer as Layer)), page).toContain(`--sw-layer-${name}`);
      }
    }
  });

  it("every z-index laying something over the page is one of them (under 30: the order within a widget)", () => {
    const pages = stylePages();
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) {
      const own = [...read(page).matchAll(/z-index:\s*(-?\d+)/g)].map(([, value]) => Number(value)).filter((value) => value >= 30);
      expect(own, page).toEqual([]);
    }
  });
});
