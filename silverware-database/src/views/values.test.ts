// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { optionPill, pill } from "./values.ts";
import { TypeRegistry } from "../domain/types/registry.ts";
import { itemColor } from "../core/look.ts";
import type { ItemKey } from "../model/database.ts";

describe("pills", () => {
  it("show an own color as picked where it reads, a too light or too dark one at a lightness that does, its hue kept", () => {
    const shown = (color: `#${string}`) => pill(document, "x", color).style.getPropertyValue("--swd-pill");
    expect(shown("#3a7bd5")).toBe("58, 123, 213");
    // Yellow at full light would be text on nearly its own ground: darkened, still yellow
    const [r, g, b] = shown("#ffff00").split(", ").map(Number);
    expect([r === g, b, r! < 200]).toEqual([true, 0, true]);
    expect(shown("#000010")).not.toBe("0, 0, 16");
  });

  it("show a palette's color by its place, none where the value is none of the options", () => {
    expect(pill(document, "x", 9).dataset.color).toBe("1");
    expect(pill(document, "x", undefined).classList.contains("swd-pill-none")).toBe(true);
  });
});

describe("a person's pills", () => {
  it("show the name as a mention, one none of the options marked unless Anyone takes it, then colored by its name", () => {
    const types = new TypeRegistry();
    const owner = (params: Record<string, unknown>) => ({ key: "owner", label: "Owner", type: "person", params, readonly: false });
    const made = (params: Record<string, unknown>, name: string) => {
      const property = owner(params);
      return optionPill(document, property, name, types.of("person", params));
    };
    expect([made({ options: ["ada"] }, "ada").textContent, made({ options: ["ada"] }, "ada").dataset.color]).toEqual(["@ada", "0"]);
    expect(made({ options: ["ada"] }, "eve").classList.contains("swd-pill-none")).toBe(true);
    const anyone = made({ options: ["ada"], anyone: true }, "eve");
    // (A color of the palette, the same for the same name)
    // Color by the person: the same color as its pill, a name none of the options too with Anyone
    const by = (params: Record<string, unknown>) => ({ property: owner(params), type: types.of("person", params)! });
    const eve = { key: "eve" as ItemKey, revision: "1", name: "Eve's", values: { owner: "eve" }, rank: undefined };
    expect(itemColor(eve, by({ options: ["ada"], anyone: true }))).toBe(Number(anyone.dataset.color));
    expect(itemColor(eve, by({ options: ["ada"] }))).toBeUndefined();
    expect([anyone.classList.contains("swd-pill-none"), /^\d$/.test(anyone.dataset.color ?? ""), made({ options: ["ada"], anyone: true }, "eve").dataset.color]).toEqual([false, true, anyone.dataset.color]);
  });
});
