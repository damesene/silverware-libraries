// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fieldNodes, optionPill, pill, valueNodes } from "./values.ts";
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

describe("a person's mentions", () => {
  it("look as the page's mentions, and show where the person is mentioned as pressed, editing nothing, where the host shows it", () => {
    const types = new TypeRegistry();
    const params = { options: ["ada"] };
    const property = { key: "owner", label: "Owner", type: "person", params, readonly: false };
    const type = types.of("person", params);
    const opened: string[] = [];
    const made = optionPill(document, property, "ada", type, (name) => void opened.push(name));
    expect([made.className.includes("swd-mention"), made.getAttribute("role"), made.tabIndex]).toEqual([true, "link", 0]);
    const cell = document.createElement("td");
    let edited = 0;
    cell.addEventListener("click", () => void edited++);
    cell.append(made);
    made.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    made.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect([opened, edited]).toEqual([["ada", "ada"], 0]);
    // A color given its option: that color, no longer the page's mentions' look, still pressed
    const colored = optionPill(document, { ...property, params: { ...params, colors: { ada: "green" } } }, "ada", type, (name) => void opened.push(name));
    expect([colored.classList.contains("swd-mention"), colored.dataset.color, colored.getAttribute("role")]).toEqual([false, "2", "link"]);
    // (A host showing none: a mention's look, nothing to press; a select's: no mention)
    expect(optionPill(document, property, "ada", type).getAttribute("role")).toBeNull();
    expect(optionPill(document, { ...property, type: "select" }, "ada", types.of("select", params), () => {}).classList.contains("swd-mention")).toBe(false);
  });
});

describe("files as a view draws them", () => {
  const types = new TypeRegistry();
  const property = { key: "photos", label: "Photos", type: "files", params: {}, readonly: false };
  const item = (value: unknown) => ({ key: "a" as ItemKey, revision: "1", name: "A", values: { photos: value as string[] }, rank: undefined });
  const drawn: [string, number][] = [];
  const opened: string[] = [];
  const media = {
    draw: (target: string, box: { width: number }) => (drawn.push([target, box.width]), Object.assign(document.createElement("span"), { className: "swd-media", textContent: target })),
    open: (target: string) => void opened.push(target),
    files: async () => [],
  };
  const host = (withMedia = true) => ({ document, type: (one: typeof property) => types.of(one.type, one.params), text: (one: ReturnType<typeof item>) => types.of("files", {})!.text(one.values.photos, {}), openByName: async () => undefined, ...(withMedia ? { media } : {}) });
  const five = ["[[a.png]]", "[[b.png]]", "https://example.com/c.jpg", "[[d.pdf]]", "[[e.pdf]]"];

  it("draw a line's first three, the rest counted with their names; the peek's every one larger", () => {
    drawn.length = 0;
    const [line] = valueNodes(host() as never, item(five), property, { files: "small" }) as HTMLElement[];
    expect([...line!.querySelectorAll(".swd-media-button")].map((one) => one.getAttribute("aria-label"))).toEqual(["Open a.png", "Open b.png", "Open c.jpg"]);
    expect(line!.querySelector(".swd-media-more")!.textContent).toBe("+2");
    expect(line!.querySelector<HTMLElement>(".swd-media-more")!.title).toBe("d.pdf, e.pdf");
    expect(drawn).toEqual([["a.png", 84], ["b.png", 84], ["https://example.com/c.jpg", 84]]);
    const [large] = valueNodes(host() as never, item(five), property, { files: "large" }) as HTMLElement[];
    expect(large!.querySelectorAll(".swd-media-button")).toHaveLength(5);
    expect(large!.querySelector(".swd-media-more")).toBeNull();
    expect(drawn.at(-1)).toEqual(["e.pdf", 240]);
  });

  it("open a file pressed, the press not reaching what holds it (a cell's editor)", () => {
    const cell = document.createElement("td");
    let edited = 0;
    cell.addEventListener("click", () => void edited++);
    cell.append(...valueNodes(host() as never, item(["[[a.png]]"]), property, { files: "small" }));
    cell.querySelector<HTMLButtonElement>(".swd-media-button")!.click();
    expect([opened.at(-1), edited]).toEqual(["a.png", 0]);
  });

  it("show their names where no size is asked (a calendar's line), where the host draws no files, or where the value does not read", () => {
    const names = (nodes: Node[]) => nodes.map((one) => one.textContent).join("");
    expect(names(valueNodes(host() as never, item(["[[a.png]]", "[[b.pdf]]"]), property))).toBe("a.png, b.pdf");
    expect(names(fieldNodes(host() as never, item(["[[a.png]]"]), property))).toBe("a.png");
    expect(names(valueNodes(host(false) as never, item(["[[a.png]]"]), property, { files: "small" }))).toBe("a.png");
    expect(names(valueNodes(host() as never, item(["a.png"]), property, { files: "small" }))).toBe("a.png");
    expect(valueNodes(host() as never, item([]), property, { files: "small" })).toEqual([]);
  });
});
